/** Encode payment destination for a single "Payment via" select (cash or bank account). */

export function encodePaymentVia({ payment_method, bank_account_id }) {
  if (payment_method === "bank_transfer" && bank_account_id) {
    return `bank:${bank_account_id}`;
  }
  return "cash";
}

export function parsePaymentVia(value) {
  if (!value || value === "cash") {
    return { payment_method: "cash", bank_account_id: null };
  }
  if (String(value).startsWith("bank:")) {
    const id = Number(String(value).slice(5));
    return {
      payment_method: "bank_transfer",
      bank_account_id: Number.isFinite(id) && id > 0 ? id : null,
    };
  }
  return { payment_method: value, bank_account_id: null };
}

export function formatBankAccountLabel(account) {
  if (!account) return "—";
  const bank = account.bank_name || "";
  const title = account.account_title || "";
  const number = account.account_number || "";
  if (bank || title || number) {
    return `${bank}${bank && title ? " — " : ""}${title}${number ? ` (${number})` : ""}`.trim() || "—";
  }
  return "—";
}

/** Display label for expense / payment destination (cash or bank). */
export function formatPaymentViaLabel(row, methodLabels = {}) {
  if (!row) return "—";
  if (row.bank_account_id && (row.bank_name || row.account_title || row.account_number)) {
    return formatBankAccountLabel(row);
  }
  const method = row.payment_method || "cash";
  return methodLabels[method] || method || "—";
}
