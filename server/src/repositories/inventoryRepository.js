import { readDb, writeDb } from "../database/db.js";

// Stock & Purchasing repository — unified bakery items, branches, batches, stock,
// suppliers, purchase orders and wastage. All queries are tenant-scoped and
// respect the soft-delete pattern (deleted_at IS NULL).

const ITEM_SELECT = `
  i.id, i.item_name, i.item_type, i.sku, i.unit,
  i.cost_price, i.selling_price, i.tax, i.discount,
  i.is_purchased, i.is_produced, i.is_sold,
  i.shelf_life_days, i.shelf_life_unit, i.low_stock_threshold,
  i.parent_item_id, i.variant_label, i.status,
  i.created_at, i.updated_at, i.category_id, i.tenant_id,
  c.category_name,
  COALESCE(SUM(sl.available_qty), 0) AS total_available,
  COALESCE(SUM(sl.reserved_qty), 0) AS total_reserved,
  COALESCE(SUM(sl.damaged_qty), 0) AS total_damaged
`;

const ITEM_FROM = `
  FROM items i
  LEFT JOIN item_categories c ON c.id = i.category_id AND c.deleted_at IS NULL
  LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.deleted_at IS NULL
`;

function tw(alias) {
  return `${alias}.tenant_id = ? AND ${alias}.deleted_at IS NULL`;
}

export const inventoryRepository = {
  // ── Dashboard ──────────────────────────────────────────────────────────────
  async dashboardStats(tenantId) {
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM items WHERE tenant_id = ? AND deleted_at IS NULL) AS item_count,
         (SELECT COUNT(*) FROM items WHERE tenant_id = ? AND deleted_at IS NULL AND item_type = 'ingredient') AS ingredient_count,
         (SELECT COUNT(*) FROM items WHERE tenant_id = ? AND deleted_at IS NULL AND item_type = 'finished') AS finished_count,
         (SELECT COUNT(*) FROM items WHERE tenant_id = ? AND deleted_at IS NULL AND item_type = 'packaging') AS packaging_count,
         (SELECT COUNT(*) FROM item_categories WHERE tenant_id = ? AND deleted_at IS NULL) AS category_count,
         (SELECT COUNT(*) FROM branches WHERE tenant_id = ? AND deleted_at IS NULL) AS branch_count,
         (SELECT COUNT(*) FROM suppliers WHERE tenant_id = ? AND deleted_at IS NULL) AS supplier_count,
         (SELECT COALESCE(SUM(available_qty), 0) FROM stock_levels WHERE tenant_id = ? AND deleted_at IS NULL) AS total_available,
         (SELECT COALESCE(SUM(sl.available_qty * i.cost_price), 0)
            FROM stock_levels sl JOIN items i ON i.id = sl.item_id AND i.deleted_at IS NULL
           WHERE sl.tenant_id = ? AND sl.deleted_at IS NULL) AS stock_value_cost,
         (SELECT COUNT(*) FROM purchase_orders WHERE tenant_id = ? AND deleted_at IS NULL AND status IN ('draft','ordered','partial')) AS open_purchase_orders,
         (SELECT COUNT(*) FROM stock_batches
           WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND qty_remaining > 0
             AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)) AS expiring_soon,
         (SELECT COUNT(*) FROM stock_batches
           WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active' AND qty_remaining > 0
             AND expiry_date IS NOT NULL AND expiry_date < CURDATE()) AS expired_batches,
         (SELECT COALESCE(SUM(estimated_cost), 0) FROM wastage
           WHERE tenant_id = ? AND deleted_at IS NULL
             AND wastage_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS wastage_cost_30d`,
      Array(13).fill(tenantId)
    );
    // low-stock count computed separately for clarity
    const [[{ low_stock_count }]] = await readDb.query(
      `SELECT COUNT(*) AS low_stock_count FROM (
         SELECT i.id
           FROM items i
           JOIN stock_levels sl ON sl.item_id = i.id AND sl.deleted_at IS NULL
          WHERE i.tenant_id = ? AND i.deleted_at IS NULL AND i.low_stock_threshold > 0
          GROUP BY i.id, i.low_stock_threshold
         HAVING SUM(sl.available_qty) <= i.low_stock_threshold
       ) t`,
      [tenantId]
    );
    return { ...stats, low_stock_count };
  },

  async lowStockItems(tenantId, limit = 10) {
    const [rows] = await readDb.query(
      `SELECT i.id, i.item_name, i.sku, i.unit, i.item_type, i.low_stock_threshold,
              c.category_name, COALESCE(SUM(sl.available_qty), 0) AS available_qty
       FROM items i
       LEFT JOIN item_categories c ON c.id = i.category_id AND c.deleted_at IS NULL
       LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.deleted_at IS NULL
       WHERE i.tenant_id = ? AND i.deleted_at IS NULL AND i.low_stock_threshold > 0
       GROUP BY i.id
       HAVING available_qty <= i.low_stock_threshold
       ORDER BY (available_qty / NULLIF(i.low_stock_threshold,0)) ASC
       LIMIT ?`,
      [tenantId, limit]
    );
    return rows;
  },

  async expiringBatches(tenantId, { withinDays = 7, limit = 200 } = {}) {
    const [rows] = await readDb.query(
      `SELECT b.id, b.batch_no, b.qty_remaining, b.expiry_date, b.made_on, b.status,
              b.item_id, b.branch_id, i.item_name, i.unit, br.branch_name,
              DATEDIFF(b.expiry_date, CURDATE()) AS days_left
       FROM stock_batches b
       JOIN items i ON i.id = b.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = b.branch_id AND br.deleted_at IS NULL
       WHERE b.tenant_id = ? AND b.deleted_at IS NULL AND b.status = 'active'
         AND b.qty_remaining > 0 AND b.expiry_date IS NOT NULL
         AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY b.expiry_date ASC
       LIMIT ?`,
      [tenantId, withinDays, limit]
    );
    return rows;
  },

  async recentMovements(tenantId, limit = 10) {
    const [rows] = await readDb.query(
      `SELECT m.id, m.movement_type, m.qty, m.unit_cost, m.notes, m.created_at,
              i.item_name, i.unit, br.branch_name, u.name AS created_by_name
       FROM stock_movements m
       JOIN items i ON i.id = m.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = m.branch_id AND br.deleted_at IS NULL
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.tenant_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [tenantId, limit]
    );
    return rows;
  },

  async stockByBranch(tenantId) {
    const [rows] = await readDb.query(
      `SELECT br.branch_name AS label,
              COUNT(DISTINCT sl.item_id) AS item_count,
              COALESCE(SUM(sl.available_qty), 0) AS available_qty,
              COALESCE(SUM(sl.available_qty * i.cost_price), 0) AS value_cost
       FROM branches br
       LEFT JOIN stock_levels sl ON sl.branch_id = br.id AND sl.deleted_at IS NULL
       LEFT JOIN items i ON i.id = sl.item_id AND i.deleted_at IS NULL
       WHERE br.tenant_id = ? AND br.deleted_at IS NULL
       GROUP BY br.id, br.branch_name
       ORDER BY value_cost DESC`,
      [tenantId]
    );
    return rows;
  },

  // ── Categories ─────────────────────────────────────────────────────────────
  async listCategories(tenantId, { limit, offset }) {
    const [rows] = await readDb.query(
      `SELECT c.id, c.category_name, c.item_type, c.status, c.created_at, c.tenant_id,
              COUNT(i.id) AS item_count
       FROM item_categories c
       LEFT JOIN items i ON i.category_id = c.id AND i.deleted_at IS NULL
       WHERE ${tw("c")}
       GROUP BY c.id
       ORDER BY c.category_name ASC
       LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM item_categories c WHERE ${tw("c")}`,
      [tenantId]
    );
    return { rows, total };
  },

  async getCategoryById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT id, category_name, item_type, status, created_at, tenant_id
       FROM item_categories WHERE id = ? AND ${tw("item_categories")} LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async findCategoryByName(tenantId, name, excludeId = null) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    const params = [tenantId, clean];
    let sql = `SELECT id, category_name FROM item_categories
               WHERE tenant_id = ? AND deleted_at IS NULL AND LOWER(TRIM(category_name)) = LOWER(?)`;
    if (excludeId != null) { sql += ` AND id != ?`; params.push(excludeId); }
    const [rows] = await readDb.query(sql + " LIMIT 1", params);
    return rows[0] || null;
  },

  async createCategory(tenantId, { category_name, item_type, status }) {
    const [r] = await writeDb.query(
      `INSERT INTO item_categories (category_name, item_type, status, tenant_id) VALUES (?, ?, ?, ?)`,
      [category_name, item_type || null, status, tenantId]
    );
    return r.insertId;
  },

  async updateCategory(tenantId, id, { category_name, item_type, status }) {
    await writeDb.query(
      `UPDATE item_categories SET category_name = ?, item_type = ?, status = ?
       WHERE id = ? AND ${tw("item_categories")}`,
      [category_name, item_type || null, status, id, tenantId]
    );
  },

  async softDeleteCategory(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE item_categories SET deleted_at = NOW() WHERE id = ? AND ${tw("item_categories")}`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  async getCategoryItems(tenantId, categoryId) {
    const [rows] = await readDb.query(
      `SELECT id, item_name, sku, item_type, status FROM items
       WHERE tenant_id = ? AND category_id = ? AND deleted_at IS NULL ORDER BY item_name ASC`,
      [tenantId, categoryId]
    );
    return rows;
  },

  // ── Items ──────────────────────────────────────────────────────────────────
  async listItems(tenantId, { limit, offset, item_type }) {
    const params = [tenantId];
    let typeFilter = "";
    if (item_type) { typeFilter = ` AND i.item_type = ?`; params.push(item_type); }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT ${ITEM_SELECT} ${ITEM_FROM}
       WHERE ${tw("i")}${typeFilter}
       GROUP BY i.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const countParams = item_type ? [tenantId, item_type] : [tenantId];
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM items i WHERE ${tw("i")}${item_type ? " AND i.item_type = ?" : ""}`,
      countParams
    );
    return { rows, total };
  },

  async getItemById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT ${ITEM_SELECT} ${ITEM_FROM} WHERE i.id = ? AND ${tw("i")} GROUP BY i.id LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async getItemStockLevels(tenantId, itemId) {
    const [rows] = await readDb.query(
      `SELECT sl.id, sl.available_qty, sl.reserved_qty, sl.damaged_qty, sl.updated_at,
              sl.item_id, sl.branch_id, br.branch_name, br.city
       FROM stock_levels sl
       JOIN branches br ON br.id = sl.branch_id AND br.deleted_at IS NULL
       WHERE sl.item_id = ? AND ${tw("sl")} ORDER BY br.branch_name ASC`,
      [itemId, tenantId]
    );
    return rows;
  },

  async getItemBatches(tenantId, itemId) {
    const [rows] = await readDb.query(
      `SELECT b.id, b.batch_no, b.qty_remaining, b.qty_received, b.unit_cost,
              b.made_on, b.expiry_date, b.status, b.branch_id, br.branch_name,
              DATEDIFF(b.expiry_date, CURDATE()) AS days_left
       FROM stock_batches b
       JOIN branches br ON br.id = b.branch_id AND br.deleted_at IS NULL
       WHERE b.item_id = ? AND ${tw("b")} AND b.qty_remaining > 0
       ORDER BY (b.expiry_date IS NULL) ASC, b.expiry_date ASC`,
      [itemId, tenantId]
    );
    return rows;
  },

  async findItemBySku(tenantId, sku, excludeId = null) {
    if (!sku) return null;
    const params = [tenantId, sku];
    let sql = `SELECT id FROM items WHERE tenant_id = ? AND sku = ? AND deleted_at IS NULL`;
    if (excludeId) { sql += ` AND id != ?`; params.push(excludeId); }
    const [rows] = await readDb.query(sql + " LIMIT 1", params);
    return rows[0] || null;
  },

  async createItem(tenantId, d) {
    const [r] = await writeDb.query(
      `INSERT INTO items
         (item_name, item_type, sku, unit, cost_price, selling_price, tax, discount,
          is_purchased, is_produced, is_sold, shelf_life_days, shelf_life_unit, low_stock_threshold,
          parent_item_id, variant_label, status, category_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.item_name, d.item_type, d.sku || null, d.unit, d.cost_price, d.selling_price,
       d.tax ?? 0, d.discount ?? 0, d.is_purchased ? 1 : 0, d.is_produced ? 1 : 0, d.is_sold ? 1 : 0,
       d.shelf_life_days ?? null, d.shelf_life_unit || "days", d.low_stock_threshold ?? 0, d.parent_item_id ?? null,
       d.variant_label ?? null, d.status, d.category_id, tenantId]
    );
    return r.insertId;
  },

  async updateItem(tenantId, id, d) {
    await writeDb.query(
      `UPDATE items SET item_name = ?, item_type = ?, sku = ?, unit = ?, cost_price = ?,
         selling_price = ?, tax = ?, discount = ?, is_purchased = ?, is_produced = ?, is_sold = ?,
         shelf_life_days = ?, shelf_life_unit = ?, low_stock_threshold = ?, parent_item_id = ?, variant_label = ?,
         status = ?, category_id = ?
       WHERE id = ? AND ${tw("items")}`,
      [d.item_name, d.item_type, d.sku || null, d.unit, d.cost_price, d.selling_price,
       d.tax ?? 0, d.discount ?? 0, d.is_purchased ? 1 : 0, d.is_produced ? 1 : 0, d.is_sold ? 1 : 0,
       d.shelf_life_days ?? null, d.shelf_life_unit || "days", d.low_stock_threshold ?? 0, d.parent_item_id ?? null,
       d.variant_label ?? null, d.status, d.category_id, id, tenantId]
    );
  },

  async softDeleteItem(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE items SET deleted_at = NOW() WHERE id = ? AND ${tw("items")}`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  async listItemsBrief(tenantId, { item_type = null, sellable = false, purchasable = false } = {}) {
    const params = [tenantId];
    let extra = "";
    if (item_type) { extra += ` AND i.item_type = ?`; params.push(item_type); }
    if (sellable) extra += ` AND i.is_sold = 1`;
    if (purchasable) extra += ` AND i.is_purchased = 1`;
    const [rows] = await readDb.query(
      `SELECT i.id, i.item_name, i.sku, i.unit, i.item_type, i.selling_price, i.cost_price,
              i.shelf_life_days, i.shelf_life_unit, i.is_sold, i.is_purchased, i.is_produced, i.category_id, c.category_name
       FROM items i
       LEFT JOIN item_categories c ON c.id = i.category_id AND c.deleted_at IS NULL
       WHERE ${tw("i")}${extra} ORDER BY i.item_name ASC`,
      params
    );
    return rows;
  },

  // ── Branches ───────────────────────────────────────────────────────────────
  async listBranches(tenantId, { limit, offset }) {
    const [rows] = await readDb.query(
      `SELECT br.id, br.branch_name, br.code, br.location, br.city, br.phone,
              br.open_time, br.close_time, br.opening_balance, br.status, br.created_at, br.tenant_id,
              COUNT(DISTINCT sl.item_id) AS item_count,
              COALESCE(SUM(sl.available_qty), 0) AS total_units
       FROM branches br
       LEFT JOIN stock_levels sl ON sl.branch_id = br.id AND sl.deleted_at IS NULL
       WHERE ${tw("br")}
       GROUP BY br.id ORDER BY br.branch_name ASC LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM branches br WHERE ${tw("br")}`,
      [tenantId]
    );
    return { rows, total };
  },

  async getBranchById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT br.id, br.branch_name, br.code, br.location, br.city, br.phone,
              br.open_time, br.close_time, br.opening_balance, br.status, br.created_at, br.tenant_id,
              COUNT(DISTINCT sl.item_id) AS item_count,
              COALESCE(SUM(sl.available_qty), 0) AS total_units,
              COALESCE(SUM(sl.available_qty * i.cost_price), 0) AS stock_value
       FROM branches br
       LEFT JOIN stock_levels sl ON sl.branch_id = br.id AND sl.deleted_at IS NULL
       LEFT JOIN items i ON i.id = sl.item_id AND i.deleted_at IS NULL
       WHERE br.id = ? AND ${tw("br")}
       GROUP BY br.id LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async getBranchStockLevels(tenantId, branchId) {
    const [rows] = await readDb.query(
      `SELECT sl.id, sl.available_qty, sl.reserved_qty, sl.damaged_qty, sl.updated_at,
              sl.item_id, i.item_name, i.sku, i.unit, i.item_type, i.cost_price, i.low_stock_threshold
       FROM stock_levels sl
       JOIN items i ON i.id = sl.item_id AND i.deleted_at IS NULL
       WHERE sl.branch_id = ? AND ${tw("sl")}
       ORDER BY i.item_name ASC`,
      [branchId, tenantId]
    );
    return rows;
  },

  async getBranchRecentMovements(tenantId, branchId, limit = 10) {
    const [rows] = await readDb.query(
      `SELECT m.id, m.movement_type, m.qty, m.unit_cost, m.notes, m.created_at,
              m.item_id, i.item_name, i.unit, u.name AS created_by_name
       FROM stock_movements m
       JOIN items i ON i.id = m.item_id AND i.deleted_at IS NULL
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.branch_id = ? AND m.tenant_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      [branchId, tenantId, limit]
    );
    return rows;
  },

  async getBranchWastageSummary(tenantId, branchId) {
    const [[row]] = await readDb.query(
      `SELECT COUNT(*) AS wastage_count,
              COALESCE(SUM(estimated_cost), 0) AS wastage_cost,
              COALESCE(SUM(qty), 0) AS wastage_qty
       FROM wastage
       WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [branchId, tenantId]
    );
    return row || { wastage_count: 0, wastage_cost: 0, wastage_qty: 0 };
  },

  async createBranch(tenantId, d) {
    const [r] = await writeDb.query(
      `INSERT INTO branches (branch_name, code, location, city, phone, open_time, close_time, opening_balance, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.branch_name, d.code || null, d.location || null, d.city || null, d.phone || null,
       d.open_time || null, d.close_time || null, d.opening_balance ?? 0, d.status, tenantId]
    );
    return r.insertId;
  },

  async updateBranch(tenantId, id, d) {
    await writeDb.query(
      `UPDATE branches SET branch_name = ?, code = ?, location = ?, city = ?, phone = ?,
         open_time = ?, close_time = ?, opening_balance = ?, status = ?
       WHERE id = ? AND ${tw("branches")}`,
      [d.branch_name, d.code || null, d.location || null, d.city || null, d.phone || null,
       d.open_time || null, d.close_time || null, d.opening_balance ?? 0, d.status, id, tenantId]
    );
  },

  async softDeleteBranch(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE branches SET deleted_at = NOW() WHERE id = ? AND ${tw("branches")}`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  async listBranchesBrief(tenantId) {
    const [rows] = await readDb.query(
      `SELECT id, branch_name, code, city, status FROM branches WHERE ${tw("branches")} ORDER BY branch_name ASC`,
      [tenantId]
    );
    return rows;
  },

  async countBranches(tenantId) {
    const [[row]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM branches WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    );
    return Number(row.total || 0);
  },

  async getTenantBranchLimit(tenantId) {
    const [rows] = await readDb.query(
      `SELECT max_warehouses FROM wh_tenant_limits WHERE tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [tenantId]
    );
    return Number(rows[0]?.max_warehouses || 0);
  },

  // ── Stock levels / batches / movements ──────────────────────────────────────
  async getStockLevel(tenantId, itemId, branchId) {
    const [rows] = await readDb.query(
      `SELECT id, available_qty, reserved_qty, damaged_qty FROM stock_levels
       WHERE item_id = ? AND branch_id = ? AND ${tw("stock_levels")} LIMIT 1`,
      [itemId, branchId, tenantId]
    );
    return rows[0] || null;
  },

  async listMovements(tenantId, { limit, offset, movement_type, item_id, branch_id }) {
    const params = [tenantId];
    let filter = "";
    if (movement_type) { filter += ` AND m.movement_type = ?`; params.push(movement_type); }
    if (item_id) { filter += ` AND m.item_id = ?`; params.push(item_id); }
    if (branch_id) { filter += ` AND m.branch_id = ?`; params.push(branch_id); }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT m.id, m.movement_type, m.qty, m.unit_cost, m.notes, m.created_at,
              m.item_id, m.branch_id, m.batch_id, m.reference_type, m.reference_id,
              i.item_name, i.unit, br.branch_name, u.name AS created_by_name, b.batch_no
       FROM stock_movements m
       JOIN items i ON i.id = m.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = m.branch_id AND br.deleted_at IS NULL
       LEFT JOIN stock_batches b ON b.id = m.batch_id
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.tenant_id = ? AND m.deleted_at IS NULL${filter}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
      params
    );
    const cParams = [tenantId];
    let cFilter = "";
    if (movement_type) { cFilter += ` AND movement_type = ?`; cParams.push(movement_type); }
    if (item_id) { cFilter += ` AND item_id = ?`; cParams.push(item_id); }
    if (branch_id) { cFilter += ` AND branch_id = ?`; cParams.push(branch_id); }
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM stock_movements WHERE tenant_id = ? AND deleted_at IS NULL${cFilter}`,
      cParams
    );
    return { rows, total };
  },

  async listBatches(tenantId, { limit, offset, status, expiring_days }) {
    const params = [tenantId];
    let filter = "";
    if (status) { filter += ` AND b.status = ?`; params.push(status); }
    if (expiring_days != null) {
      filter += ` AND b.expiry_date IS NOT NULL AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`;
      params.push(expiring_days);
    }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT b.id, b.batch_no, b.source_type, b.qty_received, b.qty_remaining, b.unit_cost,
              b.made_on, b.expiry_date, b.status, b.created_at, b.item_id, b.branch_id,
              i.item_name, i.unit, br.branch_name, DATEDIFF(b.expiry_date, CURDATE()) AS days_left
       FROM stock_batches b
       JOIN items i ON i.id = b.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = b.branch_id AND br.deleted_at IS NULL
       WHERE b.tenant_id = ? AND b.deleted_at IS NULL${filter}
       ORDER BY (b.expiry_date IS NULL) ASC, b.expiry_date ASC, b.id DESC
       LIMIT ? OFFSET ?`,
      params
    );
    const cParams = [tenantId];
    let cFilter = "";
    if (status) { cFilter += ` AND status = ?`; cParams.push(status); }
    if (expiring_days != null) {
      cFilter += ` AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`;
      cParams.push(expiring_days);
    }
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM stock_batches WHERE tenant_id = ? AND deleted_at IS NULL${cFilter}`,
      cParams
    );
    return { rows, total };
  },

  async getBatchById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT * FROM stock_batches WHERE id = ? AND ${tw("stock_batches")} LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  // ── Stock transfers ─────────────────────────────────────────────────────────
  async createTransfer(tenantId, userId, d) {
    const [r] = await writeDb.query(
      `INSERT INTO stock_transfers (qty, transfer_status, expiry_date, notes, item_id, from_branch_id, to_branch_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.qty, d.transfer_status, d.expiry_date || null, d.notes || null, d.item_id,
       d.from_branch_id, d.to_branch_id, userId, tenantId]
    );
    return r.insertId;
  },

  async listTransfers(tenantId, { limit, offset }) {
    const [rows] = await readDb.query(
      `SELECT t.id, t.qty, t.transfer_status, t.notes, t.created_at, t.updated_at,
              t.item_id, t.from_branch_id, t.to_branch_id,
              i.item_name, i.unit, fb.branch_name AS from_branch_name, tb.branch_name AS to_branch_name
       FROM stock_transfers t
       JOIN items i ON i.id = t.item_id AND i.deleted_at IS NULL
       JOIN branches fb ON fb.id = t.from_branch_id AND fb.deleted_at IS NULL
       JOIN branches tb ON tb.id = t.to_branch_id AND tb.deleted_at IS NULL
       WHERE t.tenant_id = ? AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM stock_transfers WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    );
    return { rows, total };
  },

  async getTransferById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT t.*, i.item_name, i.unit, fb.branch_name AS from_branch_name, tb.branch_name AS to_branch_name
       FROM stock_transfers t
       JOIN items i ON i.id = t.item_id AND i.deleted_at IS NULL
       JOIN branches fb ON fb.id = t.from_branch_id AND fb.deleted_at IS NULL
       JOIN branches tb ON tb.id = t.to_branch_id AND tb.deleted_at IS NULL
       WHERE t.id = ? AND t.tenant_id = ? AND t.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async updateTransferStatus(tenantId, id, status) {
    await writeDb.query(
      `UPDATE stock_transfers SET transfer_status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [status, id, tenantId]
    );
  },

  // ── Suppliers ────────────────────────────────────────────────────────────────
  async listSuppliers(tenantId, { limit, offset }) {
    const [rows] = await readDb.query(
      `SELECT s.id, s.supplier_name, s.contact_person, s.phone, s.email, s.address, s.city,
              s.status, s.notes, s.created_at, s.tenant_id,
              COUNT(po.id) AS purchase_order_count
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.deleted_at IS NULL
       WHERE ${tw("s")}
       GROUP BY s.id ORDER BY s.supplier_name ASC LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM suppliers s WHERE ${tw("s")}`,
      [tenantId]
    );
    return { rows, total };
  },

  async getSupplierById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT s.id, s.supplier_name, s.contact_person, s.phone, s.email, s.address, s.city,
              s.status, s.notes, s.created_at, s.tenant_id,
              COUNT(po.id) AS purchase_order_count,
              COALESCE(SUM(CASE WHEN po.status NOT IN ('cancelled') THEN po.payable_amount ELSE 0 END), 0) AS total_spend,
              COALESCE(SUM(CASE WHEN po.status IN ('draft', 'ordered', 'partial') THEN 1 ELSE 0 END), 0) AS open_po_count
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.deleted_at IS NULL
       WHERE s.id = ? AND ${tw("s")}
       GROUP BY s.id LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async getSupplierPurchaseOrders(tenantId, supplierId, limit = 20) {
    const [rows] = await readDb.query(
      `SELECT po.id, po.po_no, po.order_date, po.expected_date, po.status, po.payable_amount,
              po.created_at, br.branch_name, COUNT(poi.id) AS line_count
       FROM purchase_orders po
       JOIN branches br ON br.id = po.branch_id
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id AND poi.deleted_at IS NULL
       WHERE po.supplier_id = ? AND po.tenant_id = ? AND po.deleted_at IS NULL
       GROUP BY po.id
       ORDER BY po.created_at DESC LIMIT ?`,
      [supplierId, tenantId, limit]
    );
    return rows;
  },

  async createSupplier(tenantId, d) {
    const [r] = await writeDb.query(
      `INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, city, status, notes, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.supplier_name, d.contact_person || null, d.phone || null, d.email || null,
       d.address || null, d.city || null, d.status, d.notes || null, tenantId]
    );
    return r.insertId;
  },

  async updateSupplier(tenantId, id, d) {
    await writeDb.query(
      `UPDATE suppliers SET supplier_name = ?, contact_person = ?, phone = ?, email = ?,
         address = ?, city = ?, status = ?, notes = ?
       WHERE id = ? AND ${tw("suppliers")}`,
      [d.supplier_name, d.contact_person || null, d.phone || null, d.email || null,
       d.address || null, d.city || null, d.status, d.notes || null, id, tenantId]
    );
  },

  async softDeleteSupplier(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE suppliers SET deleted_at = NOW() WHERE id = ? AND ${tw("suppliers")}`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  async listSuppliersBrief(tenantId) {
    const [rows] = await readDb.query(
      `SELECT id, supplier_name, phone, city FROM suppliers WHERE ${tw("suppliers")} ORDER BY supplier_name ASC`,
      [tenantId]
    );
    return rows;
  },

  // ── Purchase orders ──────────────────────────────────────────────────────────
  async nextPoNo(tenantId) {
    const [[{ n }]] = await readDb.query(
      `SELECT COUNT(*) AS n FROM purchase_orders WHERE tenant_id = ?`,
      [tenantId]
    );
    return `PO-${String(Number(n) + 1).padStart(5, "0")}`;
  },

  async createPurchaseOrder(conn, tenantId, userId, d) {
    const [r] = await conn.execute(
      `INSERT INTO purchase_orders
         (po_no, order_date, expected_date, status, total_amount, discount_amount, tax_amount, payable_amount,
          notes, supplier_id, branch_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.po_no, d.order_date, d.expected_date || null, d.status, d.total_amount, d.discount_amount,
       d.tax_amount, d.payable_amount, d.notes || null, d.supplier_id, d.branch_id, userId, tenantId]
    );
    return r.insertId;
  },

  async createPurchaseOrderItem(conn, tenantId, poId, d) {
    await conn.execute(
      `INSERT INTO purchase_order_items
         (qty, unit_cost, discount, total_price, received_qty, expiry_date, purchase_order_id, item_id, tenant_id)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [d.qty, d.unit_cost, d.discount ?? 0, d.total_price, d.expiry_date || null, poId, d.item_id, tenantId]
    );
  },

  async listPurchaseOrders(tenantId, { limit, offset, status }) {
    const params = [tenantId];
    let filter = "";
    if (status) { filter += ` AND po.status = ?`; params.push(status); }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT po.id, po.po_no, po.order_date, po.expected_date, po.status, po.total_amount,
              po.discount_amount, po.tax_amount, po.payable_amount, po.created_at,
              po.supplier_id, po.branch_id, s.supplier_name, br.branch_name,
              COUNT(poi.id) AS line_count
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id AND poi.deleted_at IS NULL
       WHERE po.tenant_id = ? AND po.deleted_at IS NULL${filter}
       GROUP BY po.id ORDER BY po.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const cParams = status ? [tenantId, status] : [tenantId];
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM purchase_orders WHERE tenant_id = ? AND deleted_at IS NULL${status ? " AND status = ?" : ""}`,
      cParams
    );
    return { rows, total };
  },

  async getPurchaseOrderById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT po.*, s.supplier_name, br.branch_name, u.name AS created_by_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       LEFT JOIN users u ON u.id = po.created_by
       WHERE po.id = ? AND po.tenant_id = ? AND po.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [items] = await readDb.query(
      `SELECT poi.id, poi.qty, poi.unit_cost, poi.discount, poi.total_price, poi.received_qty,
              poi.expiry_date, poi.item_id, i.item_name, i.unit
       FROM purchase_order_items poi
       JOIN items i ON i.id = poi.item_id
       WHERE poi.purchase_order_id = ? AND poi.tenant_id = ? AND poi.deleted_at IS NULL`,
      [id, tenantId]
    );
    return { ...rows[0], items };
  },

  async getPurchaseOrderItems(conn, tenantId, poId) {
    const [rows] = await conn.execute(
      `SELECT id, qty, unit_cost, received_qty, expiry_date, item_id
       FROM purchase_order_items WHERE purchase_order_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [poId, tenantId]
    );
    return rows;
  },

  async markPoItemReceived(conn, poItemId, receivedQty) {
    await conn.execute(
      `UPDATE purchase_order_items SET received_qty = ? WHERE id = ?`,
      [receivedQty, poItemId]
    );
  },

  async updatePurchaseOrderStatus(conn, tenantId, id, status) {
    await conn.execute(
      `UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [status, id, tenantId]
    );
  },

  async softDeletePurchaseOrder(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE purchase_orders SET deleted_at = NOW() WHERE id = ? AND ${tw("purchase_orders")} AND status IN ('draft','cancelled')`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  // ── Wastage ──────────────────────────────────────────────────────────────────
  async createWastage(conn, tenantId, userId, d) {
    const [r] = await conn.execute(
      `INSERT INTO wastage (qty, reason, wastage_date, estimated_cost, notes, item_id, batch_id, branch_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.qty, d.reason, d.wastage_date, d.estimated_cost ?? 0, d.notes || null,
       d.item_id, d.batch_id || null, d.branch_id, userId, tenantId]
    );
    return r.insertId;
  },

  async listWastage(tenantId, { limit, offset }) {
    const [rows] = await readDb.query(
      `SELECT w.id, w.qty, w.reason, w.wastage_date, w.estimated_cost, w.notes, w.created_at,
              w.item_id, w.branch_id, i.item_name, i.unit, br.branch_name, u.name AS created_by_name
       FROM wastage w
       JOIN items i ON i.id = w.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = w.branch_id AND br.deleted_at IS NULL
       LEFT JOIN users u ON u.id = w.created_by
       WHERE w.tenant_id = ? AND w.deleted_at IS NULL
       ORDER BY w.wastage_date DESC, w.id DESC LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM wastage WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    );
    return { rows, total };
  },

  async getWastageById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT w.id, w.qty, w.reason, w.wastage_date, w.estimated_cost, w.notes, w.created_at,
              w.item_id, w.branch_id, w.batch_id, i.item_name, i.sku, i.unit, i.cost_price,
              br.branch_name, br.city, u.name AS created_by_name, b.batch_no
       FROM wastage w
       JOIN items i ON i.id = w.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = w.branch_id AND br.deleted_at IS NULL
       LEFT JOIN users u ON u.id = w.created_by
       LEFT JOIN stock_batches b ON b.id = w.batch_id
       WHERE w.id = ? AND w.tenant_id = ? AND w.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },
};
