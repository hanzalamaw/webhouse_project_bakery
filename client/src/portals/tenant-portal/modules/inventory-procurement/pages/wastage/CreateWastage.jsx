import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import { useT } from "../../../../../../context/LanguageContext";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import ProductPicker from "../../components/ProductPicker";
import { WASTAGE_REASONS, WASTAGE_REASON_LABELS, MODULE_BASE } from "../../constants";
import {
  NOTES_MAX,
  clampNotes,
  hasAnyError,
  nonNegNumberError,
  notesError,
  positiveQtyError,
  requiredText,
  stockExceedsError,
  visibleError,
} from "../../utils/validation";

const EMPTY = {
  item_id: "",
  branch_id: "",
  qty: "",
  reason: "spoiled",
  wastage_date: new Date().toISOString().slice(0, 10),
  estimated_cost: "",
  notes: "",
};

export default function CreateWastage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const { items, branches } = useInventoryReference();
  const [form, setForm] = useState(EMPTY);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [availableQty, setAvailableQty] = useState(null);

  const backPath = `${MODULE_BASE}/wastage`;
  const baseline = useMemo(() => JSON.stringify(EMPTY), []);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );

  const selectedItem = useMemo(
    () => items.find((i) => String(i.id) === String(form.item_id)),
    [items, form.item_id]
  );
  const qtyFieldLabel = selectedItem?.unit ? `Quantity/${selectedItem.unit}` : "Quantity";
  const selectedIds = form.item_id ? [String(form.item_id)] : [];

  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline });

  useEffect(() => {
    if (!form.branch_id || !form.item_id) {
      setAvailableQty(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/inventory/branches/${form.branch_id}`, {}, authFetch)
      .then((data) => {
        if (cancelled) return;
        const row = (data.stock_levels || []).find((r) => String(r.item_id) === String(form.item_id));
        setAvailableQty(row ? Number(row.available_qty) || 0 : 0);
      })
      .catch(() => {
        if (!cancelled) setAvailableQty(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.branch_id, form.item_id, authFetch]);

  const fieldErrors = useMemo(() => {
    const errs = {
      item_id: requiredText(form.item_id, "Item"),
      branch_id: requiredText(form.branch_id, "Branch"),
      qty: positiveQtyError(form.qty),
      notes: notesError(form.notes),
      estimated_cost: nonNegNumberError(form.estimated_cost, "Estimated cost", { required: false }),
    };
    if (!errs.qty && availableQty != null) {
      errs.qty = stockExceedsError(form.qty, availableQty);
    }
    return errs;
  }, [form, availableQty]);

  const realtimeQtyError =
    form.qty !== "" && availableQty != null
      ? stockExceedsError(form.qty, availableQty)
      : "";
  const realtimeCostError =
    form.estimated_cost !== ""
      ? nonNegNumberError(form.estimated_cost, "Estimated cost", { required: false })
      : "";

  const show = (key) => visibleError(attempted, fieldErrors[key]);

  const toggleItem = (id) => {
    const sid = String(id);
    setForm((f) => ({ ...f, item_id: f.item_id === sid ? "" : sid }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (hasAnyError(fieldErrors)) {
      setError("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        item_id: Number(form.item_id),
        branch_id: Number(form.branch_id),
        qty: Number(form.qty),
        reason: form.reason,
        wastage_date: form.wastage_date,
        notes: form.notes || null,
      };
      if (form.estimated_cost !== "") payload.estimated_cost = Number(form.estimated_cost);
      await apiFetch("/inventory/wastage", { method: "POST", body: JSON.stringify(payload) }, authFetch);
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
          title="Record Wastage"
          description="Record spoiled, expired, or damaged stock removed from a branch."
          actions={
            <>
              <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>
                Back
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>
                Cancel
              </Button>
              <Button type="submit" form="wastage-form" disabled={saving}>
                {saving ? "Saving…" : "Save Wastage"}
              </Button>
            </>
          }
        />

        <form id="wastage-form" onSubmit={submit} className="wh-form-stack wh-inv-split-form">
          <div className="wh-inv-split">
            <aside className="wh-inv-split__left">
              <ProductPicker
                items={items}
                selectedIds={selectedIds}
                onToggle={toggleItem}
                search={itemSearch}
                onSearchChange={setItemSearch}
                tall
                entityLabel="items"
              />
              {show("item_id") ? <p className="wh-field__error">{show("item_id")}</p> : null}
            </aside>

            <div className="wh-inv-split__right">
              <FormBlock title="Details" description="Branch, quantity, reason, and optional cost.">
                <div className="wh-form-grid">
                  <SearchableSelect
                    id="w_branch"
                    label="Branch"
                    options={branchOptions}
                    value={form.branch_id}
                    onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}
                    placeholder="Select branch…"
                    error={show("branch_id")}
                  />
                  <FormField
                    id="w_qty"
                    label={qtyFieldLabel}
                    type="number"
                    min="0.01"
                    step="any"
                    value={form.qty}
                    onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                    error={realtimeQtyError || show("qty")}
                  />
                  {availableQty != null && form.item_id && form.branch_id ? (
                    <p className="wh-muted wh-form-grid__full">Available at branch: {availableQty}</p>
                  ) : null}
                  <FormField
                    id="w_reason"
                    label="Reason"
                    as="select"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  >
                    {WASTAGE_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t(WASTAGE_REASON_LABELS[r] || r)}
                      </option>
                    ))}
                  </FormField>
                  <FormField
                    id="w_date"
                    label="Wastage date"
                    type="date"
                    value={form.wastage_date}
                    onChange={(e) => setForm((f) => ({ ...f, wastage_date: e.target.value }))}
                  />
                  <FormField
                    id="w_cost"
                    label="Estimated cost (optional)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.estimated_cost}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))}
                    error={realtimeCostError || show("estimated_cost")}
                  />
                  <div className="wh-form-grid__full">
                    <FormField
                      id="w_notes"
                      label="Notes"
                      as="textarea"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: clampNotes(e.target.value) }))}
                      maxLength={NOTES_MAX}
                      error={show("notes")}
                    />
                  </div>
                </div>
              </FormBlock>

              {error && attempted ? <p className="wh-field__error">{error}</p> : null}
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
