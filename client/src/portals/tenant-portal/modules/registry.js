import AdminDashboard from "./admin/pages/Dashboard";
import { getNavItems as getAdminNav } from "./admin/navConfig";
import AdminUserManagement from "./admin/pages/UserManagement";
import AdminRolesAndPermissions from "./admin/pages/RolesAndPermissions";
import AdminAuditLogs from "./admin/pages/AuditLogs";
import AdminSessions from "./admin/pages/Sessions";
import AdminOrganizationSettings from "./admin/pages/OrganizationSettings";
import AdminPlanSubscription from "./admin/pages/PlanSubscription";
import AdminActivityAlerts from "./admin/pages/ActivityAlerts";
import AdminHelpCenter from "./admin/pages/HelpCenter";
import { ADMIN_ROUTES } from "./admin/routes.jsx";

import OrderManagementDashboard from "./order-management/pages/Dashboard";
import { getNavItems as getOrderManagementNav } from "./order-management/navConfig";
import { ORDER_MANAGEMENT_ROUTES } from "./order-management/routes.jsx";

import PosDashboard from "./pos/pages/Dashboard";
import { getNavItems as getPosNav } from "./pos/navConfig";
import { POS_ROUTES } from "./pos/routes.jsx";

import PosTerminalDashboard from "./pos-terminal/pages/Dashboard";
import { getNavItems as getPosTerminalNav } from "./pos-terminal/navConfig";
import { POS_TERMINAL_ROUTES } from "./pos-terminal/routes.jsx";

import CrmDashboard from "./crm/pages/Dashboard";
import { getNavItems as getCrmNav } from "./crm/navConfig";
import { CRM_ROUTES } from "./crm/routes.jsx";

import FinanceDashboard from "./finance/pages/Dashboard";
import { getNavItems as getFinanceNav } from "./finance/navConfig";
import { FINANCE_ROUTES } from "./finance/routes.jsx";

import InventoryDashboard from "./inventory-procurement/pages/Dashboard";
import { getNavItems as getInventoryNav } from "./inventory-procurement/navConfig";
import { INVENTORY_ROUTES } from "./inventory-procurement/routes.jsx";

import ProductionDashboard from "./production/pages/Dashboard";
import { getNavItems as getProductionNav } from "./production/navConfig";
import { PRODUCTION_ROUTES } from "./production/routes.jsx";

import { MODULE_SECTION_ROUTES } from "./shared/buildModuleNav";

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

/** Canonical tenant-facing modules. */
export const TENANT_MODULE_DEFINITIONS = [
  {
    slug: "admin",
    name: "Admin",
    displayNumber: 1,
    letter: "A",
    aliases: [],
    Dashboard: AdminDashboard,
    getNavItems: getAdminNav,
    routes: ADMIN_ROUTES,
    sections: [
      { path: "user-management", title: "User Management", Component: AdminUserManagement },
      { path: "roles-and-permissions", title: "Roles & Permissions", Component: AdminRolesAndPermissions },
      { path: "audit-logs", title: "Audit Logs", Component: AdminAuditLogs },
      { path: "sessions", title: "Sessions", Component: AdminSessions },
      { path: "organization-settings", title: "Organization Settings", Component: AdminOrganizationSettings },
      { path: "plan-subscription", title: "Plan & Subscription", Component: AdminPlanSubscription },
      { path: "activity-alerts", title: "Activity Alerts", Component: AdminActivityAlerts },
      { path: "help-center", title: "Help Center", Component: AdminHelpCenter },
    ],
  },
  {
    slug: "stock-purchasing",
    name: "Stock & Purchasing",
    displayNumber: 2,
    letter: "S",
    aliases: [
      "Inventory & Procurement",
      "inventory-procurement",
      "Inventory",
      "Stock",
      "Purchasing",
      "Store",
      "Khareedari",
    ],
    Dashboard: InventoryDashboard,
    getNavItems: getInventoryNav,
    routes: INVENTORY_ROUTES,
  },
  {
    slug: "production",
    name: "Production",
    displayNumber: 3,
    letter: "R",
    aliases: ["Recipes", "Baking"],
    Dashboard: ProductionDashboard,
    getNavItems: getProductionNav,
    routes: PRODUCTION_ROUTES,
  },
  {
    slug: "pos",
    name: "Point of Sale",
    displayNumber: 4,
    letter: "P",
    aliases: ["POS"],
    Dashboard: PosDashboard,
    getNavItems: getPosNav,
    routes: POS_ROUTES,
  },
  {
    slug: "pos-terminal",
    name: "POS Terminal",
    displayNumber: 5,
    letter: "T",
    aliases: [],
    fullScreen: true,
    Dashboard: PosTerminalDashboard,
    getNavItems: getPosTerminalNav,
    routes: POS_TERMINAL_ROUTES,
  },
  {
    slug: "order-management",
    name: "Order Management",
    displayNumber: 6,
    letter: "O",
    aliases: ["Orders"],
    Dashboard: OrderManagementDashboard,
    getNavItems: getOrderManagementNav,
    routes: ORDER_MANAGEMENT_ROUTES,
  },
  {
    slug: "crm",
    name: "CRM",
    displayNumber: 7,
    letter: "C",
    aliases: ["Customers"],
    Dashboard: CrmDashboard,
    getNavItems: getCrmNav,
    routes: CRM_ROUTES,
  },
  {
    slug: "finance",
    name: "Finance & Accounting",
    displayNumber: 8,
    letter: "F",
    aliases: [],
    Dashboard: FinanceDashboard,
    getNavItems: getFinanceNav,
    routes: FINANCE_ROUTES,
  },
];

export { MODULE_SECTION_ROUTES };

export function moduleBasePath(slug) {
  return `/app/m/${slug}`;
}

export function getModuleBySlug(slug) {
  return TENANT_MODULE_DEFINITIONS.find((m) => m.slug === slug) || null;
}

export function getDefinitionForModuleName(moduleName) {
  return TENANT_MODULE_DEFINITIONS.find((d) => moduleMatchesAssignment(d, moduleName)) || null;
}

export function sortModulesByDisplayOrder(modulesFromApi) {
  return [...(modulesFromApi || [])].sort((a, b) => {
    const da = getDefinitionForModuleName(a.module_name)?.displayNumber ?? 99;
    const db = getDefinitionForModuleName(b.module_name)?.displayNumber ?? 99;
    return da - db;
  });
}

export function formatModuleLabel(moduleRow) {
  const num = getDefinitionForModuleName(moduleRow?.module_name)?.displayNumber;
  const name = moduleRow?.module_name || "";
  return num ? `${num}. ${name}` : name;
}

export function moduleMatchesAssignment(definition, assignedModuleName) {
  const assigned = normalizeName(assignedModuleName);
  if (normalizeName(definition.name) === assigned) return true;
  if (normalizeName(definition.slug) === assigned) return true;
  return (definition.aliases || []).some((alias) => normalizeName(alias) === assigned);
}

/** Keep only hardcoded modules that the tenant has been assigned (by module name). */
export function filterAssignedModules(assignedFromApi) {
  const assigned = assignedFromApi || [];
  return TENANT_MODULE_DEFINITIONS.filter((def) =>
    assigned.some((row) => moduleMatchesAssignment(def, row.module_name))
  );
}

export function getTenantMenuItems(moduleSlug) {
  const mod = getModuleBySlug(moduleSlug);
  if (!mod) return [];
  return mod.getNavItems();
}
