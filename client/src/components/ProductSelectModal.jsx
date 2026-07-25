import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

function rowId(p) {
  return String(p?.id ?? p?.product_id ?? p?.item_id ?? "");
}

function rowName(p) {
  return p?.item_name || p?.product_name || p?.name || "Item";
}

/**
 * Modal product/item picker with search + checkboxes (multi) or single select.
 * Prefer this over card grids when the catalog can be large.
 */
export function ProductSelectModal({
  open,
  onClose,
  onConfirm,
  onAddNew,
  addNewLabel,
  products,
  items,
  selectedIds = [],
  mode = "multi",
  title,
  entityLabel = "items",
  showCategoryTag = true,
  emptyMessage,
}) {
  const list = useMemo(() => {
    const raw = items || products || [];
    return Array.isArray(raw) ? raw : [];
  }, [items, products]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [draftIds, setDraftIds] = useState([]);

  useEffect(() => {
    if (!open) return;
    setDraftIds((selectedIds || []).map(String));
    setSearch("");
    setCategoryFilter("");
  }, [open, selectedIds]);

  const categories = useMemo(() => {
    const names = new Set(list.map((p) => p.category_name).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (categoryFilter && p.category_name !== categoryFilter) return false;
      if (!q) return true;
      return (
        rowName(p).toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q) ||
        String(p.category_name || "").toLowerCase().includes(q)
      );
    });
  }, [list, search, categoryFilter]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => draftIds.includes(rowId(p)));

  const toggle = (id) => {
    const sid = String(id);
    if (mode === "single") {
      setDraftIds([sid]);
      return;
    }
    setDraftIds((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };

  const toggleAllFiltered = () => {
    if (mode !== "multi") return;
    const ids = filtered.map(rowId).filter(Boolean);
    if (allFilteredSelected) {
      setDraftIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setDraftIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleConfirm = () => {
    onConfirm?.(draftIds);
    onClose?.();
  };

  const handleAddNew = () => {
    onClose?.();
    onAddNew?.();
  };

  const singular = entityLabel.replace(/s$/, "");
  const modalTitle = title || (mode === "single" ? `Select ${singular}` : `Select ${entityLabel}`);
  const addLabel = addNewLabel || `Add new ${singular}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      wide
      className="wh-product-select-modal"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            {mode === "single"
              ? draftIds.length
                ? "Use selected"
                : "Done"
              : `Add selected (${draftIds.length})`}
          </Button>
        </>
      }
    >
      {typeof onAddNew === "function" && (
        <button type="button" className="wh-inv-picker-add" onClick={handleAddNew}>
          + {addLabel}
        </button>
      )}

      <div className={`wh-inv-picker-toolbar${categories.length ? "" : " wh-inv-picker-toolbar--search-only"}`}>
        <input
          type="search"
          className="wh-field__input wh-inv-picker-search"
          placeholder={`Search ${entityLabel} by name, SKU, or category…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {categories.length > 0 && (
          <select
            className="wh-field__input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === "multi" && filtered.length > 0 && (
        <label className="wh-inv-picker-row wh-inv-picker-row--select-all">
          <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
          <span className="wh-inv-picker-row__label">
            Select all shown ({filtered.length})
          </span>
        </label>
      )}

      <div className="wh-inv-picker-panel wh-inv-picker-panel--modal">
        <div className="wh-inv-picker-list wh-inv-picker-list--modal">
          {filtered.length === 0 ? (
            <p className="wh-inv-picker-empty">
              {emptyMessage || `No ${entityLabel} match your search.`}
            </p>
          ) : (
            filtered.map((p) => {
              const id = rowId(p);
              const checked = draftIds.includes(id);
              return (
                <label key={id || rowName(p)} className="wh-inv-picker-row">
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    name={mode === "single" ? "product-select-single" : undefined}
                    checked={checked}
                    onChange={() => toggle(id)}
                  />
                  <span className="wh-inv-picker-row__label">
                    {rowName(p)}
                    {p.sku ? ` (${p.sku})` : ""}
                    {showCategoryTag && p.category_name ? (
                      <span className="wh-inv-tag"> — {p.category_name}</span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <p className="wh-muted wh-inv-picker-count">
        {draftIds.length} {entityLabel} selected
        {list.length ? ` · ${list.length} total` : ""}
      </p>
    </Modal>
  );
}
