import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../../../components/PageHeader";
import { Card } from "../../../../components/Card";
import { Button } from "../../../../components/Button";
import { LogMetaList, LogChanges } from "../../../../components/LogDetailBody";
import { useAuth } from "../../../../context/AuthContext";
import { fetchAllTableRows } from "../../../../api/client";
import { formatDateTime } from "../../../../utils/dateTime";
import { formatSessionIp } from "../../../../utils/sessionDisplay";
import { formatWhAuditAction, formatTenantAuditAction } from "../../../../utils/auditActionLabels";

export default function LogDetail() {
  const { logId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "tenant" ? "tenant" : "wh";
  const tenantId = searchParams.get("tenant_id") || "";

  const [row, setRow] = useState(() => location.state?.row || null);
  const [loading, setLoading] = useState(() => !location.state?.row);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) return;
    let alive = true;
    (async () => {
      try {
        const path = mode === "wh" ? "/logs/wh" : `/logs/tenant?tenant_id=${tenantId}`;
        const rows = await fetchAllTableRows(path, authFetch);
        const found = rows.find((r) => String(r.id) === String(logId));
        if (!alive) return;
        if (found) setRow(found);
        else setError("This log entry could not be found.");
      } catch (err) {
        if (alive) setError(err.message || "Failed to load the log entry.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [row, mode, tenantId, logId, authFetch]);

  const backTo =
    mode === "tenant"
      ? `/webhouse-portal/logs?mode=tenant&tenant_id=${tenantId}`
      : "/webhouse-portal/logs";

  const actionLabel = row
    ? mode === "wh"
      ? formatWhAuditAction(row.action)
      : formatTenantAuditAction(row.action)
    : "Log details";
  const who = row?.admin_name || row?.user_name || "";

  const meta = row
    ? [
        { label: "When", value: formatDateTime(row.created_at) },
        { label: mode === "wh" ? "Admin" : "User", value: who },
        { label: "Email", value: row.admin_email || row.user_email },
        mode === "tenant" && { label: "Module", value: row.module_name },
        mode === "tenant" && { label: "Company", value: row.company_name },
        { label: "IP address", value: formatSessionIp(row.ip_address) },
        { label: "Device", value: row.device_info },
      ].filter(Boolean)
    : [];

  return (
    <div className="wh-page">
      <PageHeader
        title={actionLabel}
        description={row ? `${who ? `${who} · ` : ""}${formatDateTime(row.created_at)}` : "Full details of this log entry."}
        actions={
          <Button variant="secondary" onClick={() => navigate(backTo)}>
            Back to Logs
          </Button>
        }
      />
      {loading ? (
        <Card>
          <p className="wh-muted">Loading…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="wh-muted">{error}</p>
        </Card>
      ) : (
        <div className="wh-log-detail">
          <Card>
            <h3 className="wh-log-detail__diff-title">Overview</h3>
            <LogMetaList meta={meta} />
          </Card>
          <Card>
            <h3 className="wh-log-detail__diff-title">What changed</h3>
            <LogChanges oldValue={row.old_value} newValue={row.new_value} />
          </Card>
        </div>
      )}
    </div>
  );
}
