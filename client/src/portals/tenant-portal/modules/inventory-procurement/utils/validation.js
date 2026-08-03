/** Shared client validation for Stock & Purchasing forms. */

export const NOTES_MAX = 255;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isPastDate(dateStr) {
  if (!dateStr) return false;
  return String(dateStr) < todayISO();
}

export function requiredText(value, label) {
  if (value == null || String(value).trim() === "") return `${label} is required`;
  return "";
}

export function notesError(value) {
  if (value == null || value === "") return "";
  if (String(value).length > NOTES_MAX) return `Notes cannot exceed ${NOTES_MAX} characters`;
  return "";
}

export function clampNotes(value) {
  const s = value == null ? "" : String(value);
  return s.length > NOTES_MAX ? s.slice(0, NOTES_MAX) : s;
}

export function positiveQtyError(value, label = "Quantity") {
  if (value === "" || value == null) return `${label} is required`;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return `${label} must be greater than zero`;
  return "";
}

export function nonNegNumberError(value, label, { required = true } = {}) {
  if (value === "" || value == null) {
    return required ? `${label} is required` : "";
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return `${label} must be zero or more`;
  return "";
}

export function expiryError(value) {
  if (!value) return "";
  if (isPastDate(value)) return "Expiry date cannot be in the past";
  return "";
}

export function emailOrDashError(value) {
  const v = String(value || "").trim();
  if (!v) return "Email is required";
  if (v === "-") return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email or -";
  return "";
}

export function stockExceedsError(qty, available, label = "Quantity") {
  const q = Number(qty);
  const a = Number(available);
  if (!Number.isFinite(q) || q <= 0) return "";
  if (!Number.isFinite(a)) return "";
  if (q > a) return `${label} exceeds available stock (${a})`;
  return "";
}

export function hasAnyError(errors) {
  if (!errors) return false;
  return Object.values(errors).some((v) => {
    if (!v) return false;
    if (typeof v === "string") return Boolean(v);
    if (typeof v === "object") return hasAnyError(v);
    return false;
  });
}

/** Show field error only after the user tries to submit (or when a realtime rule applies). */
export function visibleError(attempted, error) {
  return attempted && error ? error : "";
}
