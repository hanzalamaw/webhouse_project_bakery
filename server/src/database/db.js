/** @type {import("mysql2/promise").Pool | null} */
let pool = null;

import { getTenantContext } from "../utils/tenantContext.js";
import {
  assertTenantScopedQuery,
  AUDITED_WRITE_TABLES,
  detectSqlOperation,
  extractRecordId,
  extractTableNames,
} from "../utils/tenantScope.js";

export async function initDb(mysqlPool) {
  pool = mysqlPool;
}

function enforceSql(sql) {
  const ctx = getTenantContext();
  if (ctx?.bypass) return;
  if (ctx?.enforced) {
    assertTenantScopedQuery(sql, { enforced: true });
  }
}

function primaryAuditedTable(sql) {
  const tables = [...extractTableNames(sql)];
  return tables.find((t) => AUDITED_WRITE_TABLES.has(t)) || null;
}

async function maybeAuditWrite(sql, params, result) {
  const ctx = getTenantContext();
  if (!ctx?.enforced || !ctx.tenantId) return;
  const op = detectSqlOperation(sql);
  if (!op || op === "SELECT") return;
  const table = primaryAuditedTable(sql);
  if (!table) return;

  // Avoid recursive audit when writing audit_logs (not in AUDITED_WRITE_TABLES anyway).
  try {
    const { logTenantAudit } = await import("../utils/tenantAudit.js");
    const recordId = extractRecordId(sql, params, Array.isArray(result) ? result[0] : result, op);
    await logTenantAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? null,
      action: `${op.toLowerCase()}:${table}`,
      newValue: {
        table,
        record_id: recordId,
        operation: op,
      },
      ipAddress: ctx.ip ?? null,
      skipIfImpersonated: false,
    });
  } catch {
    // Audit must never break the primary write.
  }
}

async function runQuery(executor, sql, params = []) {
  enforceSql(sql);
  const result = await executor(sql, params);
  const op = detectSqlOperation(sql);
  if (op && op !== "SELECT") {
    maybeAuditWrite(sql, params, result).catch(() => {});
  }
  return result;
}

function wrapConnection(conn) {
  if (conn.__tenantGuarded) return conn;
  const originalExecute = conn.execute.bind(conn);
  const originalQuery = conn.query.bind(conn);
  conn.execute = (sql, params) => runQuery(originalExecute, sql, params);
  conn.query = (sql, params) => runQuery(originalQuery, sql, params);
  conn.__tenantGuarded = true;
  return conn;
}

export const readDb = {
  async query(sql, params = []) {
    if (!pool) throw new Error("Database pool not initialized");
    return runQuery(pool.execute.bind(pool), sql, params);
  },
};

export const writeDb = {
  async query(sql, params = []) {
    if (!pool) throw new Error("Database pool not initialized");
    return runQuery(pool.execute.bind(pool), sql, params);
  },
};

/**
 * Returns a pool facade whose getConnection() wraps execute/query with the tenant guard.
 * Prefer this over the raw mysql2 pool for all application code.
 */
export function getPool() {
  if (!pool) return null;
  return {
    execute: (...args) => pool.execute(...args),
    query: (...args) => pool.query(...args),
    async getConnection() {
      const conn = await pool.getConnection();
      return wrapConnection(conn);
    },
    end: (...args) => pool.end(...args),
  };
}
