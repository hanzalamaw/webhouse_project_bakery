export function requireTenant(req, res, next) {
  const tenantId = Number(req.tenantId);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return res.status(403).json({ message: "Tenant context required" });
  }
  // Never trust body/query/header overrides — JWT is the only source.
  req.tenantId = tenantId;
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    delete req.body.tenant_id;
    delete req.body.tenantId;
  }
  next();
}
