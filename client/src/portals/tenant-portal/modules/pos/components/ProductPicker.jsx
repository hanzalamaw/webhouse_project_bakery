import ProductCatalogPicker from "../../../../../components/ProductCatalogPicker";

/** Multi-select product picker — shared catalog card UI. */
export default function ProductPicker({
  products,
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
  storeName,
  showPrice = true,
  showStock = true,
  onRefresh,
  refreshing,
}) {
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
          <strong>Note:</strong> Selecting a product removes it from its existing category and assigns it here.
        </div>
      )}
      <ProductCatalogPicker
        products={products}
        title="Products"
        description={description || "Tap to select products."}
        storeName={storeName}
        mode="multi"
        selectedIds={selectedIds}
        onToggle={(id) => onToggle(id)}
        showPrice={showPrice}
        showStock={showStock}
        maxHeight={tall ? 320 : 280}
        emptyMessage="No products match your search."
        onRefresh={onRefresh}
        refreshing={refreshing}
        showRefresh={Boolean(onRefresh)}
      />
    </div>
  );
}
