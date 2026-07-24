import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { MODULE_BASE, ITEM_STATUS } from "../../constants";

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
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const backPath = `${MODULE_BASE}/purchasing/suppliers`;

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    apiFetch(`/inventory/suppliers/${supplierId}`, {}, authFetch)
      .then((row) => {
        setForm({
          supplier_name: row.supplier_name || "",
          contact_person: row.contact_person || "",
          phone: row.phone || "",
          email: row.email || "",
          address: row.address || "",
          city: row.city || "",
          notes: row.notes || "",
          status: row.status || "active",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, supplierId, authFetch]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.supplier_name.trim()) {
      setError("Supplier name is required");
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
      navigate(backPath);
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
              <FormField id="supplier_name" label="Supplier name" value={form.supplier_name} onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} required />
              <FormField id="contact_person" label="Contact person" value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} />
              <FormField id="phone" label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <FormField id="email" label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <FormField id="city" label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              <FormField id="status" label="Status" as="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </FormField>
              <div className="wh-form-grid__full">
                <FormField id="address" label="Address" as="textarea" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="wh-form-grid__full">
                <FormField id="notes" label="Notes" as="textarea" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </FormBlock>
          {error && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Supplier" : "Add Supplier"}</Button>
          </FormActions>
        </form>
      </FormPageLayout>
    </div>
  );
}
