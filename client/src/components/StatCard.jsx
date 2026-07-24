import { useT } from "../context/LanguageContext";

export function StatCard({ label, value, hint, tone = "default" }) {
  const t = useT();
  return (
    <div className={`wh-stat wh-stat--${tone}`}>
      <span className="wh-stat__label">{typeof label === "string" ? t(label) : label}</span>
      <strong className="wh-stat__value">{value}</strong>
      {hint ? <span className="wh-stat__hint">{typeof hint === "string" ? t(hint) : hint}</span> : null}
    </div>
  );
}
