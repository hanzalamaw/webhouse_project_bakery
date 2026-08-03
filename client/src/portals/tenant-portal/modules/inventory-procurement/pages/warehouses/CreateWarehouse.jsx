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
import { hasAnyError, requiredText, visibleError } from "../../utils/validation";

const EMPTY = {
  branch_name: "",
  code: "",
  location: "",
  city: "",
  phone: "",
  open_time: "",
  close_time: "",
  status: "active",
};

export default function CreateWarehouse() {
  const { branchId, warehouseId } = useParams();
  const resolvedId = branchId || warehouseId;
  const isEdit = Boolean(resolvedId);
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [baseline, setBaseline] = useState(() => (isEdit ? null : JSON.stringify(EMPTY)));
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  const backPath = `${MODULE_BASE}/branches`;
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    apiFetch(`/inventory/branches/${resolvedId}`, {}, authFetch)
      .then((row) => {
        const next = {
          branch_name: row.branch_name || "",
          code: row.code || "",
          location: row.location || "",
          city: row.city || "",
          phone: row.phone || "",
          open_time: row.open_time || "",
          close_time: row.close_time || "",
          status: row.status || "active",
        };
        setForm(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, resolvedId, authFetch]);

  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline, enabled: !loading });

  const fieldErrors = useMemo(
    () => ({
      branch_name: requiredText(form.branch_name, "Branch name"),
      code: requiredText(form.code, "Code"),
      city: requiredText(form.city, "City"),
      phone: requiredText(form.phone, "Phone"),
      open_time: requiredText(form.open_time, "Open time"),
      close_time: requiredText(form.close_time, "Close time"),
      location: requiredText(form.location, "Location / address"),
    }),
    [form]
  );
  const show = (err) => visibleError(attempted, err);

  const submit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    if (hasAnyError(fieldErrors)) {
      setError("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      open_time: form.open_time || null,
      close_time: form.close_time || null,
    };
    try {
      if (isEdit) {
        await apiFetch(`/inventory/branches/${resolvedId}`, { method: "PUT", body: JSON.stringify(payload) }, authFetch);
      } else {
        await apiFetch("/inventory/branches", { method: "POST", body: JSON.stringify(payload) }, authFetch);
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
          title={isEdit ? "Edit Branch" : "Create Branch"}
          description={isEdit ? "Update branch details." : "Add a bakery branch / shop."}
          actions={<Button variant="secondary" onClick={() => navigate(backPath)}>Back to branches</Button>}
        />
        <form onSubmit={submit} className="wh-form-stack">
          <FormBlock title="Branch details" description="Name, code, location, timings, and status.">
            <div className="wh-form-grid">
              <FormField id="branch_name" label="Branch name" value={form.branch_name} onChange={(e) => set("branch_name", e.target.value)} required error={show(fieldErrors.branch_name)} />
              <FormField id="code" label="Code" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. DHA-01" required error={show(fieldErrors.code)} />
              <FormField id="city" label="City" value={form.city} onChange={(e) => set("city", e.target.value)} required error={show(fieldErrors.city)} />
              <FormField id="phone" label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} required error={show(fieldErrors.phone)} />
              <FormField id="open_time" label="Open time" type="time" value={form.open_time} onChange={(e) => set("open_time", e.target.value)} required error={show(fieldErrors.open_time)} />
              <FormField id="close_time" label="Close time" type="time" value={form.close_time} onChange={(e) => set("close_time", e.target.value)} required error={show(fieldErrors.close_time)} />
              <FormField id="status" label="Status" as="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {ITEM_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </FormField>
              <div className="wh-form-grid__full">
                <FormField id="location" label="Location / address" as="textarea" rows={3} value={form.location} onChange={(e) => set("location", e.target.value)} required error={show(fieldErrors.location)} />
              </div>
            </div>
          </FormBlock>
          {error && attempted && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Branch" : "Create Branch"}</Button>
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
