import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";

export function useInventoryReference() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({
    categories: [],
    branches: [],
    items: [],
    suppliers: [],
    item_types: [],
    units: [],
    statuses: [],
    movement_types: [],
    transfer_statuses: [],
    po_statuses: [],
    wastage_reasons: [],
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ref = await apiFetch("/inventory/reference", {}, authFetch);
      setData({
        categories: ref.categories || [],
        branches: ref.branches || [],
        items: ref.items || [],
        suppliers: ref.suppliers || [],
        item_types: ref.item_types || [],
        units: ref.units || [],
        statuses: ref.statuses || [],
        movement_types: ref.movement_types || [],
        transfer_statuses: ref.transfer_statuses || [],
        po_statuses: ref.po_statuses || [],
        wastage_reasons: ref.wastage_reasons || [],
      });
    } catch {
      setData({
        categories: [],
        branches: [],
        items: [],
        suppliers: [],
        item_types: [],
        units: [],
        statuses: [],
        movement_types: [],
        transfer_statuses: [],
        po_statuses: [],
        wastage_reasons: [],
      });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return { ...data, loading, reload: load };
}
