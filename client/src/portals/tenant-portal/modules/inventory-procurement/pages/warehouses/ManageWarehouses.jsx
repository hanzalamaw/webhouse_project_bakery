import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { Button } from "../../../../../../components/Button";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { StatusBadge } from "../../../../../../components/Badge";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MODULE_BASE } from "../../constants";

export default function ManageWarehouses() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [limits, setLimits] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/inventory/branches?page=1&limit=10000", {}, authFetch);
      setRows(res.data || []);
      setLimits(res.limits || null);
    } catch {
      setRows([]);
      setLimits(null);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await apiFetch(`/inventory/branches/${deleteRow.id}`, { method: "DELETE" }, authFetch);
      setDeleteRow(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "branch_name", label: "Branch" },
    { key: "code", label: "Code", format: (v) => v || "—" },
    { key: "location", label: "Location", format: (v) => v || "—" },
    { key: "city", label: "City", format: (v) => v || "—" },
    { key: "phone", label: "Phone", format: (v) => v || "—" },
    { key: "item_count", label: "Items", filter: false },
    { key: "total_units", label: "Total Units", filter: false },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          <Button variant="secondary" className="wh-btn--sm" onClick={() => navigate(`${MODULE_BASE}/branches/edit/${row.id}`)}>Edit</Button>
          <Button variant="danger" className="wh-btn--sm" onClick={() => setDeleteRow(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Branches"
        description={
          limits?.max_branches
            ? `Manage bakery branches (${limits.branch_count ?? rows.length} / ${limits.max_branches} used).`
            : "Manage your bakery branches / shops."
        }
        actions={
          <Button onClick={() => navigate(`${MODULE_BASE}/branches/create`)} disabled={limits?.can_create === false}>
            Create Branch
          </Button>
        }
      />

      {limits && !limits.can_create && (
        <p className="wh-field__error">
          Branch limit reached ({limits.branch_count}/{limits.max_branches}).
        </p>
      )}

      {error && <p className="wh-field__error">{error}</p>}

      <Card className="wh-card--table">
        <div className="wh-card-table__head"><h3 className="wh-card__title">All branches</h3></div>
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`${MODULE_BASE}/branches/view/${row.id}`)}
          />
        )}
      </Card>

      <ConfirmDeleteModal
        open={!!deleteRow}
        title="Delete branch"
        recordName={deleteRow?.branch_name || "this branch"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
        loading={deleting}
      />
    </div>
  );
}
