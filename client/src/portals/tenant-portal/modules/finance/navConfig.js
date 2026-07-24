import {
  DashboardIcon,
  SubscriptionIcon,
  LogsIcon,
  TransferIcon,
  ProductIcon,
  WarehouseIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    { id: "dashboard", labelKey: "nav.dashboard", path: `${MODULE_BASE}/dashboard`, icon: DashboardIcon },
    { id: "customer-payments", labelKey: "nav.customerPayments", path: `${MODULE_BASE}/customer-payments`, icon: SubscriptionIcon },
    { id: "vendor-bills", labelKey: "nav.vendorBills", path: `${MODULE_BASE}/vendor-bills`, icon: TransferIcon },
    { id: "expenses", labelKey: "nav.expenses", path: `${MODULE_BASE}/expenses`, icon: ProductIcon },
    { id: "expense-categories", labelKey: "nav.expenseCategories", path: `${MODULE_BASE}/expense-categories`, icon: ProductIcon },
    { id: "recurring-expenses", labelKey: "nav.recurringExpenses", path: `${MODULE_BASE}/recurring-expenses`, icon: LogsIcon },
    { id: "bank-accounts", labelKey: "nav.bankAccounts", path: `${MODULE_BASE}/bank-accounts`, icon: WarehouseIcon },
    { id: "transactions", labelKey: "nav.transactions", path: `${MODULE_BASE}/transactions`, icon: LogsIcon },
  ];
}
