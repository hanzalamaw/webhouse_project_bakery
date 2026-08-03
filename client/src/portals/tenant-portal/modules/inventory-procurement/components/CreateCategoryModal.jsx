import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../../../api/client";
import { Modal } from "../../../../../components/Modal";
import { FormField } from "../../../../../components/FormField";
import { Button } from "../../../../../components/Button";
import { useT } from "../../../../../context/LanguageContext";
import { ITEM_STATUS, ITEM_TYPES, ITEM_TYPE_LABELS } from "../constants";
import { hasAnyError, requiredText, visibleError } from "../utils/validation";

const EMPTY_FORM = { category_name: "", item_type: "", status: "active" };

export default function CreateCategoryModal({ open, onClose, authFetch, onCreated }) {
  const t = useT();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError("");
    setAttempted(false);
  }, [open]);

  const fieldErrors = useMemo(
    () => ({
      category_name: requiredText(form.category_name, "Category name"),
      item_type: requiredText(form.item_type, "Item type"),
    }),
    [form]
  );
  const show = (err) => visibleError(attempted, err);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (hasAnyError(fieldErrors)) {
      setError("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await apiFetch(
        "/inventory/categories",
        {
          method: "POST",
          body: JSON.stringify({
            category_name: form.category_name.trim(),
            item_type: form.item_type,
            status: form.status,
          }),
        },
        authFetch
      );
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Create category" onClose={handleClose} className="wh-modal--category">
      <form onSubmit={handleSubmit} className="wh-form">
        <div className="wh-form-grid">
          <FormField
            id="cat_name"
            label="Category name"
            value={form.category_name}
            onChange={(e) => setForm((f) => ({ ...f, category_name: e.target.value }))}
            required
            autoFocus
            error={show(fieldErrors.category_name)}
          />
          <FormField
            id="cat_item_type"
            label="Item type"
            as="select"
            value={form.item_type}
            onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))}
            required
            error={show(fieldErrors.item_type)}
          >
            <option value="">Select type…</option>
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>{t(ITEM_TYPE_LABELS[type] || type)}</option>
            ))}
          </FormField>
          <FormField
            id="cat_status"
            label="Status"
            as="select"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {ITEM_STATUS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </FormField>
        </div>
        {error && attempted && <p className="wh-field__error">{error}</p>}
        <div className="wh-modal__actions">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Category"}</Button>
        </div>
      </form>
    </Modal>
  );
}
