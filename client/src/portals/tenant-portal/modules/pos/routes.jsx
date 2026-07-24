import { Navigate, useParams } from "react-router-dom";
import CreateStore from "./pages/stores/CreateStore";
import ManageStores from "./pages/stores/ManageStores";
import EditStore from "./pages/stores/EditStore";
import StoreView from "./pages/stores/StoreView";
import ManageSales from "./pages/sales/ManageSales";
import ManageRegisters from "./pages/registers/ManageRegisters";
import TerminalLogsView from "./pages/registers/TerminalLogsView";
import { MODULE_BASE } from "./constants";

function RedirectOutletEdit() {
  const { outletId } = useParams();
  return <Navigate to={`${MODULE_BASE}/stores/edit/${outletId}`} replace />;
}

/** Stock/items/procurement now live under Stock & Purchasing — keep redirects for old bookmarks. */
const stockBase = "/app/m/stock-purchasing";

export const POS_ROUTES = [
  { path: "stores/manage", element: <ManageStores /> },
  { path: "stores/create", element: <CreateStore /> },
  { path: "stores/edit/:storeId", element: <EditStore /> },
  { path: "stores/:storeId", element: <StoreView /> },
  { path: "products/create", element: <Navigate to={`${stockBase}/items/create`} replace /> },
  { path: "products/edit/:productId", element: <Navigate to={`${stockBase}/items/manage`} replace /> },
  { path: "products/manage", element: <Navigate to={`${stockBase}/items/manage`} replace /> },
  { path: "products/categories", element: <Navigate to={`${stockBase}/items/categories`} replace /> },
  { path: "products/import-export", element: <Navigate to={`${stockBase}/items/import-export`} replace /> },
  { path: "procurement/stock-in", element: <Navigate to={`${stockBase}/stock/stock-in`} replace /> },
  { path: "procurement/stock-in/create", element: <Navigate to={`${stockBase}/stock/stock-in/create`} replace /> },
  { path: "procurement/stock-out", element: <Navigate to={`${stockBase}/stock/stock-out`} replace /> },
  { path: "procurement/stock-out/create", element: <Navigate to={`${stockBase}/stock/stock-out/create`} replace /> },
  { path: "procurement/transfers", element: <Navigate to={`${stockBase}/stock/transfers`} replace /> },
  { path: "procurement/transfers/create", element: <Navigate to={`${stockBase}/stock/transfers/create`} replace /> },
  { path: "procurement/movement-history", element: <Navigate to={`${stockBase}/stock/movement-history`} replace /> },
  { path: "registers/terminal/:terminalId", element: <TerminalLogsView /> },
  { path: "outlets", element: <Navigate to={`${MODULE_BASE}/stores/manage`} replace /> },
  { path: "outlets/create", element: <Navigate to={`${MODULE_BASE}/stores/create`} replace /> },
  { path: "outlets/edit/:outletId", element: <RedirectOutletEdit /> },
  { path: "terminals", element: <Navigate to={`${MODULE_BASE}/stores/manage`} replace /> },
  { path: "terminals/create", element: <Navigate to={`${MODULE_BASE}/stores/create`} replace /> },
  { path: "sales", element: <ManageSales /> },
  { path: "registers", element: <ManageRegisters /> },
];
