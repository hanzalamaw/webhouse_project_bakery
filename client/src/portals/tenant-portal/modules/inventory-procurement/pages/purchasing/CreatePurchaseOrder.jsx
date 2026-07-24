import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { MODULE_BASE, PO_STATUSES } from "../../constants";
import { formatPKR } from "../../../../../../utils/currency";

function emptyLine(key, item = null) {
  return {
    _key: key,
    item_id: item ? String(item.id) : "",
    item_name: item?.item_name || "",
    qty: item ? "1" : "",
    unit_cost: item ? String(item.cost_price ?? "") : "",
    discount: "0",
    expiry_date: "",
  };
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { suppliers, branches, items } = useInventoryReference();
  const keyRef = useRef(1);
  const makeLine = useCallback((item = null) => {
    keyRef.current += 1;
    return emptyLine(`line-${keyRef.current}`, item);
  }, []);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState("ordered");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const backPath = `${MODULE_BASE}/purchasing/purchase-orders`;

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.id), label: s.supplier_name })),
    [suppliers]
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );
  const purchasableItems = useMemo(
    () =>
      items.filter(
        (i) => i.is_purchased || i.item_type === "ingredient" || i.item_type === "packaging" || !i.item_type
      ),
    [items]
  );
  const selectedIds = useMemo(() => lines.map((l) => String(l.item_id)).filter(Boolean), [lines]);

  const addOrToggleItem = (product) => {
    const id = String(product.id);
    setLines((rows) => {
      const existing = rows.find((r) => String(r.item_id) === id);
      if (existing) return rows.filter((r) => r._key !== existing._key);
      return [...rows, makeLine(product)];
    });
  };

  const updateLine = (key, field, value) => {
    setLines((rows) => rows.map((row) => (row._key === key ? { ...row, [field]: value } : row)));
  };

  const subtotal = lines.reduce((sum, line) => {
    const qty = Number(line.qty) || 0;
    const cost = Number(line.unit_cost) || 0;
    const disc = Number(line.discount) || 0;
    return sum + Math.max(0, qty * cost - disc);
  }, 0);
  const payable = Math.max(0, subtotal - (Number(discountAmount) || 0) + (Number(taxAmount) || 0));

  const submit = async (e) => {
    e.preventDefault();
    if (!supplierId) {
      setError("Select a supplier");
      return;
    }
    if (!branchId) {
      setError("Select a branch");
      return;
    }
    const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
    if (!validLines.length) {
      setError("Tap items below and set quantity for each");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        "/inventory/purchase-orders",
        {
          method: "POST",
          body: JSON.stringify({
            supplier_id: Number(supplierId),
            branch_id: Number(branchId),
            order_date: orderDate,
            expected_date: expectedDate || null,
            status,
            discount_amount: Number(discountAmount) || 0,
            tax_amount: Number(taxAmount) || 0,
            notes: notes || null,
            items: validLines.map((l) => ({
              item_id: Number(l.item_id),
              qty: Number(l.qty),
              unit_cost: Number(l.unit_cost) || 0,
              discount: Number(l.discount) || 0,
              expiry_date: l.expiry_date || null,
            })),
          }),
        },
        authFetch
      );
      navigate(backPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title="Create Purchase Order"
          description="Order items from a supplier into a branch."
          actions={<Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>}
        />
        <form onSubmit={submit} className="wh-form-stack">
          <FormBlock title="Order details">
            <div className="wh-form-grid">
              <SearchableSelect id="supplier_id" label="Supplier" options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Select supplier…" />
              <SearchableSelect id="branch_id" label="Receive at branch" options={branchOptions} value={branchId} onChange={setBranchId} placeholder="Select branch…" />
              <FormField id="order_date" label="Order date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
              <FormField id="expected_date" label="Expected date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              <FormField id="status" label="Status" as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {PO_STATUSES.filter((s) => s !== "partial" && s !== "received" && s !== "cancelled").map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </FormField>
              <FormField id="notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </FormBlock>

          <FormBlock title="Items to buy" description="Tap items to add them to this purchase order.">
            <ProductCatalogPicker
              items={purchasableItems}
              title="Products"
              mode="multi"
              selectedIds={selectedIds}
              onToggle={(_id, product) => {
                if (product) addOrToggleItem(product);
                else {
                  const match = purchasableItems.find((i) => String(i.id) === String(_id));
                  if (match) addOrToggleItem(match);
                }
              }}
              showPrice
              showStock={false}
              priceField="cost_price"
              maxHeight={280}
              emptyMessage="No purchasable items yet. Add ingredients or packaging under Items."
            />
          </FormBlock>

          {lines.length > 0 && (
            <FormBlock title="Quantities & costs" description="Set qty and unit cost for each selected item.">
              <div className="wh-inv-line-items">
                {lines.map((line, index) => (
                  <div key={line._key} className="wh-inv-line-item">
                    <div className="wh-inv-line-item__head">
                      <strong>{line.item_name || `Line ${index + 1}`}</strong>
                      <Button
                        type="button"
                        variant="secondary"
                        className="wh-btn--sm"
                        onClick={() => setLines((rows) => rows.filter((r) => r._key !== line._key))}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="wh-form-grid">
                      <FormField id={`qty_${line._key}`} label="Qty" type="number" min="0.01" step="any" value={line.qty} onChange={(e) => updateLine(line._key, "qty", e.target.value)} />
                      <FormField id={`cost_${line._key}`} label="Unit cost" type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(line._key, "unit_cost", e.target.value)} />
                      <FormField id={`disc_${line._key}`} label="Line discount" type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(line._key, "discount", e.target.value)} />
                      <FormField id={`exp_${line._key}`} label="Expiry (optional)" type="date" value={line.expiry_date} onChange={(e) => updateLine(line._key, "expiry_date", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </FormBlock>
          )}

          <FormBlock title="Totals">
            <div className="wh-form-grid">
              <FormField id="discount_amount" label="Order discount (PKR)" type="number" min="0" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
              <FormField id="tax_amount" label="Tax (PKR)" type="number" min="0" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
              <FormField id="subtotal" label="Subtotal" value={formatPKR(subtotal)} displayOnly />
              <FormField id="payable" label="Payable" value={formatPKR(payable)} displayOnly />
            </div>
          </FormBlock>

          {error && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Purchase Order"}</Button>
          </FormActions>
        </form>
      </FormPageLayout>
    </div>
  );
}
