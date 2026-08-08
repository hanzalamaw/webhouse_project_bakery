import { readDb, writeDb } from "../database/db.js";
import { joinOnTenant } from "../utils/tenantScope.js";

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
       JOIN items i ON i.id = r.item_id AND ${joinOnTenant("r", "i")}
       LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id AND ${joinOnTenant("r", "ri")}
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
       JOIN items i ON i.id = r.item_id AND ${joinOnTenant("r", "i")}
       WHERE r.id = ? AND r.tenant_id = ? AND r.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [ingredients] = await readDb.query(
      `SELECT ri.id, ri.quantity, ri.unit, ri.notes, ri.ingredient_item_id,
              i.item_name AS ingredient_name, i.unit AS ingredient_unit, i.cost_price
       FROM recipe_ingredients ri
       JOIN items i ON i.id = ri.ingredient_item_id AND ${joinOnTenant("ri", "i")}
       WHERE ri.recipe_id = ? AND ri.tenant_id = ? AND ri.deleted_at IS NULL
       ORDER BY i.item_name ASC`,
      [id, tenantId]
    );
    const [[runStats]] = await readDb.query(
      `SELECT COUNT(*) AS bake_count,
              COALESCE(SUM(quantity_produced), 0) AS total_produced,
              COALESCE(SUM(total_cost), 0) AS total_bake_cost
       FROM production_runs
       WHERE recipe_id = ? AND tenant_id = ? AND deleted_at IS NULL AND status != 'cancelled'`,
      [id, tenantId]
    );
    const batchCost = ingredients.reduce(
      (sum, ing) => sum + (Number(ing.quantity) || 0) * (Number(ing.cost_price) || 0),
      0
    );
    return {
      ...rows[0],
      ingredients,
      bake_count: Number(runStats?.bake_count || 0),
      total_produced: Number(runStats?.total_produced || 0),
      total_bake_cost: Number(runStats?.total_bake_cost || 0),
      estimated_batch_cost: batchCost,
    };
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
       JOIN items i ON i.id = pr.item_id AND ${joinOnTenant("pr", "i")}
       JOIN branches br ON br.id = pr.branch_id AND ${joinOnTenant("pr", "br")}
       LEFT JOIN users u ON u.id = pr.created_by AND ${joinOnTenant("pr", "u")}
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
       JOIN items i ON i.id = pr.item_id AND ${joinOnTenant("pr", "i")}
       JOIN branches br ON br.id = pr.branch_id AND ${joinOnTenant("pr", "br")}
       LEFT JOIN users u ON u.id = pr.created_by AND ${joinOnTenant("pr", "u")}
       WHERE pr.id = ? AND pr.tenant_id = ? AND pr.deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [consumption] = await readDb.query(
      `SELECT c.id, c.qty_consumed, c.unit_cost, c.ingredient_item_id,
              i.item_name AS ingredient_name, i.unit AS ingredient_unit, c.batch_id, b.batch_no
       FROM production_run_consumption c
       JOIN items i ON i.id = c.ingredient_item_id AND ${joinOnTenant("c", "i")}
       LEFT JOIN stock_batches b ON b.id = c.batch_id AND ${joinOnTenant("c", "b")}
       WHERE c.production_run_id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL`,
      [id, tenantId]
    );
    return { ...rows[0], consumption };
  },

  async dashboardStats(tenantId) {
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM recipes WHERE tenant_id = ? AND deleted_at IS NULL) AS recipe_count,
         (SELECT COUNT(*) FROM recipes WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active') AS active_recipe_count,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL) AS run_count,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(produced_on) = CURDATE()) AS runs_today,
         (SELECT COALESCE(SUM(quantity_produced),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(produced_on) = CURDATE()) AS produced_today,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status != 'cancelled') AS runs_7d,
         (SELECT COALESCE(SUM(quantity_produced),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status != 'cancelled') AS produced_7d,
         (SELECT COALESCE(SUM(quantity_produced),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status != 'cancelled') AS produced_30d,
         (SELECT COALESCE(SUM(total_cost),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status != 'cancelled') AS cost_30d,
         (SELECT COALESCE(AVG(total_cost),0) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND produced_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status != 'cancelled') AS avg_cost_30d,
         (SELECT COUNT(*) FROM production_runs WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'cancelled') AS cancelled_count,
         (SELECT COUNT(DISTINCT item_id) FROM recipes WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'active') AS finished_with_recipe`,
      Array(12).fill(tenantId)
    );
    return stats;
  },

  async dashboardTopItems(tenantId, { days = 30, limit = 8 } = {}) {
    const [rows] = await readDb.query(
      `SELECT i.item_name AS label,
              COALESCE(SUM(pr.quantity_produced), 0) AS qty,
              COUNT(*) AS bake_count,
              COALESCE(SUM(pr.total_cost), 0) AS cost
       FROM production_runs pr
       JOIN items i ON i.id = pr.item_id AND ${joinOnTenant("pr", "i")}
       WHERE pr.tenant_id = ? AND pr.deleted_at IS NULL
         AND pr.status != 'cancelled'
         AND pr.produced_on >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY pr.item_id, i.item_name
       ORDER BY qty DESC
       LIMIT ?`,
      [tenantId, days, limit]
    );
    return rows;
  },

  async dashboardRunsByStatus(tenantId) {
    const [rows] = await readDb.query(
      `SELECT status AS label, COUNT(*) AS value
       FROM production_runs
       WHERE tenant_id = ? AND deleted_at IS NULL
       GROUP BY status
       ORDER BY value DESC`,
      [tenantId]
    );
    return rows;
  },

  async dashboardBakesByBranch(tenantId, { days = 30 } = {}) {
    const [rows] = await readDb.query(
      `SELECT br.branch_name AS label,
              COUNT(*) AS bake_count,
              COALESCE(SUM(pr.quantity_produced), 0) AS qty,
              COALESCE(SUM(pr.total_cost), 0) AS cost
       FROM production_runs pr
       JOIN branches br ON br.id = pr.branch_id AND ${joinOnTenant("pr", "br")}
       WHERE pr.tenant_id = ? AND pr.deleted_at IS NULL
         AND pr.status != 'cancelled'
         AND pr.produced_on >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY pr.branch_id, br.branch_name
       ORDER BY qty DESC`,
      [tenantId, days]
    );
    return rows;
  },

  async dashboardRecentRecipes(tenantId, { limit = 6 } = {}) {
    const [rows] = await readDb.query(
      `SELECT r.id, r.recipe_name, r.yield_qty, r.yield_unit, r.status, r.updated_at, r.created_at,
              i.item_name AS finished_item_name
       FROM recipes r
       JOIN items i ON i.id = r.item_id AND ${joinOnTenant("r", "i")}
       WHERE r.tenant_id = ? AND r.deleted_at IS NULL
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC
       LIMIT ?`,
      [tenantId, limit]
    );
    return rows;
  },
};
