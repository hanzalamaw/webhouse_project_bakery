import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
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
import { formatTotalPrice } from "../../utils/pricing";
import { useT } from "../../../../../../context/LanguageContext";
import { ITEM_TYPE_LABELS, MODULE_BASE } from "../../constants";

const TOOLBAR_FILTERS = [
  { key: "status", label: "Status" },
  { key: "item_type", label: "Type" },
  { key: "category_name", label: "Category" },
  { key: "unit", label: "Unit" },
];

export default function ManageProducts() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [toolbar, setToolbar] = useState({
    ...EMPTY_TOOLBAR,
    status: "",
    item_type: "",
    category_name: "",
    unit: "",
  });

  const filteredRows = useToolbarFilteredRows(rows, toolbar, { dateField: "created_at", filters: TOOLBAR_FILTERS });

  useEffect(() => setPage(1), [toolbar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/items", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await apiFetch(`/inventory/items/${deleteRow.id}`, { method: "DELETE" }, authFetch);
      setDeleteRow(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "item_name", label: "Item" },
    { key: "sku", label: "SKU", format: (v) => v || "—" },
    {
      key: "item_type",
      label: "Type",
      format: (v) => t(ITEM_TYPE_LABELS[v] || v),
    },
    { key: "category_name", label: "Category", format: (v) => v || "—" },
    { key: "unit", label: "Unit" },
    { key: "cost_price", label: "Cost", format: (v) => formatPKR(v) },
    { key: "selling_price", label: "Selling", format: (v) => formatPKR(v) },
    { key: "discount", label: "Discount", format: (v) => formatPKR(v) },
    { key: "tax", label: "Tax", format: (v) => formatPKR(v) },
    {
      key: "total_price",
      label: "Total",
      filter: false,
      format: (_, r) => formatTotalPrice(r.selling_price, r.discount, r.tax),
    },
    { key: "total_available", label: "Available", filter: false },
    {
      key: "flags",
      label: "Flags",
      filter: false,
      format: (_, r) =>
        [r.is_purchased && "Buy", r.is_produced && "Make", r.is_sold && "Sell"].filter(Boolean).join(" · ") || "—",
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          <Button variant="secondary" className="wh-btn--sm" onClick={() => navigate(`${MODULE_BASE}/items/edit/${row.id}`)}>Edit</Button>
          <Button variant="danger" className="wh-btn--sm" onClick={() => setDeleteRow(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Manage Items (Cheezen)"
        description="Ingredients, finished goods, and packaging used in your bakery."
        actions={<Button onClick={() => navigate(`${MODULE_BASE}/items/create`)}>Create Item</Button>}
      />
      {error && <p className="wh-field__error">{error}</p>}
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
              searchPlaceholder="Search items…"
            />
            <DataTable
              columns={columns}
              rows={filteredRows}
              page={page}
              pageSize={TABLE_PAGE_SIZE}
              onPageChange={setPage}
              onRowClick={(row) => navigate(`${MODULE_BASE}/items/view/${row.id}`)}
            />
          </>
        )}
      </Card>

      <ConfirmDeleteModal
        open={!!deleteRow}
        title="Delete item"
        recordName={deleteRow?.item_name || "this item"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
        loading={deleting}
      />
    </div>
  );
}
