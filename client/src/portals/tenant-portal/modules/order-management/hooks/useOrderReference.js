import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";

export function useOrderReference() {
  const { authFetch } = useAuth();
  const [data, setData] = useState({
    order_users: [],
    customers: [],
    products: [],
    warehouses: [],
    branches: [],
    field_options: {
      channel: [],
      order_status: [],
      payment_status: [],
      fulfillment_status: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError("");
    return apiFetch("/orders/reference", {}, authFetch)
      .then((res) => {
        const warehouses = res.warehouses || [];
        const branches = res.branches || res.warehouses || [];
        setData({
          order_users: res.order_users || [],
          customers: res.customers || [],
          products: res.products || [],
          warehouses,
          branches,
          field_options: res.field_options || {
            channel: [],
            order_status: [],
            payment_status: [],
            fulfillment_status: [],
          },
        });
      })
      .catch((err) => {
        setLoadError(err.message || "Failed to load order reference data");
        setData({
          order_users: [],
          customers: [],
          products: [],
          warehouses: [],
          branches: [],
          field_options: { channel: [], order_status: [], payment_status: [], fulfillment_status: [] },
        });
      })
      .finally(() => setLoading(false));
  }, [authFetch]);

  const addFieldOption = useCallback(async (fieldKey, optionValue) => {
    const next = await apiFetch("/orders/field-options", {
      method: "POST",
      body: JSON.stringify({ field_key: fieldKey, option_value: optionValue }),
    }, authFetch);
    setData((prev) => ({ ...prev, field_options: next }));
    return next;
  }, [authFetch]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  return { ...data, loading, loadError, reload, addFieldOption };
}
