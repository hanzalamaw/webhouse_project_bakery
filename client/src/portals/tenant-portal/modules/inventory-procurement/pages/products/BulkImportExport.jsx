import { useState } from "react";
import { useAuth } from "../../../../../../context/AuthContext";
import { apiFetch } from "../../../../../../api/client";
import { PageHeader } from "../../../../../../components/PageHeader";
import { Card } from "../../../../../../components/Card";
import { Button } from "../../../../../../components/Button";

const CSV_HEADERS = [
  "item_name",
  "item_type",
  "sku",
  "unit",
  "cost_price",
  "selling_price",
  "discount",
  "tax",
  "status",
  "category_name",
  "is_purchased",
  "is_produced",
  "is_sold",
  "shelf_life_days",
  "low_stock_threshold",
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

function toCsv(rows) {
  const header = CSV_HEADERS.join(",");
  const body = rows.map((r) =>
    CSV_HEADERS.map((h) => {
      const v = r[h] ?? "";
      return String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : v;
    }).join(",")
  );
  return [header, ...body].join("\n");
}

export default function BulkImportExport() {
  const { authFetch } = useAuth();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await apiFetch("/inventory/items/export", {}, authFetch);
      const csv = toCsv(res.data || []);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bakery-items-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text).map((r) => ({
        ...r,
        is_purchased: r.is_purchased === "1" || r.is_purchased === "true" || r.is_purchased === true,
        is_produced: r.is_produced === "1" || r.is_produced === "true" || r.is_produced === true,
        is_sold: r.is_sold === "1" || r.is_sold === "true" || r.is_sold === true,
      }));
      const res = await apiFetch("/inventory/items/import", { method: "POST", body: JSON.stringify({ rows }) }, authFetch);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = () => {
    const sample = [{
      item_name: "Maida",
      item_type: "ingredient",
      sku: "ING-001",
      unit: "kg",
      cost_price: "120",
      selling_price: "0",
      discount: "0",
      tax: "0",
      status: "active",
      category_name: "Flours",
      is_purchased: "1",
      is_produced: "0",
      is_sold: "0",
      shelf_life_days: "90",
      low_stock_threshold: "10",
    }];
    const blob = new Blob([toCsv(sample)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bakery-items-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="wh-page wh-inv-import-export">
      <PageHeader title="Bulk Import / Export" description="Export your bakery items or import from CSV." />

      <div className="wh-inv-import-export__grid">
        <Card>
          <h3 className="wh-card__title">Export items</h3>
          <p className="wh-card__text">
            Download all items with type, pricing, flags, and stock totals as CSV.
          </p>
          <div className="wh-card__actions">
            <Button onClick={handleExport} disabled={exporting}>{exporting ? "Exporting…" : "Export CSV"}</Button>
          </div>
        </Card>

        <Card>
          <h3 className="wh-card__title">Import items</h3>
          <p className="wh-card__text">
            Upload a CSV. Required: item_name, category_name. Optional: item_type, sku, unit, prices, flags, shelf_life_days.
          </p>
          <div className="wh-card__actions">
            <Button variant="secondary" onClick={downloadTemplate}>Download template</Button>
            <label className="wh-btn wh-btn--primary" style={{ cursor: "pointer" }}>
              {importing ? "Importing…" : "Choose CSV file"}
              <input type="file" accept=".csv,text/csv" onChange={handleFile} disabled={importing} style={{ display: "none" }} />
            </label>
          </div>
        </Card>
      </div>

      {error && <p className="wh-field__error wh-inv-import-export__error">{error}</p>}
      {result && (
        <Card className="wh-inv-import-export__results">
          <h3 className="wh-card__title">Import results</h3>
          <p className="wh-card__text">Created: {result.created} · Skipped: {result.skipped}</p>
          {result.errors?.length > 0 && (
            <ul className="wh-list">
              {result.errors.map((err, i) => (
                <li key={i}>Row {err.row}: {err.message}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
