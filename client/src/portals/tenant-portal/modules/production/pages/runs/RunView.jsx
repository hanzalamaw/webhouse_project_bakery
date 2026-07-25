import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { DetailGrid, DetailValue, RecordViewSummary } from "../../../../../../components/RecordView";
import { ViewKpi, ViewPanel, formatCount } from "../../../../../../components/EntityViewLayout";
import { ProductIcon, LogsIcon } from "../../../../../../components/icons";
import { formatDateTime, formatDate } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { MODULE_BASE, RUN_STATUS_LABELS } from "../../constants";

export default function RunView() {
  const { runId } = useParams();
  const { authFetch } = useAuth();
  const { canEdit } = useModulePermission("production");
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRun(await apiFetch(`/production/runs/${runId}`, {}, authFetch));
    } catch (e) {
      setRun(null);
      setError(e.message || "Production run not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, runId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const consumption = run?.consumption || [];
  const unitCost = useMemo(() => {
    if (!run) return 0;
    const qty = Number(run.quantity_produced) || 0;
    if (qty <= 0) return 0;
    return (Number(run.total_cost) || 0) / qty;
  }, [run]);

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const updated = await apiFetch(
        `/production/runs/${runId}/cancel`,
        { method: "POST", body: JSON.stringify({}) },
        authFetch
      );
      setRun(updated);
      setCancelOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!run) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Production run not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/runs/manage`)}>Back</Button>
      </div>
    );
  }

  const qtyLabel = `${formatCount(run.quantity_produced)} ${run.finished_unit || ""}`.trim();

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Bake details"
        description="Output, cost, and ingredients consumed."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/runs/manage`)}>Back</Button>
            {run.recipe_id && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/view/${run.recipe_id}`)}>
                View recipe
              </Button>
            )}
            {canEdit && run.status !== "cancelled" && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel bake</Button>
            )}
          </div>
        }
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <RecordViewSummary
        title={run.production_no}
        subtitle={`${run.finished_item_name || "Finished item"} · ${run.branch_name || "Branch"}`}
        status={run.status}
        chips={[
          { label: "Made", value: qtyLabel || "—" },
          { label: "On", value: run.produced_on ? formatDate(run.produced_on) : "—" },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Quantity made"
            value={qtyLabel || "—"}
            hint={RUN_STATUS_LABELS[run.status] || run.status}
            tone="success"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Total cost"
            value={formatPKR(run.total_cost)}
            hint="Ingredient consumption"
            tone="accent"
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Cost / unit"
            value={formatPKR(unitCost)}
            hint="Total ÷ quantity"
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Ingredients used"
            value={formatCount(consumption.length)}
            hint="FIFO consumption lines"
            icon={<LogsIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <ViewPanel title="Ingredients used (FIFO)" subtitle="Batches deducted for this bake" flush>
            {consumption.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Qty used</th>
                    <th>Unit cost</th>
                    <th>Line cost</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {consumption.map((row) => {
                    const lineCost = (Number(row.qty_consumed) || 0) * (Number(row.unit_cost) || 0);
                    return (
                      <tr key={row.id || `${row.ingredient_item_id}-${row.batch_no}`}>
                        <td>{row.ingredient_name}</td>
                        <td>
                          {`${Number(row.qty_consumed || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.ingredient_unit || ""}`.trim()}
                        </td>
                        <td>{formatPKR(row.unit_cost)}</td>
                        <td>{formatPKR(lineCost)}</td>
                        <td className="wh-muted">{row.batch_no || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No consumption lines recorded.</p>
            )}
          </ViewPanel>
        </div>
        <div className="wh-dash-col-4">
          <ViewPanel title="Bake summary" subtitle="Where and when">
            <DetailGrid columns={1}>
              <DetailValue label="Finished item" highlight>{run.finished_item_name || "—"}</DetailValue>
              <DetailValue label="Branch">{run.branch_name || "—"}</DetailValue>
              <DetailValue label="Produced on">{run.produced_on ? formatDate(run.produced_on) : "—"}</DetailValue>
              <DetailValue label="Expiry">{run.expiry_date ? formatDate(run.expiry_date) : "—"}</DetailValue>
              <DetailValue label="Status"><StatusBadge status={run.status} /></DetailValue>
              <DetailValue label="Baked by">{run.created_by_name || "—"}</DetailValue>
              <DetailValue label="Created">{formatDateTime(run.created_at)}</DetailValue>
              <DetailValue label="Notes" fullWidth multiline>{run.notes || "—"}</DetailValue>
            </DetailGrid>
          </ViewPanel>
        </div>
      </div>

      <ConfirmDeleteModal
        open={cancelOpen}
        title="Cancel bake"
        recordName={run.production_no || "this bake"}
        categoryLabel="production run"
        cascadeItems={[
          "This marks the run as cancelled only.",
          "Ingredient stock and finished stock are not automatically reversed.",
        ]}
        confirmPhrase="CANCEL"
        onConfirm={confirmCancel}
        onClose={() => setCancelOpen(false)}
        loading={cancelling}
      />
    </div>
  );
}
