import {
  DashboardIcon,
  ProductIcon,
  WarehouseIcon,
  ProcurementIcon,
  LogsIcon,
  TransferIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    {
      id: "dashboard",
      label: "Dashboard",
      path: `${MODULE_BASE}/dashboard`,
      icon: DashboardIcon,
    },
    {
      id: "items",
      label: "Items (Cheezen)",
      icon: ProductIcon,
      children: [
        { id: "create-item", label: "Create Item", path: `${MODULE_BASE}/items/create` },
        { id: "manage-items", label: "Manage Items", path: `${MODULE_BASE}/items/manage` },
        { id: "categories", label: "Categories", path: `${MODULE_BASE}/items/categories` },
        { id: "import-export", label: "Bulk Import/Export", path: `${MODULE_BASE}/items/import-export` },
      ],
    },
    {
      id: "branches",
      label: "Branches (Shakhein)",
      path: `${MODULE_BASE}/branches`,
      icon: WarehouseIcon,
    },
    {
      id: "stock",
      label: "Stock (Stock)",
      icon: TransferIcon,
      children: [
        { id: "stock-in", label: "Stock In", path: `${MODULE_BASE}/stock/stock-in` },
        { id: "stock-out", label: "Stock Out", path: `${MODULE_BASE}/stock/stock-out` },
        { id: "transfers", label: "Transfers between branches", path: `${MODULE_BASE}/stock/transfers` },
        { id: "movement-history", label: "Movement History", path: `${MODULE_BASE}/stock/movement-history` },
        { id: "batches", label: "Batches / Expiry", path: `${MODULE_BASE}/stock/batches` },
      ],
    },
    {
      id: "purchasing",
      label: "Purchasing (Khareedari)",
      icon: ProcurementIcon,
      children: [
        { id: "suppliers", label: "Suppliers", path: `${MODULE_BASE}/purchasing/suppliers` },
        { id: "purchase-orders", label: "Purchase Orders", path: `${MODULE_BASE}/purchasing/purchase-orders` },
      ],
    },
    {
      id: "wastage",
      label: "Wastage (Barbaadi)",
      path: `${MODULE_BASE}/wastage`,
      icon: LogsIcon,
    },
  ];
}
