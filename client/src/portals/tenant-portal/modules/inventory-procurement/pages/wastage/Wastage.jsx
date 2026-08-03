import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { Button } from "../../../../../../components/Button";
import { useT } from "../../../../../../context/LanguageContext";
import { formatDate, formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { WASTAGE_REASON_LABELS, MODULE_BASE } from "../../constants";

export default function Wastage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/wastage", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const columns = [
    { key: "wastage_date", label: "Date", format: (v) => (v ? formatDate(v) : "—") },
    { key: "item_name", label: "Item" },
    { key: "branch_name", label: "Branch" },
    { key: "qty", label: "Qty" },
    { key: "unit", label: "Unit" },
    {
      key: "reason",
      label: "Reason",
      format: (v) => t(WASTAGE_REASON_LABELS[v] || v),
    },
    { key: "estimated_cost", label: "Est. cost", format: (v) => formatPKR(v) },
    { key: "notes", label: "Notes", format: (v) => v || "—" },
    { key: "created_by_name", label: "By", format: (v) => v || "—" },
    { key: "created_at", label: "Recorded", format: formatDateTime },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Wastage"
        description="Record spoiled, expired, or damaged stock removed from a branch."
        actions={
          <Button onClick={() => navigate(`${MODULE_BASE}/wastage/create`)}>
            Record Wastage
          </Button>
        }
      />

      <Card className="wh-card--table">
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            page={page}
            pageSize={TABLE_PAGE_SIZE}
            onPageChange={setPage}
            onRowClick={(row) => navigate(`${MODULE_BASE}/wastage/view/${row.id}`, { state: { row } })}
          />
        )}
      </Card>
    </div>
  );
}
