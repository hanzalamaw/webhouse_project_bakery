import { useMemo, useState } from "react";
import { Button } from "./Button";
import { ProductSelectModal } from "./ProductSelectModal";

function rowId(p) {
  return String(p?.id ?? p?.product_id ?? p?.item_id ?? "");
}

function rowName(p) {
  return p?.item_name || p?.product_name || p?.name || "Item";
}

/**
 * Compact trigger + searchable checkbox/radio modal for picking products/items.
 * Use this in forms instead of card grids when catalogs can be large.
 */
export function ProductSelectField({
  mode = "multi",
  products,
  items,
  selectedIds,
  value,
  onChange,
  onToggle,
  onSelect,
  onAddNew,
  addNewLabel,
  entityLabel = "items",
  title,
  description,
  showWarning = false,
  warningText,
  showCategoryTag = true,
  emptyMessage,
  disabled = false,
  buttonLabel,
}) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    const raw = items || products || [];
    return Array.isArray(raw) ? raw : [];
  }, [items, products]);

  const activeIds = useMemo(() => {
    if (mode === "single") {
      return value != null && value !== "" ? [String(value)] : [];
    }
    return (selectedIds || []).map(String);
  }, [mode, value, selectedIds]);

  const selected = useMemo(
    () => list.filter((p) => activeIds.includes(rowId(p))),
    [list, activeIds]
  );

  const applySelection = (nextIds) => {
    const normalized = (nextIds || []).map(String);
    if (mode === "single") {
      const id = normalized[0] || "";
      onChange?.(id);
      if (id) {
        const product = list.find((p) => rowId(p) === id);
        if (product) onSelect?.(product);
      }
      return;
    }

    if (typeof onChange === "function") {
      onChange(normalized);
      return;
    }

    const prev = new Set(activeIds);
    const next = new Set(normalized);
    for (const id of prev) {
      if (!next.has(id)) {
        const product = list.find((p) => rowId(p) === id);
        onToggle?.(id, product);
      }
    }
    for (const id of next) {
      if (!prev.has(id)) {
        const product = list.find((p) => rowId(p) === id);
        onToggle?.(id, product);
      }
    }
  };

  const removeOne = (id) => {
    if (disabled) return;
    const sid = String(id);
    if (mode === "single") {
      onChange?.("");
      return;
    }
    if (typeof onChange === "function") {
      onChange(activeIds.filter((x) => x !== sid));
      return;
    }
    const product = list.find((p) => rowId(p) === sid);
    onToggle?.(sid, product);
  };

  const defaultButton =
    mode === "single"
      ? activeIds.length
        ? "Change selection"
        : `Select ${entityLabel.replace(/s$/, "")}…`
      : activeIds.length
        ? `Change selection (${activeIds.length})`
        : `Select ${entityLabel}…`;

  return (
    <div className={`wh-inv-product-picker${disabled ? " is-disabled" : ""}`}>
      {description ? <p className="wh-inv-block__desc">{description}</p> : null}
      {showWarning && (
        <div className="wh-inv-warning">
          <strong>Note:</strong>{" "}
          {warningText || "Selecting an item moves it into this category."}
        </div>
      )}

      <div className="wh-product-select-trigger">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
          {buttonLabel || defaultButton}
        </Button>
        {activeIds.length > 0 ? (
          <span className="wh-muted">
            {activeIds.length} selected
          </span>
        ) : (
          <span className="wh-muted">Opens a searchable list with checkboxes</span>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="wh-product-select-summary">
          {selected.map((p) => (
            <li key={rowId(p)} className="wh-product-select-summary__item">
              <span>
                {rowName(p)}
                {p.sku ? ` (${p.sku})` : ""}
              </span>
              {!disabled && (
                <button
                  type="button"
                  className="wh-product-select-summary__remove"
                  onClick={() => removeOne(rowId(p))}
                  aria-label={`Remove ${rowName(p)}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ProductSelectModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={applySelection}
        onAddNew={disabled ? undefined : onAddNew}
        addNewLabel={addNewLabel}
        items={list}
        products={list}
        selectedIds={activeIds}
        mode={mode}
        title={title}
        entityLabel={entityLabel}
        showCategoryTag={showCategoryTag}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
