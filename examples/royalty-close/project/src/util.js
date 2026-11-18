/** Small shared helpers (no Astrato imports). */
export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else if (k === 'html') node.innerHTML = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const num = (v) => (v == null || v === '' ? NaN : Number(v));
export const mu = (v, d = 0) => `${(num(v) / 1e6).toFixed(d)}m`;
export const pct = (v, d = 1) => `${(num(v) * 100).toFixed(d)}%`;
export const pts = (v, d = 1) => `${num(v) >= 0 ? '+' : '−'}${Math.abs(num(v) * 100).toFixed(d)} pts`;
export const spct = (v, d = 1) => `${num(v) >= 0 ? '+' : '−'}${Math.abs(num(v) * 100).toFixed(d)}%`;
export const eurm = (v, d = 1) => `${num(v) < 0 ? '−' : ''}€${Math.abs(num(v) / 1e6).toFixed(d)}m`;
export const eur = (v) => `€${Math.round(num(v)).toLocaleString('en-GB')}`;
export const days = (v) => `${num(v).toFixed(1)} d`;
export const sum = (rows, k) => rows.reduce((a, r) => a + (num(r[k]) || 0), 0);
export const by = (rows, k) => Object.fromEntries(rows.map((r) => [r[k], r]));
export const COL = { navy: '#14324A', teal: '#1E7C8A', aqua: '#7CC4CC', slate: '#5E6E7B', mist: '#C9D3DA', emerald: '#1F9D6B', amber: '#D49A2A', coral: '#C9503E', ink: '#1C2A35', plum: '#6B5C8A' };
export const STAGE_COLORS = { Dispensing: '#7CC4CC', 'Granulation / Blending': '#4FA3AE', 'Compression / Encapsulation': '#1E7C8A', Coating: '#5E6E7B', Packaging: '#14324A', 'QA release': '#D49A2A' };
/** Red-amber-green for a value against thresholds; `good` = 'up' when high is good. */
export const rag = (v, lo, hi, good = 'up') => {
  const x = num(v);
  if (Number.isNaN(x)) return COL.slate;
  if (good === 'up') return x >= hi ? COL.emerald : x >= lo ? COL.amber : COL.coral;
  return x <= lo ? COL.emerald : x <= hi ? COL.amber : COL.coral;
};
