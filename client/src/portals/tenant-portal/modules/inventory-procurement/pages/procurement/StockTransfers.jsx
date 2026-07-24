import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch, fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MODULE_BASE } from "../../constants";

export default function StockTransfers() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const openTransfer = (row) => {
    navigate(`${MODULE_BASE}/stock/transfers/view/${row.id}`, { state: { transfer: row } });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/stock-transfers", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const receiveTransfer = async (row) => {
    setActionLoading(row.id);
    try {
      await apiFetch(`/inventory/stock-transfers/${row.id}/receive`, { method: "POST" }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const cancelTransfer = async (row) => {
    setActionLoading(row.id);
    try {
      await apiFetch(`/inventory/stock-transfers/${row.id}/cancel`, { method: "POST" }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const canAct = (status) => status === "pending" || status === "in_transit";

  const columns = [
    { key: "item_name", label: "Item" },
    { key: "from_branch_name", label: "From" },
    { key: "to_branch_name", label: "To" },
    { key: "qty", label: "Qty" },
    { key: "transfer_status", label: "Status", render: (r) => <StatusBadge status={r.transfer_status} /> },
    { key: "created_at", label: "Created", format: formatDateTime },
    { key: "updated_at", label: "Updated", format: formatDateTime },
    {
      label: "Actions",
      filter: false,
      stopRowClick: true,
      render: (row) => (
        <div className="wh-action-btns">
          {canAct(row.transfer_status) ? (
            <>
              <Button variant="secondary" className="wh-btn--sm" disabled={actionLoading === row.id} onClick={() => receiveTransfer(row)}>Receive</Button>
              <Button variant="danger" className="wh-btn--sm" disabled={actionLoading === row.id} onClick={() => cancelTransfer(row)}>Cancel</Button>
            </>
          ) : (
            <span className="wh-muted">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Transfers between branches"
        description="Move stock from one shakha to another."
        actions={<Button onClick={() => navigate(`${MODULE_BASE}/stock/transfers/create`)}>Create Transfer</Button>}
      />
      {error && <p className="wh-field__error">{error}</p>}
      <Card className="wh-card--table">
        <div className="wh-card-table__head"><h3 className="wh-card__title">Transfer history</h3></div>
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            onPageChange={setPage}
            onRowClick={openTransfer}
          />
        )}
      </Card>
    </div>
  );
}
