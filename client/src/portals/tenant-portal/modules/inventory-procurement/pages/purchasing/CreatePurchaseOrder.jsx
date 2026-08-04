import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { DiscountField } from "../../../../../../components/DiscountField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import { MODULE_BASE, PO_STATUSES } from "../../constants";
import { formatPKR } from "../../../../../../utils/currency";
import {
  NOTES_MAX,
  clampNotes,
  expiryError,
  hasAnyError,
  nonNegNumberError,
  notesError,
  positiveQtyError,
  requiredText,
  visibleError,
} from "../../utils/validation";

function emptyLine(key, item = null) {
  return {
    _key: key,
    item_id: item ? String(item.id) : "",
    item_name: item?.item_name || "",
    unit: item?.unit || "",
    qty: item ? "1" : "",
    unit_cost: item ? String(item.cost_price ?? "0") : "",
    discount: "0",
    expiry_date: "",
  };
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { suppliers, branches, items } = useInventoryReference();
  const keyRef = useRef(1);
  const [initialOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const makeLine = useCallback((item = null) => {
    keyRef.current += 1;
    return emptyLine(`line-${keyRef.current}`, item);
  }, []);

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [orderDate, setOrderDate] = useState(initialOrderDate);
  const [expectedDate, setExpectedDate] = useState("");
  const [status, setStatus] = useState("ordered");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

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
  const formState = useMemo(
    () => ({
      supplierId,
      branchId,
      orderDate,
      expectedDate,
      status,
      discountAmount,
      taxAmount,
      notes,
      lines,
    }),
    [supplierId, branchId, orderDate, expectedDate, status, discountAmount, taxAmount, notes, lines]
  );
  const initialBaseline = useMemo(
    () =>
      JSON.stringify({
        supplierId: "",
        branchId: "",
        orderDate: initialOrderDate,
        expectedDate: "",
        status: "ordered",
        discountAmount: "0",
        taxAmount: "0",
        notes: "",
        lines: [],
      }),
    [initialOrderDate]
  );
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(formState, { baseline: initialBaseline });

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

  const fieldErrors = useMemo(() => {
    const errs = {
      supplierId: requiredText(supplierId, "Supplier"),
      branchId: requiredText(branchId, "Branch"),
      orderDate: requiredText(orderDate, "Order date"),
      notes: notesError(notes),
      taxAmount: nonNegNumberError(taxAmount, "Tax", { required: false }),
      lines: {},
    };
    if (expectedDate && orderDate && expectedDate < orderDate) {
      errs.expectedDate = "Expected date cannot be before order date";
    }
    if (!lines.length) errs.items = "Select at least one item";
    lines.forEach((line) => {
      const row = {
        qty: positiveQtyError(line.qty),
        unit_cost: nonNegNumberError(line.unit_cost, "Unit cost"),
        expiry_date: expiryError(line.expiry_date),
      };
      if (Object.values(row).some(Boolean)) errs.lines[line._key] = row;
    });
    return errs;
  }, [supplierId, branchId, orderDate, expectedDate, notes, taxAmount, lines]);

  const show = (err) => visibleError(attempted, err);

  const taxRealtime = taxAmount !== "" ? nonNegNumberError(taxAmount, "Tax", { required: false }) : "";
  const expectedRealtime =
    expectedDate && orderDate && expectedDate < orderDate
      ? "Expected date cannot be before order date"
      : "";

  const submit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (hasAnyError(fieldErrors)) {
      setError("Please fix the highlighted fields");
      return;
    }
    const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
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
      navigateSafely(backPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wh-page wh-page--wide">
      <FormPageLayout wide>
        <PageHeader
          title="Create Purchase Order"
          description="Order items from a supplier into a branch."
          actions={
            <>
              <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>
                Back
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>
                Cancel
              </Button>
              <Button type="submit" form="purchase-order-form" disabled={saving}>
                {saving ? "Saving…" : "Create Purchase Order"}
              </Button>
            </>
          }
        />
        <form id="purchase-order-form" onSubmit={submit} className="wh-form-stack wh-inv-split-form">
          <div className="wh-inv-split">
            <aside className="wh-inv-split__left">
              <div className="wh-inv-product-picker">
                <ProductCatalogPicker
                  className="wh-catalog-picker--fill"
                  items={purchasableItems}
                  mode="multi"
                  title="Select items"
                  selectedIds={selectedIds}
                  onToggle={(_id, product) => {
                    if (product) addOrToggleItem(product);
                    else {
                      const match = purchasableItems.find((i) => String(i.id) === String(_id));
                      if (match) addOrToggleItem(match);
                    }
                  }}
                  showPrice
                  priceField="cost_price"
                  showStock={false}
                  maxHeight={420}
                  emptyMessage="No purchasable items yet. Add ingredients or packaging under Items."
                />
              </div>
              {show(fieldErrors.items) ? <p className="wh-field__error">{show(fieldErrors.items)}</p> : null}
            </aside>

            <div className="wh-inv-split__right">
              <FormBlock title="Order details">
                <div className="wh-form-grid">
                  <SearchableSelect
                    id="supplier_id"
                    label="Supplier"
                    options={supplierOptions}
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder="Select supplier…"
                    error={show(fieldErrors.supplierId)}
                  />
                  <SearchableSelect
                    id="branch_id"
                    label="Receive at branch"
                    options={branchOptions}
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="Select branch…"
                    error={show(fieldErrors.branchId)}
                  />
                  <FormField
                    id="order_date"
                    label="Order date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    required
                    error={show(fieldErrors.orderDate)}
                  />
                  <FormField
                    id="expected_date"
                    label="Expected date"
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    error={expectedRealtime || show(fieldErrors.expectedDate)}
                  />
                  <FormField
                    id="status"
                    label="Status"
                    as="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {PO_STATUSES.filter((s) => s !== "partial" && s !== "received" && s !== "cancelled").map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </FormField>
                  <FormField
                    id="notes"
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(clampNotes(e.target.value))}
                    maxLength={NOTES_MAX}
                    error={fieldErrors.notes}
                  />
                </div>
              </FormBlock>

              <FormBlock title="Quantities & costs" description="Set qty and unit cost for each selected item.">
                <div className="wh-inv-line-items">
                  {lines.length === 0 ? (
                    <p className="wh-muted">Select items on the left to enter quantities and costs.</p>
                  ) : (
                    lines.map((line, index) => {
                      const lineErr = fieldErrors.lines?.[line._key] || {};
                      const qtyRealtime = line.qty !== "" ? positiveQtyError(line.qty) : "";
                      const costRealtime =
                        line.unit_cost !== "" ? nonNegNumberError(line.unit_cost, "Unit cost") : "";
                      return (
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
                            <FormField
                              id={`qty_${line._key}`}
                              label={line.unit ? `Quantity/${line.unit}` : "Quantity"}
                              type="number"
                              min="0.01"
                              step="any"
                              value={line.qty}
                              onChange={(e) => updateLine(line._key, "qty", e.target.value)}
                              error={qtyRealtime || show(lineErr.qty)}
                            />
                            <FormField
                              id={`cost_${line._key}`}
                              label="Unit cost"
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_cost}
                              onChange={(e) => updateLine(line._key, "unit_cost", e.target.value)}
                              error={costRealtime || show(lineErr.unit_cost)}
                            />
                            <DiscountField
                              id={`disc_${line._key}`}
                              label="Line discount"
                              value={line.discount}
                              baseAmount={(Number(line.qty) || 0) * (Number(line.unit_cost) || 0)}
                              onChange={(v) => updateLine(line._key, "discount", v)}
                            />
                            <FormField
                              id={`exp_${line._key}`}
                              label="Expiry (optional)"
                              type="date"
                              value={line.expiry_date}
                              onChange={(e) => updateLine(line._key, "expiry_date", e.target.value)}
                              error={lineErr.expiry_date}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </FormBlock>

              <FormBlock title="Totals">
                <div className="wh-form-grid">
                  <DiscountField
                    id="discount_amount"
                    label="Order discount"
                    value={discountAmount}
                    baseAmount={subtotal}
                    onChange={setDiscountAmount}
                  />
                  <FormField
                    id="tax_amount"
                    label="Tax (PKR)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    error={taxRealtime || show(fieldErrors.taxAmount)}
                  />
                  <FormField id="subtotal" label="Subtotal" value={formatPKR(subtotal)} displayOnly />
                  <FormField id="payable" label="Payable" value={formatPKR(payable)} displayOnly />
                </div>
              </FormBlock>

              {error && attempted && <p className="wh-field__error">{error}</p>}
            </div>
          </div>
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
