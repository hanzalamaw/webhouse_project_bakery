import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Button } from "../../../../../../components/Button";
import { StatusBadge } from "../../../../../../components/Badge";
import { DetailGrid, DetailValue, RecordViewSummary } from "../../../../../../components/RecordView";
import { ViewKpi, ViewPanel, formatCount } from "../../../../../../components/EntityViewLayout";
import { ProductIcon, LogsIcon, ProcurementIcon } from "../../../../../../components/icons";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { formatPKR } from "../../../../../../utils/currency";
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
    return <div className="wh-page wh-page--wide"><p className="wh-muted">Loading…</p></div>;
  }

  if (!recipe) {
    return (
      <div className="wh-page wh-page--wide">
        <div className="wh-alert wh-alert--error">{error || "Recipe not found"}</div>
        <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/manage`)}>Back</Button>
      </div>
    );
  }

  const ingredients = recipe.ingredients || [];
  const prepLabel =
    recipe.prep_time_mins == null
      ? "—"
      : recipe.prep_time_mins >= 60 && recipe.prep_time_mins % 60 === 0
        ? `${recipe.prep_time_mins / 60} hr`
        : `${recipe.prep_time_mins} mins`;

  const yieldLabel = `${formatCount(recipe.yield_qty)} ${recipe.yield_unit || ""}`.trim();

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Recipe details"
        description="Yield, ingredients, cost, and baking history."
        actions={
          <div className="wh-action-btns">
            <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/manage`)}>Back</Button>
            {canEdit && (
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/recipes/edit/${recipeId}`)}>
                Edit recipe
              </Button>
            )}
            <Button onClick={() => navigate(`${MODULE_BASE}/runs/create?recipe_id=${recipe.id}`)}>
              Bake now
            </Button>
          </div>
        }
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <RecordViewSummary
        title={recipe.recipe_name}
        subtitle={recipe.finished_item_name || "Finished item"}
        status={recipe.status}
        chips={[
          { label: "Yield", value: yieldLabel || "—" },
          { label: "Prep", value: prepLabel },
        ]}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Yield / batch"
            value={yieldLabel || "—"}
            hint="Finished output per bake"
            tone="success"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Ingredients"
            value={formatCount(ingredients.length)}
            hint="Lines in this recipe"
            tone="accent"
            icon={<ProcurementIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Est. batch cost"
            value={formatPKR(recipe.estimated_batch_cost)}
            hint="From ingredient costs"
          />
        </div>
        <div className="wh-dash-col-3">
          <ViewKpi
            label="Times baked"
            value={formatCount(recipe.bake_count)}
            hint={`${formatCount(recipe.total_produced)} units made`}
            icon={<LogsIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <ViewPanel title="Ingredients" subtitle="Quantities and cost per yield batch" flush>
            {ingredients.length ? (
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Quantity</th>
                    <th>Unit cost</th>
                    <th>Line cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((row) => {
                    const lineCost = (Number(row.quantity) || 0) * (Number(row.cost_price) || 0);
                    return (
                      <tr key={row.id || row.ingredient_item_id || row.ingredient_name}>
                        <td>{row.ingredient_name}</td>
                        <td>{`${formatCount(row.quantity)} ${row.unit || row.ingredient_unit || ""}`.trim()}</td>
                        <td>{formatPKR(row.cost_price)}</td>
                        <td>{formatPKR(lineCost)}</td>
                        <td className="wh-muted">{row.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="wh-panel__empty">No ingredients on this recipe.</p>
            )}
          </ViewPanel>
        </div>
        <div className="wh-dash-col-4">
          <ViewPanel title="Baking history">
            <DetailGrid columns={1}>
              <DetailValue label="Completed bakes" highlight>{formatCount(recipe.bake_count)}</DetailValue>
              <DetailValue label="Total produced">
                {`${formatCount(recipe.total_produced)} ${recipe.finished_unit || recipe.yield_unit || ""}`.trim()}
              </DetailValue>
              <DetailValue label="Total bake cost">{formatPKR(recipe.total_bake_cost)}</DetailValue>
              <DetailValue label="Est. cost / batch">{formatPKR(recipe.estimated_batch_cost)}</DetailValue>
              <DetailValue label="Prep time">{prepLabel}</DetailValue>
              <DetailValue label="Shelf life">
                {recipe.shelf_life_days != null
                  ? `${recipe.shelf_life_days} ${recipe.shelf_life_unit || "days"}`
                  : "—"}
              </DetailValue>
            </DetailGrid>
          </ViewPanel>
        </div>
      </div>

      {recipe.instructions && (
        <ViewPanel title="Instructions" subtitle="How to prepare this batch">
          <p className="wh-muted" style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
            {recipe.instructions}
          </p>
        </ViewPanel>
      )}

      <ViewPanel title="Recipe metadata">
        <DetailGrid columns={3}>
          <DetailValue label="Finished item">{recipe.finished_item_name || "—"}</DetailValue>
          <DetailValue label="Yield">{yieldLabel || "—"}</DetailValue>
          <DetailValue label="Status"><StatusBadge status={recipe.status} /></DetailValue>
          <DetailValue label="Created">{formatDateTime(recipe.created_at)}</DetailValue>
          <DetailValue label="Updated">{formatDateTime(recipe.updated_at)}</DetailValue>
        </DetailGrid>
      </ViewPanel>
    </div>
  );
}
