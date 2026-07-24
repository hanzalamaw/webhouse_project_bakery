import {
  DashboardIcon,
  ProductIcon,
  ProcurementIcon,
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
      id: "recipes",
      label: "Recipes (Nuskhay)",
      icon: ProductIcon,
      children: [
        { id: "create-recipe", label: "Create Recipe", path: `${MODULE_BASE}/recipes/create` },
        { id: "manage-recipes", label: "Manage Recipes", path: `${MODULE_BASE}/recipes/manage` },
      ],
    },
    {
      id: "baking",
      label: "Baking (Pakana)",
      icon: ProcurementIcon,
      children: [
        { id: "create-run", label: "New Bake / Production Run", path: `${MODULE_BASE}/runs/create` },
        { id: "manage-runs", label: "Manage Runs", path: `${MODULE_BASE}/runs/manage` },
      ],
    },
  ];
}
