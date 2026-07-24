import { messages } from "./messages";
import { languageParts, normalizeLanguage } from "./languages";

const BILINGUAL_SEP = " / ";

function lookup(pack, key) {
  const dict = messages[pack];
  if (!dict) return null;
  return dict[key] ?? null;
}

/**
 * Translate a key for the tenant language mode.
 * Bilingual modes join both packs with " / " when texts differ.
 */
export function translate(key, language, vars) {
  const parts = languageParts(language);
  const texts = parts
    .map((pack) => lookup(pack, key))
    .filter((v) => v != null && v !== "");

  let out;
  if (texts.length === 0) {
    out = lookup("en", key) || key;
  } else if (texts.length === 1) {
    out = texts[0];
  } else if (texts[0] === texts[1]) {
    out = texts[0];
  } else {
    out = texts.join(BILINGUAL_SEP);
  }

  if (vars && typeof out === "string") {
    out = out.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      vars[name] != null ? String(vars[name]) : ""
    );
  }
  return out;
}

export function createTranslator(language) {
  const lang = normalizeLanguage(language);
  return (key, vars) => translate(key, lang, vars);
}
