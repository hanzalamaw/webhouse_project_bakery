import dotenv from "dotenv";
import { createPool, closePool } from "../src/db/pool.js";

dotenv.config();

function mapPosPaymentToOrder(method) {
  const m = String(method || "cash").trim().toLowerCase();
  if (m === "bank") return "bank_transfer";
  if (["cash", "card", "qr", "easypaisa", "jazzcash", "online", "cod", "bank_transfer", "other"].includes(m)) {
    return m;
  }
  return "other";
}

async function ensureOrderIdColumn(db) {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_sales' AND COLUMN_NAME = 'order_id'`
  );
  if (cols.length) return;
  await db.query(`
    ALTER TABLE pos_sales
      ADD COLUMN order_id INT NULL DEFAULT NULL AFTER crm_customers_id
  `);
  try {
    await db.query(`ALTER TABLE pos_sales ADD UNIQUE INDEX uk_pos_sales_order_id (order_id)`);
  } catch (e) {
    if (e.code !== "ER_DUP_KEYNAME") throw e;
  }
  try {
    await db.query(`
      ALTER TABLE pos_sales
        ADD CONSTRAINT fk_pos_sales_orders
          FOREIGN KEY (order_id) REFERENCES orders (id)
          ON DELETE SET NULL ON UPDATE CASCADE
    `);
  } catch (e) {
    if (e.code !== "ER_DUP_KEYNAME" && e.errno !== 1826) throw e;
  }
  console.log("Added pos_sales.order_id column");
}

async function backfill(db) {
  const [sales] = await db.query(
    `SELECT s.*
     FROM pos_sales s
     WHERE s.deleted_at IS NULL AND s.order_id IS NULL
     ORDER BY s.id ASC`
  );
  console.log(`Found ${sales.length} POS sale(s) to project into Order Management`);

  let created = 0;
  for (const sale of sales) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [items] = await conn.execute(
        `SELECT * FROM pos_sale_items WHERE pos_sale_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
        [sale.id, sale.tenant_id]
      );

      const [orderResult] = await conn.execute(
        `INSERT INTO orders
           (order_no, order_source, order_status, payment_status, fulfillment_status,
            total_amount, discount_amount, delivery_charges, payable_amount,
            city, delivery_address, delivery_date, notes,
            customer_id, branch_id, created_by, tenant_id, created_at)
         VALUES (?, 'pos', 'delivered', 'paid', 'fulfilled',
                 ?, ?, 0, ?,
                 NULL, NULL, NULL, ?,
                 ?, ?, ?, ?, ?)`,
        [
          sale.sale_no,
          sale.total_amount,
          sale.discount_amount || 0,
          sale.payable_amount,
          `POS terminal sale ${sale.sale_no}`,
          sale.crm_customers_id || null,
          sale.branch_id,
          sale.created_by,
          sale.tenant_id,
          sale.created_at,
        ]
      );
      const orderId = orderResult.insertId;

      for (const item of items) {
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
            item.item_id || null,
            sale.tenant_id,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO order_payments (payment_method, amount, payment_status, paid_at, order_id, tenant_id)
         VALUES (?, ?, 'paid', ?, ?, ?)`,
        [
          mapPosPaymentToOrder(sale.payment_method),
          sale.payable_amount,
          sale.created_at,
          orderId,
          sale.tenant_id,
        ]
      );

      await conn.execute(
        `UPDATE pos_sales SET order_id = ? WHERE id = ? AND tenant_id = ?`,
        [orderId, sale.id, sale.tenant_id]
      );

      await conn.commit();
      created += 1;
      console.log(`  ${sale.sale_no} → order #${orderId}`);
    } catch (err) {
      await conn.rollback();
      console.error(`  Failed ${sale.sale_no}:`, err.message);
    } finally {
      conn.release();
    }
  }
  console.log(`Backfilled ${created} sale(s)`);
}

const db = await createPool();
try {
  await ensureOrderIdColumn(db);
  await backfill(db);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await closePool(db);
}
