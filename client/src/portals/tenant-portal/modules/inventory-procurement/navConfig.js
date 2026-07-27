import {
  DashboardIcon,
  ProductIcon,
  ProcurementIcon,
  LogsIcon,
  TransferIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    {
      id: "dashboard",
      labelKey: "nav.dashboard",
      path: `${MODULE_BASE}/dashboard`,
      icon: DashboardIcon,
    },
    {
      id: "items",
      labelKey: "nav.items",
      icon: ProductIcon,
      children: [
        { id: "create-item", labelKey: "nav.createItem", path: `${MODULE_BASE}/items/create` },
        { id: "manage-items", labelKey: "nav.manageItems", path: `${MODULE_BASE}/items/manage` },
        { id: "categories", labelKey: "nav.categories", path: `${MODULE_BASE}/items/categories` },
        { id: "import-export", labelKey: "nav.bulkImportExport", path: `${MODULE_BASE}/items/import-export` },
      ],
    },
    {
      id: "stock",
      labelKey: "nav.stock",
      icon: TransferIcon,
      children: [
        { id: "stock-in", labelKey: "nav.stockIn", path: `${MODULE_BASE}/stock/stock-in` },
        { id: "stock-out", labelKey: "nav.stockOut", path: `${MODULE_BASE}/stock/stock-out` },
        { id: "transfers", labelKey: "nav.transfers", path: `${MODULE_BASE}/stock/transfers` },
        { id: "movement-history", labelKey: "nav.movementHistory", path: `${MODULE_BASE}/stock/movement-history` },
        { id: "batches", labelKey: "nav.batches", path: `${MODULE_BASE}/stock/batches` },
      ],
    },
    {
      id: "purchasing",
      labelKey: "nav.purchasing",
      icon: ProcurementIcon,
      children: [
        { id: "suppliers", labelKey: "nav.suppliers", path: `${MODULE_BASE}/purchasing/suppliers` },
        { id: "purchase-orders", labelKey: "nav.purchaseOrders", path: `${MODULE_BASE}/purchasing/purchase-orders` },
      ],
    },
    {
      id: "wastage",
      labelKey: "nav.wastage",
      path: `${MODULE_BASE}/wastage`,
      icon: LogsIcon,
    },
  ];
}
