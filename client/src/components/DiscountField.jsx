import { useEffect, useState } from "react";
import { useT } from "../context/LanguageContext";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function toAmountFromPercent(percent, base) {
  const p = Number(percent);
  const b = Number(base);
  if (!Number.isFinite(p) || !Number.isFinite(b) || b <= 0) return 0;
  return round2((p / 100) * b);
}

function toPercentFromAmount(amount, base) {
  const a = Number(amount);
  const b = Number(base);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return round2((a / b) * 100);
}

/**
 * Discount entry with Rs / % toggle.
 * Parent always receives and stores the PKR amount (DB stays amount-only).
 * When % is typed, shows the calculated rupees; when Rs is typed, shows the calculated %.
 */
export function DiscountField({
  id,
  label = "Discount",
  value,
  onChange,
  baseAmount = 0,
  disabled = false,
  required = false,
  className = "",
  compact = false,
}) {
  const t = useT();
  const [mode, setMode] = useState("rs"); // "rs" | "percent"
  const [percentInput, setPercentInput] = useState("");

  const amount = Number(value) || 0;
  const base = Math.max(0, Number(baseAmount) || 0);
  const derivedPercent = toPercentFromAmount(amount, base);
  const derivedAmount = toAmountFromPercent(percentInput, base);

  // Re-sync percent display when the PKR amount or base changes from outside
  // (e.g. quantity change), but not while the user is actively editing percent.
  useEffect(() => {
    if (mode !== "percent") return;
    if (typeof document !== "undefined" && document.activeElement?.id === id) return;
    setPercentInput(base > 0 ? String(derivedPercent) : amount > 0 ? "" : "0");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, amount, base, id]);

  const switchMode = (next) => {
    if (next === mode) return;
    if (next === "percent") {
      setPercentInput(base > 0 ? String(toPercentFromAmount(amount, base)) : "");
    }
    setMode(next);
  };

  const handleAmountChange = (raw) => {
    onChange?.(raw);
  };

  const handlePercentChange = (raw) => {
    setPercentInput(raw);
    if (raw === "" || raw == null) {
      onChange?.("0");
      return;
    }
    onChange?.(String(toAmountFromPercent(raw, base)));
  };

  const inputValue = mode === "percent" ? percentInput : value ?? "";
  const hint =
    mode === "percent"
      ? base > 0
        ? `= Rs ${derivedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        : "Enter a base amount first"
      : base > 0 && amount > 0
        ? `= ${derivedPercent}%`
        : null;

  const labelText = typeof label === "string" ? t(label) : label;

  return (
    <div className={`wh-field wh-discount-field${className ? ` ${className}` : ""}${disabled ? " wh-discount-field--disabled" : ""}`}>
      {labelText ? (
        <label className="wh-field__label" htmlFor={id}>
          {labelText}
        </label>
      ) : null}
      <div className={`wh-discount-field__row${compact ? " wh-discount-field__row--compact" : ""}`}>
        <div className="wh-discount-field__modes" role="group" aria-label={t("Discount type")}>
          <button
            type="button"
            className={`wh-discount-field__mode${mode === "rs" ? " is-active" : ""}`}
            onClick={() => switchMode("rs")}
            disabled={disabled}
            aria-pressed={mode === "rs"}
          >
            Rs
          </button>
          <button
            type="button"
            className={`wh-discount-field__mode${mode === "percent" ? " is-active" : ""}`}
            onClick={() => switchMode("percent")}
            disabled={disabled}
            aria-pressed={mode === "percent"}
          >
            %
          </button>
        </div>
        <input
          id={id}
          type="number"
          min="0"
          step="0.01"
          max={mode === "percent" ? "100" : undefined}
          className="wh-field__input"
          value={inputValue}
          onChange={(e) =>
            mode === "percent" ? handlePercentChange(e.target.value) : handleAmountChange(e.target.value)
          }
          disabled={disabled}
          required={required}
          inputMode="decimal"
        />
      </div>
      {hint ? <span className="wh-discount-field__hint">{hint}</span> : null}
    </div>
  );
}
