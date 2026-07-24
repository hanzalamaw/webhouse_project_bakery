import {
  DashboardIcon,
  TenantsIcon,
  LogsIcon,
  SubscriptionIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

export function getNavItems() {
  return [
    { id: "dashboard", label: "Dashboard", path: `${MODULE_BASE}/dashboard`, icon: DashboardIcon },
    {
      id: "stores",
      label: "Branches (Shakhein)",
      icon: TenantsIcon,
      children: [
        { id: "create-store", label: "Add Branch", path: `${MODULE_BASE}/stores/create` },
        { id: "manage-stores", label: "Manage Branches", path: `${MODULE_BASE}/stores/manage` },
      ],
    },
    { id: "sales", label: "Counter Sales", path: `${MODULE_BASE}/sales`, icon: LogsIcon },
    { id: "registers", label: "Cash Drawer", path: `${MODULE_BASE}/registers`, icon: SubscriptionIcon },
  ];
}
