import ProductCatalogPicker from "../../../../../components/ProductCatalogPicker";

/** Multi-select bakery item picker — card grid with search + category chips. */
export default function ProductPicker({
  products,
  items,
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
  entityLabel = "items",
  title,
  storeName,
  branchName,
  showPrice = false,
  showStock = false,
  priceField,
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
          <strong>Note:</strong> Selecting an item moves it into this category.
        </div>
      )}
      <ProductCatalogPicker
        className={tall ? "wh-catalog-picker--fill" : ""}
        products={products}
        items={items}
        mode="multi"
        title={title || `Select ${entityLabel}`}
        description={description}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        storeName={storeName}
        branchName={branchName}
        showPrice={showPrice}
        showStock={showStock}
        priceField={priceField}
        onRefresh={onRefresh}
        refreshing={refreshing}
        emptyMessage={emptyMessage || `No ${entityLabel} found.`}
        disabled={disabled}
        maxHeight={tall ? 420 : 280}
      />
    </div>
  );
}
