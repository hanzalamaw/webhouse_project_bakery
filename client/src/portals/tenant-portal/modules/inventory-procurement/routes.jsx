import CreateProduct from "./pages/products/CreateProduct";
import ManageProducts from "./pages/products/ManageProducts";
import ItemView from "./pages/products/ItemView";
import Categories from "./pages/products/Categories";
import BulkImportExport from "./pages/products/BulkImportExport";
import CreateWarehouse from "./pages/warehouses/CreateWarehouse";
import ManageWarehouses from "./pages/warehouses/ManageWarehouses";
import BranchView from "./pages/warehouses/BranchView";
import StockIn from "./pages/procurement/StockIn";
import StockOut from "./pages/procurement/StockOut";
import StockTransfers from "./pages/procurement/StockTransfers";
import CreateBulkStock from "./pages/procurement/CreateBulkStock";
import MovementHistory from "./pages/procurement/MovementHistory";
import ViewStockMovement from "./pages/procurement/ViewStockMovement";
import ViewStockTransfer from "./pages/procurement/ViewStockTransfer";
import Batches from "./pages/stock/Batches";
import ManageSuppliers from "./pages/purchasing/ManageSuppliers";
import CreateSupplier from "./pages/purchasing/CreateSupplier";
import SupplierView from "./pages/purchasing/SupplierView";
import ManagePurchaseOrders from "./pages/purchasing/ManagePurchaseOrders";
import CreatePurchaseOrder from "./pages/purchasing/CreatePurchaseOrder";
import ViewPurchaseOrder from "./pages/purchasing/ViewPurchaseOrder";
import Wastage from "./pages/wastage/Wastage";
import WastageView from "./pages/wastage/WastageView";

export const INVENTORY_ROUTES = [
  // Items (Cheezen)
  { path: "items/create", element: <CreateProduct /> },
  { path: "items/edit/:itemId", element: <CreateProduct /> },
  { path: "items/view/:itemId", element: <ItemView /> },
  { path: "items/manage", element: <ManageProducts /> },
  { path: "items/categories", element: <Categories /> },
  { path: "items/import-export", element: <BulkImportExport /> },

  // Branches
  { path: "branches", element: <ManageWarehouses /> },
  { path: "branches/create", element: <CreateWarehouse /> },
  { path: "branches/edit/:branchId", element: <CreateWarehouse /> },
  { path: "branches/view/:branchId", element: <BranchView /> },

  // Stock
  { path: "stock/stock-in", element: <StockIn /> },
  { path: "stock/stock-in/create", element: <CreateBulkStock /> },
  { path: "stock/stock-out", element: <StockOut /> },
  { path: "stock/stock-out/create", element: <CreateBulkStock /> },
  { path: "stock/transfers", element: <StockTransfers /> },
  { path: "stock/transfers/create", element: <CreateBulkStock /> },
  { path: "stock/transfers/view/:transferId", element: <ViewStockTransfer /> },
  { path: "stock/movements/view/:movementId", element: <ViewStockMovement /> },
  { path: "stock/movement-history", element: <MovementHistory /> },
  { path: "stock/batches", element: <Batches /> },

  // Purchasing (Khareedari)
  { path: "purchasing/suppliers", element: <ManageSuppliers /> },
  { path: "purchasing/suppliers/create", element: <CreateSupplier /> },
  { path: "purchasing/suppliers/edit/:supplierId", element: <CreateSupplier /> },
  { path: "purchasing/suppliers/view/:supplierId", element: <SupplierView /> },
  { path: "purchasing/purchase-orders", element: <ManagePurchaseOrders /> },
  { path: "purchasing/purchase-orders/create", element: <CreatePurchaseOrder /> },
  { path: "purchasing/purchase-orders/view/:poId", element: <ViewPurchaseOrder /> },

  // Wastage
  { path: "wastage", element: <Wastage /> },
  { path: "wastage/view/:wastageId", element: <WastageView /> },
];
