import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout } from "../../../../../../components/FormPageLayout";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailValue } from "../../../../../../components/DetailValue";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { formatDate, formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { MODULE_BASE } from "../../constants";

export default function ViewPurchaseOrder() {
  const { poId } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const backPath = `${MODULE_BASE}/purchasing/purchase-orders`;
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/inventory/purchase-orders/${poId}`, {}, authFetch);
      setPo(data);
    } catch (e) {
      setPo(null);
      setError(e.message || "Purchase order not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, poId]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const receive = async () => {
    setActing(true);
    setError("");
    try {
      await apiFetch(`/inventory/purchase-orders/${poId}/receive`, { method: "POST", body: JSON.stringify({}) }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  };

  const cancel = async () => {
    setActing(true);
    setError("");
    try {
      await apiFetch(`/inventory/purchase-orders/${poId}/cancel`, { method: "POST" }, authFetch);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="wh-page">
        <FormPageLayout><p className="wh-muted">Loading…</p></FormPageLayout>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <div className="wh-alert wh-alert--error">{error || "Not found"}</div>
          <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
        </FormPageLayout>
      </div>
    );
  }

  const canReceive = ["draft", "ordered", "partial"].includes(po.status);

  const columns = [
    { key: "item_name", label: "Item" },
    { key: "unit", label: "Unit" },
    { key: "qty", label: "Ordered" },
    { key: "received_qty", label: "Received" },
    { key: "unit_cost", label: "Unit cost", format: (v) => formatPKR(v) },
    { key: "discount", label: "Discount", format: (v) => formatPKR(v) },
    { key: "total_price", label: "Total", format: (v) => formatPKR(v) },
    { key: "expiry_date", label: "Expiry", format: (v) => (v ? formatDate(v) : "—") },
  ];

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={`PO ${po.po_no}`}
          description={`${po.supplier_name} → ${po.branch_name}`}
          actions={
            <div className="wh-action-btns">
              {canReceive && (
                <Button onClick={receive} disabled={acting}>{acting ? "Working…" : "Receive all"}</Button>
              )}
              {canReceive && (
                <Button variant="danger" onClick={cancel} disabled={acting}>Cancel PO</Button>
              )}
              <Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>
            </div>
          }
        />

        {error && <p className="wh-field__error">{error}</p>}

        <FormBlock title="Order info">
          <div className="wh-form-grid">
            <DetailValue label="Status"><StatusBadge status={po.status} /></DetailValue>
            <DetailValue label="Order date">{po.order_date ? formatDate(po.order_date) : "—"}</DetailValue>
            <DetailValue label="Expected">{po.expected_date ? formatDate(po.expected_date) : "—"}</DetailValue>
            <DetailValue label="Created by">{po.created_by_name || "—"}</DetailValue>
            <DetailValue label="Subtotal">{formatPKR(po.total_amount)}</DetailValue>
            <DetailValue label="Discount">{formatPKR(po.discount_amount)}</DetailValue>
            <DetailValue label="Tax">{formatPKR(po.tax_amount)}</DetailValue>
            <DetailValue label="Payable">{formatPKR(po.payable_amount)}</DetailValue>
            <DetailValue label="Created">{formatDateTime(po.created_at)}</DetailValue>
            <DetailValue label="Notes" fullWidth>{po.notes || "—"}</DetailValue>
          </div>
        </FormBlock>

        <Card className="wh-card--table">
          <div className="wh-card-table__head"><h3 className="wh-card__title">Line items</h3></div>
          <DataTable columns={columns} rows={po.items || []} page={1} pageSize={100} onPageChange={() => {}} />
        </Card>
      </FormPageLayout>
    </div>
  );
}
