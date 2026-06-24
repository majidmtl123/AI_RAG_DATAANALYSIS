/**
 * Analysis helper library.
 *
 * This is shipped to the sandbox as a SOURCE STRING (HELPERS_SOURCE) because the
 * sandboxed worker cannot import compiled project modules at runtime. The same
 * helpers are summarized for the model in HELPERS_DOC so it knows the API.
 */

export const HELPERS_SOURCE = String.raw`
const helpers = {
  num(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(String(v).replace(/[$,%\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  },
  sum(rows, key) {
    let t = 0;
    for (const r of rows) { const n = helpers.num(r[key]); if (n !== null) t += n; }
    return t;
  },
  avg(rows, key) {
    let t = 0, c = 0;
    for (const r of rows) { const n = helpers.num(r[key]); if (n !== null) { t += n; c++; } }
    return c ? t / c : null;
  },
  min(rows, key) {
    let m = null;
    for (const r of rows) { const n = helpers.num(r[key]); if (n !== null && (m === null || n < m)) m = n; }
    return m;
  },
  max(rows, key) {
    let m = null;
    for (const r of rows) { const n = helpers.num(r[key]); if (n !== null && (m === null || n > m)) m = n; }
    return m;
  },
  count(rows, predicate) {
    if (!predicate) return rows.length;
    let c = 0; for (const r of rows) if (predicate(r)) c++; return c;
  },
  distinct(rows, key) {
    const s = new Set(); for (const r of rows) s.add(r[key]); return [...s];
  },
  filter(rows, predicate) { return rows.filter(predicate); },
  groupBy(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = r[typeof key === 'function' ? undefined : key];
      const gk = typeof key === 'function' ? key(r) : k;
      const bucket = m.get(gk) || [];
      bucket.push(r); m.set(gk, bucket);
    }
    return m;
  },
  groupAgg(rows, key, valueKey, fn) {
    const groups = helpers.groupBy(rows, key);
    const out = [];
    for (const [g, bucket] of groups) {
      const agg = (fn || 'sum');
      let value;
      if (agg === 'sum') value = helpers.sum(bucket, valueKey);
      else if (agg === 'avg') value = helpers.avg(bucket, valueKey);
      else if (agg === 'count') value = bucket.length;
      else if (agg === 'min') value = helpers.min(bucket, valueKey);
      else if (agg === 'max') value = helpers.max(bucket, valueKey);
      else value = helpers.sum(bucket, valueKey);
      out.push({ group: g, value: value });
    }
    return out;
  },
  sortBy(rows, key, dir) {
    const d = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = typeof key === 'function' ? key(a) : a[key];
      const bv = typeof key === 'function' ? key(b) : b[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av < bv ? -1 * d : 1 * d;
    });
  },
  topN(rows, n, key) { return helpers.sortBy(rows, key, 'desc').slice(0, n); },
  // Date helpers: accept ISO strings or Date-like values.
  monthKey(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7); },
  yearKey(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear()); },
  quarterKey(v) { const d = new Date(v); if (Number.isNaN(d.getTime())) return null; return d.getUTCFullYear() + '-Q' + (Math.floor(d.getUTCMonth() / 3) + 1); },
  round(n, dp) { if (n === null || n === undefined) return n; const f = Math.pow(10, dp == null ? 2 : dp); return Math.round(n * f) / f; },
  pct(part, whole) { return whole ? (part / whole) * 100 : null; },
  // Simple linear trend (least squares) over an array of numbers.
  linearTrend(values) {
    const ys = values.map(helpers.num).filter(v => v !== null);
    const n = ys.length; if (n < 2) return { slope: 0, direction: 'flat' };
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
    return { slope: slope, direction: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat' };
  },
};
`;

/** Human-readable summary of the helper API for the system prompt. */
export const HELPERS_DOC = `Available helpers (global \`helpers\` object):
- helpers.num(v): parse a value to a number (handles "$1,200", "5%") or null
- helpers.sum(rows, key) / helpers.avg / helpers.min / helpers.max(rows, key)
- helpers.count(rows, predicate?) -> number
- helpers.distinct(rows, key) -> array of unique values
- helpers.filter(rows, predicate) -> rows
- helpers.groupBy(rows, key|fn) -> Map<groupValue, rows[]>
- helpers.groupAgg(rows, key|fn, valueKey, 'sum'|'avg'|'count'|'min'|'max') -> [{group, value}]
- helpers.sortBy(rows, key|fn, 'asc'|'desc') / helpers.topN(rows, n, key|fn)
- helpers.monthKey(v) -> 'YYYY-MM' | null, helpers.yearKey(v) -> 'YYYY', helpers.quarterKey(v) -> 'YYYY-Qn'
- helpers.round(n, dp=2), helpers.pct(part, whole) -> percentage
- helpers.linearTrend(values) -> { slope, direction: 'up'|'down'|'flat' }`;
