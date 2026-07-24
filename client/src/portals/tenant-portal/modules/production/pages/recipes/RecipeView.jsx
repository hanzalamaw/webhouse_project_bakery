import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { RecordViewSummary, DetailGrid, DetailValue } from "../../../../../../components/RecordView";
import { DataTable } from "../../../../../../components/DataTable";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { MODULE_BASE } from "../../constants";

export default function RecipeView() {
  const { recipeId } = useParams();
  const { authFetch } = useAuth();
  const { canEdit } = useModulePermission("production");
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecipe(await apiFetch(`/production/recipes/${recipeId}`, {}, authFetch));
    } catch (e) {
      setRecipe(null);
      setError(e.message || "Recipe not found");
    } finally {
      setLoading(false);
    }
  }, [authFetch, recipeId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (loading) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <p className="wh-muted">Loading…</p>
        </FormPageLayout>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <div className="wh-alert wh-alert--error">{error || "Recipe not found"}</div>
          <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/manage`)}>
            Back to recipes
          </Button>
        </FormPageLayout>
      </div>
    );
  }

  const ingredientColumns = [
    { key: "ingredient_name", label: "Ingredient (Kacha Maal)" },
    {
      key: "quantity",
      label: "Quantity",
      format: (v, row) => `${Number(v || 0).toLocaleString()} ${row.unit || ""}`.trim(),
    },
    { key: "notes", label: "Notes", format: (v) => v || "—" },
  ];

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title="Recipe details"
          description="Read-only view of this nuskha."
          actions={
            <div className="wh-action-btns">
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/manage`)}>
                All recipes
              </Button>
              {canEdit && (
                <Button onClick={() => navigate(`${MODULE_BASE}/recipes/edit/${recipeId}`)}>
                  Edit recipe
                </Button>
              )}
            </div>
          }
        />

        <div className="wh-form-stack">
          <RecordViewSummary
            title={recipe.recipe_name}
            subtitle={recipe.finished_item_name || "Finished item"}
            status={recipe.status}
            chips={[
              {
                label: "Yield",
                value: `${Number(recipe.yield_qty || 0).toLocaleString()} ${recipe.yield_unit || ""}`.trim(),
              },
              {
                label: "Prep",
                value: recipe.prep_time_mins != null ? `${recipe.prep_time_mins} mins` : "—",
              },
              { label: "Created", value: formatDateTime(recipe.created_at) },
            ]}
          />

          <FormBlock title="Recipe" description="Finished item and baking details.">
            <DetailGrid>
              <DetailValue label="Recipe name" highlight>
                {recipe.recipe_name}
              </DetailValue>
              <DetailValue label="Finished bakery item">{recipe.finished_item_name}</DetailValue>
              <DetailValue label="Yield">
                {Number(recipe.yield_qty || 0).toLocaleString()} {recipe.yield_unit || ""}
              </DetailValue>
              <DetailValue label="Prep time">
                {recipe.prep_time_mins != null ? `${recipe.prep_time_mins} mins` : "—"}
              </DetailValue>
              <DetailValue label="Status">
                <StatusBadge status={recipe.status} />
              </DetailValue>
              <DetailValue label="Last updated">{formatDateTime(recipe.updated_at)}</DetailValue>
              <DetailValue label="Instructions" fullWidth multiline>
                {recipe.instructions}
              </DetailValue>
            </DetailGrid>
          </FormBlock>

          <FormBlock title="Ingredients (Kacha Maal)" description="What this recipe consumes per yield batch.">
            {recipe.ingredients?.length ? (
              <DataTable columns={ingredientColumns} rows={recipe.ingredients} pageSize={100} />
            ) : (
              <p className="wh-muted">No ingredients on this recipe.</p>
            )}
          </FormBlock>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/manage`)}>
              Back to recipes
            </Button>
            {canEdit && (
              <Button type="button" onClick={() => navigate(`${MODULE_BASE}/recipes/edit/${recipeId}`)}>
                Edit recipe
              </Button>
            )}
            <Button type="button" onClick={() => navigate(`${MODULE_BASE}/runs/create?recipe_id=${recipe.id}`)}>
              Bake Now
            </Button>
          </FormActions>
        </div>
      </FormPageLayout>
    </div>
  );
}
