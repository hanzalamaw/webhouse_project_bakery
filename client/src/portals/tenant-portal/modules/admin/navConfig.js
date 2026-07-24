import {
  DashboardIcon,
  TenantsIcon,
  ImpersonateIcon,
  LogsIcon,
  SubscriptionIcon,
  SupportIcon,
} from "../../../../components/icons";

const base = "/app/m/admin";

/** Flat menu aligned with Admin module spec. Labels are i18n keys. */
export function getNavItems() {
  return [
    { id: "dashboard", labelKey: "nav.dashboard", path: `${base}/dashboard`, icon: DashboardIcon },
    { id: "user-management", labelKey: "nav.userManagement", path: `${base}/user-management`, icon: TenantsIcon },
    {
      id: "roles-and-permissions",
      labelKey: "nav.rolesPermissions",
      path: `${base}/roles-and-permissions`,
      icon: ImpersonateIcon,
    },
    { id: "audit-logs", labelKey: "nav.auditLogs", path: `${base}/audit-logs`, icon: LogsIcon },
    { id: "sessions", labelKey: "nav.sessions", path: `${base}/sessions`, icon: ImpersonateIcon },
    {
      id: "organization-settings",
      labelKey: "nav.organizationSettings",
      path: `${base}/organization-settings`,
      icon: TenantsIcon,
    },
    {
      id: "plan-subscription",
      labelKey: "nav.planSubscription",
      path: `${base}/plan-subscription`,
      icon: SubscriptionIcon,
    },
    { id: "activity-alerts", labelKey: "nav.activityAlerts", path: `${base}/activity-alerts`, icon: SupportIcon },
  ];
}
