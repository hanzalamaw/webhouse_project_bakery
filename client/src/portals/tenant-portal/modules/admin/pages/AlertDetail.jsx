import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { PageHeader } from "../../../../../components/PageHeader";
import { FormPageAlerts } from "../../../../../components/FormPageLayout";
import { Card } from "../../../../../components/Card";
import { Button } from "../../../../../components/Button";
import { StatusBadge } from "../../../../../components/Badge";
import { LogMetaList, humanizeKey } from "../../../../../components/LogDetailBody";
import { useAuth } from "../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../hooks/useModulePermission";
import { apiFetch, fetchAllTableRows } from "../../../../../api/client";
import { formatDateTime } from "../../../../../utils/dateTime";

const MODULE_BASE = "/app/m/admin";

export default function AlertDetail() {
  const { alertId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { canEdit } = useModulePermission("admin");

  const [row, setRow] = useState(() => location.state?.row || null);
  const [loading, setLoading] = useState(() => !location.state?.row);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) return;
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAllTableRows("/tenant/activity-alerts", authFetch);
        const found = rows.find((r) => String(r.id) === String(alertId));
        if (!alive) return;
        if (found) setRow(found);
        else setError("This alert could not be found.");
      } catch (err) {
        if (alive) setError(err.message || "Failed to load the alert.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [row, alertId, authFetch]);

  const markRead = async () => {
    if (!canEdit || !row || row.is_read) return;
    try {
      await apiFetch(`/tenant/activity-alerts/${row.id}/read`, { method: "PATCH" }, authFetch);
      setRow((r) => ({ ...r, is_read: 1 }));
    } catch (err) {
      setError(err.message || "Failed to mark alert as read");
    }
  };

  const meta = row
    ? [
        { label: "When", value: formatDateTime(row.created_at) },
        { label: "Type", value: humanizeKey(row.alert_type || "") },
        { label: "Priority", value: humanizeKey(row.priority || "") },
        {
          label: "Status",
          value: row.is_read ? <StatusBadge status="inactive" /> : <StatusBadge status="pending" />,
        },
      ]
    : [];

  return (
    <div className="wh-page">
      <PageHeader
        title={row?.title || "Alert details"}
        description={row ? formatDateTime(row.created_at) : "Full details of this alert."}
        actions={
          <>
            {row && !row.is_read && (
              <Button onClick={markRead} disabled={!canEdit}>
                Mark read
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/activity-alerts`)}>
              Back to Alerts
            </Button>
          </>
        }
      />
      <FormPageAlerts error={error} />
      {loading ? (
        <Card>
          <p className="wh-muted">Loading…</p>
        </Card>
      ) : row ? (
        <div className="wh-log-detail">
          <Card>
            <h3 className="wh-log-detail__diff-title">Overview</h3>
            <LogMetaList meta={meta} />
          </Card>
          <Card>
            <h3 className="wh-log-detail__diff-title">Message</h3>
            <p className="wh-log-detail__summary">{row.message || "No message was recorded for this alert."}</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
