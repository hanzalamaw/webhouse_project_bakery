import { ProductSelectField } from "../../../../../components/ProductSelectField";

/** Multi-select bakery item picker — opens a searchable checkbox modal. */
export default function ProductPicker({
  products,
  items,
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
  entityLabel = "items",
  storeName,
  branchName,
  showPrice,
  showStock,
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
  void tall;
  void storeName;
  void branchName;
  void showPrice;
  void showStock;
  void priceField;
  void onRefresh;
  void refreshing;

  return (
    <ProductSelectField
      mode="multi"
      products={products}
      items={items}
      selectedIds={selectedIds}
      onToggle={onToggle}
      onChange={onChange}
      entityLabel={entityLabel}
      description={description}
      showWarning={showWarning}
      showCategoryTag={showCategoryTag}
      emptyMessage={emptyMessage}
      disabled={disabled}
    />
  );
}
