import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";
import { PageHeader } from "../../../../../components/PageHeader";
import { KpiCard, Panel } from "../../../../../components/KpiPanel";
import { DashboardFilter } from "../../../../../components/DashboardFilter";
import { EMPTY_DASHBOARD_FILTER, filterRowsByDashboard } from "../../../../../utils/dashboardFilter";
import { useFiscalYear } from "../../../../../context/FiscalYearContext";
import { HBars, DonutChart, CHART_COLORS } from "../../../../../components/charts";
import { formatPKR, formatCompactPKR } from "../../../../../utils/currency";
import { formatDateTime, formatDate } from "../../../../../utils/dateTime";
import { useT } from "../../../../../context/LanguageContext";
import { MOVEMENT_LABELS, ITEM_TYPE_LABELS, MODULE_BASE } from "../constants";
import { ProductIcon, WarehouseIcon, ProcurementIcon, LogsIcon } from "../../../../../components/icons";



export default function InventoryDashboard() {
  const { authFetch } = useAuth();
  const t = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dashFilter, setDashFilter] = useState({ ...EMPTY_DASHBOARD_FILTER });
  const fiscalYearStart = useFiscalYear();

  useEffect(() => {
    apiFetch("/inventory/dashboard", {}, authFetch)
      .then((res) => {
        setData(res);
        setLoadError("");
      })
      .catch((e) => {
        setData(null);
        setLoadError(e.message || "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [authFetch]);

  const stats = data?.stats || {};
  const movements = data?.recent_movements || [];
  const lowStock = data?.low_stock_items || [];
  const expiring = data?.expiring_batches || [];
  const stockByBranch = data?.stock_by_branch || [];

  const filteredMovements = useMemo(
    () => filterRowsByDashboard(movements, "created_at", dashFilter, fiscalYearStart),
    [movements, dashFilter, fiscalYearStart]
  );

  const dash = (n) => (loading ? "—" : n ?? 0);
  const money = (n) => (loading ? "—" : formatPKR(n));
  const num = (n) => (loading ? "—" : Number(n || 0).toLocaleString());

  const itemTypeSegments = useMemo(
    () =>
      [
        { label: t(ITEM_TYPE_LABELS.ingredient), value: Number(stats.ingredient_count) || 0, color: CHART_COLORS[0] },
        { label: t(ITEM_TYPE_LABELS.finished), value: Number(stats.finished_count) || 0, color: CHART_COLORS[1] },
        { label: t(ITEM_TYPE_LABELS.packaging), value: Number(stats.packaging_count) || 0, color: CHART_COLORS[2] },
      ].filter((s) => s.value > 0),
    [stats, t]
  );

  const branchBars = useMemo(
    () =>
      stockByBranch.map((row, i) => ({
        label: row.label,
        value: Number(row.available_qty) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [stockByBranch]
  );

  const branchValueBars = useMemo(
    () =>
      stockByBranch.map((row, i) => ({
        label: row.label,
        value: Number(row.value_cost) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [stockByBranch]
  );

  const quickLinks = useMemo(
    () => [
      { label: "Create Item", path: `${MODULE_BASE}/items/create` },
      { label: "Stock In", path: `${MODULE_BASE}/stock/stock-in/create` },
      { label: "Stock Out", path: `${MODULE_BASE}/stock/stock-out/create` },
      { label: "Transfers", path: `${MODULE_BASE}/stock/transfers/create` },
      { label: "Purchase Order", path: `${MODULE_BASE}/purchasing/purchase-orders/create` },
      { label: "Batches / Expiry", path: `${MODULE_BASE}/stock/batches` },
      { label: "Wastage", path: `${MODULE_BASE}/wastage` },
    ],
    []
  );

  if (loading) {
    return (
      <div className="wh-page wh-page--wide">
        <p className="wh-muted">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Stock & Purchasing"
        description="Bakery stock overview — items, purchases, expiry, and wastage."
      />

      {loadError && <p className="wh-field__error">{loadError}</p>}

      <DashboardFilter
        rows={movements}
        dateField="created_at"
        value={dashFilter}
        onChange={setDashFilter}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <KpiCard
            label="Items (Cheezen)"
            value={dash(stats.item_count)}
            hint={`${dash(stats.ingredient_count)} ingredients · ${dash(stats.finished_count)} finished · ${dash(stats.packaging_count)} packing`}
            tone="accent"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Branches"
            value={dash(stats.branch_count)}
            hint={`${dash(stats.category_count)} categories`}
            icon={<WarehouseIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Suppliers"
            value={dash(stats.supplier_count)}
            hint={`${dash(stats.open_purchase_orders)} open POs`}
            icon={<ProcurementIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Low stock"
            value={dash(stats.low_stock_count)}
            hint={`${dash(stats.expiring_soon)} expiring · ${dash(stats.expired_batches)} expired`}
            tone={Number(stats.low_stock_count) > 0 ? "danger" : "default"}
            icon={<LogsIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-4">
          <KpiCard label="Available stock" value={num(stats.total_available)} hint="Units across all branches" tone="success" />
        </div>
        <div className="wh-dash-col-4">
          <KpiCard label="Stock value (cost)" value={money(stats.stock_value_cost)} hint="Available × cost price" />
        </div>
        <div className="wh-dash-col-4">
          <KpiCard label="Wastage (30 days)" value={money(stats.wastage_cost_30d)} hint="Wastage cost" tone="warning" />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-4">
          <Panel title="Items by type">
            {itemTypeSegments.length ? (
              <DonutChart
                segments={itemTypeSegments}
                centerValue={Number(stats.item_count) || 0}
                centerLabel="items"
              />
            ) : (
              <p className="wh-panel__empty">No items yet.</p>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Stock by branch" subtitle="Available units">
            {branchBars.length ? (
              <HBars data={branchBars} formatValue={(v) => v.toLocaleString()} />
            ) : (
              <p className="wh-panel__empty">No branch stock yet.</p>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Value by branch" subtitle="At cost">
            {branchValueBars.length ? (
              <HBars data={branchValueBars} formatValue={formatCompactPKR} />
            ) : (
              <p className="wh-panel__empty">No value data.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-4">
          <Panel
            title="Recent movements"
            subtitle="Latest stock activity"
            flush
            action={
              <Link to={`${MODULE_BASE}/stock/movement-history`} className="wh-link">
                View all
              </Link>
            }
          >
            {filteredMovements.length === 0 ? (
              <p className="wh-panel__empty">No movements in this range.</p>
            ) : (
              <div className="wh-mini-list">
                {filteredMovements.map((m) => (
                  <div key={m.id} className="wh-mini-row">
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">{m.item_name}</div>
                      <div className="wh-mini-row__sub">
                        {MOVEMENT_LABELS[m.movement_type] || m.movement_type} · {m.branch_name} ·{" "}
                        {formatDateTime(m.created_at)}
                      </div>
                    </div>
                    <span className="wh-mini-row__value">{m.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel
            title="Low stock alert"
            subtitle="Below threshold"
            flush
            action={
              <Link to={`${MODULE_BASE}/items/manage`} className="wh-link">
                Manage items
              </Link>
            }
          >
            {lowStock.length === 0 ? (
              <p className="wh-panel__empty">All items look fine.</p>
            ) : (
              <div className="wh-mini-list">
                {lowStock.map((p) => (
                  <div key={p.id} className="wh-mini-row">
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">{p.item_name}</div>
                      <div className="wh-mini-row__sub">
                        {p.sku || p.unit} · alert at {p.low_stock_threshold}
                      </div>
                    </div>
                    <span className="wh-mini-row__value" style={{ color: "var(--color-danger)" }}>
                      {Number(p.available_qty).toLocaleString()} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel
            title="Expiring soon"
            subtitle="Within 7 days"
            flush
            action={
              <Link to={`${MODULE_BASE}/stock/batches`} className="wh-link">
                Batches
              </Link>
            }
          >
            {expiring.length === 0 ? (
              <p className="wh-panel__empty">Nothing expiring soon.</p>
            ) : (
              <div className="wh-mini-list">
                {expiring.map((b) => (
                  <div key={b.id} className="wh-mini-row">
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">{b.item_name}</div>
                      <div className="wh-mini-row__sub">
                        {b.batch_no} · {b.branch_name} · {b.expiry_date ? formatDate(b.expiry_date) : "—"}
                      </div>
                    </div>
                    <span className="wh-mini-row__value">{b.qty_remaining}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-12">
          <Panel title="Quick actions">
            <ul className="wh-list">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="wh-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
