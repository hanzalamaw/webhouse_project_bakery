import { useMemo } from "react";
import { formatCompactPKR, formatPKR } from "../utils/currency";

/** Money helpers for bakery ERP (PKR). */
export function useMoney() {
  return useMemo(
    () => ({
      currency: "PKR",
      prefix: "Rs.",
      fieldSuffix: "(Rs.)",
      format: (amount) => formatPKR(amount),
      formatCompact: (amount) => formatCompactPKR(amount),
      amountLabel: (base = "Amount") => `${base} (Rs.)`,
    }),
    []
  );
}
