import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../api/client";
import { createTranslator } from "../i18n";
import {
  DEFAULT_LANGUAGE,
  isRtlLanguage,
  normalizeLanguage,
} from "../i18n/languages";

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  t: createTranslator(DEFAULT_LANGUAGE),
  loading: false,
});

function applyDocumentLanguage(language) {
  const lang = normalizeLanguage(language);
  const root = document.documentElement;
  root.lang = lang === "ur" ? "ur" : lang === "roman" || lang === "en_roman" ? "ur-Latn" : "en";
  root.dir = isRtlLanguage(lang) ? "rtl" : "ltr";
}

export function LanguageProvider({ children }) {
  const { user, authFetch } = useAuth();
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(false);

  const loadLanguage = useCallback(() => {
    if (user?.portal !== "tenant") {
      setLanguage(DEFAULT_LANGUAGE);
      applyDocumentLanguage(DEFAULT_LANGUAGE);
      return Promise.resolve();
    }
    setLoading(true);
    return apiFetch("/tenant/organization-settings", {}, authFetch)
      .then((res) => {
        const next = normalizeLanguage(res.data?.language);
        setLanguage(next);
        applyDocumentLanguage(next);
      })
      .catch(() => {
        setLanguage(DEFAULT_LANGUAGE);
        applyDocumentLanguage(DEFAULT_LANGUAGE);
      })
      .finally(() => setLoading(false));
  }, [user?.portal, authFetch]);

  useEffect(() => {
    loadLanguage();
  }, [loadLanguage]);

  useEffect(() => {
    const handler = () => {
      loadLanguage();
    };
    window.addEventListener("tenant-org-updated", handler);
    return () => window.removeEventListener("tenant-org-updated", handler);
  }, [loadLanguage]);

  useEffect(() => {
    return () => {
      applyDocumentLanguage(DEFAULT_LANGUAGE);
    };
  }, []);

  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo(
    () => ({ language, t, loading, reloadLanguage: loadLanguage }),
    [language, t, loading, loadLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}
