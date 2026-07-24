import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch, fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { Modal } from "../../../../../../components/Modal";
import { FormBlock } from "../../../../../../components/FormBlock";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { formatDate, formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
import { WASTAGE_REASONS, WASTAGE_REASON_LABELS } from "../../constants";

export default function Wastage() {
  const { authFetch } = useAuth();
  const { items, branches } = useInventoryReference();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    item_id: "",
    branch_id: "",
    qty: "",
    reason: "spoiled",
    wastage_date: new Date().toISOString().slice(0, 10),
    estimated_cost: "",
    notes: "",
  });

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );

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

  const openCreate = () => {
    setForm({
      item_id: "",
      branch_id: "",
      qty: "",
      reason: "spoiled",
      wastage_date: new Date().toISOString().slice(0, 10),
      estimated_cost: "",
      notes: "",
    });
    setError("");
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.item_id || !form.branch_id || !(Number(form.qty) > 0)) {
      setError("Item, branch, and quantity are required");
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
      setOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "wastage_date", label: "Date", format: (v) => (v ? formatDate(v) : "—") },
    { key: "item_name", label: "Item" },
    { key: "branch_name", label: "Branch" },
    { key: "qty", label: "Qty" },
    { key: "unit", label: "Unit" },
    {
      key: "reason",
      label: "Reason",
      format: (v) => WASTAGE_REASON_LABELS[v] || v,
    },
    { key: "estimated_cost", label: "Est. cost", format: (v) => formatPKR(v) },
    { key: "notes", label: "Notes", format: (v) => v || "—" },
    { key: "created_by_name", label: "By", format: (v) => v || "—" },
    { key: "created_at", label: "Recorded", format: formatDateTime },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Wastage (Barbaadi)"
        description="Record spoiled, expired, or damaged stock removed from a branch."
        actions={<Button onClick={openCreate}>Record Wastage</Button>}
      />

      <Card className="wh-card--table">
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable columns={columns} rows={rows} page={page} pageSize={TABLE_PAGE_SIZE} onPageChange={setPage} />
        )}
      </Card>

      <Modal open={open} title="Record wastage" onClose={() => !saving && setOpen(false)} wide>
        <form onSubmit={submit} className="wh-form">
          <FormBlock title="Select item" description="Tap the item being wasted.">
            <ProductCatalogPicker
              items={items}
              title="Products"
              mode="single"
              value={form.item_id}
              onSelect={(product) => setForm((f) => ({ ...f, item_id: String(product.id) }))}
              showPrice
              showStock={false}
              priceField="cost_price"
              maxHeight={220}
              emptyMessage="No items found."
            />
          </FormBlock>
          <FormBlock title="Details">
            <div className="wh-form-grid">
              <SearchableSelect
                id="w_branch"
                label="Branch"
                options={branchOptions}
                value={form.branch_id}
                onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}
                placeholder="Select branch…"
              />
              <FormField
                id="w_qty"
                label="Quantity"
                type="number"
                min="0.01"
                step="any"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                required
              />
              <FormField
                id="w_reason"
                label="Reason"
                as="select"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              >
                {WASTAGE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {WASTAGE_REASON_LABELS[r] || r}
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
              />
              <div className="wh-form-grid__full">
                <FormField
                  id="w_notes"
                  label="Notes"
                  as="textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </FormBlock>
          {error && <p className="wh-field__error">{error}</p>}
          <div className="wh-modal__actions">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Wastage"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
