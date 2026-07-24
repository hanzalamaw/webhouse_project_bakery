import {
  DashboardIcon,
  TenantsIcon,
  LogsIcon,
  SubscriptionIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    { id: "dashboard", labelKey: "nav.dashboard", path: `${MODULE_BASE}/dashboard`, icon: DashboardIcon },
    {
      id: "stores",
      labelKey: "nav.branches",
      icon: TenantsIcon,
      children: [
        { id: "create-store", labelKey: "nav.addBranch", path: `${MODULE_BASE}/stores/create` },
        { id: "manage-stores", labelKey: "nav.manageBranches", path: `${MODULE_BASE}/stores/manage` },
      ],
    },
    { id: "sales", labelKey: "nav.counterSales", path: `${MODULE_BASE}/sales`, icon: LogsIcon },
    { id: "registers", labelKey: "nav.cashDrawer", path: `${MODULE_BASE}/registers`, icon: SubscriptionIcon },
  ];
}
