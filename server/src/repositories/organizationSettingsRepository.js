import { readDb, writeDb } from "../database/db.js";
import { normalizeLanguage } from "../constants/languages.js";

const DEFAULT_ACCENT = "#E11D48";

export function normalizeAccentColor(hex) {
  const raw = String(hex || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return DEFAULT_ACCENT;
}

function withDefaults(row) {
  if (!row) return null;
  return {
    ...row,
    language: normalizeLanguage(row.language),
    invoice_accent_color: normalizeAccentColor(row.invoice_accent_color),
    company_address: row.company_address || "",
    company_phone: row.company_phone || "",
  };
}

export const organizationSettingsRepository = {
  async getByTenant(tenantId) {
    try {
      const [rows] = await readDb.query(
        `SELECT company_name, logo_url, invoice_accent_color, company_address, company_phone,
                timezone, currency, language, fiscal_year_start, fiscal_year_end
         FROM organization_settings
         WHERE tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
        [tenantId]
      );
      return withDefaults(rows[0] || null);
    } catch (err) {
      // Older DBs may not have branding columns yet — fall back.
      if (err?.code !== "ER_BAD_FIELD_ERROR") throw err;
      const [rows] = await readDb.query(
        `SELECT company_name, logo_url, timezone, currency, language, fiscal_year_start, fiscal_year_end
         FROM organization_settings
         WHERE tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
        [tenantId]
      );
      return withDefaults(rows[0] || null);
    }
  },

  async upsert(tenantId, data) {
    const accent = normalizeAccentColor(data.invoice_accent_color);
    const address = data.company_address || null;
    const phone = data.company_phone || null;
    try {
      await writeDb.query(
        `INSERT INTO organization_settings
         (company_name, logo_url, invoice_accent_color, company_address, company_phone,
          timezone, currency, language, fiscal_year_start, fiscal_year_end, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           company_name = VALUES(company_name),
           logo_url = VALUES(logo_url),
           invoice_accent_color = VALUES(invoice_accent_color),
           company_address = VALUES(company_address),
           company_phone = VALUES(company_phone),
           timezone = VALUES(timezone),
           currency = VALUES(currency),
           language = VALUES(language),
           fiscal_year_start = VALUES(fiscal_year_start),
           fiscal_year_end = VALUES(fiscal_year_end),
           deleted_at = NULL`,
        [
          data.company_name,
          data.logo_url || null,
          accent,
          address,
          phone,
          data.timezone || "Asia/Karachi",
          data.currency || null,
          normalizeLanguage(data.language),
          data.fiscal_year_start || null,
          data.fiscal_year_end || null,
          tenantId,
        ]
      );
    } catch (err) {
      if (err?.code !== "ER_BAD_FIELD_ERROR") throw err;
      await writeDb.query(
        `INSERT INTO organization_settings
         (company_name, logo_url, timezone, currency, language, fiscal_year_start, fiscal_year_end, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           company_name = VALUES(company_name),
           logo_url = VALUES(logo_url),
           timezone = VALUES(timezone),
           currency = VALUES(currency),
           language = VALUES(language),
           fiscal_year_start = VALUES(fiscal_year_start),
           fiscal_year_end = VALUES(fiscal_year_end),
           deleted_at = NULL`,
        [
          data.company_name,
          data.logo_url || null,
          data.timezone || "Asia/Karachi",
          data.currency || null,
          normalizeLanguage(data.language),
          data.fiscal_year_start || null,
          data.fiscal_year_end || null,
          tenantId,
        ]
      );
    }
  },
};
