import { readDb, writeDb, getPool } from "../database/db.js";
import { consumeStock } from "../services/stockEngine.js";

// POS repository — re-pointed onto the unified bakery model:
//   * "outlets"/"stores" are rows in `branches` (aliased as outlet_* for the UI)
//   * sellable products are `items` with is_sold = 1, stock via stock_levels
//   * sales deduct stock through the batch-aware stock engine (FIFO by expiry)

function tw(alias) {
  return `${alias}.tenant_id = ? AND ${alias}.deleted_at IS NULL`;
}

/** Map POS payment method onto Order Management payment_method vocabulary. */
function mapPosPaymentToOrder(method) {
  const m = String(method || "cash").trim().toLowerCase();
  if (m === "bank") return "bank_transfer";
  if (["cash", "card", "qr", "easypaisa", "jazzcash", "online", "cod", "bank_transfer", "other"].includes(m)) {
    return m;
  }
  return "other";
}

// Branch columns aliased to the field names the POS UI already expects.
const OUTLET_COLS = `
  b.id, b.branch_name AS outlet_name, b.location, b.city, b.status,
  b.open_time AS store_open_time, b.close_time AS store_close_time,
  b.opening_balance, b.created_at, b.tenant_id
`;

export const posRepository = {
  async dashboardStats(tenantId) {
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM branches WHERE tenant_id = ? AND deleted_at IS NULL) AS outlet_count,
         (SELECT COUNT(*) FROM pos_terminals WHERE tenant_id = ? AND deleted_at IS NULL) AS terminal_count,
         (SELECT COUNT(*) FROM pos_sales WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(created_at) = CURDATE()) AS sales_today,
         (SELECT COALESCE(SUM(payable_amount),0) FROM pos_sales WHERE tenant_id = ? AND deleted_at IS NULL AND DATE(created_at) = CURDATE()) AS revenue_today,
         (SELECT COUNT(*) FROM pos_cash_registers WHERE tenant_id = ? AND deleted_at IS NULL AND closed_at IS NULL) AS open_registers,
         (SELECT COUNT(*) FROM pos_sales WHERE tenant_id = ? AND deleted_at IS NULL) AS total_sales`,
      Array(6).fill(tenantId)
    );
    return stats;
  },

  async listRecentSales(tenantId, limit = 10) {
    const [rows] = await readDb.query(
      `SELECT s.id, s.sale_no, s.payable_amount, s.payment_status, s.payment_method, s.created_at,
              b.branch_name AS outlet_name, t.terminal_name, u.name AS cashier_name
       FROM pos_sales s
       INNER JOIN branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
       INNER JOIN pos_terminals t ON t.id = s.terminal_id AND t.deleted_at IS NULL
       INNER JOIN users u ON u.id = s.created_by
       WHERE ${tw("s")}
       ORDER BY s.created_at DESC LIMIT ?`,
      [tenantId, limit]
    );
    return rows;
  },

  // ── Outlets (branches) ──
  async listOutlets(tenantId) {
    const [rows] = await readDb.query(
      `SELECT ${OUTLET_COLS},
              (SELECT COUNT(*) FROM pos_terminals t WHERE t.branch_id = b.id AND t.tenant_id = b.tenant_id AND t.deleted_at IS NULL) AS terminal_count
       FROM branches b WHERE ${tw("b")} ORDER BY b.branch_name ASC`,
      [tenantId]
    );
    return rows;
  },

  async countOutlets(tenantId) {
    const [[row]] = await readDb.query(
      `SELECT COUNT(*) AS total FROM branches WHERE tenant_id = ? AND deleted_at IS NULL`,
      [tenantId]
    );
    return Number(row.total || 0);
  },

  async getTenantStoreLimit(tenantId) {
    const [rows] = await readDb.query(
      `SELECT max_stores FROM wh_tenant_limits WHERE tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
      [tenantId]
    );
    return Number(rows[0]?.max_stores || 0);
  },

  async getOutlet(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT ${OUTLET_COLS} FROM branches b WHERE b.id = ? AND ${tw("b")} LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async findOutletByName(tenantId, outletName, excludeId = null) {
    const name = String(outletName || "").trim();
    if (!name) return null;
    const params = [tenantId, name];
    let sql = `SELECT id, branch_name AS outlet_name FROM branches
               WHERE tenant_id = ? AND deleted_at IS NULL AND LOWER(TRIM(branch_name)) = LOWER(?)`;
    if (excludeId != null) { sql += " AND id != ?"; params.push(excludeId); }
    const [rows] = await readDb.query(sql + " LIMIT 1", params);
    return rows[0] || null;
  },

  async createOutlet(tenantId, data) {
    const [result] = await writeDb.query(
      `INSERT INTO branches (branch_name, location, city, status, open_time, close_time, opening_balance, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.outlet_name, data.location || null, data.city || null, data.status || "active",
       data.store_open_time || null, data.store_close_time || null, Number(data.opening_balance) || 0, tenantId]
    );
    return this.getOutlet(tenantId, result.insertId);
  },

  async updateOutlet(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE branches SET branch_name = ?, location = ?, city = ?, status = ?,
         open_time = ?, close_time = ?, opening_balance = ?
       WHERE id = ? AND ${tw("branches")}`,
      [data.outlet_name, data.location || null, data.city || null, data.status || "active",
       data.store_open_time || null, data.store_close_time || null, Number(data.opening_balance) || 0, id, tenantId]
    );
    return result.affectedRows === 1 ? this.getOutlet(tenantId, id) : null;
  },

  async deleteOutlet(tenantId, id) {
    const [result] = await writeDb.query(
      `UPDATE branches SET deleted_at = NOW() WHERE id = ? AND ${tw("branches")}`,
      [id, tenantId]
    );
    return result.affectedRows === 1;
  },

  async listOutletsForReference(tenantId) {
    const [rows] = await readDb.query(
      `SELECT id, branch_name AS outlet_name FROM branches
       WHERE ${tw("branches")} AND status = 'active' ORDER BY branch_name ASC`,
      [tenantId]
    );
    return rows;
  },

  // ── Terminals ──
  async listTerminals(tenantId) {
    const [rows] = await readDb.query(
      `SELECT t.id, t.terminal_name, t.device_code, t.status, t.opening_balance, t.created_at,
              t.branch_id AS outlet_id, b.branch_name AS outlet_name
       FROM pos_terminals t
       INNER JOIN branches b ON b.id = t.branch_id AND b.deleted_at IS NULL
       WHERE ${tw("t")} ORDER BY t.created_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async getTerminal(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT t.id, t.terminal_name, t.device_code, t.status, t.opening_balance, t.created_at,
              t.branch_id AS outlet_id, b.branch_name AS outlet_name,
              b.open_time AS store_open_time, b.close_time AS store_close_time,
              b.opening_balance AS store_opening_balance, b.city AS outlet_city
       FROM pos_terminals t
       INNER JOIN branches b ON b.id = t.branch_id AND b.deleted_at IS NULL
       WHERE t.id = ? AND ${tw("t")} LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  async findTerminalByDeviceCode(tenantId, deviceCode, excludeId = null) {
    const code = String(deviceCode || "").trim();
    if (!code) return null;
    const params = [tenantId, code];
    let sql = `SELECT t.id, t.terminal_name, t.device_code, t.status, t.opening_balance,
                 t.branch_id AS outlet_id, b.branch_name AS outlet_name,
                 b.open_time AS store_open_time, b.close_time AS store_close_time,
                 b.opening_balance AS store_opening_balance
               FROM pos_terminals t
               INNER JOIN branches b ON b.id = t.branch_id AND b.deleted_at IS NULL
               WHERE ${tw("t")} AND t.device_code = ?`;
    if (excludeId != null) { sql += " AND t.id != ?"; params.push(excludeId); }
    const [rows] = await readDb.query(sql + " LIMIT 1", params);
    return rows[0] || null;
  },

  async createTerminal(tenantId, data) {
    const [result] = await writeDb.query(
      `INSERT INTO pos_terminals (terminal_name, device_code, status, opening_balance, branch_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.terminal_name,
        data.device_code,
        data.status || "active",
        Number(data.opening_balance) || 0,
        data.outlet_id,
        tenantId,
      ]
    );
    return this.getTerminal(tenantId, result.insertId);
  },

  async updateTerminal(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE pos_terminals
       SET terminal_name = ?, device_code = ?, status = ?, opening_balance = ?, branch_id = ?
       WHERE id = ? AND ${tw("pos_terminals")}`,
      [
        data.terminal_name,
        data.device_code,
        data.status || "active",
        Number(data.opening_balance) || 0,
        data.outlet_id,
        id,
        tenantId,
      ]
    );
    return result.affectedRows === 1 ? this.getTerminal(tenantId, id) : null;
  },

  async deleteTerminal(tenantId, id) {
    const [result] = await writeDb.query(
      `UPDATE pos_terminals SET deleted_at = NOW() WHERE id = ? AND ${tw("pos_terminals")}`,
      [id, tenantId]
    );
    return result.affectedRows === 1;
  },

  // ── Sellable products (unified items) ──
  async listTerminalProducts(tenantId, branchId) {
    const [rows] = await readDb.query(
      `SELECT i.id, i.id AS product_id, i.item_name AS product_name, i.sku, i.unit,
              i.selling_price, i.tax, i.discount, c.category_name,
              COALESCE(sl.available_qty, 0) AS available_qty
       FROM items i
       LEFT JOIN item_categories c ON c.id = i.category_id AND c.deleted_at IS NULL
       LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.branch_id = ? AND sl.deleted_at IS NULL
       WHERE ${tw("i")} AND i.is_sold = 1 AND i.status = 'active'
       ORDER BY c.category_name ASC, i.item_name ASC`,
      [branchId, tenantId]
    );
    return rows;
  },

  // ── Sales ──
  async listSales(tenantId) {
    const [rows] = await readDb.query(
      `SELECT s.*, s.branch_id AS outlet_id, b.branch_name AS outlet_name, t.terminal_name,
              u.name AS cashier_name, c.customer_name
       FROM pos_sales s
       INNER JOIN branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
       INNER JOIN pos_terminals t ON t.id = s.terminal_id AND t.deleted_at IS NULL
       INNER JOIN users u ON u.id = s.created_by
       LEFT JOIN crm_customers c ON c.id = s.crm_customers_id AND c.deleted_at IS NULL
       WHERE ${tw("s")} ORDER BY s.created_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async getSale(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT s.*, s.branch_id AS outlet_id, b.branch_name AS outlet_name, t.terminal_name,
              u.name AS cashier_name, c.customer_name
       FROM pos_sales s
       INNER JOIN branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
       INNER JOIN pos_terminals t ON t.id = s.terminal_id AND t.deleted_at IS NULL
       INNER JOIN users u ON u.id = s.created_by
       LEFT JOIN crm_customers c ON c.id = s.crm_customers_id AND c.deleted_at IS NULL
       WHERE s.id = ? AND ${tw("s")} LIMIT 1`,
      [id, tenantId]
    );
    if (!rows[0]) return null;
    const [items] = await readDb.query(
      `SELECT * FROM pos_sale_items WHERE pos_sale_id = ? AND tenant_id = ? AND deleted_at IS NULL ORDER BY id ASC`,
      [id, tenantId]
    );
    return { ...rows[0], items };
  },

  async nextSaleNo(conn, tenantId) {
    const [[row]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM pos_sales WHERE tenant_id = ?`,
      [tenantId]
    );
    return `PS-${String((Number(row.cnt) || 0) + 1).padStart(6, "0")}`;
  },

  // Runs in a single transaction: create sale, insert lines, deduct stock (FIFO),
  // record cash, and project a paid Order Management order + payment.
  async createSale(tenantId, userId, data) {
    const conn = await getPool().getConnection();
    try {
      await conn.beginTransaction();
      const saleNo = await this.nextSaleNo(conn, tenantId);
      const [result] = await conn.execute(
        `INSERT INTO pos_sales
           (sale_no, total_amount, discount_amount, payable_amount, payment_status, payment_method,
            branch_id, terminal_id, crm_customers_id, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [saleNo, data.total_amount, data.discount_amount || 0, data.payable_amount,
         data.payment_status || "paid", data.payment_method || null,
         data.outlet_id, data.terminal_id, data.crm_customers_id || null, userId, tenantId]
      );
      const saleId = result.insertId;

      for (const item of data.items) {
        await conn.execute(
          `INSERT INTO pos_sale_items (product_name, sku, quantity, unit_price, total_price, pos_sale_id, item_id, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.product_name, item.sku || null, item.quantity, item.unit_price, item.total_price,
           saleId, item.product_id || null, tenantId]
        );
        if (item.product_id) {
          await consumeStock(conn, tenantId, {
            itemId: item.product_id, branchId: data.outlet_id, qty: item.quantity,
            movementType: "sale_out", referenceType: "pos_sale", referenceId: saleId,
            notes: `Sale ${saleNo}`, createdBy: userId, allowNegative: true,
          });
        }
      }

      if (data.register_id && data.register_cash_amount) {
        await conn.execute(
          `UPDATE pos_cash_registers SET cash_collected = cash_collected + ?
           WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL AND closed_at IS NULL`,
          [data.register_cash_amount, data.register_id, tenantId]
        );
      }

      // Mirror into Order Management so the sale + payment appear there.
      const orderNo = saleNo;
      const [orderResult] = await conn.execute(
        `INSERT INTO orders
           (order_no, order_source, order_status, payment_status, fulfillment_status,
            total_amount, discount_amount, delivery_charges, payable_amount,
            city, delivery_address, delivery_date, notes,
            customer_id, branch_id, created_by, tenant_id)
         VALUES (?, 'pos', 'delivered', 'paid', 'fulfilled',
                 ?, ?, 0, ?,
                 NULL, NULL, NULL, ?,
                 ?, ?, ?, ?)`,
        [
          orderNo,
          data.total_amount,
          data.discount_amount || 0,
          data.payable_amount,
          `POS terminal sale ${saleNo}`,
          data.crm_customers_id || null,
          data.outlet_id,
          userId,
          tenantId,
        ]
      );
      const orderId = orderResult.insertId;

      for (const item of data.items) {
        await conn.execute(
          `INSERT INTO order_items
             (product_name, sku, quantity, unit_price, discount, total_price, order_id, item_id, tenant_id)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            item.product_name,
            item.sku || "N/A",
            item.quantity,
            item.unit_price,
            item.total_price,
            orderId,
            item.product_id || null,
            tenantId,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO order_payments (payment_method, amount, payment_status, paid_at, order_id, tenant_id)
         VALUES (?, ?, 'paid', NOW(), ?, ?)`,
        [
          mapPosPaymentToOrder(data.payment_method),
          data.payable_amount,
          orderId,
          tenantId,
        ]
      );

      await conn.execute(
        `UPDATE pos_sales SET order_id = ? WHERE id = ? AND tenant_id = ?`,
        [orderId, saleId, tenantId]
      );

      await conn.commit();
      return this.getSale(tenantId, saleId);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  // ── Cash registers ──
  async listRegisters(tenantId) {
    const [rows] = await readDb.query(
      `SELECT r.*, r.branch_id AS outlet_id, b.branch_name AS outlet_name, t.terminal_name,
              ob.name AS opened_by_name, cb.name AS closed_by_name
       FROM pos_cash_registers r
       INNER JOIN branches b ON b.id = r.branch_id AND b.deleted_at IS NULL
       INNER JOIN pos_terminals t ON t.id = r.terminal_id AND t.deleted_at IS NULL
       INNER JOIN users ob ON ob.id = r.opened_by
       LEFT JOIN users cb ON cb.id = r.closed_by
       WHERE ${tw("r")} ORDER BY r.opened_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async listTerminalBalances(tenantId) {
    const [rows] = await readDb.query(
      `SELECT t.id, t.terminal_name, t.device_code, t.status, t.branch_id AS outlet_id,
              b.branch_name AS outlet_name, r.id AS register_id, r.opening_balance, r.cash_collected, r.opened_at,
              CASE WHEN r.id IS NOT NULL AND r.closed_at IS NULL THEN 'open' ELSE 'closed' END AS shift_status
       FROM pos_terminals t
       INNER JOIN branches b ON b.id = t.branch_id AND b.deleted_at IS NULL
       LEFT JOIN pos_cash_registers r ON r.terminal_id = t.id AND r.tenant_id = t.tenant_id AND r.deleted_at IS NULL AND r.closed_at IS NULL
       WHERE ${tw("t")} ORDER BY b.branch_name ASC, t.terminal_name ASC`,
      [tenantId]
    );
    return rows.map((row) => ({
      ...row,
      current_balance: row.shift_status === "open"
        ? Number(row.opening_balance || 0) + Number(row.cash_collected || 0) : null,
    }));
  },

  async getTerminalLogs(tenantId, terminalId) {
    const terminal = await this.getTerminal(tenantId, terminalId);
    if (!terminal) return null;
    const [registers] = await readDb.query(
      `SELECT r.*, ob.name AS opened_by_name, cb.name AS closed_by_name
       FROM pos_cash_registers r
       INNER JOIN users ob ON ob.id = r.opened_by
       LEFT JOIN users cb ON cb.id = r.closed_by
       WHERE r.terminal_id = ? AND ${tw("r")} ORDER BY r.opened_at DESC LIMIT 50`,
      [terminalId, tenantId]
    );
    const [sales] = await readDb.query(
      `SELECT s.id, s.sale_no, s.payable_amount, s.payment_status, s.total_amount, s.discount_amount, s.created_at,
              u.name AS cashier_name, c.customer_name
       FROM pos_sales s
       INNER JOIN users u ON u.id = s.created_by
       LEFT JOIN crm_customers c ON c.id = s.crm_customers_id AND c.deleted_at IS NULL
       WHERE s.terminal_id = ? AND ${tw("s")} ORDER BY s.created_at DESC LIMIT 50`,
      [terminalId, tenantId]
    );
    const openRegister = await this.getOpenRegister(tenantId, terminalId);
    return { terminal, open_register: openRegister, registers, sales };
  },

  async outletDashboard(tenantId, outletId) {
    const outlet = await this.getOutlet(tenantId, outletId);
    if (!outlet) return null;
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM pos_terminals WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL) AS terminal_count,
         (SELECT COUNT(*) FROM pos_sales WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL AND DATE(created_at) = CURDATE()) AS sales_today,
         (SELECT COALESCE(SUM(payable_amount),0) FROM pos_sales WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL AND DATE(created_at) = CURDATE()) AS revenue_today,
         (SELECT COUNT(*) FROM pos_cash_registers WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL AND closed_at IS NULL) AS open_registers,
         (SELECT COUNT(*) FROM pos_sales WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL) AS total_sales,
         (SELECT COALESCE(SUM(payable_amount),0) FROM pos_sales WHERE branch_id = ? AND tenant_id = ? AND deleted_at IS NULL) AS total_revenue`,
      Array(6).fill([outletId, tenantId]).flat()
    );
    const [terminals] = await readDb.query(
      `SELECT t.id, t.terminal_name, t.device_code, t.status, t.opening_balance, t.created_at
       FROM pos_terminals t WHERE t.branch_id = ? AND ${tw("t")} ORDER BY t.terminal_name ASC`,
      [outletId, tenantId]
    );
    const [recent_sales] = await readDb.query(
      `SELECT s.id, s.sale_no, s.payable_amount, s.payment_status, s.created_at, t.terminal_name, u.name AS cashier_name
       FROM pos_sales s
       INNER JOIN pos_terminals t ON t.id = s.terminal_id AND t.deleted_at IS NULL
       INNER JOIN users u ON u.id = s.created_by
       WHERE s.branch_id = ? AND ${tw("s")} ORDER BY s.created_at DESC LIMIT 10`,
      [outletId, tenantId]
    );
    return {
      outlet,
      stats: {
        terminal_count: Number(stats.terminal_count) || 0,
        sales_today: Number(stats.sales_today) || 0,
        revenue_today: Number(stats.revenue_today) || 0,
        open_registers: Number(stats.open_registers) || 0,
        total_sales: Number(stats.total_sales) || 0,
        total_revenue: Number(stats.total_revenue) || 0,
      },
      terminals,
      recent_sales,
    };
  },

  async getOpenRegister(tenantId, terminalId) {
    const [rows] = await readDb.query(
      `SELECT * FROM pos_cash_registers WHERE terminal_id = ? AND ${tw("pos_cash_registers")} AND closed_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
      [terminalId, tenantId]
    );
    return rows[0] || null;
  },

  async getLastClosedRegister(tenantId, terminalId) {
    const [rows] = await readDb.query(
      `SELECT * FROM pos_cash_registers WHERE terminal_id = ? AND ${tw("pos_cash_registers")} AND closed_at IS NOT NULL
       ORDER BY closed_at DESC LIMIT 1`,
      [terminalId, tenantId]
    );
    return rows[0] || null;
  },

  async openRegister(tenantId, userId, terminal, openingBalance) {
    const [result] = await writeDb.query(
      `INSERT INTO pos_cash_registers (opening_balance, cash_collected, branch_id, terminal_id, opened_by, tenant_id)
       VALUES (?, 0, ?, ?, ?, ?)`,
      [openingBalance, terminal.outlet_id, terminal.id, userId, tenantId]
    );
    const [rows] = await readDb.query(
      `SELECT * FROM pos_cash_registers WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [result.insertId, tenantId]
    );
    return rows[0];
  },

  async closeRegister(tenantId, userId, registerId, closingBalance) {
    const [result] = await writeDb.query(
      `UPDATE pos_cash_registers SET closing_balance = ?, closed_at = NOW(), closed_by = ?
       WHERE id = ? AND ${tw("pos_cash_registers")} AND closed_at IS NULL`,
      [closingBalance, userId, registerId, tenantId]
    );
    return result.affectedRows === 1;
  },
};
