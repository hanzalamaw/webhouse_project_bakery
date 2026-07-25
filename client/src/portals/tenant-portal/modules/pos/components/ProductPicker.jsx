import { ProductSelectField } from "../../../../../components/ProductSelectField";

/** Multi-select product picker — opens a searchable checkbox modal. */
export default function ProductPicker({
  products,
  selectedIds,
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
  showPrice,
  showStock,
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
  void tall;
  void storeName;
  void showPrice;
  void showStock;
  void onRefresh;
  void refreshing;

  return (
    <ProductSelectField
      mode="multi"
      products={products}
      selectedIds={selectedIds}
      onToggle={onToggle}
      onChange={onChange}
      entityLabel="products"
      description={description}
      showWarning={showWarning}
      warningText="Selecting a product removes it from its existing category and assigns it here."
      showCategoryTag={showCategoryTag}
      emptyMessage={emptyMessage}
      disabled={disabled}
    />
  );
}
