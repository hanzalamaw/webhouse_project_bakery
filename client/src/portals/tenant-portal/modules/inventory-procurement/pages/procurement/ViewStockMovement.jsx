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
import { formatPKR } from "../../../../../../utils/currency";
import { MOVEMENT_LABELS, MODULE_BASE } from "../../constants";

const LIST_API = "/inventory/stock-movements";

export default function ViewStockMovement() {
  const { movementId } = useParams();
  const location = useLocation();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const backPath = location.state?.backPath || `${MODULE_BASE}/stock/movement-history`;
  const [movement, setMovement] = useState(location.state?.movement ?? null);
  const [loading, setLoading] = useState(!location.state?.movement);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAllTableRows(LIST_API, authFetch);
      const found = rows.find((r) => String(r.id) === String(movementId));
      if (!found) {
        setMovement(null);
        setError("Movement not found");
      } else {
        setMovement(found);
      }
    } catch (e) {
      setMovement(null);
      setError(e.message || "Movement not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, movementId]);

  useEffect(() => {
    if (location.state?.movement) return;
    load().catch(() => {});
  }, [load, location.state?.movement]);

  if (loading) {
    return <div className="wh-page"><p className="wh-muted">Loading…</p></div>;
  }

  if (!movement) {
    return (
      <div className="wh-page">
        <PageHeader title="Stock movement" />
        <p className="wh-field__error">{error || "Movement not found"}</p>
        <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
      </div>
    );
  }

  const typeLabel = MOVEMENT_LABELS[movement.movement_type] || movement.movement_type;
  const lineValue = (Number(movement.qty) || 0) * (Number(movement.unit_cost) || 0);
  const isIn = String(movement.movement_type || "").includes("_in") || movement.movement_type === "purchase_in" || movement.movement_type === "production_in" || movement.movement_type === "transfer_in";

  return (
    <div className="wh-page">
      <PageHeader
        title={typeLabel}
        description={`${movement.item_name} · ${formatDateTime(movement.created_at)}`}
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
            {movement.item_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/view/${movement.item_id}`)}>
                View item
              </Button>
            )}
            {movement.branch_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/branches/view/${movement.branch_id}`)}>
                View branch
              </Button>
            )}
          </div>
        }
      />

      <div className="wh-stat-grid">
        <StatCard
          label="Quantity"
          value={`${Number(movement.qty || 0).toLocaleString()} ${movement.unit || ""}`.trim()}
          tone={isIn ? "success" : "warning"}
          hint={isIn ? "Stock increased" : "Stock decreased"}
        />
        <StatCard label="Unit cost" value={formatPKR(movement.unit_cost)} />
        <StatCard label="Line value" value={formatPKR(lineValue)} hint="Qty × unit cost" />
        <StatCard label="Movement" value={typeLabel} />
      </div>

      <div className="wh-entity-view-grid">
        <Card>
          <h3 className="wh-card__title">What moved</h3>
          <div className="wh-detail-grid">
            <DetailValue label="Item">{movement.item_name}</DetailValue>
            <DetailValue label="Unit">{movement.unit || "—"}</DetailValue>
            <DetailValue label="Quantity">{Number(movement.qty || 0).toLocaleString()}</DetailValue>
            <DetailValue label="Batch">{movement.batch_no || "—"}</DetailValue>
            <DetailValue label="Type"><StatusBadge status={typeLabel} /></DetailValue>
            <DetailValue label="Reference">
              {movement.reference_type ? `${movement.reference_type}${movement.reference_id ? ` #${movement.reference_id}` : ""}` : "—"}
            </DetailValue>
          </div>
        </Card>

        <Card>
          <h3 className="wh-card__title">Where & who</h3>
          <div className="wh-detail-grid">
            <DetailValue label="Branch">{movement.branch_name}</DetailValue>
            <DetailValue label="Recorded by">{movement.created_by_name || "—"}</DetailValue>
            <DetailValue label="When">{formatDateTime(movement.created_at)}</DetailValue>
            <DetailValue label="Unit cost">{formatPKR(movement.unit_cost)}</DetailValue>
            <DetailValue label="Notes" fullWidth multiline>{movement.notes || "—"}</DetailValue>
          </div>
        </Card>
      </div>
    </div>
  );
}
