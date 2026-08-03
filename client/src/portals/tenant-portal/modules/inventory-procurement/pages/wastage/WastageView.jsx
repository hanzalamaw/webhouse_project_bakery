import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailGrid, DetailValue, RecordViewSummary } from "../../../../../../components/RecordView";
import { ViewKpi, ViewPanel, formatCount } from "../../../../../../components/EntityViewLayout";
import { ProductIcon, WarehouseIcon, LogsIcon } from "../../../../../../components/icons";
import { formatDateTime, formatDate } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { useT } from "../../../../../../context/LanguageContext";
import { MODULE_BASE, WASTAGE_REASON_LABELS } from "../../constants";

export default function WastageView() {
  const { wastageId } = useParams();
  const location = useLocation();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [row, setRow] = useState(location.state?.row || null);
  const [loading, setLoading] = useState(!location.state?.row);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRow(await apiFetch(`/inventory/wastage/${wastageId}`, {}, authFetch));
    } catch (e) {
      setRow(null);
      setError(e.message || "Wastage record not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, wastageId]);

  useEffect(() => {
    if (location.state?.row) return;
    load().catch(() => {});
  }, [load, location.state?.row]);

  if (loading) {
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!row) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Wastage record not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/wastage`)}>Back</Button>
      </div>
    );
  }

  const reasonLabel = t(WASTAGE_REASON_LABELS[row.reason] || row.reason);
  const unitCost = Number(row.qty) > 0 ? Number(row.estimated_cost || 0) / Number(row.qty) : 0;
  const qtyLabel = `${formatCount(row.qty)} ${row.unit || ""}`.trim();

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Wastage details"
        description="What was lost, where, and the estimated cost."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/wastage`)}>Back</Button>
            {row.item_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/view/${row.item_id}`)}>
                View item
              </Button>
            )}
            {row.branch_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/branches/view/${row.branch_id}`)}>
                View branch
              </Button>
            )}
          </div>
        }
      />

      <RecordViewSummary
        title={row.item_name || "Wastage"}
        subtitle={`${row.branch_name || "Branch"} · ${row.wastage_date ? formatDate(row.wastage_date) : "—"}`}
        status={row.reason}
        chips={[
          { label: "Qty", value: qtyLabel || "—" },
          { label: "Reason", value: reasonLabel || "—" },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Quantity wasted"
            value={qtyLabel || "—"}
            hint={row.batch_no ? `Batch ${row.batch_no}` : "No batch"}
            tone="warning"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Estimated cost"
            value={formatPKR(row.estimated_cost)}
            hint="Loss value"
            tone="danger"
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Unit cost used"
            value={formatPKR(unitCost)}
            hint="Cost ÷ qty"
            icon={<LogsIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Branch"
            value={row.branch_name || "—"}
            hint={row.city || "Location"}
            icon={<WarehouseIcon />}
          />
        </div>
      </div>

      <ViewPanel title="Record details">
        <DetailGrid columns={3}>
          <DetailValue label="Item" highlight>{row.item_name}</DetailValue>
          <DetailValue label="SKU">{row.sku || "—"}</DetailValue>
          <DetailValue label="Batch">{row.batch_no || "—"}</DetailValue>
          <DetailValue label="Reason"><StatusBadge status={row.reason} /> {reasonLabel}</DetailValue>
          <DetailValue label="Wastage date">{row.wastage_date ? formatDate(row.wastage_date) : "—"}</DetailValue>
          <DetailValue label="Branch">{row.branch_name || "—"}</DetailValue>
          <DetailValue label="Recorded by">{row.created_by_name || "—"}</DetailValue>
          <DetailValue label="Recorded at">{formatDateTime(row.created_at)}</DetailValue>
          <DetailValue label="Estimated cost">{formatPKR(row.estimated_cost)}</DetailValue>
          <DetailValue label="Notes" fullWidth multiline>{row.notes || "—"}</DetailValue>
        </DetailGrid>
      </ViewPanel>
    </div>
  );
}
