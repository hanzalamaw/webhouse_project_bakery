import { getPool } from "../database/db.js";
import { parseEntityId } from "./ids.js";
import { TENANT_SCOPED_TABLES } from "./tenantScope.js";

/** Tables with tenant_id — soft-deleted when deleting one tenant (child tables first). */
const TENANT_CHILD_TABLES = [
  // Production
  "production_run_consumption",
  "production_runs",
  "recipe_ingredients",
  "recipes",
  // Stock & purchasing
  "wastage",
  "stock_movements",
  "stock_transfers",
  "stock_levels",
  "stock_batches",
  "purchase_order_items",
  "purchase_orders",
  "suppliers",
  "items",
  "item_categories",
  "branches",
  // POS terminal (branches-based)
  "pos_refunds",
  "pos_sale_items",
  "pos_sales",
  "pos_cash_registers",
  "pos_terminals",
  // Finance
  "finance_transactions",
  "finance_vendor_payments",
  "finance_expenses",
  "finance_recurring_expenses",
  "finance_vendor_bills",
  "finance_expense_sub_categories",
  "finance_expense_categories",
  "finance_bank_accounts",
  // Orders
  "order_refunds",
  "order_exchanges",
  "order_returns",
  "order_cancellations",
  "order_payments",
  "order_assignments",
  "order_items",
  "orders",
  // CRM
  "crm_customer_complaints",
  "crm_customer_addresses",
  "crm_leads",
  "crm_customers",
  // WH billing & platform tenant config
  "wh_tenant_modules",
  "wh_tenant_limits",
  "wh_tenant_subscriptions",
  "wh_tenant_payments",
  "wh_support_tickets",
  "organization_settings",
  "activity_alerts",
  "sessions",
  "audit_logs",
  "users",
  "roles",
].filter((t) => TENANT_SCOPED_TABLES.has(t));

async function scopedUpdate(connection, sql, params) {
  const [result] = await connection.execute(sql, params);
  return result.affectedRows ?? 0;
}

/** Soft-delete one tenant and its child rows only (deleted_at on matching tenant_id). */
export async function cascadeSoftDeleteTenant(rawTenantId) {
  const tenantId = parseEntityId(rawTenantId, "tenant id");
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [exists] = await connection.execute(
      `SELECT id FROM wh_tenants WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [tenantId]
    );
    if (!exists.length) {
      await connection.rollback();
      return false;
    }

    for (const table of TENANT_CHILD_TABLES) {
      await scopedUpdate(
        connection,
        `UPDATE \`${table}\` SET deleted_at = NOW()
         WHERE tenant_id = ? AND deleted_at IS NULL`,
        [tenantId]
      );
    }

    await scopedUpdate(
      connection,
      `UPDATE permissions
       SET deleted_at = NOW()
       WHERE deleted_at IS NULL
         AND role_id IN (
           SELECT id FROM roles WHERE tenant_id = ? AND deleted_at IS NULL
         )`,
      [tenantId]
    );

    const tenantRows = await scopedUpdate(
      connection,
      `UPDATE wh_tenants SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [tenantId]
    );

    if (tenantRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.commit();
    return true;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Soft-delete one subscription plan and its module links only. */
export async function cascadeSoftDeleteSubscriptionPlan(rawPlanId) {
  const planId = parseEntityId(rawPlanId, "plan id");
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [exists] = await connection.execute(
      `SELECT id FROM wh_subscription_plans WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [planId]
    );
    if (!exists.length) {
      await connection.rollback();
      return false;
    }

    await scopedUpdate(
      connection,
      `UPDATE wh_subscription_module SET deleted_at = NOW()
       WHERE subscription_plan_id = ? AND deleted_at IS NULL`,
      [planId]
    );

    const planRows = await scopedUpdate(
      connection,
      `UPDATE wh_subscription_plans SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [planId]
    );

    if (planRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.commit();
    return true;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

/** Soft-delete one module and junction rows that reference it only. */
export async function cascadeSoftDeleteModule(rawModuleId) {
  const moduleId = parseEntityId(rawModuleId, "module id");
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [exists] = await connection.execute(
      `SELECT id FROM modules WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [moduleId]
    );
    if (!exists.length) {
      await connection.rollback();
      return false;
    }

    await scopedUpdate(
      connection,
      `UPDATE wh_subscription_module SET deleted_at = NOW()
       WHERE module_id = ? AND deleted_at IS NULL`,
      [moduleId]
    );

    await scopedUpdate(
      connection,
      `UPDATE wh_tenant_modules SET deleted_at = NOW()
       WHERE module_id = ? AND deleted_at IS NULL`,
      [moduleId]
    );

    const moduleRows = await scopedUpdate(
      connection,
      `UPDATE modules SET deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [moduleId]
    );

    if (moduleRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.commit();
    return true;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}
