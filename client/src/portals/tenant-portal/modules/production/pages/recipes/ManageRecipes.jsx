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
import { MODULE_BASE, RECIPE_STATUSES } from "../../constants";

const TOOLBAR_FILTERS = [
  { key: "status", label: "Status", options: RECIPE_STATUSES },
  { key: "finished_item_name", label: "Finished item" },
];

export default function ManageRecipes() {
  const { authFetch } = useAuth();
  const { canCreate, canEdit, canDelete } = useModulePermission("production");
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toolbar, setToolbar] = useState({ ...EMPTY_TOOLBAR, status: "", finished_item_name: "" });

  const filteredRows = useToolbarFilteredRows(rows, toolbar, {
    dateField: "created_at",
    filters: TOOLBAR_FILTERS,
  });

  useEffect(() => setPage(1), [toolbar]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchAllTableRows("/production/recipes", authFetch));
    } catch (err) {
      setError(err.message || "Failed to load recipes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await apiFetch(`/production/recipes/${deleteRow.id}`, { method: "DELETE" }, authFetch);
      setDeleteRow(null);
      setMessage("Recipe deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "recipe_name", label: "Recipe" },
    { key: "finished_item_name", label: "Finished item", format: (v) => v || "—" },
    {
      key: "yield_qty",
      label: "Yield",
      format: (v, row) => `${Number(v || 0).toLocaleString()} ${row.yield_unit || ""}`.trim(),
    },
    {
      key: "ingredient_count",
      label: "Ingredients",
      format: (v) => Number(v || 0).toLocaleString(),
    },
    {
      key: "prep_time_mins",
      label: "Prep (mins)",
      format: (v) => (v != null ? String(v) : "—"),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          {canEdit && (
            <Button
              variant="secondary"
              className="wh-btn--sm"
              onClick={() => navigate(`${MODULE_BASE}/recipes/edit/${row.id}`)}
            >
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" className="wh-btn--sm" onClick={() => setDeleteRow(row)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Recipes"
        description="Manage bakery recipes and their ingredients (kacha maal)."
        actions={
          <Button onClick={() => navigate(`${MODULE_BASE}/recipes/create`)} disabled={!canCreate}>
            Create Recipe
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
              dateField="created_at"
              filters={TOOLBAR_FILTERS}
              searchPlaceholder="Search recipes…"
            />
            <DataTable
              columns={columns}
              rows={filteredRows}
              page={page}
              pageSize={TABLE_PAGE_SIZE}
              onPageChange={setPage}
              onRowClick={(row) => navigate(`${MODULE_BASE}/recipes/view/${row.id}`)}
            />
          </>
        )}
      </Card>

      <ConfirmDeleteModal
        open={!!deleteRow}
        title="Delete recipe"
        recordName={deleteRow?.recipe_name || "this recipe"}
        categoryLabel="recipe"
        cascadeItems={["Recipe ingredients (kacha maal lines)"]}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
        loading={deleting}
      />
    </div>
  );
}
