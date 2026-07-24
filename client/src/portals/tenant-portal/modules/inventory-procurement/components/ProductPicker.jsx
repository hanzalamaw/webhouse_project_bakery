import { useMemo } from "react";

/** Multi-select picker for bakery items (kept filename for existing imports). */
export default function ProductPicker({
  products,
  items,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  categoryFilter = "",
  onCategoryFilterChange,
  showCategoryFilter = false,
  showCategoryTag = false,
  showWarning = false,
  description,
  tall = false,
  entityLabel = "items",
}) {
  const list = items || products || [];

  const categories = useMemo(() => {
    const names = new Set(list.map((p) => p.category_name).filter(Boolean));
    return Array.from(names).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      const name = p.item_name || p.product_name;
      if (categoryFilter && p.category_name !== categoryFilter) return false;
      if (!q) return true;
      return (
        name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category_name?.toLowerCase().includes(q) ||
        p.item_type?.toLowerCase().includes(q)
      );
    });
  }, [list, search, categoryFilter]);

  return (
    <div className="wh-inv-product-picker">
      {description && <p className="wh-inv-block__desc">{description}</p>}
      {showWarning && (
        <div className="wh-inv-warning">
          <strong>Note:</strong> Selecting an item moves it into this category.
        </div>
      )}
      <div className={`wh-inv-picker-toolbar${showCategoryFilter ? "" : " wh-inv-picker-toolbar--search-only"}`}>
        <input
          type="search"
          className="wh-field__input wh-inv-picker-search"
          placeholder={`Search ${entityLabel} by name, SKU, or category…`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {showCategoryFilter && (
          <select className="wh-field__input" value={categoryFilter} onChange={(e) => onCategoryFilterChange(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>
      <div className={`wh-inv-picker-panel${tall ? " wh-inv-picker-panel--tall" : ""}`}>
        <div className="wh-inv-picker-list">
          {filtered.length === 0 ? (
            <p className="wh-inv-picker-empty">No {entityLabel} match your search.</p>
          ) : (
            filtered.map((p) => {
              const name = p.item_name || p.product_name;
              return (
                <label key={p.id} className="wh-inv-picker-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(String(p.id))}
                    onChange={() => onToggle(p.id)}
                  />
                  <span className="wh-inv-picker-row__label">
                    {name}{p.sku ? ` (${p.sku})` : ""}
                    {p.item_type && <span className="wh-inv-tag"> — {p.item_type}</span>}
                    {showCategoryTag && p.category_name && (
                      <span className="wh-inv-tag"> — {p.category_name}</span>
                    )}
                    {!showCategoryTag && p.category_name && !p.item_type && (
                      <span className="wh-inv-tag"> — {p.category_name}</span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
      {selectedIds.length > 0 && (
        <p className="wh-muted wh-inv-picker-count">{selectedIds.length} {entityLabel} selected</p>
      )}
    </div>
  );
}
