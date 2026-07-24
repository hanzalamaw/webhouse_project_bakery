import { productionService } from "../services/productionService.js";
import { tryParseEntityId } from "../utils/ids.js";

function ok(res, promise) {
  return promise.then((data) => res.json(data)).catch((e) => res.status(500).json({ message: e.message }));
}

async function handleId(req, res, label, fn) {
  const id = tryParseEntityId(req.params.id);
  if (!id) return res.status(400).json({ message: `Invalid ${label} id` });
  try {
    const result = await fn(id);
    if (result === null) return res.status(404).json({ message: `${label} not found` });
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
}

export const productionController = {
  dashboard: (req, res) => ok(res, productionService.dashboard(req.tenantId)),
  reference: (req, res) => ok(res, productionService.referenceData(req.tenantId)),

  // Recipes
  listRecipes: (req, res) => ok(res, productionService.listRecipes(req.tenantId, req.query)),
  getRecipe: (req, res) => handleId(req, res, "Recipe", (id) => productionService.getRecipe(req.tenantId, id)),
  async createRecipe(req, res) {
    try { res.status(201).json(await productionService.createRecipe(req.tenantId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  updateRecipe: (req, res) => handleId(req, res, "Recipe", (id) => productionService.updateRecipe(req.tenantId, id, req.body)),
  removeRecipe: (req, res) => handleId(req, res, "Recipe", async (id) =>
    (await productionService.removeRecipe(req.tenantId, id)) ? { success: true } : null),

  // Production runs
  listRuns: (req, res) => ok(res, productionService.listRuns(req.tenantId, req.query)),
  getRun: (req, res) => handleId(req, res, "Production run", (id) => productionService.getRun(req.tenantId, id)),
  async planRun(req, res) {
    try { res.json(await productionService.planRun(req.tenantId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  async createRun(req, res) {
    try { res.status(201).json(await productionService.createRun(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  cancelRun: (req, res) => handleId(req, res, "Production run", (id) => productionService.cancelRun(req.tenantId, req.userId, id)),
};
