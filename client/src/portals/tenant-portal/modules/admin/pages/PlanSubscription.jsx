import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "../../../../../components/PageHeader";
import { DataTable } from "../../../../../components/DataTable";
import { StatusBadge } from "../../../../../components/Badge";
import { KpiCard, Panel } from "../../../../../components/KpiPanel";
import { useAuth } from "../../../../../context/AuthContext";
import { useT } from "../../../../../context/LanguageContext";
import { apiFetch } from "../../../../../api/client";
import { formatPKR } from "../../../../../utils/currency";
import { formatDate, formatDateTime } from "../../../../../utils/dateTime";
import { ModuleIcon, SubscriptionIcon } from "../../../../../components/icons";
import { translateModuleName } from "../../../../../i18n/moduleNames";

function SummaryRow({ label, value, accent, danger }) {
  const t = useT();
  return (
    <div className="wh-tx-summary-item">
      <span className="wh-tx-summary-item__label">{typeof label === "string" ? t(label) : label}</span>
      <span
        className={`wh-tx-summary-item__value${accent ? " wh-tx-summary-item__value--accent" : ""}${
          danger ? " wh-sub-value--danger" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function LimitMeter({ label, used, max }) {
  const t = useT();
  const hasMax = max != null && max > 0;
  const pct = hasMax ? Math.min(100, (used / max) * 100) : 0;
  const tone = pct >= 90 ? "danger" : pct >= 70 ? "warning" : "accent";

  return (
    <div className="wh-limit-meter">
      <div className="wh-limit-meter__head">
        <span className="wh-limit-meter__label">{typeof label === "string" ? t(label) : label}</span>
        <strong className="wh-limit-meter__value">
          {hasMax ? `${used} / ${max}` : used ?? "—"}
        </strong>
      </div>
      {hasMax && (
        <div className="wh-limit-meter__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`wh-limit-meter__fill wh-limit-meter__fill--${tone}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function LimitStat({ label, value }) {
  const t = useT();
  return (
    <div className="wh-limit-stat">
      <span className="wh-limit-stat__label">{typeof label === "string" ? t(label) : label}</span>
      <strong className="wh-limit-stat__value">{value ?? "—"}</strong>
    </div>
  );
}

function cycleProgress(cycleStart, cycleEnd) {
  if (!cycleStart || !cycleEnd) return 0;
  const start = new Date(cycleStart).getTime();
  const end = new Date(cycleEnd).getTime();
  const now = Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function titleCase(value) {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlanSubscription() {
  const { authFetch } = useAuth();
  const t = useT();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/tenant/subscription-billing", {}, authFetch)
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (active) setError(err.message || t("Failed to load subscription"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authFetch, t]);

  const billing = data?.billing;
  const limits = data?.limits || {};
  const tenant = data?.tenant || {};
  const modules = data?.modules || [];
  const payments = data?.payments || [];

  const planName = tenant.plan_name || billing?.plan_name || "—";
  const billingCycle = tenant.billing_cycle || billing?.billing_cycle;
  const subscriptionStatus = tenant.subscription_status;
  const periodStart = billing?.billing_anchor_date || billing?.start_date || tenant.start_date;
  const periodEnd = tenant.renewal_date || billing?.end_date;
  const planPrice = billing?.plan_price;
  const cyclePct = useMemo(
    () => cycleProgress(billing?.cycle_start, billing?.cycle_end),
    [billing?.cycle_start, billing?.cycle_end]
  );
  const renewalDays = useMemo(() => daysUntil(periodEnd), [periodEnd]);

  const totalDue = Number(billing?.total_amount_due ?? 0);
  const cycleDue = Number(billing?.current_cycle_due ?? 0);

  const paymentColumns = [
    { key: "received_at", label: "Date", format: formatDateTime },
    { key: "bank", label: "Bank", format: (v) => formatPKR(v) },
    { key: "cash", label: "Cash", format: (v) => formatPKR(v) },
    { key: "total_received", label: "Total Paid", format: (v) => formatPKR(v) },
  ];

  const dash = (v) => (loading ? "—" : v);
  const money = (n) => (loading ? "—" : formatPKR(n));

  const renewalHint = (() => {
    if (renewalDays == null) return t("Renewal date not set");
    if (renewalDays > 0) {
      return renewalDays === 1
        ? t("{{n}} day remaining", { n: renewalDays })
        : t("{{n}} days remaining", { n: renewalDays });
    }
    if (renewalDays === 0) return t("Renews today");
    const past = Math.abs(renewalDays);
    return past === 1
      ? t("{{n}} day past renewal", { n: past })
      : t("{{n}} days past renewal", { n: past });
  })();

  const modulesSubtitle =
    modules.length === 1
      ? t("{{n}} module on your plan", { n: modules.length })
      : t("{{n}} modules on your plan", { n: modules.length });

  return (
    <div className="wh-page wh-page--wide">
      <PageHeader
        title="Plan & Subscription"
        description="Your subscription plan, usage limits, billing summary, and payment history — managed by WebHouse."
      />

      {error && <div className="wh-alert wh-alert--error">{error}</div>}

      {loading ? (
        <p className="wh-muted wh-sub-loading">{t("Loading subscription details…")}</p>
      ) : (
        <>
          <div className="wh-dash-grid">
            <div className="wh-dash-col-8">
              <div className="wh-plan-hero">
                <div className="wh-plan-hero__top">
                  <div>
                    <p className="wh-plan-hero__eyebrow">{t("Current plan")}</p>
                    <h2 className="wh-plan-hero__name">{planName}</h2>
                  </div>
                  <StatusBadge status={subscriptionStatus || "—"} />
                </div>
                <div className="wh-plan-hero__meta">
                  <div className="wh-plan-hero__meta-item">
                    <span>{t("Billing cycle")}</span>
                    <strong>{t(titleCase(billingCycle))}</strong>
                  </div>
                  <div className="wh-plan-hero__meta-item">
                    <span>{t("Plan price")}</span>
                    <strong>{planPrice != null ? formatPKR(planPrice) : "—"}</strong>
                  </div>
                  <div className="wh-plan-hero__meta-item">
                    <span>{t("Period start")}</span>
                    <strong>{formatDate(periodStart)}</strong>
                  </div>
                  <div className="wh-plan-hero__meta-item">
                    <span>{t("Period end")}</span>
                    <strong>{formatDate(periodEnd)}</strong>
                  </div>
                </div>
                {billing?.cycle_start && billing?.cycle_end && (
                  <div className="wh-plan-hero__cycle">
                    <div className="wh-plan-hero__cycle-head">
                      <span>{t("Current billing cycle")}</span>
                      <span className="wh-muted">
                        {formatDate(billing.cycle_start)} — {formatDate(billing.cycle_end)}
                      </span>
                    </div>
                    <div className="wh-plan-hero__cycle-track">
                      <div className="wh-plan-hero__cycle-fill" style={{ width: `${cyclePct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="wh-dash-col-4">
              <div className="wh-plan-renewal">
                <span className="wh-kpi__icon wh-plan-renewal__icon">
                  <SubscriptionIcon />
                </span>
                <p className="wh-plan-renewal__label">{t("Next renewal")}</p>
                <p className="wh-plan-renewal__date">{formatDate(periodEnd)}</p>
                <p className="wh-plan-renewal__hint">{renewalHint}</p>
                {tenant.company_name && (
                  <p className="wh-plan-renewal__org">{tenant.company_name}</p>
                )}
              </div>
            </div>
          </div>

          <div className="wh-dash-grid">
            <div className="wh-dash-col-3">
              <KpiCard
                label="Total Due"
                value={money(totalDue)}
                hint="Lifetime outstanding balance"
                icon={<SubscriptionIcon />}
                tone={totalDue > 0 ? "warning" : "success"}
              />
            </div>
            <div className="wh-dash-col-3">
              <KpiCard
                label="Current Cycle Due"
                value={money(cycleDue)}
                hint={`${t("Paid")} ${money(billing?.current_cycle_received)} ${t("this cycle")}`}
                icon={<SubscriptionIcon />}
                tone={cycleDue > 0 ? "danger" : "success"}
              />
            </div>
            <div className="wh-dash-col-3">
              <KpiCard
                label="Total Paid"
                value={money(billing?.total_received)}
                hint={`${t("Billed")} ${money(billing?.total_billing_amount)} ${t("to date")}`}
                icon={<SubscriptionIcon />}
                tone="accent"
              />
            </div>
            <div className="wh-dash-col-3">
              <KpiCard
                label="Active Users"
                value={dash(`${limits.active_users ?? 0} / ${limits.max_users ?? 0}`)}
                hint="Users included in your plan"
                icon={<ModuleIcon />}
                tone={
                  limits.max_users && limits.active_users >= limits.max_users ? "warning" : "default"
                }
              />
            </div>
          </div>

          <div className="wh-dash-grid">
            <div className="wh-dash-col-6">
              <Panel title="Usage limits" subtitle="Resources allocated to your organization">
                <LimitMeter label="Users" used={limits.active_users ?? 0} max={limits.max_users} />
                <div className="wh-limit-stat-grid">
                  <LimitStat label="Warehouses" value={limits.max_warehouses} />
                  <LimitStat label="Stores" value={limits.max_stores} />
                  <LimitStat label="Orders / month" value={limits.max_orders_per_month} />
                </div>
              </Panel>
            </div>

            <div className="wh-dash-col-6">
              <Panel title="Included modules" subtitle={modulesSubtitle}>
                {modules.length ? (
                  <ul className="wh-module-chip-list">
                    {modules.map((m) => (
                      <li key={m.module_id || m.id} className="wh-module-chip">
                        <ModuleIcon />
                        <span>{translateModuleName(t, m.module_name)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="wh-panel__empty">{t("No modules assigned to this plan.")}</p>
                )}
              </Panel>
            </div>
          </div>

          <div className="wh-dash-grid">
            <div className="wh-dash-col-6">
              <Panel title="Lifetime billing" subtitle="All-time totals since subscription start">
                <div className="wh-tx-summary-grid wh-tx-summary-grid--stacked">
                  <SummaryRow label="Total billed" value={money(billing?.total_billing_amount)} />
                  <SummaryRow label="Total paid" value={money(billing?.total_received)} accent />
                  <SummaryRow
                    label="Total due"
                    value={money(billing?.total_amount_due)}
                    danger={totalDue > 0}
                  />
                </div>
              </Panel>
            </div>
            <div className="wh-dash-col-6">
              <Panel title="Current cycle" subtitle="Charges and payments for this billing period">
                <div className="wh-tx-summary-grid wh-tx-summary-grid--stacked">
                  <SummaryRow label="Cycle amount" value={money(billing?.current_cycle_amount)} />
                  <SummaryRow label="Cycle paid" value={money(billing?.current_cycle_received)} accent />
                  <SummaryRow
                    label="Cycle due"
                    value={money(billing?.current_cycle_due)}
                    danger={cycleDue > 0}
                  />
                </div>
              </Panel>
            </div>
          </div>

          <div className="wh-dash-grid">
            <div className="wh-dash-col-12">
              <Panel
                title="Payment history"
                subtitle="Bank and cash payments recorded for your account"
                flush
              >
                {payments.length ? (
                  <DataTable
                    columns={paymentColumns}
                    rows={payments}
                    page={1}
                    pageSize={Math.max(payments.length, 10)}
                    onPageChange={() => {}}
                  />
                ) : (
                  <p className="wh-panel__empty wh-sub-empty">{t("No payments recorded yet.")}</p>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
