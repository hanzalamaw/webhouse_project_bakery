import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { useInventoryReference } from "../../hooks/useInventoryReference";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import CreateCategoryModal from "../../components/CreateCategoryModal";
import { ITEM_STATUS, ITEM_TYPES, ITEM_TYPE_LABELS, ITEM_UNITS, MODULE_BASE } from "../../constants";
import { formatTotalPrice } from "../../utils/pricing";

const INITIAL = {
  item_name: "",
  sku: "",
  unit: "piece",
  item_type: "finished",
  status: "active",
  cost_price: "",
  selling_price: "",
  discount: "0",
  tax: "0",
  category_id: "",
  is_purchased: false,
  is_produced: true,
  is_sold: true,
  shelf_life_days: "",
  low_stock_threshold: "0",
  variant_label: "",
  parent_item_id: "",
};

function emptyBranchEntry(key) {
  return { _key: key, branch_id: "", qty: "0" };
}

function defaultsForType(item_type) {
  if (item_type === "ingredient" || item_type === "packaging") {
    return { is_purchased: true, is_produced: false, is_sold: false };
  }
  return { is_purchased: false, is_produced: true, is_sold: true };
}

function mapItemToForm(item) {
  return {
    item_name: item.item_name || "",
    sku: item.sku || "",
    unit: item.unit || "piece",
    item_type: item.item_type || "finished",
    status: item.status || "active",
    cost_price: item.cost_price ?? "",
    selling_price: item.selling_price ?? "",
    discount: item.discount ?? "0",
    tax: item.tax ?? "0",
    category_id: item.category_id ? String(item.category_id) : "",
    is_purchased: Boolean(item.is_purchased),
    is_produced: Boolean(item.is_produced),
    is_sold: Boolean(item.is_sold),
    shelf_life_days: item.shelf_life_days ?? "",
    low_stock_threshold: item.low_stock_threshold ?? "0",
    variant_label: item.variant_label || "",
    parent_item_id: item.parent_item_id ? String(item.parent_item_id) : "",
  };
}

export default function CreateProduct() {
  const navigate = useNavigate();
  const { itemId, productId } = useParams();
  const resolvedId = itemId || productId;
  const isEdit = Boolean(resolvedId);
  const { authFetch } = useAuth();
  const { categories, branches, items, loading: refLoading, reload } = useInventoryReference();
  const [form, setForm] = useState(INITIAL);
  const [stockLevels, setStockLevels] = useState([]);
  const branchKeyRef = useRef(0);
  const makeBranchEntry = useCallback(() => {
    branchKeyRef.current += 1;
    return emptyBranchEntry(`br-${branchKeyRef.current}`);
  }, []);
  const [openingStock, setOpeningStock] = useState(() => {
    branchKeyRef.current = 1;
    return [emptyBranchEntry("br-1")];
  });
  const [loadingItem, setLoadingItem] = useState(isEdit);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setItemType = (item_type) => {
    setForm((f) => ({ ...f, item_type, ...defaultsForType(item_type) }));
  };

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.category_name })),
    [categories]
  );
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );
  const parentOptions = useMemo(
    () =>
      items
        .filter((i) => String(i.id) !== String(resolvedId))
        .map((i) => ({ value: String(i.id), label: `${i.item_name}${i.sku ? ` (${i.sku})` : ""}` })),
    [items, resolvedId]
  );

  useEffect(() => {
    if (!isEdit) return;
    setLoadingItem(true);
    apiFetch(`/inventory/items/${resolvedId}`, {}, authFetch)
      .then((data) => {
        setStockLevels(data.stock_levels || []);
        setForm(mapItemToForm(data));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingItem(false));
  }, [isEdit, resolvedId, authFetch]);

  const updateOpening = (key, field, value) => {
    setOpeningStock((rows) => rows.map((row) => (row._key === key ? { ...row, [field]: value } : row)));
  };

  const validate = () => {
    if (!form.item_name.trim()) return "Item name is required";
    if (form.cost_price === "" || Number(form.cost_price) < 0) return "Valid cost price is required";
    if (form.selling_price === "" || Number(form.selling_price) < 0) return "Valid selling price is required";
    if (!form.category_id) return "Category is required";
    if (!isEdit) {
      const filled = openingStock.filter((row) => row.branch_id && Number(row.qty) > 0);
      const ids = filled.map((row) => row.branch_id);
      if (new Set(ids).size !== ids.length) return "Each branch can only be selected once";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        item_name: form.item_name,
        sku: form.sku || null,
        unit: form.unit,
        item_type: form.item_type,
        status: form.status,
        category_id: Number(form.category_id),
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        discount: Number(form.discount) || 0,
        tax: Number(form.tax) || 0,
        is_purchased: Boolean(form.is_purchased),
        is_produced: Boolean(form.is_produced),
        is_sold: Boolean(form.is_sold),
        shelf_life_days: form.shelf_life_days === "" ? null : Number(form.shelf_life_days),
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        variant_label: form.variant_label || null,
        parent_item_id: form.parent_item_id ? Number(form.parent_item_id) : null,
      };

      if (isEdit) {
        await apiFetch(`/inventory/items/${resolvedId}`, { method: "PUT", body: JSON.stringify(payload) }, authFetch);
        setMessage("Item updated successfully.");
      } else {
        await apiFetch(
          "/inventory/items",
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              opening_stock: openingStock
                .filter((row) => row.branch_id && Number(row.qty) > 0)
                .map((row) => ({
                  branch_id: Number(row.branch_id),
                  qty: Number(row.qty),
                })),
            }),
          },
          authFetch
        );
        setMessage("Item created successfully.");
        await reload();
      }
      setTimeout(() => navigate(`${MODULE_BASE}/items/manage`), 700);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingItem) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <p className="wh-muted">Loading item…</p>
        </FormPageLayout>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={isEdit ? "Edit Item" : "Create Item"}
          description={
            isEdit
              ? "Update item details. Use Stock In / Stock Out to change quantities."
              : "Add an ingredient, finished product, or packaging item."
          }
          actions={
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/manage`)}>
              Manage Items
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className="wh-form-stack">
          <FormBlock title="Basic information" description="Name, type, unit, and status.">
            <div className="wh-form-grid">
              <FormField id="item_name" label="Item name" value={form.item_name} onChange={(e) => set("item_name", e.target.value)} required />
              <FormField id="sku" label="SKU (optional)" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              <FormField id="item_type" label="Item type" as="select" value={form.item_type} onChange={(e) => setItemType(e.target.value)}>
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{ITEM_TYPE_LABELS[t] || t}</option>
                ))}
              </FormField>
              <FormField id="unit" label="Unit" as="select" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {ITEM_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </FormField>
              <FormField id="status" label="Status" as="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {ITEM_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </FormField>
              <FormField
                id="shelf_life_days"
                label="Shelf life (days)"
                type="number"
                min="0"
                value={form.shelf_life_days}
                onChange={(e) => set("shelf_life_days", e.target.value)}
                placeholder="e.g. 3 for fresh cake"
              />
              <FormField
                id="low_stock_threshold"
                label="Low stock alert"
                type="number"
                min="0"
                value={form.low_stock_threshold}
                onChange={(e) => set("low_stock_threshold", e.target.value)}
              />
              <FormField id="variant_label" label="Variant label" value={form.variant_label} onChange={(e) => set("variant_label", e.target.value)} placeholder="e.g. 1kg / Chocolate" />
            </div>
            <div className="wh-form-grid" style={{ marginTop: 12 }}>
              <label className="wh-checkbox-item">
                <input type="checkbox" checked={form.is_purchased} onChange={(e) => set("is_purchased", e.target.checked)} />
                <span>Purchased (Khareeda jata hai)</span>
              </label>
              <label className="wh-checkbox-item">
                <input type="checkbox" checked={form.is_produced} onChange={(e) => set("is_produced", e.target.checked)} />
                <span>Produced (Banaya jata hai)</span>
              </label>
              <label className="wh-checkbox-item">
                <input type="checkbox" checked={form.is_sold} onChange={(e) => set("is_sold", e.target.checked)} />
                <span>Sold (Becha jata hai)</span>
              </label>
            </div>
          </FormBlock>

          <FormBlock title="Pricing" description="Cost, selling price, discount, and tax.">
            <div className="wh-form-grid">
              <FormField id="cost_price" label="Cost price (PKR)" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} required />
              <FormField id="selling_price" label="Selling price (PKR)" type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} required />
              <FormField id="discount" label="Discount (PKR)" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
              <FormField id="tax" label="Tax (PKR)" type="number" min="0" step="0.01" value={form.tax} onChange={(e) => set("tax", e.target.value)} />
              <FormField id="total_price" label="Total price (PKR)" value={formatTotalPrice(form.selling_price, form.discount, form.tax)} displayOnly />
            </div>
          </FormBlock>

          <FormBlock title="Category & parent" description="Assign a category. Optional parent for variants.">
            {refLoading ? (
              <p className="wh-muted">Loading…</p>
            ) : (
              <div className={categoryOptions.length === 0 ? "wh-form-grid" : "wh-form-grid wh-form-grid--field-action"}>
                {categoryOptions.length === 0 ? (
                  <p className="wh-field__error wh-form-grid__full">No categories yet. Create one to continue.</p>
                ) : (
                  <SearchableSelect
                    id="category_id"
                    label="Category"
                    options={categoryOptions}
                    value={form.category_id}
                    onChange={(v) => set("category_id", v)}
                    placeholder="Search categories…"
                  />
                )}
                <div className={categoryOptions.length === 0 ? "wh-form-grid__actions" : "wh-form-grid--field-action__btn"}>
                  <Button type="button" variant="secondary" onClick={() => setCreateCategoryOpen(true)}>
                    New category
                  </Button>
                </div>
                <SearchableSelect
                  id="parent_item_id"
                  label="Parent item (optional)"
                  options={parentOptions}
                  value={form.parent_item_id}
                  onChange={(v) => set("parent_item_id", v)}
                  placeholder="None"
                />
              </div>
            )}
          </FormBlock>

          {!isEdit ? (
            <FormBlock title="Opening stock (optional)" description="Starting quantity at one or more branches (shakhein).">
              {branchOptions.length === 0 ? (
                <p className="wh-field__error">No branches found. Create a branch first if you want opening stock.</p>
              ) : (
                <>
                  <div className="wh-inv-line-items">
                    {openingStock.map((row, index) => (
                      <div key={row._key} className="wh-inv-line-item">
                        <div className="wh-inv-line-item__head">
                          <strong>Branch {index + 1}</strong>
                          {openingStock.length > 1 && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="wh-btn--sm"
                              onClick={() => setOpeningStock((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r._key !== row._key)))}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="wh-form-grid">
                          <SearchableSelect
                            id={`branch_${row._key}`}
                            label="Branch"
                            options={branchOptions}
                            value={row.branch_id}
                            onChange={(v) => updateOpening(row._key, "branch_id", v)}
                            placeholder="Select branch…"
                          />
                          <FormField
                            id={`qty_${row._key}`}
                            label="Quantity"
                            type="number"
                            min="0"
                            step="1"
                            value={row.qty}
                            onChange={(e) => updateOpening(row._key, "qty", e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {openingStock.length < branches.length && (
                    <div className="wh-inv-warehouse-add">
                      <Button type="button" variant="secondary" onClick={() => setOpeningStock((rows) => [...rows, makeBranchEntry()])}>
                        Add branch
                      </Button>
                    </div>
                  )}
                </>
              )}
            </FormBlock>
          ) : (
            <FormBlock title="Stock by branch" description="Current quantities. Change stock via Stock In / Stock Out / Transfers.">
              {stockLevels.length === 0 ? (
                <p className="wh-muted">No stock recorded for this item yet.</p>
              ) : (
                <div className="wh-inv-line-items">
                  {stockLevels.map((sl) => (
                    <div key={sl.id} className="wh-inv-line-item">
                      <div className="wh-inv-line-item__head">
                        <strong>{sl.branch_name}</strong>
                        <span className="wh-muted">
                          Available: {sl.available_qty} · Reserved: {sl.reserved_qty} · Damaged: {sl.damaged_qty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormBlock>
          )}

          {error && <p className="wh-field__error">{error}</p>}
          {message && <p className="wh-form-message">{message}</p>}

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(`${MODULE_BASE}/items/manage`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Item" : "Create Item"}
            </Button>
          </FormActions>
        </form>

        <CreateCategoryModal
          open={createCategoryOpen}
          onClose={() => setCreateCategoryOpen(false)}
          authFetch={authFetch}
          onCreated={async (category) => {
            await reload();
            if (category?.id) set("category_id", String(category.id));
          }}
        />
      </FormPageLayout>
    </div>
  );
}
