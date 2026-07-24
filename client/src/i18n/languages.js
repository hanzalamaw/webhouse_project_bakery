/** Tenant UI language modes stored in organization_settings.language */

export const LANGUAGE_CODES = {
  EN: "en",
  EN_UR: "en_ur",
  ROMAN: "roman",
  EN_ROMAN: "en_roman",
  UR: "ur",
};

/** Options for WH tenant create/edit and tenant Organization Settings */
export const LANGUAGE_OPTIONS = [
  { value: LANGUAGE_CODES.EN, label: "English" },
  { value: LANGUAGE_CODES.EN_UR, label: "English and Urdu" },
  { value: LANGUAGE_CODES.ROMAN, label: "Roman Urdu" },
  { value: LANGUAGE_CODES.EN_ROMAN, label: "English and Roman Urdu" },
  { value: LANGUAGE_CODES.UR, label: "Urdu" },
];

export const DEFAULT_LANGUAGE = LANGUAGE_CODES.EN;

const VALID = new Set(LANGUAGE_OPTIONS.map((o) => o.value));

export function normalizeLanguage(value) {
  const raw = String(value || "").trim();
  if (VALID.has(raw)) return raw;
  // Legacy / loose values
  if (raw === "urdu") return LANGUAGE_CODES.UR;
  if (raw === "en-ur" || raw === "en+ur") return LANGUAGE_CODES.EN_UR;
  if (raw === "en-roman" || raw === "en+roman") return LANGUAGE_CODES.EN_ROMAN;
  if (raw === "ur-Latn" || raw === "roman_urdu") return LANGUAGE_CODES.ROMAN;
  return DEFAULT_LANGUAGE;
}

export function languageLabel(code) {
  const normalized = normalizeLanguage(code);
  return LANGUAGE_OPTIONS.find((o) => o.value === normalized)?.label || normalized;
}

export function isRtlLanguage(code) {
  return normalizeLanguage(code) === LANGUAGE_CODES.UR;
}

export function isBilingual(code) {
  const n = normalizeLanguage(code);
  return n === LANGUAGE_CODES.EN_UR || n === LANGUAGE_CODES.EN_ROMAN;
}

/** Which dictionary packs to combine for a language mode */
export function languageParts(code) {
  const n = normalizeLanguage(code);
  if (n === LANGUAGE_CODES.EN) return ["en"];
  if (n === LANGUAGE_CODES.UR) return ["ur"];
  if (n === LANGUAGE_CODES.ROMAN) return ["roman"];
  if (n === LANGUAGE_CODES.EN_UR) return ["en", "ur"];
  if (n === LANGUAGE_CODES.EN_ROMAN) return ["en", "roman"];
  return ["en"];
}
