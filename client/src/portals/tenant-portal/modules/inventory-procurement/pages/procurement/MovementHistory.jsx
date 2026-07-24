import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { TableToolbar } from "../../../../../../components/TableToolbar";
import { StatusBadge } from "../../../../../../components/Badge";
import { EMPTY_TOOLBAR } from "../../../../../../utils/tableFilters";
import { useToolbarFilteredRows } from "../../../../../../hooks/useToolbarFilteredRows";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, MODULE_BASE } from "../../constants";

const TOOLBAR_FILTERS = [
  { key: "movement_type", label: "Type" },
  { key: "branch_name", label: "Branch" },
  { key: "item_name", label: "Item" },
];

export default function MovementHistory() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const backPath = `${MODULE_BASE}/stock/movement-history`;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toolbar, setToolbar] = useState({
    ...EMPTY_TOOLBAR,
    movement_type: "",
    branch_name: "",
    item_name: "",
  });

  const openMovement = (row) => {
    navigate(`${MODULE_BASE}/stock/movements/view/${row.id}`, {
      state: { movement: row, backPath },
    });
  };

  const filteredRows = useToolbarFilteredRows(rows, toolbar, {
    dateField: "created_at",
    filters: TOOLBAR_FILTERS,
  });

  useEffect(() => setPage(1), [toolbar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/stock-movements", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const columns = [
    { key: "created_at", label: "Date", format: formatDateTime },
    { key: "movement_type", label: "Type", render: (r) => <StatusBadge status={MOVEMENT_LABELS[r.movement_type] || r.movement_type} /> },
    { key: "item_name", label: "Item" },
    { key: "unit", label: "Unit", format: (v) => v || "—" },
    { key: "branch_name", label: "Branch" },
    { key: "qty", label: "Qty" },
    { key: "notes", label: "Notes", format: (v) => v || "—" },
    { key: "created_by_name", label: "Created by", format: (v) => v || "—" },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Movement History"
        description="Complete record of stock in, out, transfers, production, sales, and wastage."
      />

      <Card className="wh-card--table">
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <>
            <TableToolbar rows={rows} value={toolbar} onChange={setToolbar} dateField="created_at" filters={TOOLBAR_FILTERS} searchPlaceholder="Search movements…" />
            <DataTable columns={columns} rows={filteredRows} page={page} pageSize={TABLE_PAGE_SIZE} onPageChange={setPage} onRowClick={openMovement} />
          </>
        )}
      </Card>

      <p className="wh-muted">Movement types: {MOVEMENT_TYPES.map((t) => MOVEMENT_LABELS[t] || t).join(" · ")}</p>
    </div>
  );
}
