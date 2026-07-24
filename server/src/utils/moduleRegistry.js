/** Canonical module_name → frontend slug (mirrors client registry / DB modules). */
export const MODULE_NAME_TO_SLUG = {
  Admin: "admin",
  "Stock & Purchasing": "stock-purchasing",
  Production: "production",
  "Point of Sale": "pos",
  POS: "pos",
  "POS Terminal": "pos-terminal",
  "Order Management": "order-management",
  CRM: "crm",
  "Finance & Accounting": "finance",
};

export function slugForModuleName(moduleName) {
  return MODULE_NAME_TO_SLUG[moduleName] || null;
}
