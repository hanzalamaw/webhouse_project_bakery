import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch, fetchAllTableRows, TABLE_PAGE_SIZE } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { DataTable } from "../../../../../../components/DataTable";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { Modal } from "../../../../../../components/Modal";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { StatusBadge } from "../../../../../../components/Badge";
import { useT } from "../../../../../../context/LanguageContext";
import { ITEM_STATUS, ITEM_TYPES, ITEM_TYPE_LABELS } from "../../constants";
import CreateCategoryModal from "../../components/CreateCategoryModal";

export default function Categories() {
  const { authFetch } = useAuth();
  const t = useT();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllTableRows("/inventory/categories", authFetch);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const openDetail = async (row) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const data = await apiFetch(`/inventory/categories/${row.id}`, {}, authFetch);
      setExpandedId(row.id);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  };

  const openEdit = async (row) => {
    try {
      const data = await apiFetch(`/inventory/categories/${row.id}`, {}, authFetch);
      setEditRow({
        id: row.id,
        category_name: data.category_name,
        item_type: data.item_type || "",
        status: data.status,
      });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!String(editRow.category_name || "").trim()) {
      setError("Category name is required");
      return;
    }
    if (!editRow.item_type) {
      setError("Item type is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        `/inventory/categories/${editRow.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            category_name: editRow.category_name,
            item_type: editRow.item_type,
            status: editRow.status,
          }),
        },
        authFetch
      );
      const editedId = editRow.id;
      setEditRow(null);
      await load();
      if (expandedId === editedId) {
        const data = await apiFetch(`/inventory/categories/${editedId}`, {}, authFetch);
        setDetail(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await apiFetch(`/inventory/categories/${deleteRow.id}`, { method: "DELETE" }, authFetch);
      setDeleteRow(null);
      if (expandedId === deleteRow.id) {
        setExpandedId(null);
        setDetail(null);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: "category_name", label: "Category" },
    {
      key: "item_type",
      label: "Type",
      format: (v) => (v ? t(ITEM_TYPE_LABELS[v] || v) : "Any"),
    },
    { key: "item_count", label: "Items", filter: false },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      label: "Actions",
      filter: false,
      render: (row) => (
        <div className="wh-action-btns">
          <Button variant="secondary" className="wh-btn--sm" onClick={() => openDetail(row)}>
            {expandedId === row.id ? "Hide" : "View"}
          </Button>
          <Button variant="secondary" className="wh-btn--sm" onClick={() => openEdit(row)}>Edit</Button>
          <Button variant="danger" className="wh-btn--sm" onClick={() => setDeleteRow(row)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="wh-page">
      <PageHeader
        title="Categories"
        description="Group your bakery items — flour, packing, cakes, etc."
        actions={<Button onClick={() => setCreateOpen(true)}>Create Category</Button>}
      />

      {error && <p className="wh-field__error">{error}</p>}

      <Card className="wh-card--table">
        <div className="wh-card-table__head"><h3 className="wh-card__title">All categories</h3></div>
        {loading ? (
          <p className="wh-muted">Loading…</p>
        ) : (
          <DataTable columns={columns} rows={rows} page={page} pageSize={TABLE_PAGE_SIZE} onPageChange={setPage} />
        )}
        {expandedId && detail && (
          <div className="wh-inv-expand-panel">
            <h4 className="wh-inv-expand-panel__title">Items in {detail.category_name}</h4>
            <ul className="wh-list">
              {(detail.items || []).map((p) => (
                <li key={p.id}>{p.item_name}{p.sku ? ` — ${p.sku}` : ""} ({p.item_type})</li>
              ))}
              {!detail.items?.length && <li className="wh-muted">No items in this category yet</li>}
            </ul>
          </div>
        )}
      </Card>

      <CreateCategoryModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        authFetch={authFetch}
        onCreated={async () => { await load(); }}
      />

      {editRow && (
        <Modal open title="Edit category" onClose={() => setEditRow(null)}>
          <FormField
            id="edit_cat_name"
            label="Category name"
            value={editRow.category_name}
            onChange={(e) => setEditRow((r) => ({ ...r, category_name: e.target.value }))}
          />
          <FormField
            id="edit_cat_type"
            label="Item type"
            as="select"
            value={editRow.item_type}
            onChange={(e) => setEditRow((r) => ({ ...r, item_type: e.target.value }))}
            required
          >
            <option value="">Select type…</option>
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>{t(ITEM_TYPE_LABELS[type] || type)}</option>
            ))}
          </FormField>
          <FormField
            id="edit_cat_status"
            label="Status"
            as="select"
            value={editRow.status}
            onChange={(e) => setEditRow((r) => ({ ...r, status: e.target.value }))}
          >
            {ITEM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </FormField>
          {error && <p className="wh-field__error">{error}</p>}
          <div className="wh-modal__actions">
            <Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editRow.category_name?.trim() || !editRow.item_type}>Save</Button>
          </div>
        </Modal>
      )}

      <ConfirmDeleteModal
        open={!!deleteRow}
        title="Delete category"
        recordName={deleteRow?.category_name || "this category"}
        onConfirm={confirmDelete}
        onClose={() => setDeleteRow(null)}
        loading={deleting}
      />
    </div>
  );
}
