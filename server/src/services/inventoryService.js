import { getPool } from "../database/db.js";
import { inventoryRepository } from "../repositories/inventoryRepository.js";
import { parsePagination, paginatedResponse } from "../utils/pagination.js";
import { addStock, consumeStock, computeExpiry } from "./stockEngine.js";
import {
  ITEM_TYPES,
  STATUS_VALUES,
  UNITS,
  MOVEMENT_TYPES,
  TRANSFER_STATUSES,
  PO_STATUSES,
  WASTAGE_REASONS,
  normalizeShelfLifeUnit,
} from "../utils/stockConstants.js";

function assertStatus(status, label = "status") {
  if (!STATUS_VALUES.includes(status)) throw new Error(`Invalid ${label}. Use: ${STATUS_VALUES.join(", ")}`);
}
function assertItemType(type) {
  if (!ITEM_TYPES.includes(type)) throw new Error(`Invalid item type. Use: ${ITEM_TYPES.join(", ")}`);
}
function assertQty(value, label = "Quantity") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
  return n;
}
function assertMoney(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a valid non-negative number`);
  return n;
}
function nonNegInt(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be zero or more`);
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

export const inventoryService = {
  ITEM_TYPES, STATUS_VALUES, UNITS, MOVEMENT_TYPES, TRANSFER_STATUSES, PO_STATUSES, WASTAGE_REASONS,

  async dashboard(tenantId) {
    const [stats, low_stock_items, expiring_batches, recent_movements, stock_by_branch] = await Promise.all([
      inventoryRepository.dashboardStats(tenantId),
      inventoryRepository.lowStockItems(tenantId, 10),
      inventoryRepository.expiringBatches(tenantId, { withinDays: 7, limit: 12 }),
      inventoryRepository.recentMovements(tenantId, 10),
      inventoryRepository.stockByBranch(tenantId),
    ]);
    return { stats, low_stock_items, expiring_batches, recent_movements, stock_by_branch };
  },

  async referenceData(tenantId) {
    const [categories, branches, items, suppliers] = await Promise.all([
      inventoryRepository.listCategories(tenantId, { limit: 10000, offset: 0 }),
      inventoryRepository.listBranchesBrief(tenantId),
      inventoryRepository.listItemsBrief(tenantId),
      inventoryRepository.listSuppliersBrief(tenantId),
    ]);
    return {
      categories: categories.rows,
      branches,
      items,
      suppliers,
      item_types: ITEM_TYPES,
      units: UNITS,
      statuses: STATUS_VALUES,
      movement_types: MOVEMENT_TYPES,
      transfer_statuses: TRANSFER_STATUSES,
      po_statuses: PO_STATUSES,
      wastage_reasons: WASTAGE_REASONS,
    };
  },

  // ── Categories ──
  async listCategories(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listCategories(tenantId, { limit, offset });
    return paginatedResponse(rows, total, page, limit);
  },
  async getCategory(tenantId, id) {
    const category = await inventoryRepository.getCategoryById(tenantId, id);
    if (!category) return null;
    const items = await inventoryRepository.getCategoryItems(tenantId, id);
    return { ...category, items };
  },
  async createCategory(tenantId, body) {
    const category_name = String(body.category_name || "").trim();
    if (!category_name) throw new Error("Category name is required");
    const status = body.status || "active";
    assertStatus(status);
    if (await inventoryRepository.findCategoryByName(tenantId, category_name)) {
      throw new Error("A category with this name already exists");
    }
    const id = await inventoryRepository.createCategory(tenantId, {
      category_name, item_type: body.item_type || null, status,
    });
    return this.getCategory(tenantId, id);
  },
  async updateCategory(tenantId, id, body) {
    const existing = await inventoryRepository.getCategoryById(tenantId, id);
    if (!existing) return null;
    const category_name = String(body.category_name ?? existing.category_name).trim();
    if (!category_name) throw new Error("Category name is required");
    const status = body.status ?? existing.status;
    assertStatus(status);
    if (await inventoryRepository.findCategoryByName(tenantId, category_name, id)) {
      throw new Error("A category with this name already exists");
    }
    await inventoryRepository.updateCategory(tenantId, id, {
      category_name, item_type: body.item_type ?? existing.item_type, status,
    });
    return this.getCategory(tenantId, id);
  },
  async removeCategory(tenantId, id) {
    return inventoryRepository.softDeleteCategory(tenantId, id);
  },

  // ── Items ──
  async listItems(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listItems(tenantId, {
      limit, offset, item_type: query.item_type || null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
  async getItem(tenantId, id) {
    const item = await inventoryRepository.getItemById(tenantId, id);
    if (!item) return null;
    const [stock_levels, batches] = await Promise.all([
      inventoryRepository.getItemStockLevels(tenantId, id),
      inventoryRepository.getItemBatches(tenantId, id),
    ]);
    return { ...item, stock_levels, batches };
  },
  async _resolveCategoryId(tenantId, body, existing) {
    const name = String(body.category_name || "").trim();
    if (name) {
      const cat = await inventoryRepository.findCategoryByName(tenantId, name);
      if (!cat) throw new Error(`Category not found: "${name}"`);
      return cat.id;
    }
    const raw = body.category_id ?? existing?.category_id;
    if (raw == null || String(raw).trim() === "") throw new Error("Category is required");
    const cat = await inventoryRepository.getCategoryById(tenantId, Number(raw));
    if (!cat) throw new Error("Category not found");
    return cat.id;
  },
  async _parseItemBody(tenantId, body, existing = null) {
    const item_name = String(body.item_name ?? existing?.item_name ?? "").trim();
    if (!item_name) throw new Error("Item name is required");
    const item_type = body.item_type ?? existing?.item_type ?? "finished";
    assertItemType(item_type);
    const status = body.status ?? existing?.status ?? "active";
    assertStatus(status);
    const category_id = await this._resolveCategoryId(tenantId, body, existing);

    const sku = body.sku != null ? String(body.sku).trim() : existing?.sku ?? null;
    if (sku) {
      const dup = await inventoryRepository.findItemBySku(tenantId, sku, existing?.id ?? null);
      if (dup) throw new Error("SKU already exists");
    }
    return {
      item_name,
      item_type,
      sku: sku || null,
      unit: String(body.unit ?? existing?.unit ?? "piece").trim(),
      cost_price: assertMoney(body.cost_price ?? existing?.cost_price ?? 0, "Cost price"),
      selling_price: assertMoney(body.selling_price ?? existing?.selling_price ?? 0, "Selling price"),
      tax: assertMoney(body.tax ?? existing?.tax ?? 0, "Tax"),
      discount: assertMoney(body.discount ?? existing?.discount ?? 0, "Discount"),
      is_purchased: body.is_purchased ?? existing?.is_purchased ?? (item_type !== "finished"),
      is_produced: body.is_produced ?? existing?.is_produced ?? (item_type === "finished"),
      is_sold: body.is_sold ?? existing?.is_sold ?? (item_type === "finished"),
      shelf_life_days: body.shelf_life_days != null && body.shelf_life_days !== ""
        ? Number(body.shelf_life_days) : (existing?.shelf_life_days ?? null),
      shelf_life_unit: normalizeShelfLifeUnit(
        body.shelf_life_unit ?? existing?.shelf_life_unit ?? "days"
      ),
      low_stock_threshold: nonNegInt(body.low_stock_threshold ?? existing?.low_stock_threshold ?? 0, "Low stock alert level"),
      parent_item_id: body.parent_item_id ? Number(body.parent_item_id) : (existing?.parent_item_id ?? null),
      variant_label: body.variant_label ? String(body.variant_label).trim() : (existing?.variant_label ?? null),
      status,
      category_id,
    };
  },
  async createItem(tenantId, userId, body) {
    const data = await this._parseItemBody(tenantId, body);
    return withTransaction(async (conn) => {
      const itemId = await inventoryRepository.createItem(tenantId, data);
      const openings = Array.isArray(body.opening_stock) ? body.opening_stock : [];
      for (const line of openings) {
        const branch_id = Number(line.branch_id);
        const qty = Number(line.qty);
        if (!branch_id || !qty || qty <= 0) continue;
        await ensureBranch(tenantId, branch_id);
        const expiry = line.expiry_date || computeExpiry(new Date(), data.shelf_life_days, data.shelf_life_unit);
        await addStock(conn, tenantId, {
          itemId, branchId: branch_id, qty, unitCost: data.cost_price,
          sourceType: "opening", movementType: "opening", expiryDate: expiry,
          notes: "Opening stock", createdBy: userId,
        });
      }
      return this.getItem(tenantId, itemId);
    });
  },
  async updateItem(tenantId, id, body) {
    const existing = await inventoryRepository.getItemById(tenantId, id);
    if (!existing) return null;
    const data = await this._parseItemBody(tenantId, body, existing);
    await inventoryRepository.updateItem(tenantId, id, data);
    return this.getItem(tenantId, id);
  },
  async removeItem(tenantId, id) {
    return inventoryRepository.softDeleteItem(tenantId, id);
  },
  async exportItems(tenantId) {
    const { rows } = await inventoryRepository.listItems(tenantId, { limit: 10000, offset: 0 });
    return rows;
  },
  async importItems(tenantId, userId, rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error("No rows to import");
    const results = { created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      try { await this.createItem(tenantId, userId, rows[i]); results.created += 1; }
      catch (e) { results.skipped += 1; results.errors.push({ row: i + 1, message: e.message }); }
    }
    return results;
  },

  // ── Branches ──
  async getBranchLimits(tenantId) {
    const max_branches = await inventoryRepository.getTenantBranchLimit(tenantId);
    const branch_count = await inventoryRepository.countBranches(tenantId);
    return { max_branches, branch_count, can_create: max_branches <= 0 || branch_count < max_branches };
  },
  async listBranches(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listBranches(tenantId, { limit, offset });
    const limits = await this.getBranchLimits(tenantId);
    return { ...paginatedResponse(rows, total, page, limit), limits };
  },
  async getBranch(tenantId, id) {
    return inventoryRepository.getBranchById(tenantId, id);
  },
  async createBranch(tenantId, body) {
    const limits = await this.getBranchLimits(tenantId);
    if (!limits.can_create) {
      throw new Error(`Branch limit reached (${limits.branch_count}/${limits.max_branches}). Contact your administrator.`);
    }
    const branch_name = String(body.branch_name || "").trim();
    if (!branch_name) throw new Error("Branch name is required");
    const status = body.status || "active";
    assertStatus(status);
    const id = await inventoryRepository.createBranch(tenantId, {
      branch_name, code: body.code, location: body.location, city: body.city, phone: body.phone,
      open_time: body.open_time, close_time: body.close_time,
      opening_balance: assertMoney(body.opening_balance ?? 0, "Opening balance"), status,
    });
    return inventoryRepository.getBranchById(tenantId, id);
  },
  async updateBranch(tenantId, id, body) {
    const existing = await inventoryRepository.getBranchById(tenantId, id);
    if (!existing) return null;
    const branch_name = String(body.branch_name ?? existing.branch_name).trim();
    if (!branch_name) throw new Error("Branch name is required");
    const status = body.status ?? existing.status;
    assertStatus(status);
    await inventoryRepository.updateBranch(tenantId, id, {
      branch_name, code: body.code ?? existing.code, location: body.location ?? existing.location,
      city: body.city ?? existing.city, phone: body.phone ?? existing.phone,
      open_time: body.open_time ?? existing.open_time, close_time: body.close_time ?? existing.close_time,
      opening_balance: assertMoney(body.opening_balance ?? existing.opening_balance ?? 0, "Opening balance"), status,
    });
    return inventoryRepository.getBranchById(tenantId, id);
  },
  async removeBranch(tenantId, id) {
    return inventoryRepository.softDeleteBranch(tenantId, id);
  },

  // ── Stock movements ──
  async listMovements(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listMovements(tenantId, {
      limit, offset,
      movement_type: query.movement_type || null,
      item_id: query.item_id ? Number(query.item_id) : null,
      branch_id: query.branch_id ? Number(query.branch_id) : null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
  async stockIn(tenantId, userId, body) {
    const item = await ensureItem(tenantId, Number(body.item_id));
    await ensureBranch(tenantId, Number(body.branch_id));
    const qty = assertQty(body.qty);
    const unitCost = assertMoney(body.unit_cost ?? item.cost_price ?? 0, "Unit cost");
    const madeOn = body.made_on || null;
    const expiry = body.expiry_date || computeExpiry(madeOn || new Date(), item.shelf_life_days, item.shelf_life_unit);
    return withTransaction(async (conn) => {
      const batchId = await addStock(conn, tenantId, {
        itemId: item.id, branchId: Number(body.branch_id), qty, unitCost,
        sourceType: "purchase", movementType: "purchase_in",
        madeOn, expiryDate: expiry, notes: body.notes || null, createdBy: userId,
      });
      return { id: batchId };
    });
  },
  async stockOut(tenantId, userId, body) {
    const item = await ensureItem(tenantId, Number(body.item_id));
    await ensureBranch(tenantId, Number(body.branch_id));
    const qty = assertQty(body.qty);
    return withTransaction(async (conn) => {
      await consumeStock(conn, tenantId, {
        itemId: item.id, branchId: Number(body.branch_id), qty,
        movementType: "adjustment", notes: body.notes || "Manual stock out", createdBy: userId,
      });
      return { success: true };
    });
  },
  async bulkStockIn(tenantId, userId, body) {
    const branch_id = Number(body.branch_id);
    await ensureBranch(tenantId, branch_id);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw new Error("Select at least one item");
    return withTransaction(async (conn) => {
      const created = [];
      for (const line of items) {
        const item = await ensureItem(tenantId, Number(line.item_id));
        const qty = assertQty(line.qty, `Quantity for ${item.item_name}`);
        const unitCost = assertMoney(line.unit_cost ?? item.cost_price ?? 0, "Unit cost");
        const expiry = line.expiry_date || computeExpiry(line.made_on || new Date(), item.shelf_life_days, item.shelf_life_unit);
        const batchId = await addStock(conn, tenantId, {
          itemId: item.id, branchId: branch_id, qty, unitCost,
          sourceType: "purchase", movementType: "purchase_in",
          madeOn: line.made_on || null, expiryDate: expiry, notes: line.notes || null, createdBy: userId,
        });
        created.push({ id: batchId, item_id: item.id });
      }
      return { count: created.length, items: created };
    });
  },

  // ── Transfers ──
  async listTransfers(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listTransfers(tenantId, { limit, offset });
    return paginatedResponse(rows, total, page, limit);
  },
  async createTransfer(tenantId, userId, body) {
    const item = await ensureItem(tenantId, Number(body.item_id));
    const from_branch_id = Number(body.from_branch_id);
    const to_branch_id = Number(body.to_branch_id);
    if (from_branch_id === to_branch_id) throw new Error("From and To branch must be different");
    await ensureBranch(tenantId, from_branch_id);
    await ensureBranch(tenantId, to_branch_id);
    const qty = assertQty(body.qty);
    const completeNow = body.complete !== false;

    return withTransaction(async (conn) => {
      const consumption = await consumeStock(conn, tenantId, {
        itemId: item.id, branchId: from_branch_id, qty,
        movementType: "transfer_out", referenceType: "transfer",
        notes: body.notes || `Transfer to branch #${to_branch_id}`, createdBy: userId,
      });
      const avgCost = consumption.length
        ? consumption.reduce((s, c) => s + c.unitCost * c.qty, 0) / qty : item.cost_price;

      const transferId = await inventoryRepository.createTransfer(tenantId, userId, {
        qty, transfer_status: completeNow ? "received" : "in_transit",
        expiry_date: body.expiry_date || null, notes: body.notes,
        item_id: item.id, from_branch_id, to_branch_id,
      });

      if (completeNow) {
        await addStock(conn, tenantId, {
          itemId: item.id, branchId: to_branch_id, qty, unitCost: avgCost,
          sourceType: "transfer", sourceRefId: transferId, movementType: "transfer_in",
          expiryDate: body.expiry_date || null, referenceType: "transfer", referenceId: transferId,
          notes: `Transfer from branch #${from_branch_id}`, createdBy: userId,
        });
      }
      return inventoryRepository.getTransferById(tenantId, transferId);
    });
  },
  async receiveTransfer(tenantId, userId, id) {
    const transfer = await inventoryRepository.getTransferById(tenantId, id);
    if (!transfer) return null;
    if (transfer.transfer_status === "received") throw new Error("Transfer already received");
    if (transfer.transfer_status === "cancelled") throw new Error("Transfer is cancelled");
    return withTransaction(async (conn) => {
      await addStock(conn, tenantId, {
        itemId: transfer.item_id, branchId: transfer.to_branch_id, qty: transfer.qty,
        unitCost: 0, sourceType: "transfer", sourceRefId: id, movementType: "transfer_in",
        expiryDate: transfer.expiry_date || null, referenceType: "transfer", referenceId: id,
        notes: `Transfer #${id} received`, createdBy: userId,
      });
      await inventoryRepository.updateTransferStatus(tenantId, id, "received");
      return inventoryRepository.getTransferById(tenantId, id);
    });
  },
  async cancelTransfer(tenantId, userId, id) {
    const transfer = await inventoryRepository.getTransferById(tenantId, id);
    if (!transfer) return null;
    if (transfer.transfer_status === "received") throw new Error("Received transfers cannot be cancelled");
    if (transfer.transfer_status === "cancelled") throw new Error("Transfer already cancelled");
    return withTransaction(async (conn) => {
      // return stock to source branch
      await addStock(conn, tenantId, {
        itemId: transfer.item_id, branchId: transfer.from_branch_id, qty: transfer.qty,
        unitCost: 0, sourceType: "adjustment", movementType: "return_in",
        referenceType: "transfer", referenceId: id,
        notes: `Transfer #${id} cancelled — stock returned`, createdBy: userId,
      });
      await inventoryRepository.updateTransferStatus(tenantId, id, "cancelled");
      return inventoryRepository.getTransferById(tenantId, id);
    });
  },

  // ── Suppliers ──
  async listSuppliers(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listSuppliers(tenantId, { limit, offset });
    return paginatedResponse(rows, total, page, limit);
  },
  async getSupplier(tenantId, id) {
    return inventoryRepository.getSupplierById(tenantId, id);
  },
  async createSupplier(tenantId, body) {
    const supplier_name = String(body.supplier_name || "").trim();
    if (!supplier_name) throw new Error("Supplier name is required");
    const status = body.status || "active";
    assertStatus(status);
    const id = await inventoryRepository.createSupplier(tenantId, { ...body, supplier_name, status });
    return inventoryRepository.getSupplierById(tenantId, id);
  },
  async updateSupplier(tenantId, id, body) {
    const existing = await inventoryRepository.getSupplierById(tenantId, id);
    if (!existing) return null;
    const supplier_name = String(body.supplier_name ?? existing.supplier_name).trim();
    if (!supplier_name) throw new Error("Supplier name is required");
    const status = body.status ?? existing.status;
    assertStatus(status);
    await inventoryRepository.updateSupplier(tenantId, id, {
      supplier_name,
      contact_person: body.contact_person ?? existing.contact_person,
      phone: body.phone ?? existing.phone,
      email: body.email ?? existing.email,
      address: body.address ?? existing.address,
      city: body.city ?? existing.city,
      status,
      notes: body.notes ?? existing.notes,
    });
    return inventoryRepository.getSupplierById(tenantId, id);
  },
  async removeSupplier(tenantId, id) {
    return inventoryRepository.softDeleteSupplier(tenantId, id);
  },

  // ── Purchase orders ──
  async listPurchaseOrders(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listPurchaseOrders(tenantId, {
      limit, offset, status: query.status || null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
  async getPurchaseOrder(tenantId, id) {
    return inventoryRepository.getPurchaseOrderById(tenantId, id);
  },
  _computePoTotals(lines, discountAmount, taxAmount) {
    let subtotal = 0;
    const parsed = lines.map((l, i) => {
      const item_id = Number(l.item_id);
      if (!item_id) throw new Error(`Select an item for line ${i + 1}`);
      const qty = assertQty(l.qty, `Quantity for line ${i + 1}`);
      const unit_cost = assertMoney(l.unit_cost ?? 0, `Unit cost for line ${i + 1}`);
      const discount = assertMoney(l.discount ?? 0, `Discount for line ${i + 1}`);
      const total_price = Math.max(0, qty * unit_cost - discount);
      subtotal += total_price;
      return { item_id, qty, unit_cost, discount, total_price, expiry_date: l.expiry_date || null };
    });
    const discount_amount = assertMoney(discountAmount ?? 0, "Discount");
    const tax_amount = assertMoney(taxAmount ?? 0, "Tax");
    const payable = Math.max(0, subtotal - discount_amount + tax_amount);
    return { parsed, total_amount: subtotal, discount_amount, tax_amount, payable_amount: payable };
  },
  async createPurchaseOrder(tenantId, userId, body) {
    const supplier = await inventoryRepository.getSupplierById(tenantId, Number(body.supplier_id));
    if (!supplier) throw new Error("Supplier not found");
    await ensureBranch(tenantId, Number(body.branch_id));
    const lines = Array.isArray(body.items) ? body.items : [];
    if (!lines.length) throw new Error("Add at least one item to the purchase order");
    const status = body.status && PO_STATUSES.includes(body.status) ? body.status : "ordered";
    const totals = this._computePoTotals(lines, body.discount_amount, body.tax_amount);

    const poId = await withTransaction(async (conn) => {
      const po_no = body.po_no || (await inventoryRepository.nextPoNo(tenantId));
      const id = await inventoryRepository.createPurchaseOrder(conn, tenantId, userId, {
        po_no,
        order_date: body.order_date || new Date().toISOString().slice(0, 10),
        expected_date: body.expected_date || null,
        status,
        total_amount: totals.total_amount,
        discount_amount: totals.discount_amount,
        tax_amount: totals.tax_amount,
        payable_amount: totals.payable_amount,
        notes: body.notes || null,
        supplier_id: supplier.id,
        branch_id: Number(body.branch_id),
      });
      for (const line of totals.parsed) {
        await inventoryRepository.createPurchaseOrderItem(conn, tenantId, id, line);
      }
      return id;
    });
    return this.getPurchaseOrder(tenantId, poId);
  },
  async receivePurchaseOrder(tenantId, userId, id, body = {}) {
    const po = await inventoryRepository.getPurchaseOrderById(tenantId, id);
    if (!po) return null;
    if (po.status === "received") throw new Error("Purchase order already received");
    if (po.status === "cancelled") throw new Error("Purchase order is cancelled");

    // optional partial receive map: { po_item_id: qty }
    const receiveMap = body.receive || null;

    return withTransaction(async (conn) => {
      const lines = await inventoryRepository.getPurchaseOrderItems(conn, tenantId, id);
      const item = {};
      let allReceived = true;
      for (const line of lines) {
        const toReceive = receiveMap && receiveMap[line.id] != null
          ? Number(receiveMap[line.id])
          : Number(line.qty) - Number(line.received_qty);
        if (toReceive > 0) {
          const itemRow = await ensureItem(tenantId, line.item_id);
          const expiry = line.expiry_date || computeExpiry(new Date(), itemRow.shelf_life_days, itemRow.shelf_life_unit);
          await addStock(conn, tenantId, {
            itemId: line.item_id, branchId: po.branch_id, qty: toReceive, unitCost: line.unit_cost,
            sourceType: "purchase", sourceRefId: id, movementType: "purchase_in",
            expiryDate: expiry, referenceType: "purchase_order", referenceId: id,
            notes: `PO ${po.po_no} received`, createdBy: userId,
          });
          await inventoryRepository.markPoItemReceived(conn, line.id, Number(line.received_qty) + toReceive);
        }
        const newReceived = Number(line.received_qty) + (toReceive > 0 ? toReceive : 0);
        if (newReceived < Number(line.qty)) allReceived = false;
        item[line.id] = newReceived;
      }
      await inventoryRepository.updatePurchaseOrderStatus(conn, tenantId, id, allReceived ? "received" : "partial");
      return this.getPurchaseOrder(tenantId, id);
    });
  },
  async cancelPurchaseOrder(tenantId, id) {
    const po = await inventoryRepository.getPurchaseOrderById(tenantId, id);
    if (!po) return null;
    if (po.status === "received") throw new Error("Received purchase orders cannot be cancelled");
    await withTransaction(async (conn) => {
      await inventoryRepository.updatePurchaseOrderStatus(conn, tenantId, id, "cancelled");
    });
    return this.getPurchaseOrder(tenantId, id);
  },
  async removePurchaseOrder(tenantId, id) {
    return inventoryRepository.softDeletePurchaseOrder(tenantId, id);
  },

  // ── Wastage ──
  async listWastage(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listWastage(tenantId, { limit, offset });
    return paginatedResponse(rows, total, page, limit);
  },
  async createWastage(tenantId, userId, body) {
    const item = await ensureItem(tenantId, Number(body.item_id));
    await ensureBranch(tenantId, Number(body.branch_id));
    const qty = assertQty(body.qty);
    const reason = WASTAGE_REASONS.includes(body.reason) ? body.reason : "other";
    const wastage_date = body.wastage_date || new Date().toISOString().slice(0, 10);
    const estimated_cost = body.estimated_cost != null
      ? assertMoney(body.estimated_cost, "Estimated cost")
      : qty * Number(item.cost_price || 0);
    return withTransaction(async (conn) => {
      await consumeStock(conn, tenantId, {
        itemId: item.id, branchId: Number(body.branch_id), qty,
        movementType: "wastage", referenceType: "wastage",
        notes: body.notes || `Wastage: ${reason}`, createdBy: userId, allowNegative: true,
      });
      const wastageId = await inventoryRepository.createWastage(conn, tenantId, userId, {
        qty, reason, wastage_date, estimated_cost, notes: body.notes,
        item_id: item.id, batch_id: body.batch_id || null, branch_id: Number(body.branch_id),
      });
      return { id: wastageId };
    });
  },

  // ── Batches / expiry ──
  async listBatches(tenantId, query) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await inventoryRepository.listBatches(tenantId, {
      limit, offset,
      status: query.status || null,
      expiring_days: query.expiring_days != null ? Number(query.expiring_days) : null,
    });
    return paginatedResponse(rows, total, page, limit);
  },
};
