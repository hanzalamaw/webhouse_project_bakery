/** Map API / registry module names to i18n keys. */
const MODULE_NAME_KEYS = {
  Admin: "module.admin",
  "Stock & Purchasing": "module.stock",
  "Inventory & Procurement": "module.stock",
  Production: "module.production",
  "Point of Sale": "module.pos",
  POS: "module.pos",
  "POS Terminal": "module.posTerminal",
  "Order Management": "module.orders",
  CRM: "module.crm",
  "Finance & Accounting": "module.finance",
  Finance: "module.finance",
  Hisaab: "module.finance",
};

export function translateModuleName(t, name) {
  if (!name) return "—";
  const key = MODULE_NAME_KEYS[name];
  if (key) return t(key);
  return t(name);
}
