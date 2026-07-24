import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch, fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { TableToolbar } from "../../../../../../components/TableToolbar";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { EMPTY_TOOLBAR } from "../../../../../../utils/tableFilters";
import { useToolbarFilteredRows } from "../../../../../../hooks/useToolbarFilteredRows";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { MODULE_BASE, RUN_STATUSES } from "../../constants";

const TOOLBAR_FILTERS = [
  { key: "status", label: "Status", options: RUN_STATUSES },
  { key: "branch_name", label: "Branch (Shop)" },
  { key: "finished_item_name", label: "Finished item" },
];

export default function ManageRuns() {
  const { authFetch } = useAuth();
  const { canCreate, canEdit } = useModulePermission("production");
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cancelRow, setCancelRow] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toolbar, setToolbar] = useState({
    ...EMPTY_TOOLBAR,
    status: "",
    branch_name: "",
    finished_item_name: "",
  });

  const filteredRows = useToolbarFilteredRows(rows, toolbar, {
    dateField: "produced_on",
    filters: TOOLBAR_FILTERS,
  });

  useEffect(() => setPage(1), [toolbar]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchAllTableRows("/production/runs", authFetch));
    } catch (err) {
      setError(err.message || "Failed to load production runs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const confirmCancel = async () => {
    if (!cancelRow) return;
    setCancelling(true);
    try {
      await apiFetch(`/production/runs/${cancelRow.id}/cancel`, { method: "POST", body: JSON.stringify({}) }, authFetch);
      setCancelRow(null);
      setMessage("Bake cancelled.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const columns = [
    { key: "production_no", label: "Bake #" },
    { key: "finished_item_name", label: "Finished item", format: (v) => v || "—" },
    {
      key: "quantity_produced",
      label: "Quantity Made",
      format: (v, row) => `${Number(v || 0).toLocaleString()} ${row.finished_unit || ""}`.trim(),
    },
    { key: "branch_name", label: "Branch (Shop)", format: (v) => v || "—" },
    {
      key: "produced_on",
      label: "Produced on",
      format: (v) => (v ? String(v).slice(0, 10) : "—"),
    },
    {
      key: "expiry_date",
      label: "Expiry Date",
      format: (v) => (v ? String(v).slice(0, 10) : "—"),
    },
    {
      key: "total_cost",
      label: "Cost",
      format: (v) => formatPKR(v),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          {canEdit && row.status !== "cancelled" && (
            <Button variant="danger" className="wh-btn--sm" onClick={() => setCancelRow(row)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Production Runs"
        description="Track bakes (pakana) — what was made, where, and when it expires."
        actions={
          <Button onClick={() => navigate(`${MODULE_BASE}/runs/create`)} disabled={!canCreate}>
            Bake Now
          </Button>
        }
      />
      {error && <div className="wh-alert wh-alert--error">{error}</div>}
      {message && <div className="wh-alert wh-alert--success">{message}</div>}
      <Card className="wh-card--table">
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <>
            <TableToolbar
              rows={rows}
              value={toolbar}
              onChange={setToolbar}
              dateField="produced_on"
              filters={TOOLBAR_FILTERS}
              searchPlaceholder="Search bakes…"
            />
            <DataTable
              columns={columns}
              rows={filteredRows}
              page={page}
              pageSize={TABLE_PAGE_SIZE}
              onPageChange={setPage}
              onRowClick={(row) => navigate(`${MODULE_BASE}/runs/view/${row.id}`)}
            />
          </>
        )}
      </Card>

      <ConfirmDeleteModal
        open={!!cancelRow}
        title="Cancel bake"
        recordName={cancelRow?.production_no || "this bake"}
        categoryLabel="production run"
        cascadeItems={[
          "This marks the run as cancelled only.",
          "Ingredient stock and finished stock are not automatically reversed.",
        ]}
        confirmPhrase="CANCEL"
        onConfirm={confirmCancel}
        onClose={() => setCancelRow(null)}
        loading={cancelling}
      />
    </div>
  );
}
