import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { fetchAllTableRows } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { Button } from "../../../../../../components/Button";
import { StatCard } from "../../../../../../components/StatCard";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailValue } from "../../../../../../components/DetailValue";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MODULE_BASE } from "../../constants";

const LIST_API = "/inventory/stock-transfers";

export default function ViewStockTransfer() {
  const { transferId } = useParams();
  const location = useLocation();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const backPath = `${MODULE_BASE}/stock/transfers`;
  const [transfer, setTransfer] = useState(location.state?.transfer ?? null);
  const [loading, setLoading] = useState(!location.state?.transfer);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAllTableRows(LIST_API, authFetch);
      const found = rows.find((r) => String(r.id) === String(transferId));
      if (!found) {
        setTransfer(null);
        setError("Transfer not found");
      } else {
        setTransfer(found);
      }
    } catch (e) {
      setTransfer(null);
      setError(e.message || "Transfer not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, transferId]);

  useEffect(() => {
    if (location.state?.transfer) return;
    load().catch(() => {});
  }, [load, location.state?.transfer]);

  if (loading) {
    return <div className="wh-page"><p className="wh-muted">Loading…</p></div>;
  }

  if (!transfer) {
    return (
      <div className="wh-page">
        <PageHeader title="Transfer" />
        <p className="wh-field__error">{error || "Transfer not found"}</p>
        <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <PageHeader
        title="Transfer details"
        description={`${transfer.item_name} · ${formatDateTime(transfer.created_at)}`}
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
            {transfer.item_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/view/${transfer.item_id}`)}>
                View item
              </Button>
            )}
          </div>
        }
      />

      <div className="wh-stat-grid">
        <StatCard
          label="Quantity moved"
          value={`${Number(transfer.qty || 0).toLocaleString()} ${transfer.unit || ""}`.trim()}
        />
        <StatCard label="From" value={transfer.from_branch_name || "—"} />
        <StatCard label="To" value={transfer.to_branch_name || "—"} />
        <StatCard label="Status" value={transfer.transfer_status || "—"} />
      </div>

      <div className="wh-entity-view-grid">
        <Card>
          <h3 className="wh-card__title">What transferred</h3>
          <div className="wh-detail-grid">
            <DetailValue label="Item">{transfer.item_name}</DetailValue>
            <DetailValue label="Unit">{transfer.unit || "—"}</DetailValue>
            <DetailValue label="Quantity">{Number(transfer.qty || 0).toLocaleString()}</DetailValue>
            <DetailValue label="Status"><StatusBadge status={transfer.transfer_status} /></DetailValue>
          </div>
        </Card>

        <Card>
          <h3 className="wh-card__title">Route & timing</h3>
          <div className="wh-detail-grid">
            <DetailValue label="From branch">{transfer.from_branch_name}</DetailValue>
            <DetailValue label="To branch">{transfer.to_branch_name}</DetailValue>
            <DetailValue label="Created">{formatDateTime(transfer.created_at)}</DetailValue>
            <DetailValue label="Updated">{formatDateTime(transfer.updated_at)}</DetailValue>
            <DetailValue label="Notes" fullWidth multiline>{transfer.notes || "—"}</DetailValue>
          </div>
        </Card>
      </div>
    </div>
  );
}
