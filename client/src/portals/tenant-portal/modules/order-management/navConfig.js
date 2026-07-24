import {
  DashboardIcon,
  ProductIcon,
  SubscriptionIcon,
  TransferIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    { id: "dashboard", labelKey: "nav.dashboard", path: `${MODULE_BASE}/dashboard`, icon: DashboardIcon },
    {
      id: "orders",
      labelKey: "nav.orders",
      icon: ProductIcon,
      children: [
        { id: "orders-manage", labelKey: "nav.manageOrders", path: `${MODULE_BASE}/orders/manage` },
        { id: "printing", labelKey: "nav.invoicePrinting", path: `${MODULE_BASE}/printing` },
        { id: "import-export", labelKey: "nav.importExport", path: `${MODULE_BASE}/import-export` },
      ],
    },
    {
      id: "payments",
      labelKey: "nav.payments",
      icon: SubscriptionIcon,
      children: [
        { id: "payments-manage", labelKey: "nav.openPayment", path: `${MODULE_BASE}/payments/manage` },
      ],
    },
    {
      id: "after-sales",
      labelKey: "nav.afterSales",
      icon: TransferIcon,
      children: [
        { id: "cancellations", labelKey: "nav.cancellations", path: `${MODULE_BASE}/cancellations/manage` },
        { id: "returns", labelKey: "nav.returns", path: `${MODULE_BASE}/returns/manage` },
        { id: "exchanges", labelKey: "nav.exchanges", path: `${MODULE_BASE}/exchanges/manage` },
        { id: "refunds", labelKey: "nav.refunds", path: `${MODULE_BASE}/refunds/manage` },
      ],
    },
  ];
}
