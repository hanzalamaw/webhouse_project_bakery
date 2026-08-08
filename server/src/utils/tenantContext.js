/**
 * AsyncLocalStorage tenant context — tenant_id must come from verified JWT only.
 * Fail closed under enforced tenant requests; platform/jobs use bypass.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const tenantContext = new AsyncLocalStorage();

/**
 * @returns {{ tenantId?: number|null, userId?: number|null, enforced?: boolean, bypass?: boolean, ip?: string|null, impersonatedBy?: number|null } | null}
 */
export function getTenantContext() {
  return tenantContext.getStore() || null;
}

/** @returns {number} */
export function requireTenantId() {
  const ctx = getTenantContext();
  const id = ctx?.tenantId != null ? Number(ctx.tenantId) : NaN;
  if (!ctx?.enforced || !Number.isInteger(id) || id <= 0) {
    throw new Error("Tenant isolation: tenant_id could not be resolved from auth context");
  }
  return id;
}

export function runWithTenantContext(store, fn) {
  return tenantContext.run(store, fn);
}

/** Jobs / WH cascades that intentionally touch scoped rows without a request tenant. */
export function runWithPlatformBypass(fn) {
  return tenantContext.run({ enforced: false, bypass: true, tenantId: null, userId: null }, fn);
}
