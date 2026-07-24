/**
 * Shared language codes for tenant organization_settings.language
 * (kept in sync with client/src/i18n/languages.js).
 */

export const LANGUAGE_CODES = ["en", "en_ur", "roman", "en_roman", "ur"];

const LEGACY = {
  urdu: "ur",
  "en-ur": "en_ur",
  "en+ur": "en_ur",
  "en-roman": "en_roman",
  "en+roman": "en_roman",
  "ur-Latn": "roman",
  roman_urdu: "roman",
};

export function normalizeLanguage(value) {
  const raw = String(value || "").trim();
  if (LANGUAGE_CODES.includes(raw)) return raw;
  if (LEGACY[raw]) return LEGACY[raw];
  return "en";
}
