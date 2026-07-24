import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch, fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { TableToolbar } from "../../../../../../components/TableToolbar";
import { Button } from "../../../../../../components/Button";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { StatusBadge } from "../../../../../../components/Badge";
import { EMPTY_TOOLBAR } from "../../../../../../utils/tableFilters";
import { useToolbarFilteredRows } from "../../../../../../hooks/useToolbarFilteredRows";
import { formatDate, formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { MODULE_BASE } from "../../constants";

const TOOLBAR_FILTERS = [
  { key: "status", label: "Status" },
  { key: "supplier_name", label: "Supplier" },
  { key: "branch_name", label: "Branch" },
];

export default function ManagePurchaseOrders() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toolbar, setToolbar] = useState({
    ...EMPTY_TOOLBAR,
    status: "",
    supplier_name: "",
    branch_name: "",
  });

  const filteredRows = useToolbarFilteredRows(rows, toolbar, {
    dateField: "created_at",
    filters: TOOLBAR_FILTERS,
  });

  useEffect(() => setPage(1), [toolbar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/purchase-orders", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const receive = async (row) => {
    setActionLoading(row.id);
    setError("");
    try {
      await apiFetch(`/inventory/purchase-orders/${row.id}/receive`, { method: "POST", body: JSON.stringify({}) }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const cancel = async (row) => {
    setActionLoading(row.id);
    setError("");
    try {
      await apiFetch(`/inventory/purchase-orders/${row.id}/cancel`, { method: "POST" }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await apiFetch(`/inventory/purchase-orders/${deleteRow.id}`, { method: "DELETE" }, authFetch);
      setDeleteRow(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "po_no", label: "PO #" },
    { key: "supplier_name", label: "Supplier" },
    { key: "branch_name", label: "Branch" },
    { key: "order_date", label: "Order date", format: (v) => (v ? formatDate(v) : "—") },
    { key: "expected_date", label: "Expected", format: (v) => (v ? formatDate(v) : "—") },
    { key: "line_count", label: "Lines", filter: false },
    { key: "payable_amount", label: "Payable", format: (v) => formatPKR(v) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          <Button variant="secondary" className="wh-btn--sm" onClick={() => navigate(`${MODULE_BASE}/purchasing/purchase-orders/view/${row.id}`)}>View</Button>
          {["draft", "ordered", "partial"].includes(row.status) && (
            <Button variant="secondary" className="wh-btn--sm" disabled={actionLoading === row.id} onClick={() => receive(row)}>Receive</Button>
          )}
          {["draft", "ordered", "partial"].includes(row.status) && (
            <Button variant="danger" className="wh-btn--sm" disabled={actionLoading === row.id} onClick={() => cancel(row)}>Cancel</Button>
          )}
          {row.status !== "received" && (
            <Button variant="danger" className="wh-btn--sm" onClick={() => setDeleteRow(row)}>Delete</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Purchase Orders"
        description="Orders placed with suppliers (khareedari)."
        actions={<Button onClick={() => navigate(`${MODULE_BASE}/purchasing/purchase-orders/create`)}>Create PO</Button>}
      />
      {error && <p className="wh-field__error">{error}</p>}
      <Card className="wh-card--table">
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <>
            <TableToolbar rows={rows} value={toolbar} onChange={setToolbar} dateField="created_at" filters={TOOLBAR_FILTERS} searchPlaceholder="Search purchase orders…" />
            <DataTable
              columns={columns}
              rows={filteredRows}
              page={page}
              pageSize={TABLE_PAGE_SIZE}
              onPageChange={setPage}
              onRowClick={(row) => navigate(`${MODULE_BASE}/purchasing/purchase-orders/view/${row.id}`)}
            />
          </>
        )}
      </Card>
      <ConfirmDeleteModal
        open={!!deleteRow}
        title="Delete purchase order"
        recordName={deleteRow?.po_no || "this purchase order"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
        loading={deleting}
      />
    </div>
  );
}
