import { inventoryController } from "../controllers/inventoryController.js";
import { tenantRouteAuth } from "../middleware/tenantRouteAuth.js";
import { createTenantPermissionMiddleware } from "../middleware/tenantPermissions.js";
import { STOCK_MODULE } from "../utils/stockConstants.js";

export function registerInventoryRoutes(app, verifyToken) {
  const { loadPermissions, requirePermission } = createTenantPermissionMiddleware();
  const auth = [...tenantRouteAuth(verifyToken), loadPermissions];
  const base = "/api/inventory";

  const view = requirePermission(STOCK_MODULE, "view");
  const create = requirePermission(STOCK_MODULE, "create");
  const edit = requirePermission(STOCK_MODULE, "edit");
  const del = requirePermission(STOCK_MODULE, "delete");
  const exp = requirePermission(STOCK_MODULE, "export");

  app.get(`${base}/dashboard`, ...auth, view, inventoryController.dashboard);
  app.get(`${base}/reference`, ...auth, view, inventoryController.reference);

  // Categories
  app.get(`${base}/categories`, ...auth, view, inventoryController.listCategories);
  app.get(`${base}/categories/:id`, ...auth, view, inventoryController.getCategory);
  app.post(`${base}/categories`, ...auth, create, inventoryController.createCategory);
  app.put(`${base}/categories/:id`, ...auth, edit, inventoryController.updateCategory);
  app.delete(`${base}/categories/:id`, ...auth, del, inventoryController.removeCategory);

  // Items (ingredients / finished / packaging)
  app.get(`${base}/items`, ...auth, view, inventoryController.listItems);
  app.get(`${base}/items/export`, ...auth, exp, inventoryController.exportItems);
  app.post(`${base}/items/import`, ...auth, create, inventoryController.importItems);
  app.get(`${base}/items/:id`, ...auth, view, inventoryController.getItem);
  app.post(`${base}/items`, ...auth, create, inventoryController.createItem);
  app.put(`${base}/items/:id`, ...auth, edit, inventoryController.updateItem);
  app.delete(`${base}/items/:id`, ...auth, del, inventoryController.removeItem);

  // Branches
  app.get(`${base}/branches`, ...auth, view, inventoryController.listBranches);
  app.get(`${base}/branches/:id`, ...auth, view, inventoryController.getBranch);
  app.post(`${base}/branches`, ...auth, create, inventoryController.createBranch);
  app.put(`${base}/branches/:id`, ...auth, edit, inventoryController.updateBranch);
  app.delete(`${base}/branches/:id`, ...auth, del, inventoryController.removeBranch);

  // Stock movements
  app.get(`${base}/stock-movements`, ...auth, view, inventoryController.listMovements);
  app.post(`${base}/stock-movements/stock-in`, ...auth, create, inventoryController.stockIn);
  app.post(`${base}/stock-movements/stock-in/bulk`, ...auth, create, inventoryController.bulkStockIn);
  app.post(`${base}/stock-movements/stock-out`, ...auth, create, inventoryController.stockOut);

  // Batches (expiry tracking)
  app.get(`${base}/batches`, ...auth, view, inventoryController.listBatches);

  // Stock transfers between branches
  app.get(`${base}/stock-transfers`, ...auth, view, inventoryController.listTransfers);
  app.post(`${base}/stock-transfers`, ...auth, create, inventoryController.createTransfer);
  app.post(`${base}/stock-transfers/:id/receive`, ...auth, edit, inventoryController.receiveTransfer);
  app.post(`${base}/stock-transfers/:id/cancel`, ...auth, edit, inventoryController.cancelTransfer);

  // Suppliers
  app.get(`${base}/suppliers`, ...auth, view, inventoryController.listSuppliers);
  app.get(`${base}/suppliers/:id`, ...auth, view, inventoryController.getSupplier);
  app.post(`${base}/suppliers`, ...auth, create, inventoryController.createSupplier);
  app.put(`${base}/suppliers/:id`, ...auth, edit, inventoryController.updateSupplier);
  app.delete(`${base}/suppliers/:id`, ...auth, del, inventoryController.removeSupplier);

  // Purchase orders
  app.get(`${base}/purchase-orders`, ...auth, view, inventoryController.listPurchaseOrders);
  app.get(`${base}/purchase-orders/:id`, ...auth, view, inventoryController.getPurchaseOrder);
  app.post(`${base}/purchase-orders`, ...auth, create, inventoryController.createPurchaseOrder);
  app.post(`${base}/purchase-orders/:id/receive`, ...auth, edit, inventoryController.receivePurchaseOrder);
  app.post(`${base}/purchase-orders/:id/cancel`, ...auth, edit, inventoryController.cancelPurchaseOrder);
  app.delete(`${base}/purchase-orders/:id`, ...auth, del, inventoryController.removePurchaseOrder);

  // Wastage
  app.get(`${base}/wastage`, ...auth, view, inventoryController.listWastage);
  app.post(`${base}/wastage`, ...auth, create, inventoryController.createWastage);
}
