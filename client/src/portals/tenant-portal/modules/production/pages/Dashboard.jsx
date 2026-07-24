import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";
import { PageHeader } from "../../../../../components/PageHeader";
import { DashboardFilter } from "../../../../../components/DashboardFilter";
import { EMPTY_DASHBOARD_FILTER, filterRowsByDashboard } from "../../../../../utils/dashboardFilter";
import { useFiscalYear } from "../../../../../context/FiscalYearContext";
import { StatusBadge } from "../../../../../components/Badge";
import { formatPKR } from "../../../../../utils/currency";
import { formatDateTime } from "../../../../../utils/dateTime";
import { ProductIcon, ProcurementIcon, LogsIcon } from "../../../../../components/icons";
import { MODULE_BASE } from "../constants";

function Kpi({ label, value, hint, tone = "default", icon }) {
  return (
    <div className={`wh-kpi wh-kpi--${tone}`}>
      <div className="wh-kpi__top">
        <span className="wh-kpi__label">{label}</span>
        {icon && <span className="wh-kpi__icon">{icon}</span>}
      </div>
      <span className="wh-kpi__value">{value}</span>
      {hint && <span className="wh-kpi__hint">{hint}</span>}
    </div>
  );
}

function Panel({ title, subtitle, children, flush, action }) {
  return (
    <div className="wh-panel">
      <div className="wh-panel__head">
        <div>
          <h3 className="wh-panel__title">{title}</h3>
          {subtitle && <p className="wh-panel__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`wh-panel__body${flush ? " wh-panel__body--flush" : ""}`}>{children}</div>
    </div>
  );
}

export default function ProductionDashboard() {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dashFilter, setDashFilter] = useState({ ...EMPTY_DASHBOARD_FILTER });
  const fiscalYearStart = useFiscalYear();

  useEffect(() => {
    apiFetch("/production/dashboard", {}, authFetch)
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
  const recentRuns = data?.recent_runs || [];

  const filteredRuns = useMemo(
    () => filterRowsByDashboard(recentRuns, "created_at", dashFilter, fiscalYearStart),
    [recentRuns, dashFilter, fiscalYearStart]
  );

  const dash = (n) => (loading ? "—" : n ?? 0);
  const num = (n) => (loading ? "—" : Number(n || 0).toLocaleString());
  const money = (n) => (loading ? "—" : formatPKR(n));

  const quickLinks = [
    { label: "Create Recipe", path: `${MODULE_BASE}/recipes/create` },
    { label: "Manage Recipes", path: `${MODULE_BASE}/recipes/manage` },
    { label: "Bake Now", path: `${MODULE_BASE}/runs/create` },
    { label: "Manage Runs", path: `${MODULE_BASE}/runs/manage` },
  ];

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
        title="Production (Baking)"
        description="Recipes (nuskhay) and baking runs — turn ingredients (kacha maal) into finished bakery items."
      />

      {loadError && <p className="wh-field__error">{loadError}</p>}

      <DashboardFilter
        rows={recentRuns}
        dateField="created_at"
        value={dashFilter}
        onChange={setDashFilter}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <Kpi
            label="Recipes"
            value={dash(stats.recipe_count)}
            hint="Active nuskhay"
            tone="accent"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <Kpi
            label="Total Bakes"
            value={dash(stats.run_count)}
            hint="All production runs"
            icon={<ProcurementIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <Kpi
            label="Bakes Today"
            value={dash(stats.runs_today)}
            hint={`${num(stats.produced_today)} pieces made`}
            tone="success"
            icon={<LogsIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <Kpi
            label="Cost (30 days)"
            value={money(stats.cost_30d)}
            hint="Ingredient cost used"
            tone="warning"
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <Panel
            title="Recent Bakes"
            subtitle="Latest production runs"
            flush
            action={
              <Link to={`${MODULE_BASE}/runs/manage`} className="wh-link">
                View all
              </Link>
            }
          >
            {filteredRuns.length === 0 ? (
              <p className="wh-panel__empty">No bakes in this range.</p>
            ) : (
              <div className="wh-mini-list">
                {filteredRuns.map((run) => (
                  <Link
                    key={run.id}
                    to={`${MODULE_BASE}/runs/view/${run.id}`}
                    className="wh-mini-row"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">
                        {run.production_no} · {run.finished_item_name}
                      </div>
                      <div className="wh-mini-row__sub">
                        {run.branch_name} · {formatDateTime(run.created_at)}
                      </div>
                    </div>
                    <span className="wh-mini-row__value">
                      {Number(run.quantity_produced).toLocaleString()} {run.finished_unit || ""}
                    </span>
                    <StatusBadge status={run.status} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Quick Actions">
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
