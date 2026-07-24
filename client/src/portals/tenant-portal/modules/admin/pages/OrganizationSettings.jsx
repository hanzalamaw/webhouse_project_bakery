import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "../../../../../components/PageHeader";
import { FormField } from "../../../../../components/FormField";
import { Button } from "../../../../../components/Button";
import { FormBlock } from "../../../../../components/FormBlock";
import { FormPageLayout, FormPageAlerts, FormActions } from "../../../../../components/FormPageLayout";
import { SearchableSelect } from "../../../../../components/SearchableSelect";
import { useAuth } from "../../../../../context/AuthContext";
import { useT } from "../../../../../context/LanguageContext";
import { useModulePermission } from "../../../../../hooks/useModulePermission";
import { useReferenceData, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../../../../../hooks/useReferenceData";
import { apiFetch } from "../../../../../api/client";
import { useUnsavedChangesGuard } from "../../../../../hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "../../../../../components/UnsavedChangesDialog";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE, normalizeLanguage } from "../../../../../i18n/languages";
import {
  fiscalToStorage,
  fiscalFromStorage,
  calcFiscalYearEnd,
} from "../../../../../utils/billing";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function MonthDayFields({ month, day, onChange, idPrefix, disabled = false, t }) {
  const daysInMonth = new Date(2000, month, 0).getDate();
  return (
    <div className="wh-month-day-row">
      <FormField
        id={`${idPrefix}_month`}
        as="select"
        value={month}
        onChange={(e) => onChange(Number(e.target.value), day)}
        aria-label={t("org.month")}
        disabled={disabled}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </FormField>
      <FormField
        id={`${idPrefix}_day`}
        as="select"
        value={day}
        onChange={(e) => onChange(month, Number(e.target.value))}
        aria-label={t("org.day")}
        disabled={disabled}
      >
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </FormField>
    </div>
  );
}

const EMPTY_FORM = {
  company_name: "",
  logo_url: "",
  timezone: DEFAULT_TIMEZONE,
  currency: DEFAULT_CURRENCY,
  language: DEFAULT_LANGUAGE,
  fiscal_year_start: fiscalToStorage(1, 1),
  fiscal_year_end: fiscalToStorage(12, 31),
};

export default function OrganizationSettings() {
  const { authFetch } = useAuth();
  const t = useT();
  const { canEdit } = useModulePermission("admin");
  const { currencies, timezones, loading: refLoading } = useReferenceData();
  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/tenant/organization-settings", {}, authFetch)
      .then((res) => {
        const data = res.data || {};
        const next = {
          company_name: data.company_name || "",
          logo_url: data.logo_url || "",
          timezone: data.timezone || DEFAULT_TIMEZONE,
          currency: data.currency || DEFAULT_CURRENCY,
          language: normalizeLanguage(data.language),
          fiscal_year_start: data.fiscal_year_start || fiscalToStorage(1, 1),
          fiscal_year_end: data.fiscal_year_end || fiscalToStorage(12, 31),
        };
        setForm(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((err) => setError(err.message || t("org.loadFailed")))
      .finally(() => setLoading(false));
  }, [authFetch, t]);

  useEffect(() => {
    load();
  }, [load]);

  const setFiscalStart = (month, day) => {
    const start = fiscalToStorage(month, day);
    setForm((f) => ({
      ...f,
      fiscal_year_start: start,
      fiscal_year_end: calcFiscalYearEnd(start),
    }));
  };

  const isDirty = useMemo(
    () => baseline !== null && JSON.stringify(form) !== baseline,
    [baseline, form]
  );
  const { dialogOpen, stayOnPage, leavePage } = useUnsavedChangesGuard(isDirty, { enabled: !loading });

  const save = async () => {
    if (!form.company_name.trim()) {
      setError(t("org.companyNameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(
        "/tenant/organization-settings",
        {
          method: "PUT",
          body: JSON.stringify({
            company_name: form.company_name.trim(),
            logo_url: form.logo_url.trim() || null,
            timezone: form.timezone || DEFAULT_TIMEZONE,
            currency: form.currency || DEFAULT_CURRENCY,
            language: normalizeLanguage(form.language),
            fiscal_year_start: form.fiscal_year_start,
            fiscal_year_end: form.fiscal_year_end,
          }),
        },
        authFetch
      );
      setMessage(t("org.saved"));
      setBaseline(JSON.stringify(form));
      window.dispatchEvent(new CustomEvent("tenant-org-updated"));
    } catch (err) {
      setError(err.message || t("org.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wh-page">
      <FormPageLayout wide>
        <PageHeader
          title={t("org.title")}
          description={t("org.description")}
        />
        {loading ? (
          <p className="wh-muted">{t("common.loading")}</p>
        ) : (
          <form
            className="wh-form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <FormPageAlerts error={error} message={message} />
            <FormBlock title={t("org.companyProfile")} description={t("org.companyProfileDesc")}>
              <div className="wh-form-grid">
                <FormField
                  id="company_name"
                  label={t("org.companyName")}
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  required
                  disabled={!canEdit}
                />
                <FormField
                  id="logo_url"
                  label={t("org.logoUrl")}
                  value={form.logo_url}
                  onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  disabled={!canEdit}
                />
                {form.logo_url && (
                  <div className="wh-logo-preview wh-form-grid__full">
                    <span className="wh-field__label">{t("org.logoPreview")}</span>
                    <img
                      src={form.logo_url}
                      alt="Organization logo"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <SearchableSelect
                  id="timezone"
                  label={t("org.timezone")}
                  value={form.timezone}
                  onChange={(v) => setForm((f) => ({ ...f, timezone: v || DEFAULT_TIMEZONE }))}
                  options={timezones}
                  loading={refLoading}
                  disabled={!canEdit}
                />
                <SearchableSelect
                  id="currency"
                  label={t("org.currency")}
                  value={form.currency}
                  onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  options={currencies}
                  loading={refLoading}
                  disabled={!canEdit}
                />
                <FormField
                  id="language"
                  label={t("org.language")}
                  as="select"
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  disabled={!canEdit}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </FormField>
              </div>
            </FormBlock>
            <FormBlock title={t("org.fiscalYear")} description={t("org.fiscalYearDesc")}>
              <div className="wh-form-grid">
                <div className="wh-field">
                  <span className="wh-field__label">{t("org.fiscalYearStart")}</span>
                  <MonthDayFields
                    idPrefix="fys"
                    {...fiscalFromStorage(form.fiscal_year_start)}
                    onChange={setFiscalStart}
                    disabled={!canEdit}
                    t={t}
                  />
                </div>
                <div className="wh-field">
                  <span className="wh-field__label">{t("org.fiscalYearEnd")}</span>
                  <MonthDayFields
                    idPrefix="fye"
                    {...fiscalFromStorage(form.fiscal_year_end)}
                    onChange={() => {}}
                    disabled
                    t={t}
                  />
                  <p className="wh-muted" style={{ marginTop: 6 }}>
                    {t("org.fiscalYearHint")}
                  </p>
                </div>
              </div>
            </FormBlock>
            <FormActions>
              <Button type="submit" disabled={!canEdit || saving}>
                {saving ? t("common.saving") : t("common.saveSettings")}
              </Button>
            </FormActions>
          </form>
        )}
      </FormPageLayout>
      <UnsavedChangesDialog open={dialogOpen} onStay={stayOnPage} onDiscard={leavePage} />
    </div>
  );
}
