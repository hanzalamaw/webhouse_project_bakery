import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../../hooks/useModulePermission";
import { apiFetch, fetchAllTableRows } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { Button } from "../../../../../../components/Button";
import { SearchableSelect } from "../../../../../../components/SearchableSelect";
import { FormField } from "../../../../../../components/FormField";
import { FormPageLayout } from "../../../../../../components/FormPageLayout";
import { formatPKR } from "../../../../../../utils/currency";
import { formatDateTime } from "../../../../../../utils/dateTime";
import { printHtml } from "../../../../../../utils/printHtml";
import { PRINT_DOC_TYPES } from "../../constants";

const DEFAULT_ACCENT = "#E11D48";
const MONO_FONT = '"Roboto Mono", "Courier New", Courier, monospace';
const INVOICE_FONT = '"Inter", Helvetica, Arial, sans-serif';

function normalizeAccent(hex) {
  const raw = String(hex || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return DEFAULT_ACCENT;
}

function printFontLinks(forInvoice = false) {
  const family = forInvoice
    ? "family=Inter:wght@400;500;600;700"
    : "family=Roboto+Mono:wght@400;500;700";
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?${family}&display=swap" rel="stylesheet" />`;
}

/** Shared print color rules — browsers strip backgrounds without this. */
function printColorFix() {
  return `
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  `;
}

function thermalStyles() {
  return `
    ${printColorFix()}
    @page { size: 80mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ${MONO_FONT};
      width: 72mm; max-width: 72mm; margin: 0 auto;
      color: #111; font-size: 11px; line-height: 1.4;
      padding: 4px 0 10px; background: #fff;
    }
    .center { text-align: center; }
    .store { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
    .muted { color: #666; font-size: 10px; margin: 2px 0; }
    .order-line { margin: 12px 0 8px; font-size: 11px; font-weight: 500; }
    .dash { border: none; border-top: 1px dashed #bbb; margin: 6px 0; }
    .solid { border: none; border-top: 1.5px solid #111; margin: 6px 0 10px; }
    .section { margin: 6px 0; font-size: 10px; text-align: left; }
    .section strong { display: block; margin-bottom: 2px; font-size: 10px; }
    .item { padding: 8px 0; }
    .item-meta {
      display: flex; justify-content: space-between; gap: 8px;
      color: #9a9a9a; font-size: 10px; margin-bottom: 3px;
    }
    .item-row {
      display: flex; justify-content: space-between; gap: 10px;
      font-size: 12px; font-weight: 500;
    }
    .item-row .price { white-space: nowrap; }
    .item-sub { color: #666; font-size: 9px; margin-top: 2px; }
    .row {
      display: flex; justify-content: space-between; gap: 8px;
      margin: 2px 0; font-size: 11px;
    }
    .row.pay { font-weight: 700; font-size: 13px; margin-top: 4px; }
    .total-row {
      display: flex; justify-content: space-between; gap: 10px;
      font-size: 15px; font-weight: 700; margin: 4px 0 10px;
    }
    .copy-label { text-align: center; font-size: 11px; margin: 8px 0 4px; }
    .thanks { text-align: center; font-size: 10px; margin-top: 8px; line-height: 1.45; }
    .barcode { text-align: center; margin-top: 6px; letter-spacing: 2px; font-size: 12px; }
  `;
}

function invoiceStyles(accent) {
  const color = normalizeAccent(accent);
  return `
    ${printColorFix()}
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      font-family: ${INVOICE_FONT};
      color: #1f2937;
      font-size: 12px;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .inv-sheet {
      position: relative;
      overflow: hidden;
      width: 100%;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
      padding: 0;
      background: #fff;
    }
    .inv-body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 0 16mm;
    }
    .accent-corner {
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 36px;
      margin: 0;
      background: ${color} !important;
      border-bottom-left-radius: 40px;
    }
    .inv-top {
      display: grid;
      grid-template-columns: 1fr minmax(320px, 38%);
      gap: 28px;
      align-items: start;
      padding-top: 72px;
      margin-bottom: 36px;
      position: relative;
      z-index: 1;
    }
    .inv-title {
      margin: 0;
      padding: 0;
      font-size: 42px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.02em;
      color: #374151;
      text-transform: uppercase;
    }
    .brand {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      width: 100%;
      margin-top: 4px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      white-space: nowrap;
      text-align: right;
    }
    .inv-meta {
      display: grid;
      grid-template-columns: 1fr minmax(320px, 38%);
      gap: 28px;
      align-items: start;
      margin-bottom: 32px;
    }
    .party-label {
      margin: 0 0 6px;
      font-size: 12px;
      font-weight: 400;
      color: #9ca3af;
    }
    .party-name {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    .party-line {
      margin: 0 0 2px;
      font-size: 12px;
      font-weight: 400;
      color: #4b5563;
      line-height: 1.45;
    }
    .party-block + .party-block {
      margin-top: 22px;
    }
    .side-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .info-chip {
      background: #f3f4f6 !important;
      border-radius: 12px;
      padding: 20px 22px;
      height: 92px;
      min-height: 92px;
      max-height: 92px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      overflow: hidden;
    }
    .info-chip.grand {
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: 16px;
      flex-wrap: nowrap;
    }
    .info-chip.grand .chip-label {
      font-weight: 700;
      font-size: 13px;
      color: #111827;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .info-chip.grand .chip-value {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .date-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      width: 100%;
      text-align: center;
      align-items: center;
    }
    .date-grid .chip-label {
      display: block;
      font-size: 12px;
      font-weight: 400;
      color: #9ca3af;
      text-align: center;
      white-space: nowrap;
    }
    .date-grid .chip-value {
      display: block;
      margin-top: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      text-align: center;
      white-space: nowrap;
    }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0;
    }
    table.lines col.col-desc { width: 40%; }
    table.lines col.col-unit { width: 20%; }
    table.lines col.col-qty { width: 20%; }
    table.lines col.col-sub { width: 20%; }
    table.lines thead th {
      background: #000000 !important;
      color: #ffffff !important;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 14px 12px;
      border: none;
    }
    table.lines thead th.desc { text-align: left; }
    table.lines thead th.num { text-align: center; }
    table.lines thead th.amt { text-align: right; }
    table.lines tbody td {
      padding: 14px 12px;
      border: none;
      border-bottom: none;
      vertical-align: middle;
      font-size: 13px;
      font-weight: 400;
      color: #4b5563;
      background: #ffffff !important;
    }
    table.lines tbody tr:nth-child(even) td {
      background: #f3f4f6 !important;
    }
    table.lines tbody td.desc { text-align: left; color: #4b5563; }
    table.lines tbody td.num {
      text-align: center;
      white-space: nowrap;
      color: #4b5563;
    }
    table.lines tbody td.amt {
      text-align: right;
      white-space: nowrap;
      color: #4b5563;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 24px;
    }
    .totals-table col.col-desc { width: 40%; }
    .totals-table col.col-unit { width: 20%; }
    .totals-table col.col-qty { width: 20%; }
    .totals-table col.col-sub { width: 20%; }
    .totals-table td {
      padding: 8px 12px;
      border: none;
      font-size: 13px;
      color: #111827;
      vertical-align: middle;
    }
    .totals-table .tot-label {
      text-align: right;
      white-space: nowrap;
    }
    .totals-table .amt {
      text-align: right;
      white-space: nowrap;
    }
    .totals-table tr.rule-row td {
      padding-top: 14px;
      border-top: 1px solid #d1d5db;
    }
    .totals-table tr.grand td {
      font-weight: 700;
      font-size: 15px;
    }
    .inv-footer {
      flex: 0 0 auto;
      margin-top: auto;
      padding: 16px 16mm 18px;
      position: relative;
      z-index: 1;
    }
    .disclaimer {
      margin: 0;
      text-align: center;
      font-style: italic;
      font-size: 14px;
      font-weight: 400;
      color: #6b7280;
      line-height: 1.4;
    }
    .accent-bar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 8px;
      background: ${color} !important;
    }
  `;
}

function buildThermalDoc(order, org, { packing = false } = {}) {
  const company = org?.company_name || "Bakery";
  const address = org?.company_address || "";
  const phone = org?.company_phone || "";
  const customerName = order.customer_name || "Walk-in Customer";
  const custCompany = order.customer_company || "";
  const custPhone = order.customer_phone || order.phone || "";
  const custEmail = order.customer_email || order.email || "";
  const custAddr = [order.delivery_address, order.city, order.delivery_state]
    .filter(Boolean)
    .join(", ");
  const branch = order.branch_name || "";
  const items = order.items || [];

  return (
    <>
      <div className="center">
        <div className="store">{company}</div>
        {address ? <div className="muted">{address}</div> : null}
        {phone ? <div className="muted">Tel: {phone}</div> : null}
        {branch ? <div className="muted">{branch}</div> : null}
        <div className="order-line">
          {packing ? "Packing slip" : "Order"}: #{order.order_no}
        </div>
        <div className="muted">{formatDateTime(order.created_at)}</div>
      </div>

      <hr className="dash" />

      <div className="section">
        <strong>{packing ? "Order info" : "Sale info"}</strong>
        Order #: {order.order_no}
        <br />
        Status: {order.order_status}
        {!packing ? (
          <>
            <br />
            Payment: {order.payment_status}
            {order.payment_method ? (
              <>
                <br />
                Method: {order.payment_method}
              </>
            ) : null}
          </>
        ) : (
          <>
            <br />
            Fulfillment: {order.fulfillment_status || "—"}
          </>
        )}
        {order.order_source ? (
          <>
            <br />
            Channel: {order.order_source}
          </>
        ) : null}
      </div>

      <div className="section">
        <strong>Customer</strong>
        {customerName}
        {custCompany ? (
          <>
            <br />
            Company: {custCompany}
          </>
        ) : null}
        {custPhone ? (
          <>
            <br />
            Phone: {custPhone}
          </>
        ) : null}
        {custEmail ? (
          <>
            <br />
            Email: {custEmail}
          </>
        ) : null}
        {custAddr ? (
          <>
            <br />
            {custAddr}
          </>
        ) : null}
      </div>

      <hr className="dash" />
      {items.map((item, idx) => (
        <div className="item" key={item.id || idx}>
          <div className="item-meta">
            <span>#{idx + 1}</span>
            <span>Qty {item.quantity}</span>
          </div>
          <div className="item-row">
            <span>
              {item.product_name}
              {item.sku ? <div className="item-sub">SKU {item.sku}</div> : null}
            </span>
            {!packing ? <span className="price">{formatPKR(item.total_price)}</span> : null}
          </div>
        </div>
      ))}
      <hr className="dash" />

      {!packing ? (
        <>
          <div className="row">
            <span>Subtotal</span>
            <span>{formatPKR(order.total_amount)}</span>
          </div>
          <div className="row">
            <span>Discount</span>
            <span>-{formatPKR(order.discount_amount)}</span>
          </div>
          <div className="row">
            <span>Delivery</span>
            <span>{formatPKR(order.delivery_charges)}</span>
          </div>
          <div className="row">
            <span>Tax</span>
            <span>{formatPKR(order.tax_amount)}</span>
          </div>
          <hr className="solid" />
          <div className="total-row">
            <span>Total</span>
            <span>{formatPKR(order.payable_amount)}</span>
          </div>
          <div className="copy-label">Customer copy</div>
          <div className="thanks">
            Thank you for shopping with {company}!
            <br />
            We appreciate your business.
            <br />
            Please keep this receipt for your records.
            <br />
            Please come again soon.
          </div>
          <div className="barcode">*{order.order_no}*</div>
          <div className="center muted" style={{ marginTop: 6 }}>
            {company}
          </div>
        </>
      ) : (
        <>
          <div className="section">
            <strong>Items to pack:</strong> {items.length}
          </div>
          <div className="copy-label">Pack carefully · check qty before sealing</div>
          <div className="thanks">
            Thank you for shopping with {company}!
            <br />
            We appreciate your business.
          </div>
          <div className="barcode">*{order.order_no}*</div>
        </>
      )}
    </>
  );
}

function buildInvoicePreview(order, org) {
  const company = org?.company_name || "Company";
  const accent = normalizeAccent(org?.invoice_accent_color);
  const logoUrl = String(org?.logo_url || "").trim();
  const issued = order.created_at
    ? String(order.created_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const dueDate = order.delivery_date ? String(order.delivery_date).slice(0, 10) : issued;
  const billName = order.customer_name || "Walk-in Customer";
  const billCompany = order.customer_company || "";
  const billPhone = order.customer_phone || order.phone || "";
  const billEmail = order.customer_email || order.email || "";
  const billAddr = [order.delivery_address, order.city, order.delivery_state]
    .filter(Boolean)
    .join(", ");
  const fromAddr = org?.company_address || order.branch_name || "";
  const fromPhone = org?.company_phone || "";
  const subtotal = Number(order.total_amount) || 0;
  const discount = Number(order.discount_amount) || 0;
  const delivery = Number(order.delivery_charges) || 0;
  const tax = Number(order.tax_amount) || 0;
  const grand = Number(order.payable_amount) || 0;

  return (
    <div className="inv-sheet" data-accent={accent}>
      <div className="accent-corner" style={{ background: accent }} />
      <div className="inv-body">
        <div className="inv-top">
          <h1 className="inv-title">INVOICE</h1>
          <div className="brand">
            {logoUrl ? <img className="brand-logo" src={logoUrl} alt="" /> : null}
            <div className="brand-name">{company}</div>
          </div>
        </div>

        <div className="inv-meta">
          <div>
            <div className="party-block">
              <p className="party-label">Bill To :</p>
              <p className="party-name">{billName}</p>
              {billCompany ? <p className="party-line">{billCompany}</p> : null}
              {billAddr ? <p className="party-line">{billAddr}</p> : null}
              {billPhone ? <p className="party-line">{billPhone}</p> : null}
              {billEmail ? <p className="party-line">{billEmail}</p> : null}
            </div>
            <div className="party-block">
              <p className="party-label">Bill From :</p>
              <p className="party-name">{company}</p>
              {fromAddr ? <p className="party-line">{fromAddr}</p> : null}
              {fromPhone ? <p className="party-line">{fromPhone}</p> : null}
            </div>
          </div>
          <div className="side-stack">
            <div className="info-chip grand">
              <span className="chip-label">GRAND TOTAL :</span>
              <span className="chip-value">{formatPKR(grand)}</span>
            </div>
            <div className="info-chip">
              <div className="date-grid">
                <div>
                  <span className="chip-label">Invoice Date :</span>
                  <span className="chip-value">{issued}</span>
                </div>
                <div>
                  <span className="chip-label">Due Date :</span>
                  <span className="chip-value">{dueDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <table className="lines">
          <colgroup>
            <col className="col-desc" />
            <col className="col-unit" />
            <col className="col-qty" />
            <col className="col-sub" />
          </colgroup>
          <thead>
            <tr>
              <th className="desc">ITEM DESCRIPTION</th>
              <th className="num">UNIT PRICE</th>
              <th className="num">QUANTITY</th>
              <th className="amt">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.id}>
                <td className="desc">{item.product_name}</td>
                <td className="num">{formatPKR(item.unit_price)}</td>
                <td className="num">{item.quantity}</td>
                <td className="amt">{formatPKR(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="totals-table">
          <colgroup>
            <col className="col-desc" />
            <col className="col-unit" />
            <col className="col-qty" />
            <col className="col-sub" />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} />
              <td className="tot-label">Sub Total :</td>
              <td className="amt">{formatPKR(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={2} />
              <td className="tot-label">Discount :</td>
              <td className="amt">-{formatPKR(discount)}</td>
            </tr>
            <tr>
              <td colSpan={2} />
              <td className="tot-label">Delivery :</td>
              <td className="amt">{formatPKR(delivery)}</td>
            </tr>
            <tr>
              <td colSpan={2} />
              <td className="tot-label">Tax :</td>
              <td className="amt">{formatPKR(tax)}</td>
            </tr>
            <tr className="rule-row grand">
              <td colSpan={2} />
              <td className="tot-label">GRAND TOTAL :</td>
              <td className="amt">{formatPKR(grand)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="inv-footer">
        <p className="disclaimer">
          *This is a computer-generated invoice and does not require any signature
        </p>
      </div>
      <div className="accent-bar" style={{ background: accent }} />
    </div>
  );
}

export default function InvoicePrinting() {
  const { authFetch, user } = useAuth();
  const { canView } = useModulePermission("order-management");
  const [searchParams] = useSearchParams();
  const printRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState(searchParams.get("orderId") || "");
  const [docType, setDocType] = useState("invoice");
  const [order, setOrder] = useState(null);
  const [org, setOrg] = useState({
    company_name: user?.tenant_name || "",
    invoice_accent_color: DEFAULT_ACCENT,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const orderOptions = useMemo(
    () =>
      orders.map((o) => ({
        value: String(o.id),
        label: `${o.order_no} — ${o.customer_name || "No customer"}${o.payable_amount != null ? ` (${formatPKR(o.payable_amount)})` : ""}`,
      })),
    [orders]
  );

  useEffect(() => {
    fetchAllTableRows("/orders", authFetch)
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    apiFetch("/tenant/organization-settings", {}, authFetch)
      .then((res) => {
        const data = res.data || res || {};
        setOrg({
          company_name: data.company_name || user?.tenant_name || "Company",
          logo_url: data.logo_url || "",
          company_address: data.company_address || "",
          company_phone: data.company_phone || "",
          invoice_accent_color: normalizeAccent(data.invoice_accent_color),
        });
      })
      .catch(() => {
        setOrg({
          company_name: user?.tenant_name || "Company",
          invoice_accent_color: DEFAULT_ACCENT,
        });
      });
  }, [authFetch, user?.tenant_name]);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    apiFetch(`/orders/${orderId}`, {}, authFetch)
      .then(setOrder)
      .catch((e) => setError(e.message));
  }, [orderId, authFetch]);

  const docTitle = PRINT_DOC_TYPES.find((d) => d.key === docType)?.label || "Document";
  const isPacking = docType === "packing_slip";
  const isReceipt = docType === "receipt";
  const isInvoice = docType === "invoice";
  const accent = normalizeAccent(org.invoice_accent_color);

  const handlePrint = async () => {
    if (!printRef.current) {
      setError("Select an order before printing.");
      return;
    }
    setError("");
    const styles = isInvoice ? invoiceStyles(accent) : thermalStyles();
    try {
      await printHtml(
        `<!doctype html><html><head><meta charset="utf-8" /><title>${docTitle}</title>
        ${printFontLinks(isInvoice)}
        <style>${styles}</style></head>
        <body>${printRef.current.innerHTML}</body></html>`,
        { title: docTitle, delayMs: 700 }
      );
    } catch (err) {
      setError(err.message || "Unable to print.");
    }
  };

  // Ctrl/Cmd+P should print the document with full styles, not the app chrome.
  useEffect(() => {
    const onKeyDown = (e) => {
      const isPrint = (e.ctrlKey || e.metaKey) && String(e.key || "").toLowerCase() === "p";
      if (!isPrint || !order || !printRef.current) return;
      e.preventDefault();
      handlePrint();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, docType, accent, org]);

  if (!canView) {
    return (
      <div className="wh-page">
        <p className="wh-muted">You do not have permission to print documents.</p>
      </div>
    );
  }

  return (
    <div className="wh-page">
      <FormPageLayout>
        <PageHeader
          title="Invoice & Slip Printing"
          description="Generate invoices, packing slips, and mart-style order receipts."
        />

        <Card className="wh-print-controls">
          <div className="wh-form-grid wh-form-grid--2">
            <SearchableSelect
              id="print-order"
              label="Order"
              options={orderOptions}
              value={orderId}
              onChange={setOrderId}
              placeholder={loading ? "Loading orders…" : "Search by order no or customer…"}
              emptyMessage="No matching orders"
              disabled={loading}
            />
            <FormField
              id="print-doc-type"
              label="Document type"
              as="select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {PRINT_DOC_TYPES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </FormField>
          </div>
          <div className="wh-card__actions">
            <Button onClick={handlePrint} disabled={!order}>
              Print {docTitle}
            </Button>
          </div>
        </Card>

        {error && <p className="wh-field__error">{error}</p>}

        {order ? (
          <div
            ref={printRef}
            className={
              isInvoice
                ? "wh-print-doc wh-print-doc--invoice"
                : isPacking
                  ? "wh-print-doc wh-print-doc--packing"
                  : "wh-print-doc wh-print-doc--receipt"
            }
            style={{
              position: "absolute",
              left: "-10000px",
              top: 0,
              width: isInvoice ? "210mm" : "80mm",
              visibility: "hidden",
              pointerEvents: "none",
              fontFamily: isInvoice ? INVOICE_FONT : MONO_FONT,
            }}
            aria-hidden="true"
          >
            {isInvoice && buildInvoicePreview(order, org)}
            {isReceipt && buildThermalDoc(order, org)}
            {isPacking && buildThermalDoc(order, org, { packing: true })}
          </div>
        ) : null}
      </FormPageLayout>
    </div>
  );
}
