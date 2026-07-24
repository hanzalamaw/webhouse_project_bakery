import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../../context/AuthContext";
import { apiFetch } from "../../../../../api/client";
import { PageHeader } from "../../../../../components/PageHeader";
import { KpiCard, Panel } from "../../../../../components/KpiPanel";
import { BarChart } from "../../../../../components/charts";
import { StatusBadge } from "../../../../../components/Badge";
import { formatPKR } from "../../../../../utils/currency";
import { formatDateTime } from "../../../../../utils/dateTime";
import { DashboardFilter } from "../../../../../components/DashboardFilter";
import { EMPTY_DASHBOARD_FILTER, filterRowsByDashboard } from "../../../../../utils/dashboardFilter";
import { useFiscalYear } from "../../../../../context/FiscalYearContext";
import { MODULE_BASE, CUSTOMER_TYPE_LABELS } from "../constants";
import { TenantsIcon, SupportIcon } from "../../../../../components/icons";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function lastNMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABELS[d.getMonth()],
      value: 0,
    });
  }
  return out;
}



export default function CrmDashboard() {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashFilter, setDashFilter] = useState({ ...EMPTY_DASHBOARD_FILTER });
  const fiscalYearStart = useFiscalYear();

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("/crm/dashboard", {}, authFetch)
      .then((res) => {
        if (!active) return;
        setData(res);
        setError("");
      })
      .catch((e) => {
        if (!active) return;
        setData(null);
        setError(e.message || "Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authFetch]);

  const stats = data?.stats || {};
  const activeDays = stats.active_customer_days || 30;
  const dash = (n) => (loading ? "—" : n ?? 0);
  const money = (n) => (loading ? "—" : formatPKR(n));

  const growthSeries = useMemo(() => {
    const buckets = lastNMonths(6);
    const index = new Map(buckets.map((b) => [b.key, b]));
    for (const row of data?.customer_growth || []) {
      const bucket = index.get(row.month_key);
      if (bucket) bucket.value = Number(row.count) || 0;
    }
    return buckets.map((b) => ({ label: b.label, value: b.value }));
  }, [data?.customer_growth]);

  const filteredActivities = useMemo(() => {
    const rows = data?.recent_activities || [];
    return filterRowsByDashboard(rows, "created_at", dashFilter, fiscalYearStart);
  }, [data?.recent_activities, dashFilter, fiscalYearStart]);

  const recentActivities = useMemo(
    () =>
      [...filteredActivities]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6),
    [filteredActivities]
  );

  const topCustomers = data?.top_customers || [];

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Dashboard"
        description={`CRM overview — customers and support. Active customers placed an order in the last ${activeDays} days.`}
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      <DashboardFilter
        rows={data?.recent_activities || []}
        dateField="created_at"
        value={dashFilter}
        onChange={setDashFilter}
      />

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <KpiCard
            label="Total Customers"
            value={dash(stats.total_customers)}
            hint={`${dash(stats.status_active_customers)} status active`}
            icon={<TenantsIcon />}
            tone="accent"
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Active Customers"
            value={dash(stats.active_customers)}
            hint={`Ordered in last ${activeDays} days`}
            icon={<TenantsIcon />}
            tone="success"
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Customers This Month"
            value={dash(stats.customers_this_month)}
            icon={<TenantsIcon />}
          />
        </div>
        <div className="wh-dash-col-3">
          <KpiCard
            label="Open Complaints"
            value={dash(stats.open_complaints)}
            hint="Open or in progress"
            icon={<SupportIcon />}
            tone={Number(stats.open_complaints) > 0 ? "warning" : "default"}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-3">
          <KpiCard
            label="Top Customer Revenue"
            value={topCustomers.length ? money(topCustomers[0].total_revenue) : money(0)}
            hint={topCustomers[0]?.customer_name || "No orders in period"}
            icon={<TenantsIcon />}
            tone={topCustomers.length ? "accent" : "default"}
          />
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-8">
          <Panel title="Customer Growth" subtitle="New customers over the last 6 months">
            <BarChart data={growthSeries} formatValue={(v) => String(v)} />
          </Panel>
        </div>
        <div className="wh-dash-col-4">
          <Panel title="Recent Activity" flush>
            {loading ? (
              <p className="wh-panel__empty">Loading…</p>
            ) : recentActivities.length ? (
              <div className="wh-mini-list">
                {recentActivities.map((a) => (
                  <div className="wh-mini-row" key={a.id}>
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">{a.summary}</div>
                      <div className="wh-mini-row__sub">
                        {a.user_name || "System"} · {formatDateTime(a.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="wh-panel__empty">No activity in range</p>
            )}
          </Panel>
        </div>
      </div>

      <div className="wh-dash-grid">
        <div className="wh-dash-col-12">
          <Panel title="Top Customers" subtitle={`By revenue in the last ${activeDays} days`} flush>
            {loading ? (
              <p className="wh-panel__empty">Loading…</p>
            ) : topCustomers.length ? (
              <div className="wh-mini-list">
                {topCustomers.map((c) => (
                  <div className="wh-mini-row" key={c.id}>
                    <div className="wh-mini-row__main">
                      <div className="wh-mini-row__title">
                        <Link to={`${MODULE_BASE}/customers/${c.id}`}>{c.customer_name}</Link>
                        {c.company_name && (
                          <span className="wh-muted"> — {c.company_name}</span>
                        )}
                      </div>
                      <div className="wh-mini-row__sub">
                        {CUSTOMER_TYPE_LABELS[c.customer_type] || c.customer_type} · {c.transaction_count} transactions
                      </div>
                    </div>
                    <span className="wh-mini-row__value">{formatPKR(c.total_revenue)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="wh-panel__empty">No customer orders in this period</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
