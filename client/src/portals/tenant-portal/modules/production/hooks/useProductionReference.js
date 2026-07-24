import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";
import { DEFAULT_UNITS, RECIPE_STATUSES } from "../constants";

const EMPTY = {
  finished_items: [],
  ingredients: [],
  branches: [],
  recipes: [],
  units: DEFAULT_UNITS,
  statuses: RECIPE_STATUSES,
};

export function useProductionReference() {
  const { authFetch } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/production/reference", {}, authFetch);
      setData({
        finished_items: res.finished_items || [],
        ingredients: res.ingredients || [],
        branches: res.branches || [],
        recipes: res.recipes || [],
        units: res.units?.length ? res.units : DEFAULT_UNITS,
        statuses: res.statuses?.length ? res.statuses : RECIPE_STATUSES,
      });
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return { ...data, loading, reload: load };
}
