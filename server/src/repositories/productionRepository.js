import { readDb, writeDb } from "../database/db.js";

// Production repository — recipes (what makes each bakery item) and production
// runs (a baking batch that consumes ingredients and yields finished goods).

function tw(alias) {
  return `${alias}.tenant_id = ? AND ${alias}.deleted_at IS NULL`;
}

export const productionRepository = {
  // ── Recipes ──
  async listRecipes(tenantId, { limit, offset, status }) {
    const params = [tenantId];
    let filter = "";
    if (status) { filter += ` AND r.status = ?`; params.push(status); }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT r.id, r.recipe_name, r.yield_qty, r.yield_unit, r.prep_time_mins, r.status,
              r.created_at, r.item_id, i.item_name AS finished_item_name, i.unit AS finished_unit,
              COUNT(ri.id) AS ingredient_count
       FROM recipes r
       JOIN items i ON i.id = r.item_id AND i.deleted_at IS NULL
       LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id AND ri.deleted_at IS NULL
       WHERE r.tenant_id = ? AND r.deleted_at IS NULL${filter}
       GROUP BY r.id ORDER BY r.recipe_name ASC LIMIT ? OFFSET ?`,
      params
    );
    const cParams = status ? [tenantId, status] : [tenantId];
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM recipes WHERE tenant_id = ? AND deleted_at IS NULL${status ? " AND status = ?" : ""}`,
      cParams
    );
    return { rows, total };
  },

  async getRecipeById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT r.*, i.item_name AS finished_item_name, i.unit AS finished_unit, i.shelf_life_days, i.shelf_life_unit
       FROM recipes r
       JOIN items i ON i.id = r.item_id AND i.deleted_at IS NULL
       WHERE r.id = ? AND r.tenant_id = ? AND r.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [ingredients] = await readDb.query(
      `SELECT ri.id, ri.quantity, ri.unit, ri.notes, ri.ingredient_item_id,
              i.item_name AS ingredient_name, i.unit AS ingredient_unit, i.cost_price
       FROM recipe_ingredients ri
       JOIN items i ON i.id = ri.ingredient_item_id AND i.deleted_at IS NULL
       WHERE ri.recipe_id = ? AND ri.tenant_id = ? AND ri.deleted_at IS NULL
       ORDER BY i.item_name ASC`,
      [id, tenantId]
    );
    return { ...rows[0], ingredients };
  },

  async getRecipeForItem(tenantId, itemId) {
    const [rows] = await readDb.query(
      `SELECT id FROM recipes WHERE tenant_id = ? AND item_id = ? AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
      [tenantId, itemId]
    );
    return rows[0] ? this.getRecipeById(tenantId, rows[0].id) : null;
  },

  async createRecipe(conn, tenantId, d) {
    const [r] = await conn.execute(
      `INSERT INTO recipes (recipe_name, yield_qty, yield_unit, instructions, prep_time_mins, status, item_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.recipe_name, d.yield_qty, d.yield_unit, d.instructions || null, d.prep_time_mins ?? null, d.status, d.item_id, tenantId]
    );
    return r.insertId;
  },

  async updateRecipe(conn, tenantId, id, d) {
    await conn.execute(
      `UPDATE recipes SET recipe_name = ?, yield_qty = ?, yield_unit = ?, instructions = ?,
         prep_time_mins = ?, status = ?, item_id = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [d.recipe_name, d.yield_qty, d.yield_unit, d.instructions || null, d.prep_time_mins ?? null, d.status, d.item_id, id, tenantId]
    );
  },

  async replaceRecipeIngredients(conn, tenantId, recipeId, ingredients) {
    await conn.execute(
      `UPDATE recipe_ingredients SET deleted_at = NOW() WHERE recipe_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [recipeId, tenantId]
    );
    for (const ing of ingredients) {
      await conn.execute(
        `INSERT INTO recipe_ingredients (quantity, unit, notes, recipe_id, ingredient_item_id, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ing.quantity, ing.unit, ing.notes || null, recipeId, ing.ingredient_item_id, tenantId]
      );
    }
  },

  async softDeleteRecipe(tenantId, id) {
    const [r] = await writeDb.query(
      `UPDATE recipes SET deleted_at = NOW() WHERE id = ? AND ${tw("recipes")}`,
      [id, tenantId]
    );
    return r.affectedRows > 0;
  },

  // ── Production runs ──
  async nextProductionNo(tenantId) {
    const [[{ n }]] = await readDb.query(
      `SELECT COUNT(*) AS n FROM production_runs WHERE tenant_id = ?`,
      [tenantId]
    );
    return `PR-${String(Number(n) + 1).padStart(5, "0")}`;
  },

  async createRun(conn, tenantId, userId, d) {
    const [r] = await conn.execute(
      `INSERT INTO production_runs
         (production_no, quantity_produced, produced_on, expiry_date, status, total_cost, notes,
          item_id, recipe_id, branch_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.production_no, d.quantity_produced, d.produced_on, d.expiry_date || null, d.status,
       d.total_cost ?? 0, d.notes || null, d.item_id, d.recipe_id || null, d.branch_id, userId, tenantId]
    );
    return r.insertId;
  },

  async addRunConsumption(conn, tenantId, runId, d) {
    await conn.execute(
      `INSERT INTO production_run_consumption (qty_consumed, unit_cost, production_run_id, ingredient_item_id, batch_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.qty_consumed, d.unit_cost ?? 0, runId, d.ingredient_item_id, d.batch_id || null, tenantId]
    );
  },

  async updateRunCost(conn, tenantId, runId, totalCost) {
    await conn.execute(
      `UPDATE production_runs SET total_cost = ? WHERE id = ? AND tenant_id = ?`,
      [totalCost, runId, tenantId]
    );
  },

  async updateRunStatus(conn, tenantId, id, status) {
    await conn.execute(
      `UPDATE production_runs SET status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [status, id, tenantId]
    );
  },

  async listRuns(tenantId, { limit, offset, status, branch_id }) {
    const params = [tenantId];
    let filter = "";
    if (status) { filter += ` AND pr.status = ?`; params.push(status); }
    if (branch_id) { filter += ` AND pr.branch_id = ?`; params.push(branch_id); }
    params.push(limit, offset);
    const [rows] = await readDb.query(
      `SELECT pr.id, pr.production_no, pr.quantity_produced, pr.produced_on, pr.expiry_date,
              pr.status, pr.total_cost, pr.created_at, pr.item_id, pr.branch_id,
              i.item_name AS finished_item_name, i.unit AS finished_unit,
              br.branch_name, u.name AS created_by_name
       FROM production_runs pr
       JOIN items i ON i.id = pr.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = pr.branch_id AND br.deleted_at IS NULL
       LEFT JOIN users u ON u.id = pr.created_by
       WHERE pr.tenant_id = ? AND pr.deleted_at IS NULL${filter}
       ORDER BY pr.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const cParams = [tenantId];
    let cFilter = "";
    if (status) { cFilter += ` AND status = ?`; cParams.push(status); }
    if (branch_id) { cFilter += ` AND branch_id = ?`; cParams.push(branch_id); }
    const [[{ total }]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL${cFilter}`,
      cParams
    );
    return { rows, total };
  },

  async getRunById(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT pr.*, i.item_name AS finished_item_name, i.unit AS finished_unit,
              br.branch_name, u.name AS created_by_name
       FROM production_runs pr
       JOIN items i ON i.id = pr.item_id AND i.deleted_at IS NULL
       JOIN branches br ON br.id = pr.branch_id AND br.deleted_at IS NULL
       LEFT JOIN users u ON u.id = pr.created_by
       WHERE pr.id = ? AND pr.tenant_id = ? AND pr.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [consumption] = await readDb.query(
      `SELECT c.id, c.qty_consumed, c.unit_cost, c.ingredient_item_id,
              i.item_name AS ingredient_name, i.unit AS ingredient_unit, c.batch_id, b.batch_no
       FROM production_run_consumption c
       JOIN items i ON i.id = c.ingredient_item_id AND i.deleted_at IS NULL
       LEFT JOIN stock_batches b ON b.id = c.batch_id
       WHERE c.production_run_id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL`,
      [id, tenantId]
    );
    return { ...rows[0], consumption };
  },

  async dashboardStats(tenantId) {
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM recipes WHERE tenant_id = ? AND deleted_at IS NULL) AS recipe_count,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL) AS run_count,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(produced_on) = CURDATE()) AS runs_today,
         (SELECT COALESCE(SUM(quantity_produced),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(produced_on) = CURDATE()) AS produced_today,
         (SELECT COALESCE(SUM(total_cost),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS cost_30d`,
      Array(5).fill(tenantId)
    );
    return stats;
  },
};
