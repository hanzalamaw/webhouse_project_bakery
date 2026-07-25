import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailGrid, DetailValue, RecordViewSummary } from "../../../../../../components/RecordView";
import { ViewKpi, ViewPanel, formatCount } from "../../../../../../components/EntityViewLayout";
import { LogsIcon, ProcurementIcon, ProductIcon } from "../../../../../../components/icons";
import { formatDateTime, formatDate } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { MODULE_BASE } from "../../constants";

export default function SupplierView() {
  const { supplierId } = useParams();
  const { authFetch } = useAuth();
  const { canEdit, canCreate } = useModulePermission("stock-purchasing");
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSupplier(await apiFetch(`/inventory/suppliers/${supplierId}`, {}, authFetch));
    } catch (e) {
      setSupplier(null);
      setError(e.message || "Supplier not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, supplierId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (loading) {
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!supplier) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Supplier not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/purchasing/suppliers`)}>Back</Button>
      </div>
    );
  }

  const orders = supplier.purchase_orders || [];
  const openCount = Number(supplier.open_po_count || 0);

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Supplier details"
        description="Contact info and purchase order history."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/purchasing/suppliers`)}>Back</Button>
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/purchasing/suppliers/edit/${supplier.id}`)}>
                Edit supplier
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => navigate(`${MODULE_BASE}/purchasing/purchase-orders/create`)}>
                New purchase order
              </Button>
            )}
          </div>
        }
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <RecordViewSummary
        title={supplier.supplier_name}
        subtitle={[supplier.contact_person, supplier.city].filter(Boolean).join(" · ") || "No contact set"}
        status={supplier.status}
        chips={[
          { label: "Phone", value: supplier.phone || "—" },
          { label: "City", value: supplier.city || "—" },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Purchase orders"
            value={formatCount(supplier.purchase_order_count)}
            hint={`${formatCount(orders.length)} shown`}
            tone="accent"
            icon={<ProcurementIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Open POs"
            value={formatCount(openCount)}
            hint={openCount > 0 ? "Awaiting receive / close" : "None open"}
            tone={openCount > 0 ? "warning" : "default"}
            icon={<LogsIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Total spend"
            value={formatPKR(supplier.total_spend)}
            hint="Excludes cancelled"
            tone="success"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Avg PO value"
            value={formatPKR(
              Number(supplier.purchase_order_count) > 0
                ? (Number(supplier.total_spend) || 0) / Number(supplier.purchase_order_count)
                : 0
            )}
            hint="Based on non-cancelled spend"
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <ViewPanel title="Purchase orders" subtitle="Orders placed with this supplier" flush>
            {orders.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Date</th>
                    <th>Branch</th>
                    <th>Lines</th>
                    <th>Payable</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((row) => (
                    <tr
                      key={row.id}
                      className="wh-table__row--clickable"
                      onClick={() => navigate(`${MODULE_BASE}/purchasing/purchase-orders/view/${row.id}`)}
                    >
                      <td>{row.po_no}</td>
                      <td className="wh-muted">{row.order_date ? formatDate(row.order_date) : "—"}</td>
                      <td>{row.branch_name || "—"}</td>
                      <td>{formatCount(row.line_count)}</td>
                      <td>{formatPKR(row.payable_amount)}</td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No purchase orders yet for this supplier.</p>
            )}
          </ViewPanel>
        </div>
        <div className="wh-dash-col-4">
          <ViewPanel title="Contact & notes">
            <DetailGrid columns={1}>
              <DetailValue label="Contact person">{supplier.contact_person || "—"}</DetailValue>
              <DetailValue label="Phone">{supplier.phone || "—"}</DetailValue>
              <DetailValue label="Email">{supplier.email || "—"}</DetailValue>
              <DetailValue label="Address" fullWidth>{supplier.address || "—"}</DetailValue>
              <DetailValue label="Notes" fullWidth multiline>{supplier.notes || "—"}</DetailValue>
              <DetailValue label="Added">{formatDateTime(supplier.created_at)}</DetailValue>
            </DetailGrid>
          </ViewPanel>
        </div>
      </div>
    </div>
  );
}
