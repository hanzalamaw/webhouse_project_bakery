import { DashboardIcon, ProductIcon } from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    { id: "checkout", labelKey: "nav.checkout", path: `${MODULE_BASE}/checkout`, icon: ProductIcon },
    { id: "pos-admin", labelKey: "nav.posSettings", path: "/app/m/pos/dashboard", icon: DashboardIcon },
  ];
}
