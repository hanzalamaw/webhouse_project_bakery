import ProductCatalogPicker from "../../../../../components/ProductCatalogPicker";

/** Multi-select bakery item picker — shared catalog card UI. */
export default function ProductPicker({
  products,
  items,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  showCategoryFilter,
  showCategoryTag,
  showWarning,
  description,
  tall = false,
  entityLabel = "items",
  storeName,
  branchName,
  showPrice = true,
  showStock = false,
  priceField = "cost_price",
  onRefresh,
  refreshing,
}) {
  // Legacy search/category props are ignored — catalog picker manages its own filters.
  void search;
  void onSearchChange;
  void categoryFilter;
  void onCategoryFilterChange;
  void showCategoryFilter;
  void showCategoryTag;

  return (
    <div className="wh-inv-product-picker">
      {showWarning && (
        <div className="wh-inv-warning">
          <strong>Note:</strong> Selecting an item moves it into this category.
        </div>
      )}
      <ProductCatalogPicker
        items={items || products}
        title={entityLabel === "products" ? "Products" : "Items"}
        description={description || `Tap to select ${entityLabel}.`}
        storeName={storeName}
        branchName={branchName}
        mode="multi"
        selectedIds={selectedIds}
        onToggle={(id) => onToggle(id)}
        showPrice={showPrice}
        showStock={showStock}
        priceField={priceField}
        maxHeight={tall ? 320 : 280}
        emptyMessage={`No ${entityLabel} match your search.`}
        onRefresh={onRefresh}
        refreshing={refreshing}
        showRefresh={Boolean(onRefresh)}
      />
    </div>
  );
}
