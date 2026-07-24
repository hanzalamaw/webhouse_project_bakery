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
      labelKey: "nav.dashboard",
      path: `${MODULE_BASE}/dashboard`,
      icon: DashboardIcon,
    },
    {
      id: "recipes",
      labelKey: "nav.recipes",
      icon: ProductIcon,
      children: [
        { id: "create-recipe", labelKey: "nav.createRecipe", path: `${MODULE_BASE}/recipes/create` },
        { id: "manage-recipes", labelKey: "nav.manageRecipes", path: `${MODULE_BASE}/recipes/manage` },
      ],
    },
    {
      id: "baking",
      labelKey: "nav.baking",
      icon: ProcurementIcon,
      children: [
        { id: "create-run", labelKey: "nav.newBake", path: `${MODULE_BASE}/runs/create` },
        { id: "manage-runs", labelKey: "nav.manageRuns", path: `${MODULE_BASE}/runs/manage` },
      ],
    },
  ];
}
