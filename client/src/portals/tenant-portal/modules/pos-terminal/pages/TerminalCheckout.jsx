import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../../../../api/client";
import { Button } from "../../../../../components/Button";
import { FormField } from "../../../../../components/FormField";
import { DiscountField } from "../../../../../components/DiscountField";
import { Modal } from "../../../../../components/Modal";
import { UnsavedChangesDialog } from "../../../../../components/UnsavedChangesDialog";
import ProductCatalogPicker from "../../../../../components/ProductCatalogPicker";
import { useAuth } from "../../../../../context/AuthContext";
import { useUnsavedChangesGuard } from "../../../../../hooks/useUnsavedChangesGuard";
import { formatPKR } from "../../../../../utils/currency";
import {
  getPosPrinterLabel,
  openPrinterChooser,
  printHtml,
  setPosPrinterLabel,
} from "../../../../../utils/printHtml";
import { DEVICE_CODE } from "../constants";
import { clearTerminalSession, readTerminalSession, writeTerminalSession } from "../terminalSession";
import "../Terminal.css";

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getProductUnitPrice(product) {
  const selling = Number(product?.selling_price) || 0;
  const discount = Number(product?.discount) || 0;
  const tax = Number(product?.tax) || 0;
  return Math.max(0, round2(selling - discount + tax));
}

function cartSubtotal(cart) {
  return round2(cart.reduce((sum, line) => sum + line.unit_price * line.quantity, 0));
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}

export default function TerminalCheckout() {
  const navigate = useNavigate();
  const { authFetch, user, logout } = useAuth();

  const [session, setSession] = useState(() => readTerminalSession());
  const [terminal, setTerminal] = useState(null);
  const [register, setRegister] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [products, setProducts] = useState([]);
  const [deviceCode, setDeviceCode] = useState(DEVICE_CODE);
  const [terminals, setTerminals] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [terminalsLoadFailed, setTerminalsLoadFailed] = useState(false);
  const [lookupFallback, setLookupFallback] = useState(null);
  const [lookupChecking, setLookupChecking] = useState(false);
  const [sessionRestoring, setSessionRestoring] = useState(false);

  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discountAmount, setDiscountAmount] = useState("0");

  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [customerModalLoading, setCustomerModalLoading] = useState(false);
  const [customerFoundModalOpen, setCustomerFoundModalOpen] = useState(false);
  const [customerCreateModalOpen, setCustomerCreateModalOpen] = useState(false);
  const [lookupCustomers, setLookupCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState("");

  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printerLabel, setPrinterLabelState] = useState(() => getPosPrinterLabel());
  const [printerBusy, setPrinterBusy] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  useEffect(() => {
    apiFetch("/tenant/organization-settings", {}, authFetch)
      .then((res) => {
        const data = res.data || res || {};
        setCompanyName(data.company_name || user?.tenant_name || "");
        setCompanyAddress(data.company_address || "");
        setCompanyPhone(data.company_phone || "");
      })
      .catch(() => setCompanyName(user?.tenant_name || ""));
  }, [authFetch, user?.tenant_name]);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(true);
  const [productsRefreshing, setProductsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applySessionResponse = useCallback((res) => {
    setTerminal(res.terminal || null);
    setRegister(res.register || null);
    setDrawer(res.drawer || null);
    setProducts(Array.isArray(res.products) ? res.products : []);
  }, []);

  const refreshProducts = useCallback(async (terminalId) => {
    const id = terminalId ?? terminal?.id;
    if (!id) return;
    setProductsRefreshing(true);
    try {
      const res = await apiFetch(`/pos/terminal/${id}/products`, {}, authFetch);
      setProducts(Array.isArray(res.products) ? res.products : []);
    } catch (err) {
      setError(err.message || "Could not refresh products.");
    } finally {
      setProductsRefreshing(false);
    }
  }, [authFetch, terminal?.id]);

  const restoreSession = useCallback(async (stored) => {
    if (!stored?.terminal_id) return;
    setSessionRestoring(true);
    setError("");
    try {
      const res = await apiFetch(`/pos/terminal/${stored.terminal_id}/session`, {}, authFetch);
      applySessionResponse(res);
      writeTerminalSession({ terminal_id: res.terminal.id });
    } catch {
      clearTerminalSession();
      setSession(null);
      setTerminal(null);
      setRegister(null);
      setDrawer(null);
      setProducts([]);
    } finally {
      setSessionRestoring(false);
    }
  }, [applySessionResponse, authFetch]);

  const loadGateTerminals = useCallback(async () => {
    setTerminalsLoading(true);
    setTerminalsLoadFailed(false);
    try {
      const res = await apiFetch("/pos/terminals", {}, authFetch);
      setTerminals(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setTerminals([]);
      setTerminalsLoadFailed(true);
      setError("");
    } finally {
      setTerminalsLoading(false);
    }
  }, [authFetch]);

  const matchedTerminal = useMemo(() => {
    const code = deviceCode.trim();
    if (!code) return null;
    return (
      terminals.find(
        (row) =>
          String(row.device_code || "").trim() === code &&
          String(row.status || "active").toLowerCase() === "active"
      ) || null
    );
  }, [terminals, deviceCode]);

  const inactiveTerminal = useMemo(() => {
    const code = deviceCode.trim();
    if (!code || matchedTerminal) return null;
    return terminals.find((row) => String(row.device_code || "").trim() === code) || null;
  }, [terminals, deviceCode, matchedTerminal]);

  const resolvedTerminal = useMemo(() => {
    if (matchedTerminal) return matchedTerminal;
    if (
      lookupFallback?.found &&
      String(lookupFallback.status || "active").toLowerCase() === "active"
    ) {
      return lookupFallback;
    }
    return null;
  }, [matchedTerminal, lookupFallback]);

  useEffect(() => {
    if (session?.terminal_id) restoreSession(session).catch(() => {});
  }, [session, restoreSession]);

  useEffect(() => {
    if (terminal?.id) return undefined;
    loadGateTerminals().catch(() => {});
    return undefined;
  }, [terminal?.id, loadGateTerminals]);

  useEffect(() => {
    if (terminal?.id || terminalsLoading) return undefined;
    if (!terminalsLoadFailed && terminals.length > 0) return undefined;

    const code = deviceCode.trim();
    if (!code) {
      setLookupFallback(null);
      setLookupChecking(false);
      return undefined;
    }

    let cancelled = false;
    setLookupChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/pos/terminal/lookup?device_code=${encodeURIComponent(code)}`,
          {},
          authFetch
        );
        if (cancelled) return;
        setLookupFallback(res?.found ? res : null);
      } catch {
        if (!cancelled) setLookupFallback(null);
      } finally {
        if (!cancelled) setLookupChecking(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deviceCode, terminal?.id, terminalsLoading, terminalsLoadFailed, terminals.length, authFetch]);

  useEffect(() => {
    if (!terminal?.id) return undefined;
    const onFocus = () => {
      refreshProducts(terminal.id).catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [terminal?.id, refreshProducts]);

  const connectTerminal = async (event) => {
    event.preventDefault();
    setConnecting(true);
    setError("");
    setMessage("");
    try {
      const code = deviceCode.trim();
      if (!code) throw new Error("Terminal code is required.");
      if (!resolvedTerminal) {
        throw new Error("Enter a valid active terminal code.");
      }
      const res = await apiFetch("/pos/terminal/connect", {
        method: "POST",
        body: JSON.stringify({ device_code: code }),
      }, authFetch);
      applySessionResponse(res);
      const stored = { terminal_id: res.terminal.id };
      writeTerminalSession(stored);
      setSession(stored);
    } catch (err) {
      setError(err.message || "Could not connect terminal.");
    } finally {
      setConnecting(false);
    }
  };

  const addToCart = (product) => {
    const unitPrice = getProductUnitPrice(product);
    const sellingPrice = Number(product?.selling_price) || 0;
    const lineDiscount = Number(product?.discount) || 0;
    const lineTax = Number(product?.tax) || 0;
    setCart((prev) => {
      const index = prev.findIndex((line) => line.product_id === product.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], quantity: next[index].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.product_name,
          sku: product.sku,
          unit_price: unitPrice,
          selling_price: sellingPrice,
          line_discount: lineDiscount,
          line_tax: lineTax,
          quantity: 1,
        },
      ];
    });
  };

  const changeQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product_id === productId
            ? { ...line, quantity: line.quantity + delta }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const setLineQuantity = (productId, rawValue) => {
    const parsed = parseInt(String(rawValue).trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setCart((prev) =>
      prev.map((line) =>
        line.product_id === productId ? { ...line, quantity: parsed } : line
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((line) => line.product_id !== productId));
  };

  const clearCustomerSelection = () => {
    setSelectedCustomer(null);
    setLookupCustomers([]);
    setCustomerPhone("");
  };

  const runCustomerLookup = async () => {
    const phone = customerPhone.trim();
    if (!phone) {
      clearCustomerSelection();
      return;
    }
    setLookupLoading(true);
    setError("");
    try {
      const lookup = await apiFetch(
        `/pos/terminal/customers/lookup?phone=${encodeURIComponent(phone)}`,
        {},
        authFetch
      );
      const customers = Array.isArray(lookup?.customers)
        ? lookup.customers
        : lookup?.customer
          ? [lookup.customer]
          : [];
      if (lookup?.found && customers.length) {
        setLookupCustomers(customers);
        setNewCustomerName("");
        setCustomerFoundModalOpen(true);
      } else {
        setLookupCustomers([]);
        setNewCustomerName("");
        setCustomerCreateModalOpen(true);
      }
    } catch (err) {
      setError(err.message || "Customer lookup failed.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    const phone = customerPhone.trim();
    const customerName = newCustomerName.trim();
    if (!phone) {
      setError("Phone number is required.");
      return;
    }
    if (!customerName) {
      setError("Customer name is required.");
      return;
    }

    setCustomerModalLoading(true);
    setError("");
    try {
      const created = await apiFetch("/pos/terminal/customers", {
        method: "POST",
        body: JSON.stringify({
          phone,
          customer_name: customerName,
          customer_type: "retailer",
          city: terminal?.outlet_city || null,
        }),
      }, authFetch);
      setSelectedCustomer(created);
      setLookupCustomers([created]);
      setCustomerCreateModalOpen(false);
      setCustomerFoundModalOpen(false);
      setMessage(`Customer ${created.customer_name} linked to this sale.`);
    } catch (err) {
      setError(err.message || "Could not create customer.");
    } finally {
      setCustomerModalLoading(false);
    }
  };

  const handleUseExistingCustomer = (customer) => {
    if (!customer) return;
    setSelectedCustomer(customer);
    setMessage(`Customer ${customer.customer_name} linked to this sale.`);
    setCustomerFoundModalOpen(false);
  };

  const handleCreateNewFromFound = async () => {
    await handleCreateCustomer();
  };

  const subtotal = cartSubtotal(cart);
  const discount = Math.max(0, Number(discountAmount) || 0);
  const total = Math.max(0, round2(subtotal - discount));
  const cartPricing = useMemo(() => {
    let grossSubtotal = 0;
    let productDiscountTotal = 0;
    let productTaxTotal = 0;
    for (const line of cart) {
      const qty = Number(line.quantity) || 0;
      grossSubtotal += (Number(line.selling_price) || 0) * qty;
      productDiscountTotal += (Number(line.line_discount) || 0) * qty;
      productTaxTotal += (Number(line.line_tax) || 0) * qty;
    }
    return {
      grossSubtotal: round2(grossSubtotal),
      productDiscountTotal: round2(productDiscountTotal),
      productTaxTotal: round2(productTaxTotal),
    };
  }, [cart]);
  const expectedDrawer = round2(
    Number(register?.opening_balance || 0) + Number(register?.cash_collected || 0)
  );

  const isDirty = Boolean(
    cart.length ||
      selectedCustomer ||
      String(customerPhone || "").trim() ||
      (Number(discountAmount) || 0) > 0
  );
  const { dialogOpen, stayOnPage, leavePage, reloadPending } = useUnsavedChangesGuard(
    isDirty,
    { enabled: Boolean(session?.terminal_id && terminal) }
  );

  const savePrinterLabel = () => {
    setPosPrinterLabel(printerLabel.trim());
    setPrinterLabelState(printerLabel.trim());
    setPrinterModalOpen(false);
    setMessage(
      printerLabel.trim()
        ? `Receipt printer set to “${printerLabel.trim()}”. Pick it in the print dialog when prompted.`
        : "Using system default printer."
    );
  };

  const choosePrinterNow = async () => {
    setPrinterBusy(true);
    setError("");
    try {
      setPosPrinterLabel(printerLabel.trim());
      setPrinterLabelState(printerLabel.trim());
      await openPrinterChooser(printerLabel.trim() || "Receipt printer");
      setPrinterModalOpen(false);
      setMessage("Choose your thermal printer in the print dialog, then confirm.");
    } catch (err) {
      setError(err.message || "Could not open printer chooser.");
    } finally {
      setPrinterBusy(false);
    }
  };

  const printThermalReceipt = async (receipt) => {
    if (!receipt) return;
    const company = String(receipt.company_name || receipt.store_name || "Store").replace(/[<>&]/g, "");
    const address = String(receipt.company_address || "").replace(/[<>&]/g, "");
    const phone = String(receipt.company_phone || "").replace(/[<>&]/g, "");
    const saleNo = String(receipt.sale_no || "—").replace(/[<>&]/g, "");
    const itemsHtml = (receipt.items || [])
      .map((line, idx) => {
        const name = String(line.product_name || "Item").replace(/[<>&]/g, "");
        const qty = Number(line.quantity) || 0;
        const price = Number(line.unit_price) || 0;
        const amt = round2(qty * price);
        return `<div class="item">
          <div class="item-meta"><span>#${idx + 1}</span><span>Qty ${qty}</span></div>
          <div class="item-row"><span>${name}</span><span class="price">${formatPKR(amt)}</span></div>
        </div>`;
      })
      .join("");

    await printHtml(
      `<!doctype html><html><head><title>Receipt ${saleNo}</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        * { box-sizing: border-box; }
        body {
          font-family: "Roboto Mono", "Courier New", Courier, monospace;
          width: 72mm; max-width: 72mm; margin: 0 auto;
          color: #111; font-size: 11px; line-height: 1.4; padding: 4px 0 10px;
        }
        .center { text-align: center; }
        .store { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
        .muted { color: #666; font-size: 10px; margin: 2px 0; }
        .order-line { margin: 14px 0 10px; font-size: 11px; font-weight: 500; }
        .dash { border: none; border-top: 1px dashed #bbb; margin: 0; }
        .item { padding: 10px 0; }
        .item-meta { display: flex; justify-content: space-between; gap: 8px; color: #9a9a9a; font-size: 10px; margin-bottom: 4px; }
        .item-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; font-weight: 500; }
        .item-row .price { white-space: nowrap; }
        .solid { border: none; border-top: 1.5px solid #111; margin: 4px 0 10px; }
        .total-row { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; font-weight: 700; margin: 4px 0 12px; }
        .copy-label { text-align: center; font-size: 11px; margin: 8px 0 6px; }
        .thanks { text-align: center; font-size: 11px; margin-top: 6px; line-height: 1.45; }
      </style></head><body>
        <div class="center">
          <div class="store">${company}</div>
          ${address ? `<div class="muted">${address}</div>` : ""}
          ${phone ? `<div class="muted">Tel: ${phone}</div>` : ""}
          <div class="order-line">Order: #${saleNo}</div>
        </div>
        <hr class="dash" />
        ${itemsHtml}
        <hr class="dash" />
        <hr class="solid" />
        <div class="total-row"><span>Total</span><span>${formatPKR(receipt.payable_amount)}</span></div>
        <div class="copy-label">Customer copy</div>
        <div class="thanks">Thanks for visiting ${company}</div>
      </body></html>`,
      { title: `Receipt ${saleNo}`, delayMs: 400 }
    );
  };

  const completeSale = async () => {
    if (!terminal || !cart.length) return;
    setCheckoutLoading(true);
    setError("");
    setMessage("");
    const snapshotItems = cart.map((line) => ({ ...line }));
    const snapshotDiscount = discount;
    const snapshotSubtotal = subtotal;
    const snapshotTotal = total;
    try {
      const sale = await apiFetch(
        "/pos/terminal/sales",
        {
          method: "POST",
          body: JSON.stringify({
            terminal_id: terminal.id,
            items: cart,
            payment_method: paymentMethod,
            crm_customers_id: selectedCustomer?.id || null,
            discount_amount: discount,
          }),
        },
        authFetch
      );
      setCart([]);
      setDiscountAmount("0");
      const receipt = {
        sale_no: sale.sale_no,
        payable_amount: sale.payable_amount ?? snapshotTotal,
        total_amount: sale.total_amount ?? snapshotSubtotal,
        discount_amount: sale.discount_amount ?? snapshotDiscount,
        product_discount_total: cartPricing.productDiscountTotal,
        product_tax_total: cartPricing.productTaxTotal,
        payment_method: sale.payment_method || paymentMethod,
        created_at: sale.created_at || new Date().toISOString(),
        company_name: companyName || terminal.outlet_name || "Store",
        company_address: companyAddress,
        company_phone: companyPhone,
        store_name: terminal.outlet_name || terminal.store_name || terminal.branch_name || "Store",
        terminal_name: terminal.terminal_name || terminal.name || "POS",
        cashier_name: user?.name || user?.email || "",
        customer_name: selectedCustomer?.customer_name || selectedCustomer?.name || "",
        customer_phone: selectedCustomer?.phone || customerPhone || "",
        customer_company: selectedCustomer?.company_name || "",
        items: snapshotItems,
      };
      setCustomerPhone("");
      setSelectedCustomer(null);
      setMessage(`Sale ${sale.sale_no} completed - ${formatPKR(sale.payable_amount)}`);
      try {
        await printThermalReceipt(receipt);
      } catch (printErr) {
        setError(printErr.message || "Sale completed, but printing failed.");
      }
      const sess = await apiFetch(`/pos/terminal/${terminal.id}/session`, {}, authFetch);
      applySessionResponse(sess);
    } catch (err) {
      setError(err.message || "Could not complete sale.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleLogoutChoice = async (shiftOff) => {
    setLogoutLoading(true);
    setError("");
    try {
      if (shiftOff && terminal?.id) {
        await apiFetch(`/pos/terminal/${terminal.id}/shift-off`, { method: "POST" }, authFetch);
        clearTerminalSession();
        setSession(null);
        setTerminal(null);
        setRegister(null);
        setDrawer(null);
        setProducts([]);
        setCart([]);
      }
      setLogoutOpen(false);
      await logout();
    } catch (err) {
      setError(err.message || "Could not logout.");
    } finally {
      setLogoutLoading(false);
    }
  };

  if (!session?.terminal_id || !terminal) {
    const canConnect = Boolean(resolvedTerminal) && !sessionRestoring;
    const codeEntered = Boolean(deviceCode.trim());
    const codeChecking = codeEntered && (terminalsLoading || lookupChecking);
    const inactiveMatch =
      inactiveTerminal ||
      (lookupFallback?.found && String(lookupFallback.status || "active").toLowerCase() !== "active"
        ? lookupFallback
        : null);
    return (
      <div className="pos-terminal pos-terminal__gate">
        <div className="pos-terminal__gate-inner">
          <div className="pos-terminal__gate-brand">
            <h1>POS Terminal</h1>
            <p className="wh-muted">Enter your terminal code to open checkout.</p>
          </div>
          <div className="pos-terminal__gate-card">
            <div className="pos-terminal__gate-card-head">
              <h2>Connect terminal</h2>
              <p>Pair this device with a registered checkout terminal at your store.</p>
            </div>

            {error && <p className="wh-field__error pos-terminal__gate-error">{error}</p>}

            <form id="pos-terminal-gate-form" className="pos-terminal__gate-form" onSubmit={connectTerminal}>
              <FormField
                id="device_code"
                label="Terminal code"
                value={deviceCode}
                onChange={(event) => setDeviceCode(event.target.value)}
                autoFocus
                disabled={connecting}
                placeholder={`e.g. ${DEVICE_CODE}`}
              />

              <p className="pos-terminal__gate-hint">
                Default code is <strong>{DEVICE_CODE}</strong> unless your store uses a custom one.
              </p>
            </form>

            <div className="pos-terminal__gate-footer">
              <Button type="button" variant="secondary" onClick={() => navigate("/app")} disabled={connecting}>
                All modules
              </Button>
              <Button type="submit" form="pos-terminal-gate-form" disabled={connecting || !canConnect}>
                {connecting ? "Connecting..." : "Open terminal"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pos-terminal">
      <header className="pos-terminal__topbar">
        <div>
          <div className="pos-terminal__brand">{terminal.terminal_name}</div>
          <div className="pos-terminal__meta">
            <span className="pos-terminal__chip">{terminal.outlet_name}</span>
            <span className="pos-terminal__chip">
              Cashier: <strong>{user?.name || user?.email}</strong>
            </span>
            <span className="pos-terminal__chip pos-terminal__chip--sensitive">
              Opening:{" "}
              <strong className={amountsHidden ? "pos-terminal__amount--hidden" : ""}>
                {formatPKR(register?.opening_balance || 0)}
              </strong>
            </span>
            <span className="pos-terminal__chip pos-terminal__chip--sensitive">
              In drawer:{" "}
              <strong className={amountsHidden ? "pos-terminal__amount--hidden" : ""}>
                {formatPKR(expectedDrawer)}
              </strong>
            </span>
            <button
              type="button"
              className="pos-terminal__visibility-toggle"
              onClick={() => setAmountsHidden((hidden) => !hidden)}
              aria-label={amountsHidden ? "Show cash amounts" : "Hide cash amounts"}
              title={amountsHidden ? "Show amounts" : "Hide amounts"}
            >
              {amountsHidden ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {drawer?.store_open_label && (
              <span className="pos-terminal__chip">
                Store hours:{" "}
                <strong>
                  {drawer.store_open_label}
                  {drawer.store_close_label ? ` - ${drawer.store_close_label}` : ""}
                </strong>
              </span>
            )}
          </div>
        </div>
        <div className="pos-terminal__topbar-actions">
          <Button variant="secondary" onClick={() => setPrinterModalOpen(true)}>
            Printer{printerLabel ? `: ${printerLabel}` : ""}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/app")}>
            Modules
          </Button>
          <Button variant="secondary" onClick={() => setLogoutOpen(true)}>
            Logout
          </Button>
        </div>
      </header>

      {(error || message) && (
        <div className="pos-terminal__alerts">
          {error && <p className="wh-field__error">{error}</p>}
          {message && <p className="wh-form-message">{message}</p>}
        </div>
      )}

      <div className="pos-terminal-v2">
        <section className="pos-terminal-v2__products">
          <ProductCatalogPicker
            className="wh-catalog-picker--flush wh-catalog-picker--fill"
            products={products}
            title="Products"
            storeName={terminal?.outlet_name}
            mode="tap"
            onSelect={addToCart}
            onRefresh={() => refreshProducts()}
            refreshing={productsRefreshing}
            showRefresh
            showPrice
            showStock
            showTaxDiscount
            maxHeight={null}
            emptyMessage={`No active products for ${terminal?.outlet_name || "this store"}.`}
            emptyHint="Products must be active and sellable. Create them under Stock & Purchasing, then refresh."
          />
          {!loading && products.length === 0 && (
            <div className="pos-terminal__empty" style={{ marginTop: 8 }}>
              <Link to="/app/m/stock-purchasing/items/create" className="wh-link">
                Create items
              </Link>
            </div>
          )}
        </section>

        <aside className="pos-terminal-v2__sidebar">
          <div className="pos-terminal-v2__panel">
            <div className="pos-terminal-v2__panel-head">
              <h3>Customer</h3>
              {selectedCustomer && (
                <button
                  type="button"
                  className="pos-terminal-v2__link-btn"
                  onClick={clearCustomerSelection}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="wh-field-action-row">
              <FormField
                id="customer_phone"
                label="Phone number"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                onBlur={runCustomerLookup}
                placeholder="03xxxxxxxxx"
              />
              <div className="wh-field-action-row__action">
                <Button type="button" variant="secondary" onClick={runCustomerLookup} disabled={lookupLoading}>
                  {lookupLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
            {selectedCustomer && (
              <p className="pos-terminal-v2__customer-selected">
                Using customer <strong>{selectedCustomer.customer_name}</strong>
              </p>
            )}
          </div>

          <div className="pos-terminal-v2__panel pos-terminal-v2__cart-panel">
            <div className="pos-terminal-v2__panel-head">
              <h3>Current order</h3>
              <span className="wh-muted">
                {cart.length} line{cart.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="pos-terminal-v2__cart-list">
              {cart.length ? (
                cart.map((line) => (
                  <div className="pos-terminal-v2__cart-row" key={line.product_id}>
                    <div className="pos-terminal-v2__cart-main">
                      <div className="pos-terminal-v2__cart-name">{line.product_name}</div>
                      <div className="pos-terminal-v2__cart-price">
                        {formatPKR(round2(line.quantity * line.unit_price))}
                      </div>
                      <div className="pos-terminal-v2__cart-sub">
                        {line.sku} · {formatPKR(line.unit_price)} each
                      </div>
                      {(line.line_discount > 0 || line.line_tax > 0) && (
                        <div className="pos-terminal-v2__cart-adjustments">
                          {line.line_discount > 0 && <span>Disc: {formatPKR(line.line_discount * line.quantity)}</span>}
                          {line.line_tax > 0 && <span>Tax: {formatPKR(line.line_tax * line.quantity)}</span>}
                        </div>
                      )}
                    </div>
                    <div className="pos-terminal-v2__cart-qty">
                      <button type="button" aria-label="Decrease quantity" onClick={() => changeQty(line.product_id, -1)}>
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="pos-terminal-v2__cart-qty-input"
                        value={line.quantity}
                        onChange={(event) => setLineQuantity(line.product_id, event.target.value)}
                        aria-label={`Quantity for ${line.product_name}`}
                      />
                      <button type="button" aria-label="Increase quantity" onClick={() => changeQty(line.product_id, 1)}>
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="pos-terminal-v2__cart-remove"
                      onClick={() => removeFromCart(line.product_id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="wh-muted">No items added yet.</p>
              )}
            </div>
          </div>

          <div className="pos-terminal-v2__panel">
            <div className="pos-terminal-v2__panel-head">
              <h3>Payment method</h3>
            </div>
            <div className="pos-terminal-v2__payment-methods">
              {[
                { value: "cash", label: "CASH" },
                { value: "card", label: "CARD" },
                { value: "qr", label: "QR" },
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  className={`pos-terminal-v2__payment-method${paymentMethod === method.value ? " is-active" : ""}`}
                  onClick={() => setPaymentMethod(method.value)}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pos-terminal-v2__panel">
            <div className="pos-terminal-v2__summary-row">
              <span>Items subtotal</span>
              <strong>{formatPKR(cartPricing.grossSubtotal)}</strong>
            </div>
            {cartPricing.productDiscountTotal > 0 && (
              <div className="pos-terminal-v2__summary-row pos-terminal-v2__summary-row--deduction">
                <span>Product discounts</span>
                <strong>-{formatPKR(cartPricing.productDiscountTotal)}</strong>
              </div>
            )}
            {cartPricing.productTaxTotal > 0 && (
              <div className="pos-terminal-v2__summary-row">
                <span>Product tax</span>
                <strong>{formatPKR(cartPricing.productTaxTotal)}</strong>
              </div>
            )}
            <div className="pos-terminal-v2__summary-row">
              <span>Net subtotal</span>
              <strong>{formatPKR(subtotal)}</strong>
            </div>
            <DiscountField
              id="discount_amount"
              label="Order discount"
              value={discountAmount}
              baseAmount={subtotal}
              onChange={setDiscountAmount}
            />
            {discount > 0 && (
              <div className="pos-terminal-v2__summary-row pos-terminal-v2__summary-row--deduction">
                <span>Order discount applied</span>
                <strong>-{formatPKR(discount)}</strong>
              </div>
            )}
            <div className="pos-terminal-v2__summary-row pos-terminal-v2__summary-row--total">
              <span>Total</span>
              <strong>{formatPKR(total)}</strong>
            </div>
            <Button type="button" onClick={completeSale} disabled={!cart.length || checkoutLoading}>
              {checkoutLoading ? "Processing..." : "Complete sale"}
            </Button>
          </div>
        </aside>
      </div>

      <Modal
        open={customerFoundModalOpen}
        onClose={() => !customerModalLoading && setCustomerFoundModalOpen(false)}
        title={lookupCustomers.length > 1 ? "Customers found" : "Customer found"}
        className="pos-terminal-customer-modal"
        wide={lookupCustomers.length > 2}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCustomerFoundModalOpen(false)}
              disabled={customerModalLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewFromFound}
              disabled={customerModalLoading || !newCustomerName.trim()}
            >
              {customerModalLoading ? "Creating..." : "Create new & use"}
            </Button>
          </>
        }
      >
        <p className="pos-terminal-customer-modal__intro">
          {lookupCustomers.length === 1
            ? "This phone number is linked to one customer. Choose how to continue."
            : `${lookupCustomers.length} customers are registered with this phone number. Select one or create a new customer.`}
        </p>

        <div className="pos-terminal-customer-modal__phone-row">
          <span className="pos-terminal-customer-modal__label">Phone</span>
          <span className="pos-terminal-customer-modal__value">
            {lookupCustomers[0]?.phone || customerPhone}
          </span>
        </div>

        <div className="pos-terminal-customer-modal__list">
          {lookupCustomers.map((customer) => (
            <div className="pos-terminal-customer-modal__item" key={customer.id}>
              <div className="pos-terminal-customer-modal__item-main">
                <div className="pos-terminal-customer-modal__item-name">{customer.customer_name}</div>
                {customer.company_name && (
                  <div className="pos-terminal-customer-modal__item-meta">{customer.company_name}</div>
                )}
                {customer.customer_type && (
                  <div className="pos-terminal-customer-modal__item-meta">
                    {String(customer.customer_type).replace(/_/g, " ")}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="wh-btn--sm"
                onClick={() => handleUseExistingCustomer(customer)}
                disabled={customerModalLoading}
              >
                Use
              </Button>
            </div>
          ))}
        </div>

        <div className="pos-terminal-customer-modal__divider" aria-hidden="true">
          <span>or</span>
        </div>

        <div className="pos-terminal-customer-modal__new">
          <h4 className="pos-terminal-customer-modal__section-title">Create a new customer</h4>
          <p className="pos-terminal-customer-modal__hint">
            Register a different name for the same phone number.
          </p>
          <FormField
            id="found_new_customer_name"
            label="New customer name"
            value={newCustomerName}
            onChange={(event) => setNewCustomerName(event.target.value)}
            placeholder="Enter name for new customer"
          />
        </div>
      </Modal>

      <Modal
        open={customerCreateModalOpen}
        onClose={() => !customerModalLoading && setCustomerCreateModalOpen(false)}
        title="Create customer"
      >
        <p className="wh-modal__text">No customer found with this phone. Create one now.</p>
        <FormField id="new_customer_phone" label="Phone" value={customerPhone} readOnly />
        <FormField
          id="new_customer_name"
          label="Customer name"
          value={newCustomerName}
          onChange={(event) => setNewCustomerName(event.target.value)}
          placeholder="Enter customer name"
        />
        <p className="wh-muted" style={{ marginTop: 8 }}>
          Customer type will be set to retailer.
        </p>
        <div className="wh-modal__actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <Button
            variant="secondary"
            onClick={() => setCustomerCreateModalOpen(false)}
            disabled={customerModalLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateCustomer} disabled={customerModalLoading}>
            {customerModalLoading ? "Creating..." : "Create customer"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={printerModalOpen}
        onClose={() => !printerBusy && setPrinterModalOpen(false)}
        title="Receipt printer"
      >
        <p className="wh-modal__text">
          Name your thermal printer, then open the print dialog to select it. Receipts print in that dialog after each sale — no new browser tabs.
        </p>
        <FormField
          id="pos_printer_label"
          label="Printer name (optional label)"
          value={printerLabel}
          onChange={(e) => setPrinterLabelState(e.target.value)}
          placeholder="e.g. Counter thermal"
        />
        <div className="wh-modal__actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <Button type="button" variant="secondary" onClick={() => setPrinterModalOpen(false)} disabled={printerBusy}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={savePrinterLabel} disabled={printerBusy}>
            Save label
          </Button>
          <Button type="button" onClick={choosePrinterNow} disabled={printerBusy}>
            {printerBusy ? "Opening…" : "Select printer…"}
          </Button>
        </div>
      </Modal>

      <UnsavedChangesDialog
        open={dialogOpen}
        onStay={stayOnPage}
        onDiscard={leavePage}
        reloadPending={reloadPending}
      />

      <Modal open={logoutOpen} onClose={() => !logoutLoading && setLogoutOpen(false)} title="End session">
        <p style={{ marginBottom: 12 }}>
          Are you taking a <strong>break</strong> or is your <strong>shift off</strong>?
        </p>
        <p className="wh-muted" style={{ marginBottom: 16 }}>
          If your shift is off, cash in this drawer ({formatPKR(expectedDrawer)}) becomes the
          opening balance for the next shift.
        </p>
        <div className="wh-modal__actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <Button variant="secondary" disabled={logoutLoading} onClick={() => handleLogoutChoice(false)}>
            Taking a break
          </Button>
          <Button disabled={logoutLoading} onClick={() => handleLogoutChoice(true)}>
            Shift is off
          </Button>
        </div>
      </Modal>
    </div>
  );
}
