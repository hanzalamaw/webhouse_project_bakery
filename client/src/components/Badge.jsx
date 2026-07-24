import { useT } from "../context/LanguageContext";

const TONE_MAP = {
  active: "success",
  resolved: "success",
  paid: "success",
  enabled: "success",
  online: "success",
  pending: "warning",
  running: "warning",
  completed: "success",
  failed: "danger",
  connected: "success",
  suspended: "warning",
  overdue: "warning",
  inactive: "neutral",
  cancelled: "danger",
  expired: "danger",
  open: "accent",
  offline: "neutral",
};

function statusLabel(status) {
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`wh-badge wh-badge--${tone}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const t = useT();
  if (status == null || status === "") return <span className="wh-badge wh-badge--neutral">—</span>;
  const raw = String(status).trim();
  const key = raw.toLowerCase();
  const tone = TONE_MAP[key] || "neutral";
  return <span className={`wh-badge wh-badge--${tone}`}>{t(statusLabel(raw))}</span>;
}
