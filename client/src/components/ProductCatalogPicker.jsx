import { useMemo, useState } from "react";
import { Button } from "./Button";
import { FormField } from "./FormField";
import { useMoney } from "../hooks/useMoney";

function productId(p) {
  return String(p?.id ?? p?.product_id ?? p?.item_id ?? "");
}

function productName(p) {
  return p?.product_name || p?.item_name || p?.name || "Item";
}

/**
 * Shared bakery product/item catalog picker (card grid + search + category chips).
 *
 * Modes:
 * - tap: click a card to add (POS, orders) — no persistent highlight
 * - single: pick one item; highlight via selectedIds / value
 * - multi: toggle selection with selectedIds / onToggle
 */
export default function ProductCatalogPicker({
  products,
  items,
  title = "Products",
  description,
  storeName,
  branchName,
  mode = "tap",
  selectedIds = [],
  value,
  onToggle,
  onSelect,
  onRefresh,
  refreshing = false,
  showRefresh = Boolean(onRefresh),
  showPrice = true,
  showStock = true,
  showTaxDiscount = false,
  priceField = "selling_price",
  stockField = "available_qty",
  maxHeight = 280,
  emptyMessage = "No products found.",
  emptyHint,
  disabled = false,
  className = "",
  searchPlaceholder = "Search by name, SKU, or category",
}) {
  const { format } = useMoney();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const list = useMemo(() => {
    const raw = items || products || [];
    return Array.isArray(raw) ? raw : [];
  }, [items, products]);

  const categories = useMemo(() => {
    const names = new Set(list.map((p) => p.category_name).filter(Boolean));
    return ["all", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      const cat = p.category_name || "";
      if (activeCategory !== "all" && cat !== activeCategory) return false;
      if (!q) return true;
      const name = productName(p).toLowerCase();
      return (
        name.includes(q) ||
        String(p.sku || "").toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [list, search, activeCategory]);

  const locationLabel = storeName || branchName || "";
  const activeIds = useMemo(() => {
    if (value != null && value !== "") return [String(value)];
    return (selectedIds || []).map(String);
  }, [value, selectedIds]);

  const hint =
    description ??
    [
      mode === "tap" ? "Tap to add items." : mode === "single" ? "Tap to select one item." : "Tap to select items.",
      locationLabel ? `Store: ${locationLabel}.` : "",
      list.length > 0 ? `${list.length} available.` : "",
    ]
      .filter(Boolean)
      .join(" ");

  const handleCardClick = (product) => {
    if (disabled) return;
    const id = productId(product);
    if (!id) return;
    if (mode === "multi") {
      onToggle?.(id, product);
      return;
    }
    onSelect?.(product);
  };

  const isSelected = (product) => activeIds.includes(productId(product));

  return (
    <section className={`wh-catalog-picker ${className}`.trim()}>
      <div className="wh-catalog-picker__head">
        <div>
          <h2 className="wh-catalog-picker__title">{title}</h2>
          {hint ? <p className="wh-muted wh-catalog-picker__hint">{hint}</p> : null}
        </div>
        {showRefresh && (
          <Button
            type="button"
            variant="secondary"
            className="wh-btn--sm"
            disabled={disabled || refreshing}
            onClick={() => onRefresh?.()}
          >
            {refreshing ? "Refreshing…" : "Refresh products"}
          </Button>
        )}
      </div>

      <div className="wh-catalog-picker__search">
        <FormField
          id={`catalog-search-${title.replace(/\s+/g, "-").toLowerCase()}`}
          label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
        />
      </div>

      {categories.length > 1 && (
        <div className="wh-catalog-picker__categories" role="tablist" aria-label="Categories">
          {categories.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                className={`wh-catalog-picker__chip${active ? " is-active" : ""}`}
                onClick={() => setActiveCategory(category)}
                disabled={disabled}
              >
                {category === "all" ? "All" : category}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="wh-catalog-picker__scroll"
        style={maxHeight ? { maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight } : undefined}
      >
        {filtered.length === 0 ? (
          <div className="wh-catalog-picker__empty">
            <p className="wh-muted">{emptyMessage}</p>
            {emptyHint ? <p className="wh-muted">{emptyHint}</p> : null}
          </div>
        ) : (
          <div className="wh-catalog-picker__grid">
            {filtered.map((product) => {
              const id = productId(product);
              const selected = (mode === "multi" || mode === "single") && isSelected(product);
              const price = Number(product[priceField] ?? product.selling_price ?? product.cost_price ?? 0) || 0;
              const stock = Number(product[stockField] ?? product.available_qty ?? product.total_available ?? 0) || 0;
              const discount = Number(product.discount) || 0;
              const tax = Number(product.tax) || 0;
              return (
                <button
                  key={id || productName(product)}
                  type="button"
                  className={`wh-catalog-picker__card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
                  onClick={() => handleCardClick(product)}
                  disabled={disabled}
                >
                  <div className="wh-catalog-picker__name">{productName(product)}</div>
                  <div className="wh-catalog-picker__meta">
                    {product.sku ? <span>SKU: {product.sku}</span> : null}
                    <span>{product.category_name || "Uncategorized"}</span>
                  </div>
                  {showPrice ? (
                    <div className="wh-catalog-picker__price">{format(price)}</div>
                  ) : null}
                  {showTaxDiscount && (discount > 0 || tax > 0) ? (
                    <div className="wh-catalog-picker__adjustments">
                      {discount > 0 ? <span>Discount: {format(discount)}</span> : null}
                      {tax > 0 ? <span>Tax: {format(tax)}</span> : null}
                    </div>
                  ) : null}
                  {showStock ? (
                    <div className="wh-catalog-picker__stock">Stock: {stock}</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {mode === "multi" && activeIds.length > 0 ? (
        <p className="wh-muted wh-catalog-picker__count">{activeIds.length} selected</p>
      ) : null}
      {mode === "single" && activeIds.length > 0 ? (
        <p className="wh-muted wh-catalog-picker__count">1 selected</p>
      ) : null}
    </section>
  );
}
