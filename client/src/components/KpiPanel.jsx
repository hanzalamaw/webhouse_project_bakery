import { useT } from "../context/LanguageContext";

/** Dashboard / detail KPI card — auto-translates label and hint. */
export function KpiCard({ label, value, hint, icon, tone = "default" }) {
  const t = useT();
  return (
    <div className={`wh-kpi wh-kpi--${tone}`}>
      <div className="wh-kpi__top">
        <span className="wh-kpi__label">{typeof label === "string" ? t(label) : label}</span>
        {icon ? <span className="wh-kpi__icon">{icon}</span> : null}
      </div>
      <span className="wh-kpi__value">{value}</span>
      {hint ? <span className="wh-kpi__hint">{typeof hint === "string" ? t(hint) : hint}</span> : null}
    </div>
  );
}

/** Section panel — auto-translates title and subtitle. */
export function Panel({ title, subtitle, children, flush, action }) {
  const t = useT();
  return (
    <div className="wh-panel">
      <div className="wh-panel__head">
        <div>
          <h3 className="wh-panel__title">{typeof title === "string" ? t(title) : title}</h3>
          {subtitle ? (
            <p className="wh-panel__subtitle">{typeof subtitle === "string" ? t(subtitle) : subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={`wh-panel__body${flush ? " wh-panel__body--flush" : ""}`}>{children}</div>
    </div>
  );
}
