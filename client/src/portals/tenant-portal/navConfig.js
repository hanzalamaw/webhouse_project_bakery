import { LogoutIcon, MoonIcon, ChevronIcon, ModuleIcon, HelpIcon } from "../../components/icons";

export { getTenantMenuItems, moduleBasePath } from "./modules/registry";

export const TENANT_FOOTER_ITEMS = {
  allModules: { labelKey: "chrome.allModules", path: "/app", icon: ModuleIcon },
  logout: { labelKey: "common.logout", icon: LogoutIcon },
  nightMode: { labelKey: "chrome.nightMode", icon: MoonIcon },
  helpCenter: { labelKey: "chrome.helpCenter", path: "/app/m/admin/help-center", icon: HelpIcon },
};

export { ChevronIcon };
