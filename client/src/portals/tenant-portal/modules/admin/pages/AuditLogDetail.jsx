import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PageHeader } from "../../../../../components/PageHeader";
import { Card } from "../../../../../components/Card";
import { Button } from "../../../../../components/Button";
import { LogMetaList, LogChanges } from "../../../../../components/LogDetailBody";
import { useAuth } from "../../../../../context/AuthContext";
import { fetchAllTableRows } from "../../../../../api/client";
import { formatDateTime } from "../../../../../utils/dateTime";
import { formatSessionIp } from "../../../../../utils/sessionDisplay";
import { formatTenantAuditAction } from "../../../../../utils/auditActionLabels";

const MODULE_BASE = "/app/m/admin";

export default function AuditLogDetail() {
  const { logId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [row, setRow] = useState(() => location.state?.row || null);
  const [loading, setLoading] = useState(() => !location.state?.row);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) return;
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAllTableRows("/tenant/audit-logs", authFetch);
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
  }, [row, logId, authFetch]);

  const actionLabel = row ? formatTenantAuditAction(row.action) : "Log details";

  const meta = row
    ? [
        { label: "When", value: formatDateTime(row.created_at) },
        { label: "User", value: row.user_name },
        { label: "Email", value: row.user_email },
        { label: "Module", value: row.module_name },
        { label: "IP address", value: formatSessionIp(row.ip_address) },
        { label: "Device", value: row.device_info },
      ]
    : [];

  return (
    <div className="wh-page">
      <PageHeader
        title={actionLabel}
        description={
          row
            ? `${row.user_name ? `${row.user_name} · ` : ""}${formatDateTime(row.created_at)}`
            : "Full details of this log entry."
        }
        actions={
          <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/audit-logs`)}>
            Back to Audit Logs
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
