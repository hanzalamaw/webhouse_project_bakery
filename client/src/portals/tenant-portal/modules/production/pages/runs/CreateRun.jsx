import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout } from "../../../../../../components/FormPageLayout";
import { DataTable } from "../../../../../../components/DataTable";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { useFormUnsavedGuard } from "../../../../../../hooks/useFormUnsavedGuard";
import {
  saveFormDraft,
  loadFormDraft,
  clearFormDraft,
  buildCreateItemReturnUrl,
  currentReturnPath,
} from "../../../../../../utils/formDraft";
import { MODULE_BASE } from "../../constants";
import { useProductionReference } from "../../hooks/useProductionReference";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY = {
  item_id: "",
  recipe_id: "",
  branch_id: "",
  quantity_produced: "1",
  produced_on: todayISO(),
  expiry_date: "",
  notes: "",
};

const DRAFT_KEY = "wh_prod_run_draft";

function shouldResumeFromUrl() {
  const sp = new URLSearchParams(window.location.search);
  return sp.get("resumed") === "1" || Boolean(sp.get("createdItemId"));
}

function peekRunDraft() {
  if (!shouldResumeFromUrl()) return null;
  return loadFormDraft(DRAFT_KEY);
}

export default function CreateRun() {
  const { authFetch } = useAuth();
  const { canCreate, readOnly } = useModulePermission("production");
  const { finished_items, branches, recipes, loading: refLoading, reload: reloadRef } =
    useProductionReference();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialDraft] = useState(() => peekRunDraft());
  const [form, setForm] = useState(() => initialDraft?.form || EMPTY);
  const [baseline, setBaseline] = useState(
    () => initialDraft?.baseline ?? JSON.stringify(EMPTY)
  );
  const [plan, setPlan] = useState(() => initialDraft?.plan || null);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const prefillAppliedRef = useRef(Boolean(initialDraft?.form));
  const createdAppliedRef = useRef(false);

  const disabled = readOnly || !canCreate;
  const backPath = `${MODULE_BASE}/runs/manage`;
  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } =
    useFormUnsavedGuard(form, { baseline, enabled: !refLoading });

  useEffect(() => {
    clearFormDraft(DRAFT_KEY);
  }, []);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: String(b.id), label: b.branch_name })),
    [branches]
  );

  const recipeOptions = useMemo(() => {
    const itemId = form.item_id;
    const list = itemId
      ? recipes.filter((r) => String(r.item_id) === String(itemId) && r.status === "active")
      : recipes.filter((r) => r.status === "active");
    return list.map((r) => ({
      value: String(r.id),
      label: `${r.recipe_name}${r.finished_item_name ? ` — ${r.finished_item_name}` : ""}`,
    }));
  }, [recipes, form.item_id]);

  // Prefill from ?recipe_id= when not resuming a draft
  useEffect(() => {
    if (prefillAppliedRef.current || refLoading) return;
    prefillAppliedRef.current = true;
    const rid = searchParams.get("recipe_id");
    if (!rid) return;
    const recipe = recipes.find((r) => String(r.id) === String(rid));
    if (!recipe) return;
    const prefilledValues = {
      recipe_id: String(recipe.id),
      item_id: recipe.item_id ? String(recipe.item_id) : "",
    };
    queueMicrotask(() => {
      setForm((f) => ({
        ...f,
        ...prefilledValues,
      }));
      setBaseline(JSON.stringify({ ...EMPTY, ...prefilledValues }));
    });
  }, [recipes, searchParams, refLoading]);

  useEffect(() => {
    const createdId = searchParams.get("createdItemId");
    if (!createdId || refLoading || createdAppliedRef.current) return;

    const apply = async () => {
      createdAppliedRef.current = true;
      await reloadRef().catch(() => {});
      setPlan(null);
      setForm((f) => ({
        ...f,
        item_id: String(createdId),
      }));
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
  }, [searchParams, refLoading, reloadRef, setSearchParams]);

  const goCreateFinished = () => {
    saveFormDraft(DRAFT_KEY, { form, baseline, plan });
    navigateSafely(
      buildCreateItemReturnUrl({
        returnTo: currentReturnPath(),
        itemType: "finished",
        selectFor: "finished",
      })
    );
  };

  const onItemSelect = (product) => {
    if (disabled) return;
    const value = String(product.id || "");
    setPlan(null);
    setForm((f) => {
      const match = recipes.find(
        (r) => String(r.item_id) === String(value) && r.status === "active"
      );
      return {
        ...f,
        item_id: value,
        recipe_id: match ? String(match.id) : "",
      };
    });
  };

  const onRecipeChange = (value) => {
    setPlan(null);
    setForm((f) => {
      const recipe = recipes.find((r) => String(r.id) === String(value));
      return {
        ...f,
        recipe_id: value,
        item_id: recipe?.item_id ? String(recipe.item_id) : f.item_id,
      };
    });
  };

  const loadIngredients = async () => {
    if (!form.item_id || !form.quantity_produced) {
      setPlan(null);
      return;
    }
    const recipeId =
      form.recipe_id ||
      recipes.find((r) => String(r.item_id) === String(form.item_id) && r.status === "active")?.id;
    if (!recipeId && !form.branch_id) {
      setPlan(null);
      return;
    }

    setPlanning(true);
    setError("");
    try {
      // Prefer live stock check when branch is chosen
      if (form.branch_id) {
        const body = {
          item_id: Number(form.item_id),
          branch_id: Number(form.branch_id),
          quantity_produced: Number(form.quantity_produced),
          recipe_id: recipeId ? Number(recipeId) : null,
        };
        const res = await apiFetch(
          "/production/runs/plan",
          { method: "POST", body: JSON.stringify(body) },
          authFetch
        );
        setPlan(res);
        if (res.recipe_id && !form.recipe_id) {
          setForm((f) => ({ ...f, recipe_id: String(res.recipe_id) }));
        }
        return;
      }

      // No branch yet — still show recipe ingredients (scaled by qty)
      const recipe = await apiFetch(`/production/recipes/${recipeId}`, {}, authFetch);
      const qty = Number(form.quantity_produced) || 1;
      const yieldQty = Number(recipe.yield_qty) || 1;
      const factor = qty / yieldQty;
      setPlan({
        recipe_id: recipe.id,
        recipe_name: recipe.recipe_name,
        can_produce: null,
        lines: (recipe.ingredients || []).map((ing) => ({
          ingredient_name: ing.ingredient_name,
          needed_qty: Number(ing.quantity) * factor,
          available_qty: null,
          unit: ing.ingredient_unit || ing.unit || "",
          enough: null,
        })),
      });
      if (!form.recipe_id) {
        setForm((f) => ({ ...f, recipe_id: String(recipe.id) }));
      }
    } catch (err) {
      setPlan(null);
      setError(err.message || "Could not load ingredients");
    } finally {
      setPlanning(false);
    }
  };

  useEffect(() => {
    if (disabled || refLoading) return;
    if (!form.item_id || !form.quantity_produced) {
      setPlan(null);
      return;
    }
    const timer = setTimeout(() => {
      loadIngredients();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.item_id,
    form.branch_id,
    form.quantity_produced,
    form.recipe_id,
    disabled,
    refLoading,
    authFetch,
    recipes,
  ]);

  const leaveForm = () => {
    clearFormDraft(DRAFT_KEY);
    navigate(backPath);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (!form.item_id || !form.branch_id) {
      setError("Finished item and branch (shop) are required");
      return;
    }
    if (!plan) {
      setError("Ingredients are still loading. Wait a moment, then confirm the bake.");
      return;
    }
    if (plan.can_produce === false) {
      setError("Not enough ingredients (kacha maal) at this branch to complete the bake.");
      return;
    }
    if (plan.can_produce == null) {
      setError("Select a branch to check ingredient stock, then confirm the bake.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        item_id: Number(form.item_id),
        recipe_id: form.recipe_id ? Number(form.recipe_id) : plan.recipe_id,
        branch_id: Number(form.branch_id),
        quantity_produced: Number(form.quantity_produced),
        produced_on: form.produced_on || todayISO(),
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      };
      const created = await apiFetch("/production/runs", { method: "POST", body: JSON.stringify(body) }, authFetch);
      clearFormDraft(DRAFT_KEY);
      navigateSafely(`${MODULE_BASE}/runs/view/${created.id}`);
    } catch (err) {
      setError(err.message || "Bake failed");
    } finally {
      setSaving(false);
    }
  };

  const planColumns = [
    { key: "ingredient_name", label: "Ingredient (Kacha Maal)" },
    {
      key: "needed_qty",
      label: "Needed",
      format: (v, row) =>
        `${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.unit || ""}`.trim(),
    },
    {
      key: "available_qty",
      label: "Available",
      format: (v, row) =>
        v == null
          ? "Select branch"
          : `${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${row.unit || ""}`.trim(),
    },
    {
      key: "enough",
      label: "Enough?",
      format: (v) => (v == null ? "—" : v ? "Yes" : "No"),
    },
  ];

  return (
    <div className="wh-page wh-page--wide">
      <FormPageLayout wide>
        <PageHeader
          title="Bake Now"
          description="Complete a production run — consumes ingredients (kacha maal) and adds finished stock."
          actions={
            <>
              <Button type="button" variant="secondary" onClick={leaveForm}>
                Back to runs
              </Button>
              <Button type="button" variant="secondary" onClick={leaveForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-run-form"
                disabled={saving || disabled || !plan || plan.can_produce !== true}
              >
                {saving ? "Baking…" : "Confirm Bake"}
              </Button>
            </>
          }
        />
        {/* Bake form: ingredients auto-load — no preview button */}
        <form id="create-run-form" onSubmit={submit} className="wh-form-stack wh-inv-split-form">
          <div className="wh-inv-split">
            <aside className="wh-inv-split__left">
              <div className="wh-inv-product-picker">
                <ProductCatalogPicker
                  className="wh-catalog-picker--fill"
                  items={finished_items}
                  mode="single"
                  title="Finished product"
                  value={form.item_id}
                  onSelect={onItemSelect}
                  onAddNew={goCreateFinished}
                  addNewLabel="Add new finished product"
                  showPrice={false}
                  showStock={false}
                  maxHeight={420}
                  disabled={disabled}
                  emptyMessage="No finished bakery items yet."
                />
              </div>
            </aside>

            <div className="wh-inv-split__right">
              <FormBlock title="Bake details" description="Recipe, branch, and quantity made.">
                <div className="wh-form-grid">
                  <SearchableSelect
                    id="recipe_id"
                    label="Recipe"
                    value={form.recipe_id}
                    onChange={onRecipeChange}
                    options={recipeOptions}
                    placeholder="Search recipes…"
                    emptyMessage="No recipes for this item"
                    disabled={disabled}
                    allowEmpty
                  />
                  <SearchableSelect
                    id="branch_id"
                    label="Branch (Shop)"
                    value={form.branch_id}
                    onChange={(v) => {
                      setPlan(null);
                      setForm((f) => ({ ...f, branch_id: v }));
                    }}
                    options={branchOptions}
                    placeholder="Search branches…"
                    emptyMessage="No branches found"
                    disabled={disabled}
                    required
                  />
                  <FormField
                    id="quantity_produced"
                    label="Quantity Made"
                    type="number"
                    min="0"
                    step="any"
                    value={form.quantity_produced}
                    onChange={(e) => {
                      setPlan(null);
                      setForm((f) => ({ ...f, quantity_produced: e.target.value }));
                    }}
                    required
                    disabled={disabled}
                  />
                  <FormField
                    id="produced_on"
                    label="Produced on"
                    type="date"
                    value={form.produced_on}
                    onChange={(e) => setForm((f) => ({ ...f, produced_on: e.target.value }))}
                    disabled={disabled}
                  />
                  <FormField
                    id="expiry_date"
                    label="Expiry Date"
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                    disabled={disabled}
                  />
                  <div className="wh-form-grid__full">
                    <FormField
                      id="notes"
                      label="Notes"
                      as="textarea"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </FormBlock>

              <FormBlock
                title="Ingredients"
                description="Shows automatically for the selected finished item and quantity."
              >
                {planning && <p className="wh-muted">Loading ingredients…</p>}
                {!planning && !plan && (
                  <p className="wh-muted">
                    Select a finished product (with a recipe) to see ingredients here.
                  </p>
                )}
                {!planning && plan && (
                  <>
                    {plan.can_produce === true && (
                      <p className="wh-alert wh-alert--success">
                        Ready to bake with recipe “{plan.recipe_name}”.
                      </p>
                    )}
                    {plan.can_produce === false && (
                      <p className="wh-alert wh-alert--error">
                        Not enough stock for recipe “{plan.recipe_name}”. Add stock or lower quantity made.
                      </p>
                    )}
                    {plan.can_produce == null && (
                      <p className="wh-muted">
                        Recipe “{plan.recipe_name}”. Select a branch above to check stock availability.
                      </p>
                    )}
                    <DataTable columns={planColumns} rows={plan.lines || []} pageSize={100} />
                  </>
                )}
              </FormBlock>

              {error && <p className="wh-field__error">{error}</p>}
            </div>
          </div>
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
