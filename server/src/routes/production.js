import { productionController } from "../controllers/productionController.js";
import { tenantRouteAuth } from "../middleware/tenantRouteAuth.js";
import { createTenantPermissionMiddleware } from "../middleware/tenantPermissions.js";
import { PRODUCTION_MODULE } from "../utils/stockConstants.js";

export function registerProductionRoutes(app, verifyToken) {
  const { loadPermissions, requirePermission } = createTenantPermissionMiddleware();
  const auth = [...tenantRouteAuth(verifyToken), loadPermissions];
  const base = "/api/production";

  const view = requirePermission(PRODUCTION_MODULE, "view");
  const create = requirePermission(PRODUCTION_MODULE, "create");
  const edit = requirePermission(PRODUCTION_MODULE, "edit");
  const del = requirePermission(PRODUCTION_MODULE, "delete");

  app.get(`${base}/dashboard`, ...auth, view, productionController.dashboard);
  app.get(`${base}/reference`, ...auth, view, productionController.reference);

  // Recipes
  app.get(`${base}/recipes`, ...auth, view, productionController.listRecipes);
  app.get(`${base}/recipes/:id`, ...auth, view, productionController.getRecipe);
  app.post(`${base}/recipes`, ...auth, create, productionController.createRecipe);
  app.put(`${base}/recipes/:id`, ...auth, edit, productionController.updateRecipe);
  app.delete(`${base}/recipes/:id`, ...auth, del, productionController.removeRecipe);

  // Production runs (baking)
  app.get(`${base}/runs`, ...auth, view, productionController.listRuns);
  app.post(`${base}/runs/plan`, ...auth, view, productionController.planRun);
  app.get(`${base}/runs/:id`, ...auth, view, productionController.getRun);
  app.post(`${base}/runs`, ...auth, create, productionController.createRun);
  app.post(`${base}/runs/:id/cancel`, ...auth, edit, productionController.cancelRun);
}
