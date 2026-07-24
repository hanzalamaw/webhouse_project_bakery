import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { MODULE_BASE, PO_STATUSES } from "../../constants";
import { formatPKR } from "../../../../../../utils/currency";

function emptyLine(key) {
  return { _key: key, item_id: "", qty: "", unit_cost: "", discount: "0", expiry_date: "" };
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { suppliers, branches, items } = useInventoryReference();
  const keyRef = useRef(1);
  const makeLine = useCallback(() => {
    keyRef.current += 1;
    return emptyLine(`line-${keyRef.current}`);
  }, []);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState("ordered");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState(() => [emptyLine("line-1")]);
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
  const itemOptions = useMemo(
    () =>
      items.map((i) => ({
        value: String(i.id),
        label: `${i.item_name}${i.sku ? ` (${i.sku})` : ""}`,
        cost: i.cost_price,
      })),
    [items]
  );

  const updateLine = (key, field, value) => {
    setLines((rows) =>
      rows.map((row) => {
        if (row._key !== key) return row;
        const next = { ...row, [field]: value };
        if (field === "item_id" && value) {
          const opt = itemOptions.find((o) => o.value === value);
          if (opt && (row.unit_cost === "" || row.unit_cost == null)) {
            next.unit_cost = String(opt.cost ?? "");
          }
        }
        return next;
      })
    );
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
      setError("Add at least one item with quantity");
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

          <FormBlock title="Line items" description="Items to purchase.">
            <div className="wh-inv-line-items">
              {lines.map((line, index) => (
                <div key={line._key} className="wh-inv-line-item">
                  <div className="wh-inv-line-item__head">
                    <strong>Line {index + 1}</strong>
                    {lines.length > 1 && (
                      <Button type="button" variant="secondary" className="wh-btn--sm" onClick={() => setLines((rows) => rows.filter((r) => r._key !== line._key))}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="wh-form-grid">
                    <SearchableSelect
                      id={`item_${line._key}`}
                      label="Item"
                      options={itemOptions}
                      value={line.item_id}
                      onChange={(v) => updateLine(line._key, "item_id", v)}
                      placeholder="Select item…"
                    />
                    <FormField id={`qty_${line._key}`} label="Qty" type="number" min="0.01" step="any" value={line.qty} onChange={(e) => updateLine(line._key, "qty", e.target.value)} />
                    <FormField id={`cost_${line._key}`} label="Unit cost" type="number" min="0" step="0.01" value={line.unit_cost} onChange={(e) => updateLine(line._key, "unit_cost", e.target.value)} />
                    <FormField id={`disc_${line._key}`} label="Line discount" type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(line._key, "discount", e.target.value)} />
                    <FormField id={`exp_${line._key}`} label="Expiry (optional)" type="date" value={line.expiry_date} onChange={(e) => updateLine(line._key, "expiry_date", e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <div className="wh-inv-warehouse-add">
              <Button type="button" variant="secondary" onClick={() => setLines((rows) => [...rows, makeLine()])}>
                Add line
              </Button>
            </div>
          </FormBlock>

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
