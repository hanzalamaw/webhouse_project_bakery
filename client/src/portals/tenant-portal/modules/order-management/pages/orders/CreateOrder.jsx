import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { useUnsavedChangesGuard } from "../../../../../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "../../../../../../components/UnsavedChangesDialog";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { FormField } from "../../../../../../components/FormField";
import { DiscountField } from "../../../../../../components/DiscountField";
import { Button } from "../../../../../../components/Button";
import { Card } from "../../../../../../components/Card";
import { OrderFieldSelect } from "../../../../../../components/OrderFieldSelect";
import { Modal } from "../../../../../../components/Modal";
import { ConfirmDeleteModal } from "../../../../../../components/ConfirmDeleteModal";
import { FormBlock } from "../../../../../../components/FormBlock";
import { FormPageLayout, FormPageAlerts, FormActions } from "../../../../../../components/FormPageLayout";
import ProductCatalogPicker from "../../../../../../components/ProductCatalogPicker";
import { useOrderReference } from "../../hooks/useOrderReference";
import { MODULE_BASE, ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS } from "../../constants";
import {
  CUSTOMER_TYPES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "../../../crm/constants";
import { PAKISTAN_CITY_OPTIONS } from "../../../../../../utils/pakistanCities";
import { formatPKR } from "../../../../../../utils/currency";
import { OrderItemsCardHead } from "../../components/OrderItemsCardHead";
import { OrderTotalsSummary } from "../../components/OrderTotalsSummary";
import {
  buildLineItemFromProduct,
  calcLineTotal,
  computeOrderTotals,
  mapOrderItemFromApi,
  productDeliveryTotal,
  lineDiscountForQty,
} from "../../utils/orderLinePricing";

const ORDER_INITIAL = {
  customer_id: "",
  order_source: "walk-in",
  order_status: "pending",
  payment_status: "unpaid",
  fulfillment_status: "unfulfilled",
  discount_amount: "0",
  delivery_charges: "0",
  city: "",
  delivery_address: "",
  delivery_state: "",
  delivery_postal_code: "",
  delivery_country: "",
  tags: "",
  notes: "",
};

const CUSTOMER_INITIAL = {
  customer_name: "",
  company_name: "",
  customer_type: "retailer",
  status: "active",
  email: "",
  tags: "",
  note: "",
};

const digitsOf = (s) => String(s || "").replace(/\D/g, "");

function productKey(product) {
  const pid = String(product.product_id ?? product.item_id ?? "");
  const vid = product.variant_id != null && product.variant_id !== "" ? String(product.variant_id) : "";
  return vid ? `${pid}:${vid}` : pid;
}

function lineMatchesProduct(row, product) {
  return productKey(row) === productKey(product);
}

function normalizeOrderItems(items) {
  return (items || []).map((item) => ({
    product_id: String(item.product_id || ""),
    variant_id: item.variant_id != null && item.variant_id !== "" ? String(item.variant_id) : null,
    product_name: item.product_name || "",
    variant_name: item.variant_name || "",
    sku: item.sku || "",
    quantity: String(item.quantity ?? ""),
    unit_price: String(item.unit_price ?? ""),
    product_discount: String(item.product_discount ?? ""),
    product_tax: String(item.product_tax ?? ""),
    product_delivery: String(item.product_delivery ?? ""),
    discount: String(item.discount ?? ""),
  }));
}

function serializeState(form, items, branchId, customerForm, customerPhone) {
  return JSON.stringify({
    form,
    items: normalizeOrderItems(items),
    branchId: String(branchId || ""),
    customerForm,
    customerPhone: String(customerPhone || ""),
  });
}

function normalizeCustomerProfileSnapshot(customerForm, customerPhone) {
  return {
    customer_name: (customerForm.customer_name || "").trim(),
    company_name: (customerForm.company_name || "").trim(),
    customer_type: String(customerForm.customer_type || "retailer").trim().toLowerCase() || "retailer",
    status: String(customerForm.status || "active").trim().toLowerCase() || "active",
    email: (customerForm.email || "").trim().toLowerCase(),
    note: (customerForm.note || "").trim(),
    phone: digitsOf(customerPhone),
    tags: String(customerForm.tags || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(","),
  };
}

function customerFormFromDetail(d) {
  const tags = Array.isArray(d?.tags)
    ? d.tags.map((t) => (typeof t === "string" ? t : t?.tag_name)).filter(Boolean)
    : String(d?.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
  return {
    customer_name: d?.customer_name || "",
    company_name: d?.company_name || "",
    customer_type: d?.customer_type || "retailer",
    status: d?.status || "active",
    email: d?.email || "",
    tags: tags.join(", "),
    note: d?.note || "",
  };
}

function branchLabel(b) {
  return b.branch_name || b.warehouse_name || `Branch #${b.id}`;
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function validateOrder({ items, branchId, isEdit }) {
  const errors = {};
  if (!isEdit && !branchId) errors.branch_id = "Select a branch (shop).";
  if (!items.length) errors.items = "Add at least one product.";
  for (const row of items) {
    if (!(Number(row.quantity) > 0)) {
      errors.items = "Each line needs a quantity greater than zero.";
      break;
    }
    if (row.unit_price === "" || Number(row.unit_price) < 0) {
      errors.items = "Each line needs a valid unit price.";
      break;
    }
  }
  return errors;
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const isEdit = Boolean(orderId);
  const { authFetch } = useAuth();
  const { canCreate, canEdit, canDelete, readOnly } = useModulePermission("order-management");
  const {
    customers,
    branches,
    warehouses,
    field_options,
    loading: refLoading,
    loadError,
    addFieldOption,
  } = useOrderReference();

  const branchOptions = useMemo(() => {
    const list = (branches && branches.length ? branches : warehouses) || [];
    return list;
  }, [branches, warehouses]);

  const [form, setForm] = useState(ORDER_INITIAL);
  const [items, setItems] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [branchProducts, setBranchProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [baseline, setBaseline] = useState(null);
  const [createBaseline, setCreateBaseline] = useState(null);
  const [pendingBaselineCapture, setPendingBaselineCapture] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEdit);
  const [actionError, setActionError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stockWarning, setStockWarning] = useState(null);
  const [orderNo, setOrderNo] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const formActionsRef = useRef(null);

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerForm, setCustomerForm] = useState(CUSTOMER_INITIAL);
  const [linkedCustomerId, setLinkedCustomerId] = useState(null);
  const [linkedOriginal, setLinkedOriginal] = useState(null);
  const [phonePrompt, setPhonePrompt] = useState(null);
  const [customerUpdatePrompt, setCustomerUpdatePrompt] = useState(false);

  const formBusy = submitting || (isEdit && loadingProduct);
  const promptedDigitsRef = useRef("");
  const formRef = useRef(form);
  const itemsRef = useRef(items);
  const branchIdRef = useRef(branchId);
  const customerFormRef = useRef(customerForm);
  const customerPhoneRef = useRef(customerPhone);
  formRef.current = form;
  itemsRef.current = items;
  branchIdRef.current = branchId;
  customerFormRef.current = customerForm;
  customerPhoneRef.current = customerPhone;

  const disabled =
    readOnly ||
    (isEdit ? !canEdit : !canCreate) ||
    (isEdit && ["cancelled", "returned"].includes(String(form.order_status || "").toLowerCase()));

  const clearFieldError = (...keys) => {
    setFieldErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const set = (key, value) => {
    clearFieldError(key);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setCust = (key, value) => {
    const map = {
      customer_name: "customer_name",
      email: "customer_email",
    };
    clearFieldError(map[key] || key);
    if (key === "email") clearFieldError("customer_phone", "customer_email");
    setCustomerForm((c) => ({ ...c, [key]: value }));
  };

  const showActionError = (msg) => {
    setActionError(msg);
    setActionMessage("");
    requestAnimationFrame(() => {
      formActionsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const setOrderStatus = (value) => {
    setForm((f) => ({
      ...f,
      order_status: value,
      ...(value === "delivered" ? { fulfillment_status: "fulfilled" } : {}),
    }));
  };

  const setFulfillmentStatus = (value) => {
    setForm((f) => ({
      ...f,
      fulfillment_status: value,
      ...(value === "fulfilled"
        && !["cancelled", "returned"].includes(String(f.order_status || "").toLowerCase())
        ? { order_status: "delivered" }
        : {}),
      ...(value === "partial"
        && !["cancelled", "returned", "delivered"].includes(String(f.order_status || "").toLowerCase())
        ? { order_status: "shipped" }
        : {}),
    }));
  };

  const isDirty = useMemo(() => {
    const snap = serializeState(form, items, branchId, customerForm, customerPhone);
    if (isEdit) return baseline !== null && snap !== baseline;
    return createBaseline !== null && snap !== createBaseline;
  }, [baseline, createBaseline, form, items, branchId, customerForm, customerPhone, isEdit]);

  const { dialogOpen, stayOnPage, leavePage, reloadPending, navigateSafely } = useUnsavedChangesGuard(isDirty, {
    enabled: isEdit
      ? baseline !== null && !loadingProduct && !refLoading
      : createBaseline !== null && !refLoading,
    mode: isEdit ? "edit" : "create",
  });

  useEffect(() => {
    if (isEdit || createBaseline || refLoading || loadingProduct) return;
    setCreateBaseline(serializeState(form, items, branchId, customerForm, customerPhone));
  }, [isEdit, createBaseline, refLoading, loadingProduct, form, items, branchId, customerForm, customerPhone]);

  const loadBranchProducts = useCallback(async (id) => {
    if (!id) {
      setBranchProducts([]);
      return;
    }
    setLoadingProducts(true);
    try {
      const branchQs = new URLSearchParams({ branch_id: String(id) });
      try {
        const res = await apiFetch(`/orders/branch-products?${branchQs}`, {}, authFetch);
        setBranchProducts(res.data || []);
        return;
      } catch {
        /* fall through to warehouse-products (accepts warehouse_id and/or branch_id) */
      }
      const whQs = new URLSearchParams({
        warehouse_id: String(id),
        branch_id: String(id),
      });
      const res = await apiFetch(`/orders/warehouse-products?${whQs}`, {}, authFetch);
      setBranchProducts(res.data || []);
    } catch {
      setBranchProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!branchId) return;
    loadBranchProducts(branchId).catch(() => {});
  }, [branchId, loadBranchProducts]);

  useEffect(() => {
    if (branchId || !branchOptions.length || refLoading || loadingProduct) return;
    setBranchId(String(branchOptions[0].id));
  }, [branchId, branchOptions, refLoading, loadingProduct]);

  const applyCustomerDetail = useCallback((d, phoneOverride) => {
    const phone = phoneOverride != null && String(phoneOverride).trim() !== ""
      ? String(phoneOverride)
      : (d?.phone || "");
    const nextForm = customerFormFromDetail(d);
    setCustomerForm(nextForm);
    setCustomerPhone(phone);
    setLinkedCustomerId(d.id);
    setLinkedOriginal(normalizeCustomerProfileSnapshot(nextForm, phone));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoadingProduct(true);
    setBaseline(null);
    setPendingBaselineCapture(false);
    apiFetch(`/orders/${orderId}`, {}, authFetch)
      .then(async (data) => {
        const nextForm = {
          customer_id: data.customer_id ? String(data.customer_id) : "",
          order_source: data.order_source || "walk-in",
          order_status: data.order_status || "pending",
          payment_status: data.payment_status || "unpaid",
          fulfillment_status: data.fulfillment_status || "unfulfilled",
          discount_amount: String(data.discount_amount ?? 0),
          delivery_charges: String(data.delivery_charges ?? 0),
          city: data.city || "",
          delivery_address: data.delivery_address || "",
          delivery_state: data.delivery_state || "",
          delivery_postal_code: data.delivery_postal_code || "",
          delivery_country: data.delivery_country || "",
          tags: data.tags || "",
          notes: data.notes || "",
        };
        const nextItems = (data.items || []).map((item, i) => mapOrderItemFromApi({ ...item, id: item.id ?? i }));
        setForm(nextForm);
        setOrderNo(data.order_no || "");
        setItems(nextItems);

        const assignedBranch = data.branch_id || data.warehouse_id;
        if (assignedBranch) setBranchId(String(assignedBranch));

        if (data.customer_id) {
          try {
            const res = await apiFetch(`/orders/customers/${data.customer_id}`, {}, authFetch);
            const d = res.data;
            if (d) {
              applyCustomerDetail(d, d.phone || "");
              promptedDigitsRef.current = digitsOf(d.phone || "");
            }
          } catch {
            /* customer detail is best-effort */
          }
        }
        setPendingBaselineCapture(true);
      })
      .catch((e) => showActionError(e.message))
      .finally(() => setLoadingProduct(false));
  }, [isEdit, orderId, authFetch, applyCustomerDetail]);

  useEffect(() => {
    if (!isEdit || loadingProduct || !pendingBaselineCapture) return undefined;
    const timer = window.setTimeout(() => {
      setBaseline(
        serializeState(
          formRef.current,
          itemsRef.current,
          branchIdRef.current,
          customerFormRef.current,
          customerPhoneRef.current,
        ),
      );
      setPendingBaselineCapture(false);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isEdit, loadingProduct, pendingBaselineCapture]);

  useEffect(() => {
    if (disabled) return;
    const digits = digitsOf(customerPhone);
    if (digits.length < 7 || linkedCustomerId) return;
    if (promptedDigitsRef.current === digits) return;
    const found = customers.find((c) => digitsOf(c.phone) === digits);
    if (found) {
      promptedDigitsRef.current = digits;
      setPhonePrompt(found);
    }
  }, [customerPhone, customers, linkedCustomerId, disabled]);

  const useExistingCustomer = async () => {
    if (!phonePrompt) return;
    const id = phonePrompt.id;
    setPhonePrompt(null);
    try {
      const res = await apiFetch(`/orders/customers/${id}`, {}, authFetch);
      const d = res.data;
      if (!d) return;
      applyCustomerDetail(d, d.phone || customerPhone);
      setForm((f) => ({
        ...f,
        customer_id: String(d.id),
        city: d.city || f.city,
        delivery_address: d.delivery_address || f.delivery_address,
        delivery_state: d.delivery_state || f.delivery_state,
        delivery_postal_code: d.delivery_postal_code || f.delivery_postal_code,
        delivery_country: d.delivery_country || f.delivery_country,
      }));
    } catch (e) {
      showActionError(e.message);
    }
  };

  const createNewFromPrompt = () => {
    setPhonePrompt(null);
    setLinkedCustomerId(null);
    setLinkedOriginal(null);
    setCustomerForm(CUSTOMER_INITIAL);
    setForm((f) => ({ ...f, customer_id: "" }));
  };

  const unlinkCustomer = () => {
    setLinkedCustomerId(null);
    setLinkedOriginal(null);
    setCustomerForm(CUSTOMER_INITIAL);
    setCustomerPhone("");
    promptedDigitsRef.current = "";
    setForm((f) => ({ ...f, customer_id: "" }));
  };

  const sellableProducts = useMemo(() => {
    return (branchProducts || []).filter((p) => p?.product_id || p?.item_id);
  }, [branchProducts]);

  const selectedProductIds = useMemo(
    () => items.map((i) => String(i.product_id || i.item_id)).filter(Boolean),
    [items]
  );

  const itemForProduct = (product) => items.find((i) => lineMatchesProduct(i, product));

  const syncDeliveryFromItems = (rows) => {
    if (isEdit) return;
    setForm((f) => ({ ...f, delivery_charges: String(productDeliveryTotal(rows)) }));
  };

  const toggleProduct = (product) => {
    const existing = itemForProduct(product);
    if (existing) {
      setItems((rows) => {
        const next = rows.filter((r) => r._key !== existing._key);
        syncDeliveryFromItems(next);
        return next;
      });
      return;
    }
    setItems((rows) => {
      const next = [...rows, buildLineItemFromProduct(product)];
      syncDeliveryFromItems(next);
      return next;
    });
  };

  const updateItem = (key, field, value) => {
    setItems((rows) => rows.map((row) => {
      if (row._key !== key) return row;
      const next = { ...row, [field]: value };
      if (field === "quantity" && Number(row.product_discount) > 0) {
        next.discount = String(lineDiscountForQty(value, row.product_discount));
      }
      return next;
    }));
  };

  const adjustQty = (key, delta) => {
    setItems((rows) => rows.map((row) => {
      if (row._key !== key) return row;
      const nextQty = Math.max(1, (Number(row.quantity) || 1) + delta);
      const next = { ...row, quantity: String(nextQty) };
      if (Number(row.product_discount) > 0) {
        next.discount = String(lineDiscountForQty(nextQty, row.product_discount));
      }
      return next;
    }));
  };

  const removeItem = (key) => {
    setItems((rows) => {
      const next = rows.filter((r) => r._key !== key);
      syncDeliveryFromItems(next);
      return next;
    });
  };

  const totals = computeOrderTotals(items, form.discount_amount, form.delivery_charges);
  const unitCount = items.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  const checkStock = () => items.filter((row) => {
    if (row.available_qty == null) return false;
    const avail = Number(row.available_qty);
    const qty = Number(row.quantity) || 0;
    return Number.isFinite(avail) && qty > avail;
  });

  const customerChanged = () => {
    if (!linkedCustomerId || !linkedOriginal) return false;
    const current = normalizeCustomerProfileSnapshot(customerForm, customerPhone);
    return JSON.stringify(current) !== JSON.stringify(linkedOriginal);
  };

  const finalizeSave = async ({ updateExisting }) => {
    setCustomerUpdatePrompt(false);
    setSubmitting(true);
    setActionError("");
    setActionMessage("");
    try {
      let resolvedCustomerId = linkedCustomerId;
      const custPayload = {
        customer_name: customerForm.customer_name.trim(),
        company_name: customerForm.company_name.trim(),
        customer_type: customerForm.customer_type,
        status: customerForm.status,
        email: customerForm.email.trim(),
        note: customerForm.note.trim(),
        tags: customerForm.tags,
        phone: customerPhone.trim(),
        city: form.city,
        delivery_address: form.delivery_address,
        delivery_state: form.delivery_state,
        delivery_postal_code: form.delivery_postal_code,
        delivery_country: form.delivery_country,
      };
      if (linkedCustomerId && updateExisting) {
        await apiFetch(`/orders/customers/${linkedCustomerId}`, {
          method: "PUT",
          body: JSON.stringify(custPayload),
        }, authFetch);
        setLinkedOriginal(normalizeCustomerProfileSnapshot(customerForm, customerPhone));
      } else if (!linkedCustomerId && custPayload.customer_name) {
        const created = await apiFetch("/orders/customers", {
          method: "POST",
          body: JSON.stringify(custPayload),
        }, authFetch);
        resolvedCustomerId = created?.id ?? null;
      }

      const payload = {
        ...form,
        customer_id: resolvedCustomerId ? Number(resolvedCustomerId) : null,
        branch_id: branchId ? Number(branchId) : null,
        warehouse_id: branchId ? Number(branchId) : null,
        discount_amount: totals.orderDiscount,
        delivery_charges: totals.delivery,
        items: items.map((row) => ({
          product_id: row.product_id ? Number(row.product_id) : null,
          variant_id: row.variant_id ? Number(row.variant_id) : null,
          product_name: row.product_name,
          sku: row.sku,
          quantity: Number(row.quantity),
          unit_price: Number(row.unit_price),
          discount: Number(row.discount) || 0,
          total_price: calcLineTotal(row),
        })),
      };
      if (isEdit) {
        await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify(payload) }, authFetch);
      } else {
        await apiFetch("/orders", { method: "POST", body: JSON.stringify(payload) }, authFetch);
      }
      const savedSnapshot = serializeState(form, items, branchId, customerForm, customerPhone);
      setBaseline(savedSnapshot);
      setCreateBaseline(savedSnapshot);
      if (isEdit) {
        setActionMessage("Order updated successfully.");
      } else {
        navigateSafely(`${MODULE_BASE}/orders/manage`);
      }
    } catch (err) {
      showActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const attemptFinalize = async (updateExisting) => {
    const errors = validateOrder({ items, branchId, isEdit });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showActionError(Object.values(errors)[0]);
      return;
    }
    setFieldErrors({});
    finalizeSave({ updateExisting });
  };

  const proceedToCustomer = async () => {
    if (linkedCustomerId && customerChanged()) {
      setCustomerUpdatePrompt(true);
      return;
    }
    attemptFinalize(false);
  };

  const submitOrder = (e) => {
    e?.preventDefault();
    if (disabled) return;
    const errors = validateOrder({ items, branchId, isEdit });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      showActionError(Object.values(errors)[0]);
      return;
    }
    setFieldErrors({});
    if (checkStock().length) {
      setStockWarning(checkStock());
      return;
    }
    proceedToCustomer();
  };

  const confirmCustomerUpdate = async (updateExisting) => {
    setCustomerUpdatePrompt(false);
    attemptFinalize(updateExisting);
  };

  const confirmOversold = () => {
    setStockWarning(null);
    proceedToCustomer();
  };

  const handleAddOption = async (fieldKey, value) => {
    await addFieldOption(fieldKey, value);
  };

  const handleBranchChange = (nextId) => {
    clearFieldError("branch_id");
    setBranchId(nextId);
    if (!isEdit && nextId !== branchId) {
      setItems([]);
    }
  };

  const refreshBranchProducts = () => {
    if (!branchId) return;
    loadBranchProducts(branchId).catch(() => {});
  };

  const confirmDeleteOrder = async () => {
    if (!isEdit || !orderId) return;
    setDeleting(true);
    setActionError("");
    try {
      await apiFetch(`/orders/${orderId}`, { method: "DELETE" }, authFetch);
      setDeleteOpen(false);
      navigateSafely(`${MODULE_BASE}/orders/manage`);
    } catch (e) {
      setActionError(e.message);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loadingProduct || refLoading) {
    return (
      <div className="wh-page">
        <FormPageLayout>
          <PageHeader title={isEdit ? "Edit Order" : "Create Order"} />
          <p className="wh-muted">Loading…</p>
        </FormPageLayout>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title={isEdit ? "Edit Order" : "Create Order"}
          description="Select a branch (shop) and bakery items, then fill in customer, delivery, and status details."
          actions={
            <div className="wh-action-btns">
              <Button variant="secondary" onClick={() => navigate(`${MODULE_BASE}/orders/manage`)}>
                Back to orders
              </Button>
              {isEdit && canDelete && (
                <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)} disabled={deleting}>
                  Delete
                </Button>
              )}
            </div>
          }
        />

        <FormPageAlerts error={loadError} />

        {isEdit && String(form.order_status || "").toLowerCase() === "cancelled" && (
          <p className="wh-field__error">This order is cancelled and cannot be edited.</p>
        )}
        {isEdit && String(form.order_status || "").toLowerCase() === "returned" && (
          <p className="wh-field__error">This order is returned and cannot be edited.</p>
        )}

        <form className="wh-form-stack" onSubmit={submitOrder}>
          <FormBlock
            title="Products"
            description={
              isEdit
                ? "Adjust existing line items or tap bakery items below to add more."
                : "Choose a branch (shop), then tap bakery items to add them."
            }
          >
            <FormField
              id="order-branch"
              label={isEdit ? "Branch (Shop) — to add products" : "Branch (Shop)"}
              as="select"
              value={branchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={disabled}
              error={fieldErrors.branch_id || fieldErrors.items}
            >
              <option value="">Select branch…</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>{branchLabel(b)}</option>
              ))}
            </FormField>

            {!branchId && (
              <div className="wh-order-create-empty">
                <p className="wh-muted">
                  {isEdit
                    ? "Select a branch above to search and add more products to this order."
                    : "Select a branch above to search and add products."}
                </p>
              </div>
            )}

            {branchId && (
              <ProductCatalogPicker
                products={sellableProducts}
                mode="multi"
                title="Products"
                selectedIds={selectedProductIds}
                onToggle={(_id, product) => {
                  if (product) toggleProduct(product);
                  else {
                    const match = sellableProducts.find(
                      (p) => String(p.product_id || p.item_id || p.id) === String(_id)
                    );
                    if (match) toggleProduct(match);
                  }
                }}
                showPrice
                showStock
                disabled={disabled || loadingProducts}
                emptyMessage={loadingProducts ? "Loading products…" : "No sellable items found for this branch."}
              />
            )}
          </FormBlock>

          {(isEdit || items.length > 0) && (
            <Card className="wh-card--table wh-order-items-card">
              <OrderItemsCardHead
                itemCount={items.length}
                unitCount={unitCount}
              />
              {items.length === 0 ? (
                <p className="wh-muted wh-order-items-card__empty">No products selected yet.</p>
              ) : (
                <>
                  <ul className="wh-order-line-cards">
                    {items.map((row) => (
                      <li key={row._key} className="wh-order-line-card">
                        <div className="wh-order-line-card__head">
                          <div className="wh-order-line-card__info">
                            <span className="wh-order-line-card__name">{row.product_name}</span>
                            {(row.variant_name || row.sku) && (
                              <span className="wh-order-line-card__meta">
                                {[row.variant_name, row.sku ? `SKU ${row.sku}` : ""].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </div>
                          {!disabled && (
                            <button
                              type="button"
                              className="wh-order-line-card__remove"
                              onClick={() => removeItem(row._key)}
                              aria-label={`Remove ${row.product_name}`}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>

                        <div className="wh-order-line-card__qty-row">
                          <span className="wh-order-line-card__field-label">Quantity</span>
                          <div className="wh-qty-stepper">
                            <button
                              type="button"
                              className="wh-qty-stepper__btn"
                              onClick={() => adjustQty(row._key, -1)}
                              disabled={disabled || Number(row.quantity) <= 1}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="wh-qty-stepper__value">{row.quantity}</span>
                            <button
                              type="button"
                              className="wh-qty-stepper__btn"
                              onClick={() => adjustQty(row._key, 1)}
                              disabled={disabled}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="wh-order-line-card__grid">
                          <label className="wh-order-line-card__field">
                            <span className="wh-order-line-card__field-label">Unit price</span>
                            <input
                              className="wh-field__input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unit_price}
                              onChange={(e) => updateItem(row._key, "unit_price", e.target.value)}
                              disabled={disabled}
                            />
                          </label>
                          <div className="wh-order-line-card__field">
                            <DiscountField
                              id={`discount_${row._key}`}
                              label="Discount"
                              compact
                              value={row.discount}
                              baseAmount={(Number(row.quantity) || 0) * (Number(row.unit_price) || 0)}
                              onChange={(v) => updateItem(row._key, "discount", v)}
                              disabled={disabled}
                            />
                          </div>
                          <label className="wh-order-line-card__field">
                            <span className="wh-order-line-card__field-label">Tax / unit</span>
                            <input
                              className="wh-field__input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.product_tax}
                              onChange={(e) => updateItem(row._key, "product_tax", e.target.value)}
                              disabled={disabled}
                            />
                          </label>
                        </div>

                        <div className="wh-order-line-card__foot">
                          <span className="wh-order-line-card__field-label">Line total</span>
                          <strong className="wh-order-line-card__total">{formatPKR(calcLineTotal(row))}</strong>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="wh-order-summary-adjustments">
                    <div className="wh-form-grid wh-order-totals-inputs">
                      <DiscountField
                        id="order-discount"
                        label="Order discount"
                        value={form.discount_amount}
                        baseAmount={totals.itemsGross}
                        onChange={(v) => set("discount_amount", v)}
                        disabled={disabled}
                      />
                      <FormField
                        id="order-delivery"
                        label="Delivery charges"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.delivery_charges}
                        onChange={(e) => set("delivery_charges", e.target.value)}
                        disabled={disabled}
                      />
                    </div>
                    <OrderTotalsSummary
                      subtotal={totals.subtotal}
                      lineDiscountTotal={totals.lineDiscountTotal}
                      taxTotal={totals.taxTotal}
                      orderDiscount={totals.orderDiscount}
                      delivery={totals.delivery}
                      payable={totals.payable}
                    />
                  </div>
                </>
              )}
            </Card>
          )}

          <FormBlock title="Customer & delivery" description="Enter the customer's phone to match an existing record, or fill in the details to create a new customer.">
            <div className="wh-form-grid">
              <FormField
                id="order-customer-phone"
                label="Phone number"
                type="tel"
                value={customerPhone}
                onChange={(e) => {
                  clearFieldError("customer_phone", "customer_email");
                  setCustomerPhone(e.target.value);
                }}
                disabled={disabled}
                placeholder="Type phone to find an existing customer…"
                error={fieldErrors.customer_phone}
              />
              {linkedCustomerId && (
                <div className="wh-form-grid__full">
                  <div className="wh-customer-hit">
                    <div className="wh-customer-hit__info">
                      <span className="wh-customer-hit__badge">Linked to existing customer</span>
                      <span className="wh-customer-hit__meta">Edits below will offer to update this customer when you save.</span>
                    </div>
                    {!disabled && (
                      <Button type="button" variant="secondary" className="wh-btn--sm" onClick={unlinkCustomer}>
                        Use a different number
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <FormField
                id="order-customer-name"
                label="Customer name"
                value={customerForm.customer_name}
                onChange={(e) => setCust("customer_name", e.target.value)}
                disabled={disabled}
                placeholder="Full name"
                error={fieldErrors.customer_name}
              />
              <FormField
                id="order-customer-company"
                label="Company"
                value={customerForm.company_name}
                onChange={(e) => setCust("company_name", e.target.value)}
                disabled={disabled}
              />
              <FormField
                id="order-customer-type"
                label="Customer type"
                as="select"
                value={customerForm.customer_type}
                onChange={(e) => setCust("customer_type", e.target.value)}
                disabled={disabled}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t] || t}</option>
                ))}
              </FormField>
              <FormField
                id="order-customer-status"
                label="Status"
                as="select"
                value={customerForm.status}
                onChange={(e) => setCust("status", e.target.value)}
                disabled={disabled}
              >
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>{CUSTOMER_STATUS_LABELS[s] || s}</option>
                ))}
              </FormField>
              <FormField
                id="order-customer-email"
                label="Email"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCust("email", e.target.value)}
                disabled={disabled}
                placeholder="name@example.com"
                error={fieldErrors.customer_email}
              />
              <FormField
                id="order-city"
                label="City"
                as="select"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                disabled={disabled}
                error={fieldErrors.city}
              >
                <option value="">Select city…</option>
                {PAKISTAN_CITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FormField>
              <div className="wh-form-grid__full">
                <FormField
                  id="order-customer-tags"
                  label="Tags"
                  value={customerForm.tags}
                  onChange={(e) => setCust("tags", e.target.value)}
                  disabled={disabled}
                  placeholder="Comma-separated (e.g. vip, lahore)"
                />
              </div>
              <div className="wh-form-grid__full">
                <FormField
                  id="order-address"
                  label="Street address"
                  as="textarea"
                  rows={2}
                  value={form.delivery_address}
                  onChange={(e) => set("delivery_address", e.target.value)}
                  disabled={disabled}
                  placeholder="Address line 1"
                  error={fieldErrors.delivery_address}
                />
              </div>
              <FormField
                id="order-delivery-state"
                label="State / Province"
                value={form.delivery_state}
                onChange={(e) => set("delivery_state", e.target.value)}
                disabled={disabled}
              />
              <FormField
                id="order-delivery-postal"
                label="Postal code"
                value={form.delivery_postal_code}
                onChange={(e) => set("delivery_postal_code", e.target.value)}
                disabled={disabled}
              />
              <FormField
                id="order-delivery-country"
                label="Country"
                value={form.delivery_country}
                onChange={(e) => set("delivery_country", e.target.value)}
                disabled={disabled}
                placeholder="e.g. Pakistan"
              />
              <div className="wh-form-grid__full">
                <FormField
                  id="order-tags"
                  label="Order tags"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  disabled={disabled}
                  placeholder="Comma-separated (e.g. wholesale, urgent)"
                />
              </div>
              <div className="wh-form-grid__full">
                <FormField
                  id="order-customer-note"
                  label="Customer note"
                  as="textarea"
                  rows={2}
                  value={customerForm.note}
                  onChange={(e) => setCust("note", e.target.value)}
                  disabled={disabled}
                  placeholder="Saved on the customer profile"
                />
              </div>
              <div className="wh-form-grid__full">
                <FormField
                  id="order-notes"
                  label="Order notes"
                  as="textarea"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  disabled={disabled}
                  placeholder="Internal notes for this order"
                />
              </div>
            </div>
          </FormBlock>

          <FormBlock title="Order status" description="Channel and current order, payment, and fulfillment status.">
            <div className="wh-form-grid">
              <OrderFieldSelect
                label="Channel"
                fieldKey="channel"
                fieldOptions={field_options}
                value={form.order_source}
                onChange={(v) => set("order_source", v)}
                onAddOption={handleAddOption}
                labelFor={(v) => ORDER_SOURCE_LABELS[v] || v.replace(/_/g, " ")}
                emptyLabel="Select channel…"
                disabled={disabled}
              />
              <OrderFieldSelect
                label="Order status"
                fieldKey="order_status"
                fieldOptions={field_options}
                value={form.order_status}
                onChange={setOrderStatus}
                onAddOption={handleAddOption}
                labelFor={(v) => ORDER_STATUS_LABELS[v] || v.replace(/_/g, " ")}
                disabled={disabled}
              />
              <OrderFieldSelect
                label="Payment status"
                fieldKey="payment_status"
                fieldOptions={field_options}
                value={form.payment_status}
                onChange={(v) => set("payment_status", v)}
                onAddOption={handleAddOption}
                disabled={disabled}
              />
              <OrderFieldSelect
                label="Fulfillment status"
                fieldKey="fulfillment_status"
                fieldOptions={field_options}
                value={form.fulfillment_status}
                onChange={setFulfillmentStatus}
                onAddOption={handleAddOption}
                disabled={disabled}
              />
            </div>
          </FormBlock>

          <FormActions ref={formActionsRef} error={actionError} message={actionMessage}>
            <Button type="button" variant="secondary" onClick={() => navigate(`${MODULE_BASE}/orders/manage`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formBusy || disabled}>
              {submitting ? "Saving…" : isEdit ? "Update order" : "Create order"}
            </Button>
          </FormActions>
        </form>
      </FormPageLayout>

      <Modal
        open={!!stockWarning}
        onClose={() => setStockWarning(null)}
        title="Insufficient stock"
        footer={
          <>
            <Button variant="secondary" modalPrimary onClick={() => setStockWarning(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmOversold}>Continue anyway</Button>
          </>
        }
      >
        <p>The following products are sold out or exceed available stock. Continue with negative availability?</p>
        <ul className="wh-list">
          {(stockWarning || []).map((row) => (
            <li key={row._key}>
              {row.product_name} — requested {row.quantity}, available {row.available_qty ?? 0}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={!!phonePrompt}
        onClose={createNewFromPrompt}
        title="Customer found"
        footer={
          <>
            <Button variant="secondary" onClick={createNewFromPrompt}>Create new customer</Button>
            <Button modalPrimary onClick={useExistingCustomer}>Use this customer</Button>
          </>
        }
      >
        {phonePrompt && (
          <div className="wh-customer-prompt">
            <p>A customer already uses this phone number:</p>
            <div className="wh-customer-prompt__card">
              <span className="wh-customer-prompt__name">
                {phonePrompt.customer_name}
                {phonePrompt.company_name ? ` — ${phonePrompt.company_name}` : ""}
              </span>
              <span className="wh-customer-prompt__meta">
                {[phonePrompt.phone, phonePrompt.email, phonePrompt.city].filter(Boolean).join(" · ") || "No extra details"}
              </span>
            </div>
            <p className="wh-muted">Use this customer to auto-fill their details, or create a new customer on this number.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={customerUpdatePrompt}
        onClose={() => confirmCustomerUpdate(false)}
        title="Update customer info?"
        footer={
          <>
            <Button variant="secondary" onClick={() => confirmCustomerUpdate(false)} disabled={submitting}>
              Keep existing
            </Button>
            <Button modalPrimary onClick={() => confirmCustomerUpdate(true)} disabled={submitting}>
              Update customer
            </Button>
          </>
        }
      >
        <p>You changed details for the linked customer. Do you want to update this customer&apos;s saved information, or keep it as-is and only use the new details for this order?</p>
      </Modal>

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete order"
        recordName={orderNo || "this order"}
        onConfirm={confirmDeleteOrder}
        onClose={() => setDeleteOpen(false)}
        loading={deleting}
      />

      <UnsavedChangesDialog open={dialogOpen} onStay={stayOnPage} onDiscard={leavePage} reloadPending={reloadPending} />
    </div>
  );
}
