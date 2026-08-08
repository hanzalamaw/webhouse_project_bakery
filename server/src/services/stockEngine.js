// Batch-aware stock engine for the unified bakery inventory.
//
// All functions take a live mysql2 connection (inside a transaction) so callers
// can compose purchase receiving, production, sales and transfers atomically.
//
// Stock is tracked two ways that must always stay in sync:
//   * stock_batches  — per batch remaining qty, with made_on / expiry_date
//   * stock_levels   — fast per item+branch rollup used for low-stock checks
// Every change also writes a stock_movements audit row.

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Add stock into a branch as a new batch (purchase, production, transfer-in, opening). */
export async function addStock(conn, tenantId, {
  itemId,
  branchId,
  qty,
  unitCost = 0,
  sourceType = "purchase",
  sourceRefId = null,
  madeOn = null,
  expiryDate = null,
  batchNo = null,
  notes = null,
  movementType = "purchase_in",
  referenceType = null,
  referenceId = null,
  createdBy = null,
}) {
  const quantity = toNum(qty);
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  const [batchResult] = await conn.execute(
    `INSERT INTO stock_batches
       (batch_no, source_type, source_ref_id, qty_received, qty_remaining, unit_cost,
        made_on, expiry_date, status, notes, item_id, branch_id, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      batchNo,
      sourceType,
      sourceRefId,
      quantity,
      quantity,
      toNum(unitCost),
      madeOn,
      expiryDate,
      notes,
      itemId,
      branchId,
      tenantId,
    ]
  );
  const batchId = batchResult.insertId;

  if (batchNo == null) {
    await conn.execute(
      `UPDATE stock_batches SET batch_no = ? WHERE id = ? AND tenant_id = ?`,
      [`B-${String(batchId).padStart(6, "0")}`, batchId, tenantId]
    );
  }

  await conn.execute(
    `INSERT INTO stock_movements
       (movement_type, qty, unit_cost, reference_type, reference_id, notes,
        item_id, branch_id, batch_id, created_by, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movementType,
      quantity,
      toNum(unitCost),
      referenceType,
      referenceId,
      notes,
      itemId,
      branchId,
      batchId,
      createdBy,
      tenantId,
    ]
  );

  await upsertLevelDelta(conn, tenantId, itemId, branchId, quantity, 0);
  return batchId;
}

/** Consume stock from a branch using FIFO by soonest expiry (sale, production use, transfer-out, wastage). */
export async function consumeStock(conn, tenantId, {
  itemId,
  branchId,
  qty,
  movementType = "sale_out",
  referenceType = null,
  referenceId = null,
  createdBy = null,
  notes = null,
  allowNegative = false,
}) {
  const quantity = toNum(qty);
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  const available = await getAvailable(conn, tenantId, itemId, branchId);
  if (!allowNegative && available < quantity) {
    throw new Error("Not enough stock available at this branch");
  }

  const [batches] = await conn.execute(
    `SELECT id, qty_remaining, unit_cost
       FROM stock_batches
      WHERE tenant_id = ? AND item_id = ? AND branch_id = ?
        AND deleted_at IS NULL AND status = 'active' AND qty_remaining > 0
      ORDER BY (expiry_date IS NULL) ASC, expiry_date ASC, created_at ASC, id ASC`,
    [tenantId, itemId, branchId]
  );

  let remaining = quantity;
  const consumption = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, toNum(batch.qty_remaining));
    if (take <= 0) continue;
    const newRemaining = toNum(batch.qty_remaining) - take;
    await conn.execute(
      `UPDATE stock_batches
          SET qty_remaining = ?, status = ?
        WHERE id = ? AND tenant_id = ?`,
      [newRemaining, newRemaining <= 0 ? "finished" : "active", batch.id, tenantId]
    );
    await conn.execute(
      `INSERT INTO stock_movements
         (movement_type, qty, unit_cost, reference_type, reference_id, notes,
          item_id, branch_id, batch_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [movementType, -take, toNum(batch.unit_cost), referenceType, referenceId, notes,
       itemId, branchId, batch.id, createdBy, tenantId]
    );
    consumption.push({ batchId: batch.id, qty: take, unitCost: toNum(batch.unit_cost) });
    remaining -= take;
  }

  // If batches ran out but negative is allowed (or rounding leftover), log the remainder without a batch.
  if (remaining > 0.0001) {
    await conn.execute(
      `INSERT INTO stock_movements
         (movement_type, qty, unit_cost, reference_type, reference_id, notes,
          item_id, branch_id, batch_id, created_by, tenant_id)
       VALUES (?, ?, 0, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [movementType, -remaining, referenceType, referenceId, notes, itemId, branchId, createdBy, tenantId]
    );
    consumption.push({ batchId: null, qty: remaining, unitCost: 0 });
    remaining = 0;
  }

  await upsertLevelDelta(conn, tenantId, itemId, branchId, -quantity, 0);
  return consumption;
}

/** Move a damaged/expired quantity out and record wastage. */
export async function wasteStock(conn, tenantId, options) {
  return consumeStock(conn, tenantId, { ...options, movementType: "wastage", allowNegative: true });
}

export async function getAvailable(conn, tenantId, itemId, branchId) {
  const [rows] = await conn.execute(
    `SELECT available_qty FROM stock_levels
      WHERE tenant_id = ? AND item_id = ? AND branch_id = ? AND deleted_at IS NULL LIMIT 1`,
    [tenantId, itemId, branchId]
  );
  return toNum(rows[0]?.available_qty);
}

async function upsertLevelDelta(conn, tenantId, itemId, branchId, deltaAvailable, deltaDamaged) {
  const [rows] = await conn.execute(
    `SELECT id, available_qty, reserved_qty, damaged_qty FROM stock_levels
      WHERE tenant_id = ? AND item_id = ? AND branch_id = ? LIMIT 1`,
    [tenantId, itemId, branchId]
  );
  if (rows.length) {
    const available = Math.max(0, toNum(rows[0].available_qty) + toNum(deltaAvailable));
    const damaged = Math.max(0, toNum(rows[0].damaged_qty) + toNum(deltaDamaged));
    await conn.execute(
      `UPDATE stock_levels SET available_qty = ?, damaged_qty = ?, deleted_at = NULL
       WHERE id = ? AND tenant_id = ?`,
      [available, damaged, rows[0].id, tenantId]
    );
    return rows[0].id;
  }
  const [result] = await conn.execute(
    `INSERT INTO stock_levels (available_qty, reserved_qty, damaged_qty, item_id, branch_id, tenant_id)
     VALUES (?, 0, ?, ?, ?, ?)`,
    [Math.max(0, toNum(deltaAvailable)), Math.max(0, toNum(deltaDamaged)), itemId, branchId, tenantId]
  );
  return result.insertId;
}

/** Compute an expiry date string (YYYY-MM-DD) from a base date + shelf life. */
export function computeExpiry(baseDate, shelfLifeValue, shelfLifeUnit = "days") {
  const value = Number(shelfLifeValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  const base = baseDate ? new Date(baseDate) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const unit = String(shelfLifeUnit || "days").toLowerCase();
  if (unit === "hours") {
    base.setHours(base.getHours() + value);
  } else if (unit === "weeks") {
    base.setDate(base.getDate() + value * 7);
  } else if (unit === "months") {
    base.setMonth(base.getMonth() + value);
  } else {
    // days (default)
    base.setDate(base.getDate() + value);
  }
  return base.toISOString().slice(0, 10);
}
