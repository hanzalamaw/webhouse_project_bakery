import { inventoryService } from "../services/inventoryService.js";
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

export const inventoryController = {
  dashboard: (req, res) => ok(res, inventoryService.dashboard(req.tenantId)),
  reference: (req, res) => ok(res, inventoryService.referenceData(req.tenantId)),

  // Categories
  listCategories: (req, res) => ok(res, inventoryService.listCategories(req.tenantId, req.query)),
  getCategory: (req, res) => handleId(req, res, "Category", (id) => inventoryService.getCategory(req.tenantId, id)),
  async createCategory(req, res) {
    try { res.status(201).json(await inventoryService.createCategory(req.tenantId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  updateCategory: (req, res) => handleId(req, res, "Category", (id) => inventoryService.updateCategory(req.tenantId, id, req.body)),
  removeCategory: (req, res) => handleId(req, res, "Category", async (id) =>
    (await inventoryService.removeCategory(req.tenantId, id)) ? { success: true } : null),

  // Items
  listItems: (req, res) => ok(res, inventoryService.listItems(req.tenantId, req.query)),
  getItem: (req, res) => handleId(req, res, "Item", (id) => inventoryService.getItem(req.tenantId, id)),
  async createItem(req, res) {
    try { res.status(201).json(await inventoryService.createItem(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  updateItem: (req, res) => handleId(req, res, "Item", (id) => inventoryService.updateItem(req.tenantId, id, req.body)),
  removeItem: (req, res) => handleId(req, res, "Item", async (id) =>
    (await inventoryService.removeItem(req.tenantId, id)) ? { success: true } : null),
  async exportItems(req, res) {
    try { res.json({ data: await inventoryService.exportItems(req.tenantId) }); }
    catch (e) { res.status(500).json({ message: e.message }); }
  },
  async importItems(req, res) {
    try { res.json(await inventoryService.importItems(req.tenantId, req.userId, req.body.rows)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },

  // Branches
  listBranches: (req, res) => ok(res, inventoryService.listBranches(req.tenantId, req.query)),
  getBranch: (req, res) => handleId(req, res, "Branch", (id) => inventoryService.getBranch(req.tenantId, id)),
  async createBranch(req, res) {
    try { res.status(201).json(await inventoryService.createBranch(req.tenantId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  updateBranch: (req, res) => handleId(req, res, "Branch", (id) => inventoryService.updateBranch(req.tenantId, id, req.body)),
  removeBranch: (req, res) => handleId(req, res, "Branch", async (id) =>
    (await inventoryService.removeBranch(req.tenantId, id)) ? { success: true } : null),

  // Stock movements
  listMovements: (req, res) => ok(res, inventoryService.listMovements(req.tenantId, req.query)),
  async stockIn(req, res) {
    try { res.status(201).json(await inventoryService.stockIn(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  async bulkStockIn(req, res) {
    try { res.status(201).json(await inventoryService.bulkStockIn(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  async stockOut(req, res) {
    try { res.status(201).json(await inventoryService.stockOut(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },

  // Batches
  listBatches: (req, res) => ok(res, inventoryService.listBatches(req.tenantId, req.query)),

  // Transfers
  listTransfers: (req, res) => ok(res, inventoryService.listTransfers(req.tenantId, req.query)),
  async createTransfer(req, res) {
    try { res.status(201).json(await inventoryService.createTransfer(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  receiveTransfer: (req, res) => handleId(req, res, "Transfer", (id) => inventoryService.receiveTransfer(req.tenantId, req.userId, id)),
  cancelTransfer: (req, res) => handleId(req, res, "Transfer", (id) => inventoryService.cancelTransfer(req.tenantId, req.userId, id)),

  // Suppliers
  listSuppliers: (req, res) => ok(res, inventoryService.listSuppliers(req.tenantId, req.query)),
  getSupplier: (req, res) => handleId(req, res, "Supplier", (id) => inventoryService.getSupplier(req.tenantId, id)),
  async createSupplier(req, res) {
    try { res.status(201).json(await inventoryService.createSupplier(req.tenantId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  updateSupplier: (req, res) => handleId(req, res, "Supplier", (id) => inventoryService.updateSupplier(req.tenantId, id, req.body)),
  removeSupplier: (req, res) => handleId(req, res, "Supplier", async (id) =>
    (await inventoryService.removeSupplier(req.tenantId, id)) ? { success: true } : null),

  // Purchase orders
  listPurchaseOrders: (req, res) => ok(res, inventoryService.listPurchaseOrders(req.tenantId, req.query)),
  getPurchaseOrder: (req, res) => handleId(req, res, "Purchase order", (id) => inventoryService.getPurchaseOrder(req.tenantId, id)),
  async createPurchaseOrder(req, res) {
    try { res.status(201).json(await inventoryService.createPurchaseOrder(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
  receivePurchaseOrder: (req, res) => handleId(req, res, "Purchase order", (id) => inventoryService.receivePurchaseOrder(req.tenantId, req.userId, id, req.body)),
  cancelPurchaseOrder: (req, res) => handleId(req, res, "Purchase order", (id) => inventoryService.cancelPurchaseOrder(req.tenantId, id)),
  removePurchaseOrder: (req, res) => handleId(req, res, "Purchase order", async (id) =>
    (await inventoryService.removePurchaseOrder(req.tenantId, id)) ? { success: true } : null),

  // Wastage
  listWastage: (req, res) => ok(res, inventoryService.listWastage(req.tenantId, req.query)),
  getWastage: (req, res) => handleId(req, res, "Wastage", (id) => inventoryService.getWastage(req.tenantId, id)),
  async createWastage(req, res) {
    try { res.status(201).json(await inventoryService.createWastage(req.tenantId, req.userId, req.body)); }
    catch (e) { res.status(400).json({ message: e.message }); }
  },
};
