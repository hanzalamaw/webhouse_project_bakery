import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import { MODULE_BASE, ITEM_STATUS } from "../../constants";
import {
  NOTES_MAX,
  clampNotes,
  emailOrDashError,
  hasAnyError,
  notesError,
  requiredText,
  visibleError,
} from "../../utils/validation";

const EMPTY = {
  supplier_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
  status: "active",
};

export default function CreateSupplier() {
  const { supplierId } = useParams();
  const isEdit = Boolean(supplierId);
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [baseline, setBaseline] = useState(() => (isEdit ? null : JSON.stringify(EMPTY)));
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const backPath = `${MODULE_BASE}/purchasing/suppliers`;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    apiFetch(`/inventory/suppliers/${supplierId}`, {}, authFetch)
      .then((row) => {
        const next = {
          supplier_name: row.supplier_name || "",
          contact_person: row.contact_person || "",
          phone: row.phone || "",
          email: row.email || "",
          address: row.address || "",
          city: row.city || "",
          notes: row.notes || "",
          status: row.status || "active",
        };
        setForm(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, supplierId, authFetch]);

  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline, enabled: !loading });

  const fieldErrors = useMemo(
    () => ({
      supplier_name: requiredText(form.supplier_name, "Supplier name"),
      contact_person: requiredText(form.contact_person, "Contact person"),
      phone: requiredText(form.phone, "Phone"),
      email: emailOrDashError(form.email),
      address: requiredText(form.address, "Address"),
      city: requiredText(form.city, "City"),
      notes: notesError(form.notes),
    }),
    [form]
  );
  const show = (err) => visibleError(attempted, err);

  // Realtime only when user typed an invalid email (not empty-required)
  const emailRealtime = (() => {
    const v = String(form.email || "").trim();
    if (!v) return "";
    const err = emailOrDashError(form.email);
    return err === "Email is required" ? "" : err;
  })();

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
      if (isEdit) {
        await apiFetch(`/inventory/suppliers/${supplierId}`, { method: "PUT", body: JSON.stringify(form) }, authFetch);
      } else {
        await apiFetch("/inventory/suppliers", { method: "POST", body: JSON.stringify(form) }, authFetch);
      }
      navigateSafely(backPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wh-page">
        <FormPageLayout><p className="wh-muted">Loading…</p></FormPageLayout>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={isEdit ? "Edit Supplier" : "Add Supplier"}
          description="Supplier / vendor details for purchasing."
          actions={<Button variant="secondary" onClick={() => navigate(backPath)}>Back</Button>}
        />
        <form onSubmit={submit} className="wh-form-stack">
          <FormBlock title="Supplier details">
            <div className="wh-form-grid">
              <FormField id="supplier_name" label="Supplier name" value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} required error={show(fieldErrors.supplier_name)} />
              <FormField id="contact_person" label="Contact person" value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} required error={show(fieldErrors.contact_person)} />
              <FormField id="phone" label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} required error={show(fieldErrors.phone)} />
              <FormField id="email" label="Email" value={form.email} onChange={(e) => set("email", e.target.value)} required error={emailRealtime || show(fieldErrors.email)} placeholder="email@example.com or -" />
              <FormField id="city" label="City" value={form.city} onChange={(e) => set("city", e.target.value)} required error={show(fieldErrors.city)} />
              <FormField id="status" label="Status" as="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </FormField>
              <div className="wh-form-grid__full">
                <FormField id="address" label="Address" as="textarea" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} required error={show(fieldErrors.address)} />
              </div>
              <div className="wh-form-grid__full">
                <FormField
                  id="notes"
                  label="Notes"
                  as="textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", clampNotes(e.target.value))}
                  maxLength={NOTES_MAX}
                  error={fieldErrors.notes}
                />
              </div>
            </div>
          </FormBlock>
          {error && attempted && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Supplier" : "Add Supplier"}</Button>
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
