import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";
import { PageHeader } from "../../../../../components/PageHeader";
import { KpiCard, Panel } from "../../../../../components/KpiPanel";
import { DashboardFilter } from "../../../../../components/DashboardFilter";
import { EMPTY_DASHBOARD_FILTER, filterRowsByDashboard } from "../../../../../utils/dashboardFilter";
import { useFiscalYear } from "../../../../../context/FiscalYearContext";
import { StatusBadge } from "../../../../../components/Badge";
import { HBars, DonutChart, CHART_COLORS } from "../../../../../components/charts";
import { formatPKR, formatCompactPKR } from "../../../../../utils/currency";
import { formatDateTime } from "../../../../../utils/dateTime";
import { ProductIcon, ProcurementIcon, LogsIcon, WarehouseIcon } from "../../../../../components/icons";
import { MODULE_BASE } from "../constants";

const STATUS_COLORS = {
  completed: CHART_COLORS[1],
  planned: CHART_COLORS[0],
  in_progress: CHART_COLORS[3],
  cancelled: CHART_COLORS[4] || CHART_COLORS[2],
};

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
  const topItems = data?.top_items || [];
  const runsByStatus = data?.runs_by_status || [];
  const bakesByBranch = data?.bakes_by_branch || [];
  const recentRecipes = data?.recent_recipes || [];

  const filteredRuns = useMemo(
    () => filterRowsByDashboard(recentRuns, "created_at", dashFilter, fiscalYearStart),
    [recentRuns, dashFilter, fiscalYearStart]
  );

  const dash = (n) => (loading ? "—" : n ?? 0);
  const num = (n) => (loading ? "—" : Number(n || 0).toLocaleString());
  const money = (n) => (loading ? "—" : formatPKR(n));

  const statusSegments = useMemo(
    () =>
      runsByStatus
        .map((row, i) => ({
          label: String(row.label || "").replace(/_/g, " "),
          value: Number(row.value) || 0,
          color: STATUS_COLORS[row.label] || CHART_COLORS[i % CHART_COLORS.length],
        }))
        .filter((s) => s.value > 0),
    [runsByStatus]
  );

  const topItemBars = useMemo(
    () =>
      topItems.map((row, i) => ({
        label: row.label,
        value: Number(row.qty) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [topItems]
  );

  const branchBars = useMemo(
    () =>
      bakesByBranch.map((row, i) => ({
        label: row.label,
        value: Number(row.qty) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [bakesByBranch]
  );

  const branchCostBars = useMemo(
    () =>
      bakesByBranch.map((row, i) => ({
        label: row.label,
        value: Number(row.cost) || 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [bakesByBranch]
  );

  const quickLinks = [
    { label: "Bake Now", path: `${MODULE_BASE}/runs/create` },
    { label: "Manage Runs", path: `${MODULE_BASE}/runs/manage` },
    { label: "Create Recipe", path: `${MODULE_BASE}/recipes/create` },
    { label: "Manage Recipes", path: `${MODULE_BASE}/recipes/manage` },
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
        description="Recipes and baking runs — turn ingredients into finished bakery items."
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
          <KpiCard
            label="Recipes"
            value={dash(stats.recipe_count)}
            hint={`${dash(stats.active_recipe_count)} active · ${dash(stats.finished_with_recipe)} items covered`}
            tone="accent"
            icon={<ProductIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Total Bakes"
            value={dash(stats.run_count)}
            hint={`${dash(stats.cancelled_count)} cancelled`}
            icon={<ProcurementIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Bakes Today"
            value={dash(stats.runs_today)}
            hint={`${num(stats.produced_today)} pieces made`}
            tone="success"
            icon={<LogsIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Cost (30 days)"
            value={money(stats.cost_30d)}
            hint={`Avg ${money(stats.avg_cost_30d)} per bake`}
            tone="warning"
            icon={<WarehouseIcon />}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <KpiCard
            label="Bakes (7 days)"
            value={dash(stats.runs_7d)}
            hint={`${num(stats.produced_7d)} pieces`}
            tone="success"
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Produced (30 days)"
            value={num(stats.produced_30d)}
            hint="Finished pieces made"
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Active recipes"
            value={dash(stats.active_recipe_count)}
            hint="Ready to bake"
            tone="accent"
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Items with recipe"
            value={dash(stats.finished_with_recipe)}
            hint="Finished goods covered"
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-4">
          <Panel title="Bakes by status" subtitle="All production runs">
            {statusSegments.length ? (
              <DonutChart
                segments={statusSegments}
                centerValue={Number(stats.run_count) || 0}
                centerLabel="bakes"
              />
            ) : (
              <p className="wh-panel__empty">No bakes yet.</p>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Top baked items" subtitle="Last 30 days by quantity">
            {topItemBars.length ? (
              <HBars data={topItemBars} formatValue={(v) => v.toLocaleString()} />
            ) : (
              <p className="wh-panel__empty">No bakes in the last 30 days.</p>
            )}
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Output by branch" subtitle="Pieces made · last 30 days">
            {branchBars.length ? (
              <HBars data={branchBars} formatValue={(v) => v.toLocaleString()} />
            ) : (
              <p className="wh-panel__empty">No branch output yet.</p>
            )}
          </Panel>
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
                        {run.total_cost != null ? ` · ${formatPKR(run.total_cost)}` : ""}
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
          <Panel title="Ingredient cost by branch" subtitle="Last 30 days">
            {branchCostBars.length ? (
              <HBars data={branchCostBars} formatValue={formatCompactPKR} />
            ) : (
              <p className="wh-panel__empty">No cost data yet.</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-12">
          <Panel
            title="Recent recipes"
            subtitle="Latest nuskha updates"
            flush
            action={
              <Link to={`${MODULE_BASE}/recipes/manage`} className="wh-link">
                View all
              </Link>
            }
          >
            {recentRecipes.length === 0 ? (
              <p className="wh-panel__empty">No recipes yet.</p>
            ) : (
              <div className="wh-mini-list">
                {recentRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    to={`${MODULE_BASE}/recipes/view/${recipe.id}`}
                    className="wh-mini-row"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">{recipe.recipe_name}</div>
                      <div className="wh-mini-row__sub">
                        {recipe.finished_item_name}
                        {recipe.updated_at || recipe.created_at
                          ? ` · ${formatDateTime(recipe.updated_at || recipe.created_at)}`
                          : ""}
                      </div>
                    </div>
                    <span className="wh-mini-row__value">
                      Yield {Number(recipe.yield_qty).toLocaleString()} {recipe.yield_unit || ""}
                    </span>
                    <StatusBadge status={recipe.status} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
