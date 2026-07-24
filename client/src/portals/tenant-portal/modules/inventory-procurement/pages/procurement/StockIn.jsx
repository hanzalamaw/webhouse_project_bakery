import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MOVEMENT_LABELS, MODULE_BASE } from "../../constants";

export default function StockIn() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const backPath = `${MODULE_BASE}/stock/stock-in`;

  const openMovement = (row) => {
    navigate(`${MODULE_BASE}/stock/movements/view/${row.id}`, {
      state: { movement: row, backPath },
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [purchase, opening] = await Promise.all([
        fetchAllTableRows("/inventory/stock-movements?movement_type=purchase_in", authFetch),
        fetchAllTableRows("/inventory/stock-movements?movement_type=opening", authFetch),
      ]);
      const merged = [...purchase, ...opening].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setRows(merged);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const columns = [
    { key: "item_name", label: "Item" },
    { key: "unit", label: "Unit", format: (v) => v || "—" },
    { key: "branch_name", label: "Branch" },
    { key: "qty", label: "Qty" },
    { key: "notes", label: "Notes", format: (v) => v || "—" },
    { key: "created_by_name", label: "By", format: (v) => v || "—" },
    { key: "created_at", label: "Date", format: formatDateTime },
    { key: "movement_type", label: "Type", render: (r) => <StatusBadge status={MOVEMENT_LABELS[r.movement_type] || r.movement_type} /> },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Stock In"
        description="Items received into a branch (purchase or opening stock)."
        actions={<Button onClick={() => navigate(`${MODULE_BASE}/stock/stock-in/create`)}>Record Stock In</Button>}
      />
      <Card className="wh-card--table">
        <div className="wh-card-table__head"><h3 className="wh-card__title">Stock in history</h3></div>
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable columns={columns} rows={rows} page={page} pageSize={TABLE_PAGE_SIZE} onPageChange={setPage} onRowClick={openMovement} />
        )}
      </Card>
    </div>
  );
}
