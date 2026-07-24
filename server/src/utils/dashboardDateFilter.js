/**
 * Shared dashboard date-range helpers for module dashboards.
 * Query params: period | range | from | to | start_date | end_date
 * period values: today | week | month | year | fiscal_year | all | all_time | custom
 */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toSqlDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fiscalYearBounds(fiscalYearStart, now = new Date()) {
  // fiscalYearStart: "MM-DD" or "YYYY-MM-DD" or month number
  let month = 7; // default July (common PK fiscal)
  let day = 1;
  if (fiscalYearStart) {
    const raw = String(fiscalYearStart).trim();
    if (/^\d{1,2}$/.test(raw)) {
      month = Math.min(12, Math.max(1, Number(raw)));
    } else {
      const parts = raw.split(/[-/]/);
      if (parts.length >= 2) {
        if (parts.length === 3) {
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          month = Number(parts[0]);
          day = Number(parts[1]);
        }
      }
    }
  }
  const y = now.getFullYear();
  let start = new Date(y, month - 1, day, 0, 0, 0, 0);
  if (now < start) start = new Date(y - 1, month - 1, day, 0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setMilliseconds(-1);
  return { from: start, to: end };
}

export function parseDashboardFilterQuery(query = {}) {
  const period = String(query.period || query.range || query.filter || "all").trim().toLowerCase();
  const from = query.from || query.start_date || query.startDate || null;
  const to = query.to || query.end_date || query.endDate || null;
  return {
    period,
    from,
    to,
  };
}

export function isAllTimeDashboardFilter(filter = {}) {
  const period = String(filter.period || "").toLowerCase();
  if (!period || period === "all" || period === "all_time" || period === "alltime") {
    if (!filter.from && !filter.to) return true;
  }
  return false;
}

/**
 * Resolve concrete from/to Date objects for a filter.
 * Returns nulls for all-time (no SQL constraint).
 */
export function resolveDashboardDateRange(filter = {}) {
  if (isAllTimeDashboardFilter(filter) && !filter.from && !filter.to) {
    return { from: null, to: null };
  }

  const period = String(filter.period || "all").toLowerCase();
  const now = new Date();

  if (period === "custom" || filter.from || filter.to) {
    const from = filter.from ? startOfDay(parseDateInput(filter.from) || now) : null;
    const to = filter.to ? endOfDay(parseDateInput(filter.to) || now) : null;
    return { from, to };
  }

  if (period === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (period === "week" || period === "7d" || period === "last_7_days") {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 6);
    return { from, to: endOfDay(now) };
  }

  if (period === "month" || period === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { from, to: endOfDay(now) };
  }

  if (period === "year" || period === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    return { from, to: endOfDay(now) };
  }

  if (period === "fiscal_year" || period === "fy") {
    return fiscalYearBounds(filter.fiscalYearStart, now);
  }

  return { from: null, to: null };
}

/**
 * Build AND-prefixed SQL fragment + params for a column (e.g. "created_at" or "o.created_at").
 * @returns {{ sql: string, params: any[] }}
 */
export function buildDashboardDateSql(filter = {}, column = "created_at") {
  const { from, to } = resolveDashboardDateRange(filter);
  const params = [];
  let sql = "";
  if (from) {
    sql += ` AND ${column} >= ?`;
    params.push(toSqlDateTime(from));
  }
  if (to) {
    sql += ` AND ${column} <= ?`;
    params.push(toSqlDateTime(to));
  }
  return { sql, params };
}
