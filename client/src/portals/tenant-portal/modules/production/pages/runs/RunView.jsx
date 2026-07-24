import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { RecordViewSummary, DetailGrid, DetailValue } from "../../../../../../components/RecordView";
import { DataTable } from "../../../../../../components/DataTable";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { formatDateTime } from "../../../../../../utils/dateTime";
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
    return (
      <div className="wh-page">
        <FormPageLayout>
          <p className="wh-muted">Loading…</p>
        </FormPageLayout>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <div className="wh-alert wh-alert--error">{error || "Production run not found"}</div>
          <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/runs/manage`)}>
            Back to runs
          </Button>
        </FormPageLayout>
      </div>
    );
  }

  const consumptionColumns = [
    { key: "ingredient_name", label: "Ingredient (Kacha Maal)" },
    {
      key: "qty_consumed",
      label: "Qty used",
      format: (v, row) => `${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.ingredient_unit || ""}`.trim(),
    },
    {
      key: "unit_cost",
      label: "Unit cost",
      format: (v) => formatPKR(v),
    },
    {
      key: "batch_no",
      label: "Batch",
      format: (v) => v || "—",
    },
  ];

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title="Bake details"
          description="What was produced and which ingredients were used."
          actions={
            <div className="wh-action-btns">
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/runs/manage`)}>
                All runs
              </Button>
              {canEdit && run.status !== "cancelled" && (
                <Button variant="danger" onClick={() => setCancelOpen(true)}>
                  Cancel bake
                </Button>
              )}
            </div>
          }
        />

        {error && <div className="wh-alert wh-alert--error">{error}</div>}

        <div className="wh-form-stack">
          <RecordViewSummary
            title={run.production_no}
            subtitle={run.finished_item_name || "Finished item"}
            status={run.status}
            chips={[
              {
                label: "Quantity Made",
                value: `${Number(run.quantity_produced || 0).toLocaleString()} ${run.finished_unit || ""}`.trim(),
              },
              { label: "Branch (Shop)", value: run.branch_name || "—" },
              { label: "Cost", value: formatPKR(run.total_cost) },
            ]}
          />

          <FormBlock title="Production run" description="Bake summary.">
            <DetailGrid>
              <DetailValue label="Bake #" highlight>
                {run.production_no}
              </DetailValue>
              <DetailValue label="Finished bakery item">{run.finished_item_name}</DetailValue>
              <DetailValue label="Quantity Made">
                {Number(run.quantity_produced || 0).toLocaleString()} {run.finished_unit || ""}
              </DetailValue>
              <DetailValue label="Branch (Shop)">{run.branch_name}</DetailValue>
              <DetailValue label="Produced on">
                {run.produced_on ? String(run.produced_on).slice(0, 10) : "—"}
              </DetailValue>
              <DetailValue label="Expiry Date">
                {run.expiry_date ? String(run.expiry_date).slice(0, 10) : "—"}
              </DetailValue>
              <DetailValue label="Status">
                <StatusBadge status={run.status} /> {RUN_STATUS_LABELS[run.status] || ""}
              </DetailValue>
              <DetailValue label="Total cost">{formatPKR(run.total_cost)}</DetailValue>
              <DetailValue label="Baked by">{run.created_by_name}</DetailValue>
              <DetailValue label="Created">{formatDateTime(run.created_at)}</DetailValue>
              <DetailValue label="Notes" fullWidth multiline>
                {run.notes}
              </DetailValue>
            </DetailGrid>
          </FormBlock>

          <FormBlock title="Ingredients used (Kacha Maal)" description="FIFO consumption from this bake.">
            {run.consumption?.length ? (
              <DataTable columns={consumptionColumns} rows={run.consumption} pageSize={100} />
            ) : (
              <p className="wh-muted">No consumption lines recorded.</p>
            )}
          </FormBlock>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(`${MODULE_BASE}/runs/manage`)}>
              Back to runs
            </Button>
            {canEdit && run.status !== "cancelled" && (
              <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel bake
              </Button>
            )}
          </FormActions>
        </div>
      </FormPageLayout>

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
