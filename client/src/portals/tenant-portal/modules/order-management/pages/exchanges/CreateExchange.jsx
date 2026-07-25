import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormPageAlerts, FormActions } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import { AfterSalesOrderSection } from "../../components/AfterSalesOrderSection";
import { useAfterSalesOrders } from "../../hooks/useAfterSalesOrders";
import { useOrderReference } from "../../hooks/useOrderReference";
import { MODULE_BASE, EXCHANGE_STATUSES, EXCHANGE_STATUS_LABELS } from "../../constants";
import { afterSalesIneligibilityMessage, isOrderEligibleForExchange } from "../../utils/afterSalesRules";

const EMPTY = {
  order_id: "",
  old_product_id: "",
  new_product_id: "",
  exchange_status: "requested",
  reason: "",
};

export default function CreateExchange() {
  const { authFetch } = useAuth();
  const { canCreate, readOnly } = useModulePermission("order-management");
  const { products, loading: refLoading } = useOrderReference();
  const navigate = useNavigate();
  const { orders, error: loadError, prefillOrderId } = useAfterSalesOrders(authFetch);

  const [form, setForm] = useState(() => ({
    ...EMPTY,
    order_id: prefillOrderId ? String(prefillOrderId) : "",
  }));
  const [baseline] = useState(() => JSON.stringify({
    ...EMPTY,
    order_id: prefillOrderId ? String(prefillOrderId) : "",
  }));
  const [orderItems, setOrderItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(Boolean(prefillOrderId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const disabled = readOnly || !canCreate;
  const managePath = `${MODULE_BASE}/exchanges/manage`;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline });

  const selectedOrder = useMemo(
    () => orders.find((o) => String(o.id) === String(form.order_id)) || null,
    [orders, form.order_id]
  );
  const orderEligible = selectedOrder ? isOrderEligibleForExchange(selectedOrder) : false;
  const ineligibleMessage =
    selectedOrder && !orderEligible ? afterSalesIneligibilityMessage(selectedOrder, "exchange") : null;

  const returningProducts = useMemo(() => {
    if (orderItems.length) {
      const seen = new Set();
      return orderItems
        .filter((item) => item.product_id && !seen.has(String(item.product_id)) && seen.add(String(item.product_id)))
        .map((item) => ({
          id: item.product_id,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          category_name: item.category_name,
          selling_price: item.unit_price ?? item.selling_price,
          available_qty: item.qty,
        }));
    }
    return products;
  }, [orderItems, products]);

  useEffect(() => {
    if (!form.order_id) return;
    apiFetch(`/orders/${form.order_id}`, {}, authFetch)
      .then((data) => setOrderItems(data.items || []))
      .catch(() => setOrderItems([]))
      .finally(() => setLoadingItems(false));
  }, [form.order_id, authFetch]);

  const handleOrderChange = (orderId) => {
    setOrderItems([]);
    setLoadingItems(Boolean(orderId));
    setForm((f) => ({ ...f, order_id: orderId, old_product_id: "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!form.order_id) {
      setError("Select an order for this exchange.");
      return;
    }
    if (!orderEligible) {
      setError(ineligibleMessage || "This order cannot be exchanged.");
      return;
    }
    if (!form.old_product_id || !form.new_product_id) {
      setError("Select both the product being returned and the replacement product.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        "/orders/exchanges",
        {
          method: "POST",
          body: JSON.stringify({
            order_id: Number(form.order_id),
            old_product_id: Number(form.old_product_id),
            new_product_id: Number(form.new_product_id),
            exchange_status: form.exchange_status,
            reason: form.reason || null,
          }),
        },
        authFetch
      );
      navigateSafely(managePath);
    } catch (err) {
      setError(err.message || "Failed to create exchange");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title="Create Exchange"
          description="Swap a product from an order with a replacement."
          actions={
            <Button variant="secondary" onClick={() => navigate(managePath)}>
              Back
            </Button>
          }
        />
        <FormPageAlerts error={error || loadError} />
        <form onSubmit={submit} className="wh-form-stack">
          <AfterSalesOrderSection
            orders={orders}
            value={form.order_id}
            onChange={handleOrderChange}
            disabled={disabled}
            ineligibleMessage={ineligibleMessage}
          />

          <FormBlock title="Exchange details">
            <FormField
              id="exchange_status"
              label="Status"
              as="select"
              value={form.exchange_status}
              onChange={(e) => set("exchange_status", e.target.value)}
              disabled={disabled}
            >
              {EXCHANGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EXCHANGE_STATUS_LABELS[s] || s}
                </option>
              ))}
            </FormField>
          </FormBlock>

          <FormBlock title="Returning" description="Choose the product from this order that is being returned.">
            {loadingItems ? (
              <p className="wh-muted">Loading order items…</p>
            ) : (
              <ProductCatalogPicker
                products={returningProducts}
                mode="single"
                title="Product to return"
                value={form.old_product_id}
                onSelect={(p) => set("old_product_id", String(p.id ?? p.product_id))}
                showPrice={false}
                showStock={false}
                disabled={disabled || !form.order_id}
                emptyMessage={form.order_id ? "No products on this order." : "Select an order first."}
              />
            )}
          </FormBlock>

          <FormBlock title="Replacement" description="Choose the replacement product.">
            <ProductCatalogPicker
              products={products}
              mode="single"
              title="Replacement product"
              value={form.new_product_id}
              onSelect={(p) => set("new_product_id", String(p.id ?? p.product_id))}
              showPrice
              showStock={false}
              disabled={disabled || refLoading}
              emptyMessage="No products available."
            />
          </FormBlock>

          <FormBlock title="Reason">
            <FormField
              id="exchange-reason"
              label="Reason"
              as="textarea"
              rows={4}
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              disabled={disabled}
            />
          </FormBlock>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(managePath)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || disabled}>
              {saving ? "Saving…" : "Create Exchange"}
            </Button>
          </FormActions>
        </form>
      </FormPageLayout>
      <UnsavedChangesDialog
        open={dialogOpen}
        onStay={stayOnPage}
        onDiscard={leavePage}
        reloadPending={reloadPending}
      />
    </div>
  );
}
