import { getPool } from "../database/db.js";
import { productionRepository } from "../repositories/productionRepository.js";
import { inventoryRepository } from "../repositories/inventoryRepository.js";
import { parsePagination, paginatedResponse } from "../utils/pagination.js";
import { addStock, consumeStock, computeExpiry, getAvailable } from "./stockEngine.js";
import { UNITS, STATUS_VALUES } from "../utils/stockConstants.js";

const RUN_STATUSES = ["planned", "in_progress", "completed", "cancelled"];

function assertQty(value, label = "Quantity") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
  return n;
}

async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function ensureItem(tenantId, itemId) {
  const item = await inventoryRepository.getItemById(tenantId, itemId);
  if (!item) throw new Error("Item not found");
  return item;
}
async function ensureBranch(tenantId, branchId) {
  const br = await inventoryRepository.getBranchById(tenantId, branchId);
  if (!br) throw new Error("Branch not found");
  return br;
}

export const productionService = {
  RUN_STATUSES,

  async dashboard(tenantId) {
    const [stats, recent_runs] = await Promise.all([
      productionRepository.dashboardStats(tenantId),
      productionRepository.listRuns(tenantId, { limit: 8, offset: 0 }),
    ]);
    return { stats, recent_runs: recent_runs.rows };
  },

  async referenceData(tenantId) {
    const [finished_items, ingredients, branches, recipes] = await Promise.all([
      inventoryRepository.listItemsBrief(tenantId, { item_type: "finished" }),
      inventoryRepository.listItemsBrief(tenantId, { item_type: "ingredient" }),
      inventoryRepository.listBranchesBrief(tenantId),
      productionRepository.listRecipes(tenantId, { limit: 10000, offset: 0 }),
    ]);
    return { finished_items, ingredients, branches, recipes: recipes.rows, units: UNITS, statuses: STATUS_VALUES };
  },

  // ── Recipes ──
  async listRecipes(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await productionRepository.listRecipes(tenantId, {
      limit, offset, status: query.status || null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
  async getRecipe(tenantId, id) {
    return productionRepository.getRecipeById(tenantId, id);
  },
  _parseIngredients(body) {
    const list = Array.isArray(body.ingredients) ? body.ingredients : [];
    if (!list.length) throw new Error("Add at least one ingredient to the recipe");
    return list.map((ing, i) => {
      const ingredient_item_id = Number(ing.ingredient_item_id);
      if (!ingredient_item_id) throw new Error(`Select an ingredient for row ${i + 1}`);
      const quantity = assertQty(ing.quantity, `Quantity for ingredient ${i + 1}`);
      return { ingredient_item_id, quantity, unit: ing.unit || "g", notes: ing.notes || null };
    });
  },
  async createRecipe(tenantId, body) {
    const recipe_name = String(body.recipe_name || "").trim();
    if (!recipe_name) throw new Error("Recipe name is required");
    const finished = await ensureItem(tenantId, Number(body.item_id));
    const status = STATUS_VALUES.includes(body.status) ? body.status : "active";
    const ingredients = this._parseIngredients(body);
    for (const ing of ingredients) await ensureItem(tenantId, ing.ingredient_item_id);

    const recipeId = await withTransaction(async (conn) => {
      const id = await productionRepository.createRecipe(conn, tenantId, {
        recipe_name,
        yield_qty: assertQty(body.yield_qty ?? 1, "Yield quantity"),
        yield_unit: body.yield_unit || finished.unit || "piece",
        instructions: body.instructions,
        prep_time_mins: body.prep_time_mins ? Number(body.prep_time_mins) : null,
        status,
        item_id: finished.id,
      });
      await productionRepository.replaceRecipeIngredients(conn, tenantId, id, ingredients);
      return id;
    });
    return this.getRecipe(tenantId, recipeId);
  },
  async updateRecipe(tenantId, id, body) {
    const existing = await productionRepository.getRecipeById(tenantId, id);
    if (!existing) return null;
    const recipe_name = String(body.recipe_name ?? existing.recipe_name).trim();
    if (!recipe_name) throw new Error("Recipe name is required");
    const finished = await ensureItem(tenantId, Number(body.item_id ?? existing.item_id));
    const status = STATUS_VALUES.includes(body.status) ? body.status : existing.status;
    const ingredients = body.ingredients ? this._parseIngredients(body) : null;
    if (ingredients) for (const ing of ingredients) await ensureItem(tenantId, ing.ingredient_item_id);

    await withTransaction(async (conn) => {
      await productionRepository.updateRecipe(conn, tenantId, id, {
        recipe_name,
        yield_qty: assertQty(body.yield_qty ?? existing.yield_qty, "Yield quantity"),
        yield_unit: body.yield_unit ?? existing.yield_unit,
        instructions: body.instructions ?? existing.instructions,
        prep_time_mins: body.prep_time_mins != null ? Number(body.prep_time_mins) : existing.prep_time_mins,
        status,
        item_id: finished.id,
      });
      if (ingredients) await productionRepository.replaceRecipeIngredients(conn, tenantId, id, ingredients);
    });
    return this.getRecipe(tenantId, id);
  },
  async removeRecipe(tenantId, id) {
    return productionRepository.softDeleteRecipe(tenantId, id);
  },

  // ── Production runs ──
  async listRuns(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await productionRepository.listRuns(tenantId, {
      limit, offset, status: query.status || null,
      branch_id: query.branch_id ? Number(query.branch_id) : null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
  async getRun(tenantId, id) {
    return productionRepository.getRunById(tenantId, id);
  },

  // Preview what a run would consume (for the UI before baking).
  async planRun(tenantId, body) {
    const branch_id = Number(body.branch_id);
    await ensureBranch(tenantId, branch_id);
    const quantity = assertQty(body.quantity_produced, "Quantity to make");
    let recipe = body.recipe_id
      ? await productionRepository.getRecipeById(tenantId, Number(body.recipe_id))
      : null;
    const finished = body.item_id
      ? await ensureItem(tenantId, Number(body.item_id))
      : recipe
        ? await ensureItem(tenantId, Number(recipe.item_id))
        : null;
    if (!finished) throw new Error("Select a bakery item or recipe to bake.");
    if (!recipe) {
      recipe = await productionRepository.getRecipeForItem(tenantId, finished.id);
    }
    if (!recipe) throw new Error("No recipe found for this item. Create a recipe first.");
    const factor = quantity / Number(recipe.yield_qty || 1);
    const conn = await getPool().getConnection();
    try {
      const lines = [];
      for (const ing of recipe.ingredients) {
        const needed = Number(ing.quantity) * factor;
        const available = await getAvailable(conn, tenantId, ing.ingredient_item_id, branch_id);
        lines.push({
          ingredient_item_id: ing.ingredient_item_id,
          ingredient_name: ing.ingredient_name,
          unit: ing.unit,
          needed_qty: needed,
          available_qty: available,
          enough: available >= needed,
        });
      }
      return { recipe_id: recipe.id, recipe_name: recipe.recipe_name, factor, lines,
        can_produce: lines.every((l) => l.enough) };
    } finally {
      conn.release();
    }
  },

  async createRun(tenantId, userId, body) {
    const finished = await ensureItem(tenantId, Number(body.item_id));
    const branch_id = Number(body.branch_id);
    await ensureBranch(tenantId, branch_id);
    const quantity = assertQty(body.quantity_produced, "Quantity to make");
    const produced_on = body.produced_on || new Date().toISOString().slice(0, 10);

    // Ingredients come from the recipe (scaled) unless an explicit override is given.
    let ingredientLines;
    let recipeId = body.recipe_id ? Number(body.recipe_id) : null;
    if (Array.isArray(body.consumption) && body.consumption.length) {
      ingredientLines = body.consumption.map((c, i) => ({
        ingredient_item_id: Number(c.ingredient_item_id),
        qty: assertQty(c.qty ?? c.qty_consumed, `Quantity for ingredient ${i + 1}`),
      }));
    } else {
      const recipe = recipeId
        ? await productionRepository.getRecipeById(tenantId, recipeId)
        : await productionRepository.getRecipeForItem(tenantId, finished.id);
      if (!recipe) throw new Error("No recipe found for this item. Create a recipe or provide ingredients.");
      recipeId = recipe.id;
      const factor = quantity / Number(recipe.yield_qty || 1);
      ingredientLines = recipe.ingredients.map((ing) => ({
        ingredient_item_id: ing.ingredient_item_id,
        qty: Number(ing.quantity) * factor,
      }));
    }

    const expiry = body.expiry_date || computeExpiry(produced_on, finished.shelf_life_days);

    const runId = await withTransaction(async (conn) => {
      const production_no = body.production_no || (await productionRepository.nextProductionNo(tenantId));
      const id = await productionRepository.createRun(conn, tenantId, userId, {
        production_no, quantity_produced: quantity, produced_on, expiry_date: expiry,
        status: "completed", total_cost: 0, notes: body.notes,
        item_id: finished.id, recipe_id: recipeId, branch_id,
      });

      let totalCost = 0;
      for (const line of ingredientLines) {
        const ingItem = await ensureItem(tenantId, line.ingredient_item_id);
        const consumption = await consumeStock(conn, tenantId, {
          itemId: ingItem.id, branchId: branch_id, qty: line.qty,
          movementType: "production_consume", referenceType: "production_run", referenceId: id,
          notes: `Used in ${production_no}`, createdBy: userId,
        });
        for (const c of consumption) {
          totalCost += c.qty * c.unitCost;
          await productionRepository.addRunConsumption(conn, tenantId, id, {
            qty_consumed: c.qty, unit_cost: c.unitCost,
            ingredient_item_id: ingItem.id, batch_id: c.batchId,
          });
        }
      }

      const unitCost = quantity > 0 ? totalCost / quantity : 0;
      await addStock(conn, tenantId, {
        itemId: finished.id, branchId: branch_id, qty: quantity, unitCost,
        sourceType: "production", sourceRefId: id, movementType: "production_in",
        madeOn: produced_on, expiryDate: expiry,
        referenceType: "production_run", referenceId: id,
        notes: `Baked in ${production_no}`, createdBy: userId,
      });
      await productionRepository.updateRunCost(conn, tenantId, id, totalCost);
      return id;
    });
    return this.getRun(tenantId, runId);
  },

  async cancelRun(tenantId, userId, id) {
    const run = await productionRepository.getRunById(tenantId, id);
    if (!run) return null;
    if (run.status === "cancelled") throw new Error("Run already cancelled");
    // Reversing a completed bake (returning ingredients and pulling finished goods)
    // is intentionally not automated to avoid negative-stock edge cases; just mark it.
    await withTransaction(async (conn) => {
      await productionRepository.updateRunStatus(conn, tenantId, id, "cancelled");
    });
    return this.getRun(tenantId, id);
  },
};
