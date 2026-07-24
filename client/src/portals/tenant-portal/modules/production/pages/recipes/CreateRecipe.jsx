import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { MODULE_BASE, RECIPE_STATUSES, DEFAULT_UNITS } from "../../constants";
import { useProductionReference } from "../../hooks/useProductionReference";

function emptyIngredient() {
  return { ingredient_item_id: "", quantity: "", unit: "g", notes: "" };
}

const EMPTY = {
  recipe_name: "",
  item_id: "",
  yield_qty: "1",
  yield_unit: "piece",
  instructions: "",
  prep_time_mins: "",
  status: "active",
  ingredients: [emptyIngredient()],
};

export default function CreateRecipe() {
  const { recipeId } = useParams();
  const isEdit = Boolean(recipeId);
  const { authFetch } = useAuth();
  const { canCreate, canEdit, readOnly } = useModulePermission("production");
  const { finished_items, ingredients, units, statuses } = useProductionReference();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const disabled = readOnly || (isEdit ? !canEdit : !canCreate);
  const backPath = `${MODULE_BASE}/recipes/manage`;
  const unitList = units?.length ? units : DEFAULT_UNITS;
  const statusList = statuses?.length ? statuses : RECIPE_STATUSES;

  const finishedOptions = useMemo(
    () =>
      finished_items.map((i) => ({
        value: String(i.id),
        label: i.sku ? `${i.item_name} (${i.sku})` : i.item_name,
      })),
    [finished_items]
  );

  const ingredientOptions = useMemo(
    () =>
      ingredients.map((i) => ({
        value: String(i.id),
        label: i.sku ? `${i.item_name} (${i.sku})` : i.item_name,
      })),
    [ingredients]
  );

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    apiFetch(`/production/recipes/${recipeId}`, {}, authFetch)
      .then((row) => {
        setForm({
          recipe_name: row.recipe_name || "",
          item_id: row.item_id ? String(row.item_id) : "",
          yield_qty: row.yield_qty != null ? String(row.yield_qty) : "1",
          yield_unit: row.yield_unit || "piece",
          instructions: row.instructions || "",
          prep_time_mins: row.prep_time_mins != null ? String(row.prep_time_mins) : "",
          status: row.status || "active",
          ingredients:
            Array.isArray(row.ingredients) && row.ingredients.length
              ? row.ingredients.map((ing) => ({
                  ingredient_item_id: ing.ingredient_item_id ? String(ing.ingredient_item_id) : "",
                  quantity: ing.quantity != null ? String(ing.quantity) : "",
                  unit: ing.unit || "g",
                  notes: ing.notes || "",
                }))
              : [emptyIngredient()],
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, recipeId, authFetch]);

  const setIngredient = (index, field, value) => {
    setForm((f) => {
      const next = [...f.ingredients];
      next[index] = { ...next[index], [field]: value };
      if (field === "ingredient_item_id") {
        const item = ingredients.find((i) => String(i.id) === String(value));
        if (item?.unit) next[index].unit = item.unit;
      }
      return { ...f, ingredients: next };
    });
  };

  const addIngredient = () => {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, emptyIngredient()] }));
  };

  const removeIngredient = (index) => {
    setForm((f) => {
      if (f.ingredients.length <= 1) return f;
      return { ...f, ingredients: f.ingredients.filter((_, i) => i !== index) };
    });
  };

  const onFinishedChange = (value) => {
    setForm((f) => {
      const item = finished_items.find((i) => String(i.id) === String(value));
      return {
        ...f,
        item_id: value,
        yield_unit: item?.unit || f.yield_unit || "piece",
      };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!form.recipe_name.trim()) {
      setError("Recipe name is required");
      return;
    }
    if (!form.item_id) {
      setError("Select the finished bakery item");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        recipe_name: form.recipe_name.trim(),
        item_id: Number(form.item_id),
        yield_qty: Number(form.yield_qty),
        yield_unit: form.yield_unit,
        instructions: form.instructions || null,
        prep_time_mins: form.prep_time_mins ? Number(form.prep_time_mins) : null,
        status: form.status,
        ingredients: form.ingredients.map((ing) => ({
          ingredient_item_id: Number(ing.ingredient_item_id),
          quantity: Number(ing.quantity),
          unit: ing.unit || "g",
          notes: ing.notes || null,
        })),
      };
      if (isEdit) {
        await apiFetch(`/production/recipes/${recipeId}`, { method: "PUT", body: JSON.stringify(body) }, authFetch);
      } else {
        await apiFetch("/production/recipes", { method: "POST", body: JSON.stringify(body) }, authFetch);
      }
      navigate(backPath);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <p className="wh-muted">Loading…</p>
        </FormPageLayout>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={isEdit ? "Edit Recipe" : "Create Recipe"}
          description={
            isEdit
              ? "Update the recipe and its ingredients (kacha maal)."
              : "Add a nuskha for a finished bakery item."
          }
          actions={
            <Button variant="secondary" onClick={() => navigate(backPath)}>
              Back to recipes
            </Button>
          }
        />
        <form onSubmit={submit} className="wh-form-stack">
          <FormBlock title="Recipe details" description="Name, finished item, yield, and status.">
            <div className="wh-form-grid">
              <FormField
                id="recipe_name"
                label="Recipe name"
                value={form.recipe_name}
                onChange={(e) => setForm((f) => ({ ...f, recipe_name: e.target.value }))}
                required
                disabled={disabled}
              />
              <SearchableSelect
                id="item_id"
                label="Finished bakery item"
                value={form.item_id}
                onChange={onFinishedChange}
                options={finishedOptions}
                placeholder="Search finished items…"
                emptyMessage="No finished items found"
                disabled={disabled}
                required
              />
              <FormField
                id="yield_qty"
                label="Yield quantity"
                type="number"
                min="0"
                step="any"
                value={form.yield_qty}
                onChange={(e) => setForm((f) => ({ ...f, yield_qty: e.target.value }))}
                required
                disabled={disabled}
              />
              <FormField
                id="yield_unit"
                label="Yield unit"
                as="select"
                value={form.yield_unit}
                onChange={(e) => setForm((f) => ({ ...f, yield_unit: e.target.value }))}
                disabled={disabled}
              >
                {unitList.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </FormField>
              <FormField
                id="prep_time_mins"
                label="Prep time (mins)"
                type="number"
                min="0"
                value={form.prep_time_mins}
                onChange={(e) => setForm((f) => ({ ...f, prep_time_mins: e.target.value }))}
                disabled={disabled}
              />
              <FormField
                id="status"
                label="Status"
                as="select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                disabled={disabled}
              >
                {statusList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </FormField>
              <div className="wh-form-grid__full">
                <FormField
                  id="instructions"
                  label="Instructions"
                  as="textarea"
                  rows={4}
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  disabled={disabled}
                />
              </div>
            </div>
          </FormBlock>

          <FormBlock
            title="Ingredients (Kacha Maal)"
            description="What goes into one yield batch of this recipe."
          >
            {!disabled && (
              <div style={{ marginBottom: 12 }}>
                <Button type="button" variant="secondary" onClick={addIngredient}>
                  Add ingredient
                </Button>
              </div>
            )}
            <div className="wh-form-stack">
              {form.ingredients.map((ing, index) => (
                <div key={index} className="wh-form-grid" style={{ alignItems: "end" }}>
                  <SearchableSelect
                    id={`ingredient_${index}`}
                    label={`Ingredient ${index + 1}`}
                    value={ing.ingredient_item_id}
                    onChange={(v) => setIngredient(index, "ingredient_item_id", v)}
                    options={ingredientOptions}
                    placeholder="Search ingredients…"
                    emptyMessage="No ingredients found"
                    disabled={disabled}
                    required
                  />
                  <FormField
                    id={`qty_${index}`}
                    label="Quantity"
                    type="number"
                    min="0"
                    step="any"
                    value={ing.quantity}
                    onChange={(e) => setIngredient(index, "quantity", e.target.value)}
                    required
                    disabled={disabled}
                  />
                  <FormField
                    id={`unit_${index}`}
                    label="Unit"
                    as="select"
                    value={ing.unit}
                    onChange={(e) => setIngredient(index, "unit", e.target.value)}
                    disabled={disabled}
                  >
                    {unitList.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </FormField>
                  <FormField
                    id={`notes_${index}`}
                    label="Notes"
                    value={ing.notes}
                    onChange={(e) => setIngredient(index, "notes", e.target.value)}
                    disabled={disabled}
                  />
                  {!disabled && form.ingredients.length > 1 && (
                    <div>
                      <Button type="button" variant="danger" className="wh-btn--sm" onClick={() => removeIngredient(index)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FormBlock>

          {error && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={() => navigate(backPath)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || disabled}>
              {saving ? "Saving…" : isEdit ? "Save Recipe" : "Create Recipe"}
            </Button>
          </FormActions>
        </form>
      </FormPageLayout>
    </div>
  );
}
