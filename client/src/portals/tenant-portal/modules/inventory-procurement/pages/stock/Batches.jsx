import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../../../context/AuthContext";
import { fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { TableToolbar } from "../../../../../../components/TableToolbar";
import { StatusBadge } from "../../../../../../components/Badge";
import { EMPTY_TOOLBAR } from "../../../../../../utils/tableFilters";
import { useToolbarFilteredRows } from "../../../../../../hooks/useToolbarFilteredRows";
import { formatDateTime, formatDate } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";

const TOOLBAR_FILTERS = [
  { key: "status", label: "Status" },
  { key: "branch_name", label: "Branch" },
  { key: "item_name", label: "Item" },
];

export default function Batches() {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [toolbar, setToolbar] = useState({
    ...EMPTY_TOOLBAR,
    status: "",
    branch_name: "",
    item_name: "",
  });

  const filteredRows = useToolbarFilteredRows(rows, toolbar, {
    dateField: "created_at",
    filters: TOOLBAR_FILTERS,
  });

  useEffect(() => setPage(1), [toolbar, expiringOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = expiringOnly
        ? "/inventory/batches?expiring_days=7"
        : "/inventory/batches";
      const data = await fetchAllTableRows(path, authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, expiringOnly]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const columns = [
    { key: "batch_no", label: "Batch" },
    { key: "item_name", label: "Item" },
    { key: "branch_name", label: "Branch" },
    { key: "qty_remaining", label: "Remaining" },
    { key: "qty_received", label: "Received" },
    { key: "unit_cost", label: "Unit cost", format: (v) => formatPKR(v) },
    { key: "made_on", label: "Made on", format: (v) => (v ? formatDate(v) : "—") },
    { key: "expiry_date", label: "Expiry", format: (v) => (v ? formatDate(v) : "—") },
    {
      key: "days_left",
      label: "Days left",
      filter: false,
      format: (v) => (v == null ? "—" : v),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Batches / Expiry"
        description="Track batches and items nearing expiry (taaza maal)."
        actions={
          <label className="wh-checkbox-item">
            <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
            <span>Expiring within 7 days</span>
          </label>
        }
      />

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
              searchPlaceholder="Search batches…"
            />
            <DataTable
              columns={columns}
              rows={filteredRows}
              page={page}
              pageSize={TABLE_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
