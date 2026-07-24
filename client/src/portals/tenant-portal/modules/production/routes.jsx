import CreateRecipe from "./pages/recipes/CreateRecipe";
import ManageRecipes from "./pages/recipes/ManageRecipes";
import RecipeView from "./pages/recipes/RecipeView";
import CreateRun from "./pages/runs/CreateRun";
import ManageRuns from "./pages/runs/ManageRuns";
import RunView from "./pages/runs/RunView";

export const PRODUCTION_ROUTES = [
  { path: "recipes/create", element: <CreateRecipe /> },
  { path: "recipes/edit/:recipeId", element: <CreateRecipe /> },
  { path: "recipes/view/:recipeId", element: <RecipeView /> },
  { path: "recipes/manage", element: <ManageRecipes /> },
  { path: "runs/create", element: <CreateRun /> },
  { path: "runs/view/:runId", element: <RunView /> },
  { path: "runs/manage", element: <ManageRuns /> },
];
