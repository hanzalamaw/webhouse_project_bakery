import { formatDateTime } from "../utils/dateTime";

/** Human-friendly rendering of one audit-log entry (overview + what changed). */

function coerceObject(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function flattenObject(rawObj, prefix = "") {
  const out = {};
  const obj = coerceObject(rawObj);
  if (obj == null || typeof obj !== "object") return out;
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val != null && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(out, flattenObject(val, path));
    } else {
      out[path] = val;
    }
  }
  return out;
}

/** Keys normal users don't need: internal ids, secrets, and the summary (shown separately). */
function isHiddenKey(path) {
  const last = path.split(".").pop().toLowerCase();
  if (last === "id" || last.endsWith("_id")) return true;
  if (last.includes("password") || last.includes("token")) return true;
  if (path === "summary") return true;
  return false;
}

export function humanizeKey(path) {
  return path
    .split(".")
    .map((seg) =>
      seg
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(" › ");
}

function looksLikeDate(value) {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

export function humanizeValue(path, value) {
  if (value == null || value === "") return "(empty)";
  const last = path.split(".").pop().toLowerCase();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (/^(is|has|can)_/.test(last) && (value === 0 || value === 1 || value === "0" || value === "1")) {
    return Number(value) ? "Yes" : "No";
  }
  if ((/(?:_at|_date)$/.test(last) || looksLikeDate(value)) && !Number.isNaN(new Date(value).getTime())) {
    if (typeof value === "string" && value.length >= 10) return formatDateTime(value);
  }
  if (Array.isArray(value)) {
    if (!value.length) return "(empty)";
    return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function LogMetaList({ meta = [] }) {
  const rows = meta.filter((row) => row && row.value != null && row.value !== "");
  if (!rows.length) return null;
  return (
    <dl className="wh-log-detail__meta">
      {rows.map((row) => (
        <div className="wh-log-detail__row" key={row.label}>
          <dt className="wh-log-detail__label">{row.label}</dt>
          <dd className="wh-log-detail__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LogChanges({ oldValue, newValue }) {
  const oldFlat = flattenObject(oldValue);
  const newFlat = flattenObject(newValue);
  const hasOld = Object.keys(oldFlat).length > 0;
  const hasNew = Object.keys(newFlat).length > 0;
  const summary = typeof newFlat.summary === "string" ? newFlat.summary : null;

  let content = null;

  if (hasOld && hasNew) {
    const keys = [...new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)])]
      .filter((key) => !isHiddenKey(key))
      .filter((key) => JSON.stringify(oldFlat[key]) !== JSON.stringify(newFlat[key]))
      .sort();
    content = !keys.length ? (
      <p className="wh-muted">Nothing visible was changed.</p>
    ) : (
      <div className="wh-diff">
        <div className="wh-diff__header">
          <span>Field</span>
          <span className="wh-diff__col--old">Before</span>
          <span className="wh-diff__col--new">After</span>
        </div>
        {keys.map((key) => (
          <div key={key} className="wh-diff__row wh-diff__row--changed">
            <span className="wh-diff__key">{humanizeKey(key)}</span>
            <span className="wh-diff__val wh-diff__val--old">
              {key in oldFlat ? humanizeValue(key, oldFlat[key]) : "—"}
            </span>
            <span className="wh-diff__val wh-diff__val--new">
              {key in newFlat ? humanizeValue(key, newFlat[key]) : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (hasNew || hasOld) {
    const flat = hasNew ? newFlat : oldFlat;
    const keys = Object.keys(flat).filter((key) => !isHiddenKey(key)).sort();
    content = !keys.length ? (
      <p className="wh-muted">No further details were recorded.</p>
    ) : (
      <dl className="wh-log-detail__meta">
        {keys.map((key) => (
          <div className="wh-log-detail__row" key={key}>
            <dt className="wh-log-detail__label">{humanizeKey(key)}</dt>
            <dd className="wh-log-detail__value">{humanizeValue(key, flat[key])}</dd>
          </div>
        ))}
      </dl>
    );
  } else {
    content = <p className="wh-muted">No further details were recorded for this entry.</p>;
  }

  return (
    <div className="wh-log-detail__changes">
      {summary && <p className="wh-log-detail__summary">{summary}</p>}
      {content}
    </div>
  );
}
