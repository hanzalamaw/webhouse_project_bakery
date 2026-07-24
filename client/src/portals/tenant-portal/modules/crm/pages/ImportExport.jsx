import { useState } from "react";
import { useAuth } from "../../../../../context/AuthContext";
import { useModulePermission } from "../../../../../hooks/useModulePermission";
import { apiFetch } from "../../../../../api/client";
import { PageHeader } from "../../../../../components/PageHeader";
import { Card } from "../../../../../components/Card";
import { Button } from "../../../../../components/Button";
import {
  CUSTOMER_CSV_HEADERS,
  parseCsv,
  downloadCsv,
} from "../utils/csv";

const CUSTOMER_TEMPLATE_ROW = {
  customer_name: "Ali Khan",
  company_name: "Metro Store",
  customer_type: "retailer",
  phone: "03001112222",
  email: "ali@example.com",
  status: "active",
  tags: "vip|lahore",
  note: "Preferred contact via phone",
  billing_address: "12 Main Street",
  billing_city: "Lahore",
  billing_state: "Punjab",
  billing_postal_code: "54000",
};

function ImportResultCard({ title, result }) {
  if (!result) return null;
  return (
    <Card className="wh-inv-import-export__results">
      <h3 className="wh-card__title">{title}</h3>
      <p className="wh-card__text">
        Created: {result.created ?? 0}
        {result.updated != null && ` · Updated: ${result.updated}`}
        {result.skipped != null && ` · Skipped empty rows: ${result.skipped}`}
      </p>
      {result.errors?.length > 0 && (
        <ul className="wh-list">
          {result.errors.map((err) => (
            <li key={`err-${err.row}-${err.message}`}>Row {err.row}: {err.message}</li>
          ))}
        </ul>
      )}
      {result.warnings?.length > 0 && (
        <ul className="wh-list wh-inv-import-export__warnings">
          {result.warnings.map((w) => (
            <li key={`warn-${w.row}-${w.message}`}>Row {w.row}: {w.message}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ImportExport() {
  const { authFetch } = useAuth();
  const { canCreate, canExport } = useModulePermission("crm");
  const [customerExporting, setCustomerExporting] = useState(false);
  const [customerImporting, setCustomerImporting] = useState(false);
  const [customerResult, setCustomerResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const dateStamp = new Date().toISOString().slice(0, 10);

  const exportCustomers = async () => {
    if (!canExport) return;
    setCustomerExporting(true);
    setError("");
    try {
      const res = await apiFetch("/crm/customers/export", {}, authFetch);
      downloadCsv(`crm-customers-${dateStamp}.csv`, CUSTOMER_CSV_HEADERS, res.data || []);
      setMessage("Customers export downloaded.");
    } catch (e) {
      setError(e.message);
    } finally {
      setCustomerExporting(false);
    }
  };

  const importCustomers = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !canCreate) return;
    setCustomerImporting(true);
    setError("");
    setMessage("");
    setCustomerResult(null);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) throw new Error("CSV file has no data rows");
      const res = await apiFetch("/crm/customers/import", { method: "POST", body: JSON.stringify({ rows }) }, authFetch);
      setCustomerResult(res);
      setMessage(`Customers import finished: ${res.created} created, ${res.updated} updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCustomerImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="wh-page wh-inv-import-export">
      <PageHeader
        title="Import / Export"
        description="Bulk import or export customers as CSV. Customer import updates existing records when phone or email matches."
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}
      {message && <div className="wh-alert wh-alert--success">{message}</div>}

      <div className="wh-inv-import-export__grid">
        <Card>
          <h3 className="wh-card__title">Export customers</h3>
          <p className="wh-card__text">
            Download all customers with type, status, tags, summary note, and default billing address fields.
          </p>
          <div className="wh-card__actions">
            {canExport ? (
              <Button onClick={exportCustomers} disabled={customerExporting}>
                {customerExporting ? "Exporting…" : "Export CSV"}
              </Button>
            ) : (
              <p className="wh-muted">Export requires CRM export permission.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="wh-card__title">Import customers</h3>
          <p className="wh-card__text">
            Upload a CSV file. Required: <strong>customer_name</strong>. If phone or email matches an existing customer, that record is updated instead of duplicated.
          </p>
          <p className="wh-card__text wh-muted wh-inv-import-export__note">
            Tags use pipe separator (e.g. vip|wholesale). Billing address columns create a default address when none exists.
          </p>
          <div className="wh-card__actions">
            <Button
              variant="secondary"
              onClick={() => downloadCsv("crm-customers-import-template.csv", CUSTOMER_CSV_HEADERS, [CUSTOMER_TEMPLATE_ROW])}
            >
              Download template
            </Button>
            {canCreate ? (
              <label className="wh-btn wh-btn--primary" style={{ cursor: "pointer" }}>
                {customerImporting ? "Importing…" : "Choose CSV file"}
                <input type="file" accept=".csv,text/csv" onChange={importCustomers} disabled={customerImporting} style={{ display: "none" }} />
              </label>
            ) : (
              <p className="wh-muted">Import requires CRM create permission.</p>
            )}
          </div>
        </Card>
      </div>

      <ImportResultCard title="Customer import results" result={customerResult} />
    </div>
  );
}
