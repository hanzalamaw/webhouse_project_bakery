/**
 * Smoke checks for tenant SQL guard helpers (run: node scripts/check-tenant-guard.js)
 */
import {
  assertTenantScopedQuery,
  extractTableNames,
  stripTenantIdFromBody,
} from "../src/utils/tenantScope.js";

function expectThrow(fn, label) {
  try {
    fn();
    throw new Error(`Expected throw: ${label}`);
  } catch (e) {
    if (String(e.message).includes("Expected throw")) throw e;
  }
}

assertTenantScopedQuery("SELECT * FROM items WHERE tenant_id = ?", { enforced: true });
assertTenantScopedQuery("INSERT INTO items (item_name, tenant_id) VALUES (?, ?)", { enforced: true });
expectThrow(
  () => assertTenantScopedQuery("SELECT * FROM items WHERE id = ?", { enforced: true }),
  "select missing tenant"
);
expectThrow(
  () => assertTenantScopedQuery("UPDATE items SET item_name = ? WHERE id = ?", { enforced: true }),
  "update missing tenant"
);
assertTenantScopedQuery("SELECT * FROM items WHERE id = ?", { enforced: false });

const tables = extractTableNames("SELECT i.* FROM items i JOIN branches b ON b.id = 1");
if (!tables.has("items") || !tables.has("branches")) throw new Error("extractTableNames failed");

const stripped = stripTenantIdFromBody({ name: "x", tenant_id: 99, tenantId: 88, amount: 1 });
if (stripped.tenant_id != null || stripped.tenantId != null || stripped.amount !== 1) {
  throw new Error("stripTenantIdFromBody failed");
}

console.log("tenant guard smoke checks passed");
