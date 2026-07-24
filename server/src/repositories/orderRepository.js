import { readDb, writeDb, getPool } from "../database/db.js";
import { DELAYED_ORDER_DAYS } from "../utils/orderConstants.js";
import { joinOnTenant } from "../utils/tenantScope.js";
import { buildDashboardDateSql, isAllTimeDashboardFilter } from "../utils/dashboardDateFilter.js";
import { consumeStock } from "../services/stockEngine.js";

function tw(alias, tenantId) {
  return `${alias}.tenant_id = ? AND ${alias}.deleted_at IS NULL`;
}

const BRANCH_ASSIGNMENT_SQL = `oa.assignment_type IN ('warehouse', 'branch')`;

const ORDER_LIST_SELECT = `
  SELECT o.*,
         c.customer_name,
         u.name AS created_by_name,
         b.branch_name,
         (SELECT op.payment_method FROM order_payments op
            WHERE op.order_id = o.id AND op.tenant_id = o.tenant_id AND op.deleted_at IS NULL
            ORDER BY op.id DESC LIMIT 1) AS payment_method,
         (SELECT oa.assignment_type FROM order_assignments oa
            WHERE oa.order_id = o.id AND oa.tenant_id = o.tenant_id AND oa.deleted_at IS NULL AND ${BRANCH_ASSIGNMENT_SQL}
            ORDER BY oa.id DESC LIMIT 1) AS warehouse_assignment_type,
         (SELECT oa.assignment_type FROM order_assignments oa
            WHERE oa.order_id = o.id AND oa.tenant_id = o.tenant_id AND oa.deleted_at IS NULL AND ${BRANCH_ASSIGNMENT_SQL}
            ORDER BY oa.id DESC LIMIT 1) AS branch_assignment_type,
         (SELECT usr.name FROM order_assignments oa
            INNER JOIN users usr ON usr.id = oa.assigned_to AND ${joinOnTenant("oa", "usr")}
            WHERE oa.order_id = o.id AND oa.tenant_id = o.tenant_id AND oa.deleted_at IS NULL AND ${BRANCH_ASSIGNMENT_SQL}
            ORDER BY oa.id DESC LIMIT 1) AS warehouse_assignee,
         (SELECT usr.name FROM order_assignments oa
            INNER JOIN users usr ON usr.id = oa.assigned_to AND ${joinOnTenant("oa", "usr")}
            WHERE oa.order_id = o.id AND oa.tenant_id = o.tenant_id AND oa.deleted_at IS NULL AND ${BRANCH_ASSIGNMENT_SQL}
            ORDER BY oa.id DESC LIMIT 1) AS branch_assignee,
         EXISTS (SELECT 1 FROM order_cancellations oc
            WHERE oc.order_id = o.id AND oc.tenant_id = o.tenant_id AND oc.deleted_at IS NULL) AS has_cancellation,
         EXISTS (SELECT 1 FROM order_returns ort
            WHERE ort.order_id = o.id AND ort.tenant_id = o.tenant_id AND ort.deleted_at IS NULL) AS has_return,
         EXISTS (SELECT 1 FROM order_exchanges oe
            WHERE oe.order_id = o.id AND oe.tenant_id = o.tenant_id AND oe.deleted_at IS NULL) AS has_exchange,
         EXISTS (SELECT 1 FROM order_refunds orf
            WHERE orf.order_id = o.id AND orf.tenant_id = o.tenant_id AND orf.deleted_at IS NULL) AS has_refund
  FROM orders o
  LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
  LEFT JOIN users u ON u.id = o.created_by AND ${joinOnTenant("o", "u")}
  LEFT JOIN branches b ON b.id = o.branch_id AND ${joinOnTenant("o", "b")}
`;

function resolveItemId(item) {
  const raw = item.item_id ?? item.product_id ?? null;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const orderRepository = {
  async listOrderUsers(tenantId) {
    const [rows] = await readDb.query(
      `SELECT DISTINCT u.id, u.name, u.email
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND ${joinOnTenant("u", "r")}
       WHERE u.tenant_id = ? AND u.deleted_at IS NULL AND u.status = 'active'
         AND (
           r.role_name = 'Super Admin'
           OR EXISTS (
             SELECT 1 FROM permissions p
             INNER JOIN modules m ON m.id = p.module_id
               AND m.module_name = 'Order Management' AND m.deleted_at IS NULL
             WHERE p.role_id = r.id AND p.deleted_at IS NULL
               AND p.action IN ('view', 'manage')
           )
         )
       ORDER BY u.name ASC`,
      [tenantId]
    );
    return rows;
  },

  async listCustomers(tenantId) {
    const [rows] = await readDb.query(
      `SELECT c.id, c.customer_name, c.company_name, c.phone, c.email,
              (SELECT a.city FROM crm_customer_addresses a
               WHERE a.customer_id = c.id AND a.deleted_at IS NULL
               ORDER BY a.is_default DESC, a.id ASC LIMIT 1) AS city
       FROM crm_customers c
       WHERE c.tenant_id = ? AND c.deleted_at IS NULL
         AND LOWER(TRIM(c.status)) = 'active'
       ORDER BY c.customer_name ASC`,
      [tenantId]
    );
    return rows;
  },

  async listProducts(tenantId) {
    const [rows] = await readDb.query(
      `SELECT i.id, i.item_name AS product_name, i.item_name, i.sku, i.selling_price, i.status
       FROM items i
       WHERE i.tenant_id = ? AND i.deleted_at IS NULL
         AND LOWER(TRIM(COALESCE(i.status, 'active'))) = 'active'
         AND i.is_sold = 1
       ORDER BY i.item_name ASC`,
      [tenantId]
    );
    return rows;
  },

  async listBranches(tenantId) {
    const [rows] = await readDb.query(
      `SELECT id, branch_name, branch_name AS warehouse_name, city, status
       FROM branches
       WHERE tenant_id = ? AND deleted_at IS NULL
         AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'
       ORDER BY branch_name ASC`,
      [tenantId]
    );
    return rows;
  },

  /** @deprecated Use listBranches — kept for temporary UI compat */
  async listWarehouses(tenantId) {
    return this.listBranches(tenantId);
  },

  async listBranchProducts(tenantId, branchId) {
    const [rows] = await readDb.query(
      `SELECT i.id AS product_id, i.id AS item_id, i.item_name AS product_name,
              i.sku, i.selling_price, i.cost_price, i.discount, i.tax,
              NULL AS variant_id, NULL AS variant_name,
              0 AS delivery_charges,
              COALESCE(sl.available_qty, 0) AS available_qty
       FROM items i
       LEFT JOIN stock_levels sl
         ON sl.item_id = i.id AND sl.branch_id = ? AND ${joinOnTenant("i", "sl")}
       WHERE i.tenant_id = ? AND i.deleted_at IS NULL
         AND LOWER(TRIM(COALESCE(i.status, 'active'))) = 'active'
         AND i.is_sold = 1
       ORDER BY i.item_name ASC`,
      [branchId, tenantId]
    );
    return rows;
  },

  /** @deprecated Use listBranchProducts */
  async listWarehouseProducts(tenantId, warehouseId) {
    return this.listBranchProducts(tenantId, warehouseId);
  },

  async listFieldOptions(tenantId, fieldKey) {
    try {
      const [rows] = await readDb.query(
        `SELECT option_value FROM order_field_options
         WHERE tenant_id = ? AND field_key = ? AND deleted_at IS NULL
         ORDER BY option_value ASC`,
        [tenantId, fieldKey]
      );
      return rows.map((r) => r.option_value);
    } catch {
      return [];
    }
  },

  async addFieldOption(tenantId, fieldKey, optionValue) {
    const value = String(optionValue || "").trim();
    if (!value) return false;
    try {
      await writeDb.query(
        `INSERT INTO order_field_options (tenant_id, field_key, option_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE deleted_at = NULL`,
        [tenantId, fieldKey, value]
      );
      return true;
    } catch {
      return false;
    }
  },

  async dashboardStats(tenantId, filter = {}) {
    const date = buildDashboardDateSql(filter, "created_at");
    const returnDate = buildDashboardDateSql(filter, "created_at");
    const paymentDate = buildDashboardDateSql(filter, "o.created_at");
    const [[stats]] = await readDb.query(
      `SELECT
         (SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND deleted_at IS NULL${date.sql}) AS total_orders,
         (SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND deleted_at IS NULL AND order_status = 'pending'${date.sql}) AS pending_orders,
         (SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND deleted_at IS NULL AND order_status = 'confirmed'${date.sql}) AS confirmed_orders,
         (SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND deleted_at IS NULL AND order_status = 'cancelled'${date.sql}) AS cancelled_orders,
         (SELECT COUNT(*) FROM order_returns WHERE tenant_id = ? AND deleted_at IS NULL${returnDate.sql}) AS return_requests,
         (SELECT COUNT(*) FROM order_exchanges WHERE tenant_id = ? AND deleted_at IS NULL${returnDate.sql}) AS exchange_requests,
         (SELECT COALESCE(SUM(op.amount), 0) FROM order_payments op
            INNER JOIN orders o ON o.id = op.order_id AND o.tenant_id = op.tenant_id AND o.deleted_at IS NULL
            WHERE op.tenant_id = ? AND op.deleted_at IS NULL AND op.payment_method = 'cod'${paymentDate.sql}) AS cod_amount,
         (SELECT COALESCE(SUM(payable_amount), 0) FROM orders
            WHERE tenant_id = ? AND deleted_at IS NULL${date.sql}) AS total_revenue,
         (SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND deleted_at IS NULL
            AND fulfillment_status != 'fulfilled'
            AND order_status NOT IN ('cancelled', 'returned')
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)${date.sql}) AS delayed_orders`,
      [
        tenantId, ...date.params,
        tenantId, ...date.params,
        tenantId, ...date.params,
        tenantId, ...date.params,
        tenantId, ...returnDate.params,
        tenantId, ...returnDate.params,
        tenantId, ...paymentDate.params,
        tenantId, ...date.params,
        tenantId, DELAYED_ORDER_DAYS, ...date.params,
      ]
    );
    return stats;
  },

  async dashboardOrdersByStatus(tenantId, filter = {}) {
    const date = buildDashboardDateSql(filter, "created_at");
    const [rows] = await readDb.query(
      `SELECT order_status AS label, COUNT(*) AS count
       FROM orders WHERE tenant_id = ? AND deleted_at IS NULL${date.sql}
       GROUP BY order_status ORDER BY count DESC`,
      [tenantId, ...date.params]
    );
    return rows;
  },

  async dashboardFulfillmentByStatus(tenantId, filter = {}) {
    const date = buildDashboardDateSql(filter, "created_at");
    const [rows] = await readDb.query(
      `SELECT fulfillment_status AS label, COUNT(*) AS count
       FROM orders WHERE tenant_id = ? AND deleted_at IS NULL${date.sql}
       GROUP BY fulfillment_status ORDER BY count DESC`,
      [tenantId, ...date.params]
    );
    return rows;
  },

  async dashboardPaymentByStatus(tenantId, filter = {}) {
    const date = buildDashboardDateSql(filter, "created_at");
    const [rows] = await readDb.query(
      `SELECT payment_status AS label, COUNT(*) AS count
       FROM orders WHERE tenant_id = ? AND deleted_at IS NULL${date.sql}
       GROUP BY payment_status ORDER BY count DESC`,
      [tenantId, ...date.params]
    );
    return rows;
  },

  async dashboardOrdersByMonth(tenantId, filter = {}, months = 6) {
    const date = buildDashboardDateSql(filter, "created_at");
    const params = [tenantId];
    let rollingSql = "";
    if (isAllTimeDashboardFilter(filter)) {
      rollingSql = ` AND created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)`;
      params.push(months - 1);
    }
    params.push(...date.params);
    const [rows] = await readDb.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key,
              MONTHNAME(created_at) AS month_label,
              COUNT(*) AS count,
              COALESCE(SUM(payable_amount), 0) AS revenue
       FROM orders
       WHERE tenant_id = ? AND deleted_at IS NULL${rollingSql}${date.sql}
       GROUP BY month_key, month_label
       ORDER BY month_key ASC`,
      params
    );
    return rows;
  },

  async dashboardRecentOrders(tenantId, filter = {}, limit = 50) {
    const date = buildDashboardDateSql(filter, "o.created_at");
    const [rows] = await readDb.query(
      `${ORDER_LIST_SELECT}
       WHERE ${tw("o", tenantId)}${date.sql}
       ORDER BY o.created_at DESC
       LIMIT ?`,
      [tenantId, ...date.params, limit]
    );
    return rows;
  },

  async listOrders(tenantId) {
    const [rows] = await readDb.query(
      `${ORDER_LIST_SELECT}
       WHERE ${tw("o", tenantId)}
       ORDER BY o.created_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async getOrder(tenantId, id) {
    const [rows] = await readDb.query(
      `${ORDER_LIST_SELECT}
       WHERE o.id = ? AND ${tw("o", tenantId)} LIMIT 1`,
      [id, tenantId]
    );
    if (!rows.length) return null;
    const order = rows[0];
    const [items] = await readDb.query(
      `SELECT oi.*,
              oi.item_id AS product_id,
              i.discount AS product_discount_unit,
              i.tax AS product_tax_unit,
              0 AS product_delivery
       FROM order_items oi
       LEFT JOIN items i ON i.id = oi.item_id AND ${joinOnTenant("oi", "i")}
       WHERE oi.order_id = ? AND ${tw("oi", tenantId)}
       ORDER BY oi.id ASC`,
      [id, tenantId]
    );
    order.items = items;
    return order;
  },

  async getOrderByIdIncludingDeleted(tenantId, id) {
    const [rows] = await readDb.query(
      `SELECT id, order_no, order_source, order_status, payment_status, fulfillment_status,
              total_amount, discount_amount, delivery_charges, payable_amount,
              city, delivery_address, delivery_date, notes, customer_id, branch_id,
              tenant_id, created_at, deleted_at
       FROM orders
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] || null;
  },

  async findOrderByOrderNoIncludingDeleted(tenantId, orderNo) {
    const [rows] = await readDb.query(
      `SELECT id, order_no, order_source, deleted_at
       FROM orders
       WHERE tenant_id = ? AND order_no = ?
       LIMIT 1`,
      [tenantId, orderNo],
    );
    return rows[0] || null;
  },

  async reviveOrder(tenantId, id) {
    await writeDb.query(
      `UPDATE orders SET deleted_at = NULL WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
    for (const table of [
      "order_items",
      "order_payments",
      "order_assignments",
      "order_cancellations",
      "order_returns",
      "order_exchanges",
      "order_refunds",
    ]) {
      try {
        await writeDb.query(
          `UPDATE \`${table}\` SET deleted_at = NULL
           WHERE tenant_id = ? AND order_id = ? AND deleted_at IS NOT NULL`,
          [tenantId, id],
        );
      } catch {
        // Table may not have deleted_at
      }
    }
  },

  async generateOrderNo(tenantId) {
    const prefix = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const [rows] = await readDb.query(
      `SELECT COUNT(*) AS cnt FROM orders
       WHERE tenant_id = ? AND order_no LIKE ?`,
      [tenantId, `${prefix}%`]
    );
    const seq = (Number(rows[0]?.cnt) || 0) + 1;
    return `${prefix}-${String(seq).padStart(4, "0")}`;
  },

  async createOrder(tenantId, userId, data, items, { deductStock = true } = {}) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO orders
           (order_no, order_source, order_status, payment_status, fulfillment_status,
            total_amount, discount_amount, delivery_charges, payable_amount,
            city, delivery_address, delivery_date, notes,
            customer_id, branch_id, created_by, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          data.order_no,
          data.order_source,
          data.order_status,
          data.payment_status,
          data.fulfillment_status,
          data.total_amount,
          data.discount_amount,
          data.delivery_charges,
          data.payable_amount,
          data.city,
          data.delivery_address,
          data.delivery_date || null,
          data.notes,
          data.customer_id,
          data.branch_id || null,
          userId,
          tenantId,
          data.created_at || null,
        ]
      );
      const orderId = result.insertId;
      const branchId = data.branch_id ? Number(data.branch_id) : null;

      for (const item of items) {
        const itemId = resolveItemId(item);
        await connection.execute(
          `INSERT INTO order_items
             (product_name, sku, quantity, unit_price, discount, total_price, order_id, item_id, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.product_name,
            item.sku,
            item.quantity,
            item.unit_price,
            item.discount,
            item.total_price,
            orderId,
            itemId,
            tenantId,
          ]
        );

        if (deductStock && branchId && itemId && Number(item.quantity) > 0) {
          await consumeStock(connection, tenantId, {
            itemId,
            branchId,
            qty: item.quantity,
            movementType: "sale_out",
            referenceType: "order",
            referenceId: orderId,
            createdBy: userId,
            notes: `Order ${data.order_no}`,
          });
        }
      }
      await connection.commit();
      return orderId;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  async updateOrder(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE orders SET
         order_source = ?, order_status = ?, payment_status = ?, fulfillment_status = ?,
         total_amount = ?, discount_amount = ?, delivery_charges = ?, payable_amount = ?,
         city = ?, delivery_address = ?, delivery_date = ?, notes = ?,
         customer_id = ?, branch_id = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        data.order_source,
        data.order_status,
        data.payment_status,
        data.fulfillment_status,
        data.total_amount,
        data.discount_amount,
        data.delivery_charges,
        data.payable_amount,
        data.city,
        data.delivery_address,
        data.delivery_date || null,
        data.notes,
        data.customer_id,
        data.branch_id || null,
        id,
        tenantId,
      ]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  async replaceOrderItems(tenantId, orderId, items) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE order_items SET deleted_at = NOW()
         WHERE order_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
        [orderId, tenantId]
      );
      for (const item of items) {
        const itemId = resolveItemId(item);
        await connection.execute(
          `INSERT INTO order_items
             (product_name, sku, quantity, unit_price, discount, total_price, order_id, item_id, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.product_name,
            item.sku,
            item.quantity,
            item.unit_price,
            item.discount,
            item.total_price,
            orderId,
            itemId,
            tenantId,
          ]
        );
      }
      await connection.commit();
      return true;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  // Assignments
  async listAssignments(tenantId) {
    const [rows] = await readDb.query(
      `SELECT oa.*, o.order_no, u.name AS assigned_to_name, cb.customer_name AS order_customer_name
       FROM order_assignments oa
       INNER JOIN orders o ON o.id = oa.order_id AND ${joinOnTenant("oa", "o")}
       LEFT JOIN users u ON u.id = oa.assigned_to AND ${joinOnTenant("oa", "u")}
       LEFT JOIN crm_customers cb ON cb.id = o.customer_id AND ${joinOnTenant("o", "cb")}
       WHERE ${tw("oa", tenantId)}
       ORDER BY oa.assigned_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async createAssignment(tenantId, data) {
    const [result] = await writeDb.query(
      `INSERT INTO order_assignments (assigned_to, assignment_type, status, order_id, tenant_id)
       VALUES (?, ?, ?, ?, ?)`,
      [data.assigned_to, data.assignment_type, data.status, data.order_id, tenantId]
    );
    return result.insertId;
  },

  async updateAssignment(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE order_assignments SET assigned_to = ?, assignment_type = ?, status = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [data.assigned_to, data.assignment_type, data.status, id, tenantId]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  async deleteAssignment(tenantId, id) {
    const [result] = await writeDb.query(
      `UPDATE order_assignments SET deleted_at = NOW()
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [id, tenantId]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  // Payments
  async listPayments(tenantId) {
    const [rows] = await readDb.query(
      `SELECT op.*, o.order_no, o.payment_status AS order_payment_status, o.payable_amount,
              c.customer_name
       FROM order_payments op
       INNER JOIN orders o ON o.id = op.order_id AND ${joinOnTenant("op", "o")}
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       WHERE ${tw("op", tenantId)}
       ORDER BY op.id DESC`,
      [tenantId]
    );
    return rows;
  },

  async listPaymentsForOrder(tenantId, orderId) {
    const [rows] = await readDb.query(
      `SELECT id, amount, payment_method, payment_status, paid_at, order_id
       FROM order_payments
       WHERE order_id = ? AND ${tw("order_payments", tenantId)}
       ORDER BY COALESCE(paid_at, id) DESC, id DESC`,
      [orderId, tenantId]
    );
    return rows;
  },

  async listPaymentTransactions(tenantId) {
    const [rows] = await readDb.query(
      `SELECT o.id AS order_id, o.order_no, o.order_status, o.payment_status,
              o.payable_amount, o.created_at, c.customer_name,
              COALESCE(pay.total_received, 0) AS total_received,
              GREATEST(0, o.payable_amount - COALESCE(pay.total_received, 0)) AS amount_due
       FROM orders o
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS total_received
         FROM order_payments
         WHERE tenant_id = ? AND deleted_at IS NULL
           AND payment_status IN ('paid', 'partial')
         GROUP BY order_id
       ) pay ON pay.order_id = o.id
       WHERE ${tw("o", tenantId)}
       ORDER BY o.created_at DESC`,
      [tenantId, tenantId]
    );
    return rows;
  },

  async paymentSummary(tenantId) {
    const [[outstanding]] = await readDb.query(
      `SELECT COALESCE(SUM(GREATEST(0, o.payable_amount - COALESCE(pay.total_paid, 0))), 0) AS outstanding_dues
       FROM orders o
       LEFT JOIN (
         SELECT order_id, SUM(amount) AS total_paid
         FROM order_payments
         WHERE tenant_id = ? AND deleted_at IS NULL AND payment_status IN ('paid', 'partial')
         GROUP BY order_id
       ) pay ON pay.order_id = o.id
       WHERE o.tenant_id = ? AND o.deleted_at IS NULL
         AND o.order_status NOT IN ('cancelled')`,
      [tenantId, tenantId]
    );
    const [[received]] = await readDb.query(
      `SELECT COALESCE(SUM(amount), 0) AS received_this_month
       FROM order_payments
       WHERE tenant_id = ? AND deleted_at IS NULL
         AND payment_status IN ('paid', 'partial')
         AND paid_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [tenantId]
    );
    return {
      outstanding_dues: Number(outstanding?.outstanding_dues || 0),
      received_this_month: Number(received?.received_this_month || 0),
    };
  },

  async createPayment(tenantId, data) {
    const amount = Number(data.amount) || 0;
    const [result] = await writeDb.query(
      `INSERT INTO order_payments (payment_method, amount, payment_status, paid_at, order_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.payment_method || "cash",
        amount,
        data.payment_status,
        data.paid_at,
        data.order_id,
        tenantId,
      ]
    );
    return result.insertId;
  },

  async updatePayment(tenantId, id, data) {
    const amount = Number(data.amount) || 0;
    const [result] = await writeDb.query(
      `UPDATE order_payments
       SET payment_method = ?, amount = ?, payment_status = ?, paid_at = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        data.payment_method || "cash",
        amount,
        data.payment_status,
        data.paid_at,
        id,
        tenantId,
      ]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  async deletePayment(tenantId, id) {
    const [result] = await writeDb.query(
      `UPDATE order_payments SET deleted_at = NOW()
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [id, tenantId]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  async sumPaymentsForOrder(tenantId, orderId) {
    const [[row]] = await readDb.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM order_payments
       WHERE order_id = ? AND tenant_id = ? AND deleted_at IS NULL
         AND payment_status IN ('paid', 'partial')`,
      [orderId, tenantId]
    );
    return Number(row?.total_paid) || 0;
  },

  // Cancellations
  async listCancellations(tenantId) {
    const [rows] = await readDb.query(
      `SELECT oc.*, o.order_no, o.payment_status, o.payable_amount,
              EXISTS (SELECT 1 FROM order_refunds orf
                WHERE orf.order_id = o.id AND orf.deleted_at IS NULL) AS has_refund,
              CASE
                WHEN oc.reason LIKE 'Auto-recorded from order status change%' THEN 'System'
                ELSE u.name
              END AS cancelled_by_name,
              c.customer_name
       FROM order_cancellations oc
       INNER JOIN orders o ON o.id = oc.order_id AND ${joinOnTenant("oc", "o")}
       LEFT JOIN users u ON u.id = oc.cancelled_by AND ${joinOnTenant("oc", "u")}
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       WHERE ${tw("oc", tenantId)}
       ORDER BY oc.cancelled_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async updateCancellation(tenantId, id, data) {
    const fields = [];
    const params = [];
    if (data.cancelled_at != null) {
      fields.push("cancelled_at = ?");
      params.push(data.cancelled_at);
    }
    if (data.reason != null) {
      fields.push("reason = ?");
      params.push(data.reason);
    }
    if (!fields.length) return false;
    const [result] = await writeDb.query(
      `UPDATE order_cancellations SET ${fields.join(", ")}
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [...params, id, tenantId]
    );
    return result.affectedRows > 0;
  },

  async createCancellation(tenantId, userId, data) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const cancelledAt = data.cancelled_at ?? null;
      const [result] = await connection.execute(
        cancelledAt
          ? `INSERT INTO order_cancellations (reason, order_id, cancelled_by, tenant_id, cancelled_at)
             VALUES (?, ?, ?, ?, ?)`
          : `INSERT INTO order_cancellations (reason, order_id, cancelled_by, tenant_id)
             VALUES (?, ?, ?, ?)`,
        cancelledAt
          ? [data.reason, data.order_id, userId, tenantId, cancelledAt]
          : [data.reason, data.order_id, userId, tenantId]
      );
      await connection.execute(
        `UPDATE orders SET order_status = 'cancelled'
         WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
        [data.order_id, tenantId]
      );
      await connection.commit();
      return result.insertId;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  // Returns
  async listReturns(tenantId) {
    const [rows] = await readDb.query(
      `SELECT ort.*, o.order_no, u.name AS created_by_name, c.customer_name
       FROM order_returns ort
       INNER JOIN orders o ON o.id = ort.order_id AND ${joinOnTenant("ort", "o")}
       LEFT JOIN users u ON u.id = ort.created_by AND ${joinOnTenant("ort", "u")}
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       WHERE ${tw("ort", tenantId)}
       ORDER BY ort.created_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async createReturn(tenantId, userId, data) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO order_returns (reason, return_status, order_id, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?)`,
        [data.reason, data.return_status, data.order_id, userId, tenantId]
      );
      await connection.execute(
        `UPDATE orders SET order_status = 'returned'
         WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
        [data.order_id, tenantId]
      );
      await connection.commit();
      return result.insertId;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  async updateReturn(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE order_returns SET reason = ?, return_status = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [data.reason, data.return_status, id, tenantId]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  // Exchanges
  async listExchanges(tenantId) {
    const [rows] = await readDb.query(
      `SELECT oe.*,
              oe.old_item_id AS old_product_id,
              oe.new_item_id AS new_product_id,
              o.order_no, u.name AS created_by_name, c.customer_name,
              oi.item_name AS old_product_name, ni.item_name AS new_product_name
       FROM order_exchanges oe
       INNER JOIN orders o ON o.id = oe.order_id AND ${joinOnTenant("oe", "o")}
       LEFT JOIN users u ON u.id = oe.created_by AND ${joinOnTenant("oe", "u")}
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       LEFT JOIN items oi ON oi.id = oe.old_item_id AND ${joinOnTenant("oe", "oi")}
       LEFT JOIN items ni ON ni.id = oe.new_item_id AND ${joinOnTenant("oe", "ni")}
       WHERE ${tw("oe", tenantId)}
       ORDER BY oe.created_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async createExchange(tenantId, userId, data) {
    const oldItemId = data.old_item_id ?? data.old_product_id;
    const newItemId = data.new_item_id ?? data.new_product_id;
    const [result] = await writeDb.query(
      `INSERT INTO order_exchanges
         (reason, exchange_status, order_id, old_item_id, new_item_id, created_by, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.reason,
        data.exchange_status,
        data.order_id,
        oldItemId,
        newItemId,
        userId,
        tenantId,
      ]
    );
    return result.insertId;
  },

  async updateExchange(tenantId, id, data) {
    const oldItemId = data.old_item_id ?? data.old_product_id;
    const newItemId = data.new_item_id ?? data.new_product_id;
    const [result] = await writeDb.query(
      `UPDATE order_exchanges SET reason = ?, exchange_status = ?,
         old_item_id = ?, new_item_id = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [data.reason, data.exchange_status, oldItemId, newItemId, id, tenantId]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  // Refunds
  async listRefunds(tenantId) {
    const [rows] = await readDb.query(
      `SELECT orf.*, o.order_no, u.name AS created_by_name, c.customer_name
       FROM order_refunds orf
       INNER JOIN orders o ON o.id = orf.order_id AND ${joinOnTenant("orf", "o")}
       LEFT JOIN users u ON u.id = orf.created_by AND ${joinOnTenant("orf", "u")}
       LEFT JOIN crm_customers c ON c.id = o.customer_id AND ${joinOnTenant("o", "c")}
       WHERE ${tw("orf", tenantId)}
       ORDER BY orf.id DESC`,
      [tenantId]
    );
    return rows;
  },

  async createRefund(tenantId, userId, data) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO order_refunds
           (refund_amount, refund_method, refund_status, reason, refunded_at, order_id, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.refund_amount,
          data.refund_method,
          data.refund_status,
          data.reason,
          data.refunded_at,
          data.order_id,
          userId,
          tenantId,
        ]
      );
      if (data.refund_status === "processed") {
        await connection.execute(
          `UPDATE orders SET payment_status = 'refunded'
           WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
          [data.order_id, tenantId]
        );
      }
      await connection.commit();
      return result.insertId;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  },

  async updateRefund(tenantId, id, data) {
    const [result] = await writeDb.query(
      `UPDATE order_refunds SET refund_amount = ?, refund_method = ?, refund_status = ?,
         reason = ?, refunded_at = ?
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        data.refund_amount,
        data.refund_method,
        data.refund_status,
        data.reason,
        data.refunded_at,
        id,
        tenantId,
      ]
    );
    return (result.affectedRows ?? 0) === 1;
  },

  async revertCancellation(tenantId, cancellationId, orderId, previousOrderStatus) {
    await writeDb.query(
      `DELETE FROM order_cancellations WHERE id = ? AND tenant_id = ?`,
      [cancellationId, tenantId],
    );
    await writeDb.query(
      `UPDATE orders SET order_status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [previousOrderStatus, orderId, tenantId],
    );
  },

  async revertReturn(tenantId, returnId, orderId, previousOrderStatus) {
    await writeDb.query(
      `DELETE FROM order_returns WHERE id = ? AND tenant_id = ?`,
      [returnId, tenantId],
    );
    await writeDb.query(
      `UPDATE orders SET order_status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [previousOrderStatus, orderId, tenantId],
    );
  },

  async revertExchange(tenantId, exchangeId) {
    await writeDb.query(
      `DELETE FROM order_exchanges WHERE id = ? AND tenant_id = ?`,
      [exchangeId, tenantId],
    );
  },

  async revertRefund(tenantId, refundId, orderId, previousPaymentStatus) {
    await writeDb.query(
      `DELETE FROM order_refunds WHERE id = ? AND tenant_id = ?`,
      [refundId, tenantId],
    );
    await writeDb.query(
      `UPDATE orders SET payment_status = ? WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [previousPaymentStatus, orderId, tenantId],
    );
  },

  async countOrdersForCustomer(tenantId, customerId) {
    const [[row]] = await readDb.query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE customer_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [customerId, tenantId],
    );
    return Number(row?.count) || 0;
  },

  async countOpenOrdersForProduct(tenantId, productId) {
    const [[row]] = await readDb.query(
      `SELECT COUNT(DISTINCT o.id) AS count
       FROM orders o
       INNER JOIN order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id AND oi.deleted_at IS NULL
       WHERE o.tenant_id = ? AND o.deleted_at IS NULL
         AND oi.item_id = ?
         AND o.order_status NOT IN ('cancelled', 'returned')`,
      [tenantId, productId],
    );
    return Number(row?.count) || 0;
  },
};
