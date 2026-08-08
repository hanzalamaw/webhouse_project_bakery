import { requireTenant } from "./tenantAuth.js";
import { impersonationAudit } from "./impersonationAudit.js";
import { stripTenantIdFromBody } from "../utils/tenantScope.js";
import { sessionRepository } from "../repositories/sessionRepository.js";

/** Reject client-supplied tenant_id / tenantId on body (auth context is the only source). */
export function rejectBodyTenantOverride(req, _res, next) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    req.body = stripTenantIdFromBody(req.body);
  }
  if (req.query && typeof req.query === "object") {
    const { tenant_id: _a, tenantId: _b, ...rest } = req.query;
    req.query = rest;
  }
  next();
}

/** Fail closed: tenant JWTs must have an active session (unless WH is impersonating). */
export async function requireActiveTenantSession(req, res, next) {
  if (req.userRole !== "tenant") return next();
  if (req.impersonatedBy) return next();
  if (!req.sessionId) {
    return res.status(401).json({ message: "Session required" });
  }
  const active = await sessionRepository.isActive(req.sessionId, req.tenantId);
  if (!active) {
    return res.status(401).json({ message: "Session terminated" });
  }
  next();
}

export function tenantRouteAuth(verifyToken) {
  return [
    verifyToken,
    requireTenant,
    rejectBodyTenantOverride,
    requireActiveTenantSession,
    impersonationAudit,
  ];
}
