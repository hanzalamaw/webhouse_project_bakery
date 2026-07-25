import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { ProductSelectField } from "../../../../../../components/ProductSelectField";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormActions } from "../../../../../../components/FormPageLayout";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import {
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  buildCreateItemReturnUrl,
  currentReturnPath,
} from "../../../../../../utils/formDraft";
import { MODULE_BASE, RECIPE_STATUSES } from "../../constants";
import { useProductionReference } from "../../hooks/useProductionReference";

const EMPTY = {
  recipe_name: "",
  item_id: "",
  yield_qty: "1",
  yield_unit: "piece",
  instructions: "",
  prep_time_value: "",
  prep_time_unit: "mins",
  status: "active",
  ingredients: [],
};

const PREP_TIME_UNITS = [
  { value: "mins", label: "Minutes" },
  { value: "hours", label: "Hours" },
];

function splitPrepTime(totalMins) {
  if (totalMins == null || totalMins === "" || Number.isNaN(Number(totalMins))) {
    return { prep_time_value: "", prep_time_unit: "mins" };
  }
  const mins = Number(totalMins);
  if (mins > 0 && mins % 60 === 0) {
    return { prep_time_value: String(mins / 60), prep_time_unit: "hours" };
  }
  return { prep_time_value: String(mins), prep_time_unit: "mins" };
}

function toPrepTimeMins(value, unit) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return unit === "hours" ? Math.round(n * 60) : Math.round(n);
}

function normalizeRecipeForm(raw) {
  if (!raw || typeof raw !== "object") return EMPTY;
  if (raw.prep_time_value != null || raw.prep_time_unit) {
    return {
      ...EMPTY,
      ...raw,
      prep_time_value: raw.prep_time_value != null ? String(raw.prep_time_value) : "",
      prep_time_unit: raw.prep_time_unit === "hours" ? "hours" : "mins",
    };
  }
  // Older drafts stored prep_time_mins only
  const rest = { ...raw };
  delete rest.prep_time_mins;
  return { ...EMPTY, ...rest, ...splitPrepTime(raw.prep_time_mins) };
}

function draftKeyFor(recipeId) {
  return recipeId ? `wh_prod_recipe_draft_${recipeId}` : "wh_prod_recipe_draft";
}

function shouldResumeFromUrl() {
  const sp = new URLSearchParams(window.location.search);
  return sp.get("resumed") === "1" || Boolean(sp.get("createdItemId"));
}

function peekRecipeDraft(recipeId) {
  if (!shouldResumeFromUrl()) return null;
  return loadFormDraft(draftKeyFor(recipeId));
}

export default function CreateRecipe() {
  const { recipeId } = useParams();
  const isEdit = Boolean(recipeId);
  const { authFetch } = useAuth();
  const { canCreate, canEdit, readOnly } = useModulePermission("production");
  const { finished_items, ingredients, statuses, reload: reloadRef } = useProductionReference();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftKey = draftKeyFor(recipeId);
  const [initialDraft] = useState(() => peekRecipeDraft(recipeId));
  const createdAppliedRef = useRef(false);

  const [form, setForm] = useState(() => normalizeRecipeForm(initialDraft?.form));
  const [baseline, setBaseline] = useState(() => {
    if (initialDraft?.form) {
      const normalized = normalizeRecipeForm(initialDraft.form);
      if (initialDraft.baseline) {
        try {
          return JSON.stringify(normalizeRecipeForm(JSON.parse(initialDraft.baseline)));
        } catch {
          return JSON.stringify(normalized);
        }
      }
      return isEdit ? JSON.stringify(normalized) : JSON.stringify(EMPTY);
    }
    return isEdit ? null : JSON.stringify(EMPTY);
  });
  const [loading, setLoading] = useState(() => isEdit && !initialDraft?.form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const disabled = readOnly || (isEdit ? !canEdit : !canCreate);
  const backPath = `${MODULE_BASE}/recipes/manage`;
  const statusList = statuses?.length ? statuses : RECIPE_STATUSES;
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline, enabled: !loading });

  const selectedIngredientIds = useMemo(
    () => form.ingredients.map((ing) => String(ing.ingredient_item_id)).filter(Boolean),
    [form.ingredients]
  );

  useEffect(() => {
    // Drop draft after it has been applied into state (or clear stale when not resuming)
    clearFormDraft(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!isEdit || initialDraft?.form) return undefined;
    let active = true;
    apiFetch(`/production/recipes/${recipeId}`, {}, authFetch)
      .then((row) => {
        if (!active) return;
        const loaded = {
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
        };
        const next = normalizeRecipeForm(loaded);
        setForm(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setBaseline(JSON.stringify(EMPTY));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isEdit, recipeId, authFetch, initialDraft]);

  useEffect(() => {
    const createdId = searchParams.get("createdItemId");
    const selectFor = searchParams.get("selectFor");
    if (!createdId || loading || createdAppliedRef.current) return;

    const apply = async () => {
      createdAppliedRef.current = true;
      let itemMeta = null;
      try {
        itemMeta = await apiFetch(`/inventory/items/${createdId}`, {}, authFetch);
      } catch {
        itemMeta = null;
      }
      await reloadRef().catch(() => {});

      if (selectFor === "ingredient") {
        setForm((f) => {
          if (f.ingredients.some((ing) => String(ing.ingredient_item_id) === String(createdId))) {
            return f;
          }
          return {
            ...f,
            ingredients: [
              ...f.ingredients,
              {
                ingredient_item_id: String(createdId),
                item_name: itemMeta?.item_name || "New ingredient",
                quantity: "1",
                unit: itemMeta?.unit || "g",
                notes: "",
              },
            ],
          };
        });
      } else {
        setForm((f) => ({
          ...f,
          item_id: String(createdId),
          yield_unit: itemMeta?.unit || f.yield_unit || "piece",
        }));
      }

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("createdItemId");
          next.delete("selectFor");
          next.delete("resumed");
          return next;
        },
        { replace: true }
      );
    };

    apply();
  }, [searchParams, loading, reloadRef, authFetch, setSearchParams]);

  const goCreateItem = (itemType, selectFor) => {
    saveFormDraft(draftKey, { form, baseline });
    const url = buildCreateItemReturnUrl({
      returnTo: currentReturnPath(),
      itemType,
      selectFor,
    });
    navigateSafely(url);
  };

  const onFinishedSelect = (product) => {
    if (disabled) return;
    const id = String(product.id || "");
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

  // Keep every ingredient line locked to that item's stock unit.
  useEffect(() => {
    if (!ingredients?.length && !finished_items?.length) return;
    setForm((f) => {
      let changed = false;
      let next = f;

      if (finished_items?.length && f.item_id) {
        const finished = finished_items.find((i) => String(i.id) === String(f.item_id));
        if (finished?.unit && String(f.yield_unit || "").toLowerCase() !== String(finished.unit).toLowerCase()) {
          next = { ...next, yield_unit: finished.unit };
          changed = true;
        }
      }

      if (ingredients?.length) {
        const nextIngredients = (next.ingredients || []).map((ing) => {
          const item = ingredients.find((i) => String(i.id) === String(ing.ingredient_item_id));
          if (!item?.unit) return ing;
          if (String(ing.unit || "").toLowerCase() === String(item.unit).toLowerCase()) return ing;
          changed = true;
          return { ...ing, unit: item.unit, item_name: item.item_name || ing.item_name };
        });
        if (changed) next = { ...next, ingredients: nextIngredients };
      }

      return changed ? next : f;
    });
  }, [ingredients, finished_items]);

  const setIngredient = (index, field, value) => {
    if (field === "unit") return; // unit is locked to the item's stock unit
    setForm((f) => {
      const next = [...f.ingredients];
      next[index] = { ...next[index], [field]: value };
      return { ...f, ingredients: next };
    });
  };

  const removeIngredient = (index) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  };

  const leaveForm = () => {
    clearFormDraft(draftKey);
    navigate(backPath);
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
        yield_unit:
          finished_items.find((i) => String(i.id) === String(form.item_id))?.unit ||
          form.yield_unit ||
          "piece",
        instructions: form.instructions || null,
        prep_time_mins: toPrepTimeMins(form.prep_time_value, form.prep_time_unit),
        status: form.status,
        ingredients: validIngredients.map((ing) => {
          const stockItem = ingredients.find((i) => String(i.id) === String(ing.ingredient_item_id));
          return {
            ingredient_item_id: Number(ing.ingredient_item_id),
            quantity: Number(ing.quantity),
            unit: stockItem?.unit || ing.unit || "g",
            notes: ing.notes || null,
          };
        }),
      };
      if (isEdit) {
        await apiFetch(`/production/recipes/${recipeId}`, { method: "PUT", body: JSON.stringify(body) }, authFetch);
      } else {
        await apiFetch("/production/recipes", { method: "POST", body: JSON.stringify(body) }, authFetch);
      }
      clearFormDraft(draftKey);
      navigateSafely(backPath);
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
            <Button variant="secondary" onClick={leaveForm}>
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
                label={
                  form.item_id
                    ? `Yield quantity (${
                        finished_items.find((i) => String(i.id) === String(form.item_id))?.unit ||
                        form.yield_unit ||
                        "piece"
                      })`
                    : "Yield quantity"
                }
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
                label="Yield unit (stock)"
                as="select"
                value={
                  finished_items.find((i) => String(i.id) === String(form.item_id))?.unit ||
                  form.yield_unit ||
                  "piece"
                }
                disabled
                title="Must match the finished item’s stock unit"
              >
                <option
                  value={
                    finished_items.find((i) => String(i.id) === String(form.item_id))?.unit ||
                    form.yield_unit ||
                    "piece"
                  }
                >
                  {finished_items.find((i) => String(i.id) === String(form.item_id))?.unit ||
                    form.yield_unit ||
                    "piece"}
                </option>
              </FormField>
              <div className="wh-field">
                <span className="wh-field__label">Prep time</span>
                <div className="wh-month-day-row">
                  <FormField
                    id="prep_time_value"
                    type="number"
                    min="0"
                    step="any"
                    value={form.prep_time_value}
                    onChange={(e) => setForm((f) => ({ ...f, prep_time_value: e.target.value }))}
                    placeholder="e.g. 30"
                    aria-label="Prep time value"
                    disabled={disabled}
                  />
                  <FormField
                    id="prep_time_unit"
                    as="select"
                    value={form.prep_time_unit}
                    onChange={(e) => setForm((f) => ({ ...f, prep_time_unit: e.target.value }))}
                    aria-label="Prep time unit"
                    disabled={disabled}
                  >
                    {PREP_TIME_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </FormField>
                </div>
              </div>
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

          <FormBlock title="Finished bakery item" description="Choose the product this recipe produces.">
            <ProductSelectField
              items={finished_items}
              mode="single"
              entityLabel="products"
              value={form.item_id}
              onSelect={onFinishedSelect}
              onChange={(id) => {
                if (!id) onFinishedSelect?.({ id: "" });
              }}
              onAddNew={() => goCreateItem("finished", "finished")}
              addNewLabel="Add new finished product"
              disabled={disabled}
              emptyMessage="No finished bakery items yet."
            />
          </FormBlock>

          <FormBlock title="Ingredients (Kacha Maal)" description="Choose ingredients to add to this recipe.">
            <ProductSelectField
              items={ingredients}
              mode="multi"
              entityLabel="ingredients"
              selectedIds={selectedIngredientIds}
              onToggle={toggleIngredient}
              onAddNew={() => goCreateItem("ingredient", "ingredient")}
              addNewLabel="Add new raw item"
              disabled={disabled}
              emptyMessage="No ingredients found. Add purchasable items under Stock."
            />
          </FormBlock>

          {form.ingredients.length > 0 && (
            <FormBlock
              title="Ingredient quantities"
              description="Quantities use each item’s stock unit (locked). Enter how much goes into one yield batch."
            >
              <div className="wh-inv-line-items">
                {form.ingredients.map((ing, index) => {
                  const stockItem = ingredients.find((i) => String(i.id) === String(ing.ingredient_item_id));
                  const stockUnit = stockItem?.unit || ing.unit || "g";
                  return (
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
                        label={`Quantity (${stockUnit})`}
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
                        label="Unit (stock)"
                        as="select"
                        value={stockUnit}
                        disabled
                        title="Must match the item’s stock unit"
                      >
                        <option value={stockUnit}>{stockUnit}</option>
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
                  );
                })}
              </div>
            </FormBlock>
          )}

          {error && <p className="wh-field__error">{error}</p>}
          <FormActions>
            <Button type="button" variant="secondary" onClick={leaveForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || disabled}>
              {saving ? "Saving…" : isEdit ? "Save Recipe" : "Create Recipe"}
            </Button>
          </FormActions>
        </form>
      </FormPageLayout>
      <UnsavedChangesDialog
        open={dialogOpen}
        onStay={stayOnPage}
        onDiscard={leavePage}
        reloadPending={reloadPending}
      />
    </div>
  );
}
