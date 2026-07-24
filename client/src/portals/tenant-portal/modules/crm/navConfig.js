import {
  DashboardIcon,
  TenantsIcon,
  SupportIcon,
  LogsIcon,
} from "../../../../components/icons";
import { MODULE_BASE } from "./constants";

/** Flat menu aligned with Admin module layout. */
export function getNavItems() {
  return [
    { id: "dashboard", labelKey: "nav.dashboard", path: `${MODULE_BASE}/dashboard`, icon: DashboardIcon },
    { id: "customers", labelKey: "nav.customers", path: `${MODULE_BASE}/customers/manage`, icon: TenantsIcon },
    {
      id: "import-export",
      labelKey: "nav.importExportSlash",
      path: `${MODULE_BASE}/import-export`,
      icon: LogsIcon,
    },
    {
      id: "complaints",
      labelKey: "nav.complaintsSupport",
      path: `${MODULE_BASE}/complaints/manage`,
      icon: SupportIcon,
    },
  ];
}
