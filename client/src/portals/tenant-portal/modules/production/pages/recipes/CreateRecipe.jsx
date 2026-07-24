import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { MODULE_BASE, RECIPE_STATUSES, DEFAULT_UNITS } from "../../constants";
import { useProductionReference } from "../../hooks/useProductionReference";

const EMPTY = {
  recipe_name: "",
  item_id: "",
  yield_qty: "1",
  yield_unit: "piece",
  instructions: "",
  prep_time_mins: "",
  status: "active",
  ingredients: [],
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

  const selectedIngredientIds = useMemo(
    () => form.ingredients.map((ing) => String(ing.ingredient_item_id)).filter(Boolean),
    [form.ingredients]
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
                  item_name: ing.item_name || ing.ingredient_name || "",
                  quantity: ing.quantity != null ? String(ing.quantity) : "",
                  unit: ing.unit || "g",
                  notes: ing.notes || "",
                }))
              : [],
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isEdit, recipeId, authFetch]);

  const onFinishedSelect = (product) => {
    if (disabled) return;
    const id = String(product.id);
    setForm((f) => ({
      ...f,
      item_id: id,
      yield_unit: product?.unit || f.yield_unit || "piece",
    }));
  };

  const toggleIngredient = (_id, product) => {
    if (disabled) return;
    const id = String(_id || product?.id || "");
    if (!id) return;
    setForm((f) => {
      const existing = f.ingredients.find((ing) => String(ing.ingredient_item_id) === id);
      if (existing) {
        return { ...f, ingredients: f.ingredients.filter((ing) => String(ing.ingredient_item_id) !== id) };
      }
      const item = product || ingredients.find((i) => String(i.id) === id);
      return {
        ...f,
        ingredients: [
          ...f.ingredients,
          {
            ingredient_item_id: id,
            item_name: item?.item_name || "",
            quantity: "1",
            unit: item?.unit || "g",
            notes: "",
          },
        ],
      };
    });
  };

  const setIngredient = (index, field, value) => {
    setForm((f) => {
      const next = [...f.ingredients];
      next[index] = { ...next[index], [field]: value };
      return { ...f, ingredients: next };
    });
  };

  const removeIngredient = (index) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
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
    const validIngredients = form.ingredients.filter(
      (ing) => ing.ingredient_item_id && Number(ing.quantity) > 0
    );
    if (!validIngredients.length) {
      setError("Tap ingredients below and set quantity for each");
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
        ingredients: validIngredients.map((ing) => ({
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
          <FormBlock title="Recipe details" description="Name, yield, and status.">
            <div className="wh-form-grid">
              <FormField
                id="recipe_name"
                label="Recipe name"
                value={form.recipe_name}
                onChange={(e) => setForm((f) => ({ ...f, recipe_name: e.target.value }))}
                required
                disabled={disabled}
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

          <FormBlock title="Finished bakery item" description="Tap the product this recipe produces.">
            <ProductCatalogPicker
              items={finished_items}
              title="Finished products"
              mode="single"
              value={form.item_id}
              onSelect={onFinishedSelect}
              showPrice
              showStock={false}
              priceField="selling_price"
              maxHeight={240}
              disabled={disabled}
              emptyMessage="No finished bakery items yet."
            />
          </FormBlock>

          <FormBlock title="Ingredients (Kacha Maal)" description="Tap ingredients to add them to this recipe.">
            <ProductCatalogPicker
              items={ingredients}
              title="Ingredients"
              mode="multi"
              selectedIds={selectedIngredientIds}
              onToggle={toggleIngredient}
              showPrice={false}
              showStock={false}
              maxHeight={240}
              disabled={disabled}
              emptyMessage="No ingredients found. Add purchasable items under Stock."
            />
          </FormBlock>

          {form.ingredients.length > 0 && (
            <FormBlock title="Ingredient quantities" description="Set how much of each ingredient goes into one yield batch.">
              <div className="wh-inv-line-items">
                {form.ingredients.map((ing, index) => (
                  <div key={ing.ingredient_item_id || index} className="wh-inv-line-item">
                    <div className="wh-inv-line-item__head">
                      <strong>{ing.item_name || `Ingredient ${index + 1}`}</strong>
                      {!disabled && (
                        <Button type="button" variant="secondary" className="wh-btn--sm" onClick={() => removeIngredient(index)}>
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="wh-form-grid">
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
                    </div>
                  </div>
                ))}
              </div>
            </FormBlock>
          )}

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
