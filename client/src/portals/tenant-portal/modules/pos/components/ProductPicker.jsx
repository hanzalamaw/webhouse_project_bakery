import ProductCatalogPicker from "../../../../../components/ProductCatalogPicker";

/** Multi-select product picker — card grid with search + category chips. */
export default function ProductPicker({
  products,
  selectedIds = [],
  onToggle,
  onChange,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  showCategoryFilter,
  showCategoryTag = true,
  showWarning = false,
  description,
  tall,
  storeName,
  showPrice = false,
  showStock = false,
  onRefresh,
  refreshing,
  emptyMessage,
  disabled,
}) {
  void search;
  void onSearchChange;
  void categoryFilter;
  void onCategoryFilterChange;
  void showCategoryFilter;
  void showCategoryTag;

  const handleToggle = (id, product) => {
    if (typeof onToggle === "function") {
      onToggle(id, product);
      return;
    }
    if (typeof onChange === "function") {
      const sid = String(id);
      const prev = (selectedIds || []).map(String);
      onChange(prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]);
    }
  };

  return (
    <div className={`wh-inv-product-picker${disabled ? " is-disabled" : ""}`}>
      {showWarning && (
        <div className="wh-inv-warning">
          <strong>Note:</strong> Selecting a product removes it from its existing category and assigns it here.
        </div>
      )}
      <ProductCatalogPicker
        className={tall ? "wh-catalog-picker--fill" : ""}
        products={products}
        mode="multi"
        title="Select products"
        description={description}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        storeName={storeName}
        showPrice={showPrice}
        showStock={showStock}
        onRefresh={onRefresh}
        refreshing={refreshing}
        emptyMessage={emptyMessage || "No products found."}
        disabled={disabled}
        maxHeight={tall ? 420 : 280}
      />
    </div>
  );
}
