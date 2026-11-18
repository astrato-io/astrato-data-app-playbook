/** Workbench UI kit: spreadsheet grids, SVG waterfall bridges, sparklines, workflow steppers. */
import { el, esc, money, smoney, N } from './core.js';

/** Spreadsheet-quality grid. cols: [{ key, label, fmt, cls, width }]; rows: objects (row.__cls, row.__click). */
export const sheet = (cols, rows, { sticky = true, foot, onRow, dense = true } = {}) => el('div', { class: 'sheet-wrap' }, el('table', { class: `sheet${dense ? ' dense' : ''}${sticky ? ' sticky' : ''}` }, [
  el('thead', {}, el('tr', {}, cols.map((c) => el('th', { class: c.num === false ? '' : c.cls ?? (c.key === cols[0].key ? '' : 'r'), style: c.width ? `width:${c.width}` : null, text: c.label })))),
  el('tbody', {}, rows.map((r) => el('tr', { class: `${r.__cls ?? ''}${onRow || r.__click ? ' click' : ''}`, onclick: r.__click ?? (onRow ? () => onRow(r) : null) }, cols.map((c, i) => {
    const v = typeof c.value === 'function' ? c.value(r) : r[c.key];
    const node = c.fmt ? c.fmt(v, r) : v;
    const cls = [c.cls ?? (i === 0 ? '' : 'r'), typeof c.tone === 'function' ? c.tone(v, r) : ''].join(' ').trim();
    return el('td', { class: cls }, node instanceof Node ? node : el('span', { text: node ?? '–' }));
  })))),
  foot ? el('tfoot', {}, el('tr', {}, cols.map((c, i) => { const v = typeof foot === 'function' ? foot(c, i) : foot[c.key]; return el('td', { class: i ? 'r' : '' }, v instanceof Node ? v : el('span', { text: v ?? '' })); }))) : null,
]));

/** Inline sparkline (governed values passed in). */
export const spark = (values, { w = 96, h = 24, color = '#4E9A8E', area = true } = {}) => {
  const v = values.map(N).filter(Number.isFinite);
  if (v.length < 2) return el('span');
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 2) + 1, h - 2 - ((x - lo) / span) * (h - 4)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const s = el('span', { class: 'spark' });
  s.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${area ? `<path d="${d}L${w - 1},${h - 1}L1,${h - 1}Z" fill="${color}" opacity=".1"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="2" fill="${color}"/></svg>`;
  return s;
};

/**
 * Waterfall bridge. steps: [{ label, value, kind: 'total' | 'delta', note }]; onClick(step).
 * Totals are drawn from zero; deltas float. Values in USD $m.
 */
export const waterfall = (steps, { height = 280, onClick, fmt = money, sfmt = smoney } = {}) => {
  const W = Math.max(720, steps.length * 170), H = height, pad = { l: 8, r: 8, t: 26, b: 54 };
  let run = 0;
  const bars = steps.map((s) => {
    if (s.kind === 'total') { run = s.value; return { ...s, from: 0, to: s.value }; }
    const from = run; run += s.value; return { ...s, from, to: run };
  });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.from, b.to))), hi = Math.max(...bars.map((b) => Math.max(b.from, b.to)));
  const minShown = Math.min(...bars.filter((b) => b.kind === 'total').map((b) => b.to));
  const base = lo < 0 ? lo : Math.max(0, minShown - (hi - minShown) * 1.4); // zoom on the movement when all values are positive
  const y = (v) => pad.t + (1 - (v - base) / (hi - base || 1)) * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / bars.length;
  const svg = [`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="wf-svg" role="img">`];
  svg.push(`<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(Math.max(base, 0))}" y2="${y(Math.max(base, 0))}" stroke="#C9CED6"/>`);
  if (base > 0) svg.push(`<text x="${W - pad.r}" y="11" text-anchor="end" class="wf-lab">axis from ${esc(fmt(base, 0))}</text>`);
  bars.forEach((b, i) => {
    const x = pad.l + i * bw + bw * 0.16, w = bw * 0.68;
    const top = y(Math.max(b.from, b.to)), bot = y(Math.max(base, Math.min(b.from, b.to)));
    const fill = b.kind === 'total' ? '#14283A' : b.value >= 0 ? '#2E7D5B' : '#B5473A';
    svg.push(`<g class="wf-bar${onClick ? ' click' : ''}" data-i="${i}"><rect x="${x}" y="${top}" width="${w}" height="${Math.max(1.5, bot - top)}" fill="${fill}" rx="1.5"/>`);
    svg.push(`<text x="${x + w / 2}" y="${top - 6}" text-anchor="middle" class="wf-val">${esc(b.kind === 'total' ? fmt(b.value, 0) : sfmt(b.value, 1))}</text>`);
    const words = String(b.label).split(' ');
    const lines = []; let line = '';
    for (const wd of words) { if ((line + ' ' + wd).trim().length > 13) { lines.push(line.trim()); line = wd; } else line += ` ${wd}`; }
    lines.push(line.trim());
    lines.slice(0, 3).forEach((ln, k) => svg.push(`<text x="${x + w / 2}" y="${H - pad.b + 16 + k * 13}" text-anchor="middle" class="wf-lab">${esc(ln)}</text>`));
    if (i < bars.length - 1 && bars[i + 1].kind !== 'total') svg.push(`<line x1="${x + w}" x2="${x + bw}" y1="${y(b.to)}" y2="${y(b.to)}" stroke="#9AA3AF" stroke-dasharray="2,2"/>`);
    svg.push('</g>');
  });
  svg.push('</svg>');
  const host = el('div', { class: 'wf', html: svg.join('') });
  if (onClick) host.addEventListener('click', (e) => { const g = e.target.closest('.wf-bar'); if (g) onClick(steps[Number(g.dataset.i)]); });
  return host;
};

/** Horizontal workflow stepper. */
export const stepper = (states, current, { rejected } = {}) => el('ol', { class: 'stepper' }, states.map((s, i) => {
  const idx = states.indexOf(current);
  return el('li', { class: i < idx ? 'done' : i === idx ? (rejected ? 'rej' : 'now') : '' }, [el('i', { text: i < idx ? '✓' : String(i + 1) }), el('span', { text: s })]);
}));

export const kv = (pairs) => el('dl', { class: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', {}, v instanceof Node ? v : el('span', { text: v ?? '–' }))]));
export const section = (title, children, { actions, sub } = {}) => el('section', { class: 'block' }, [el('header', {}, [el('div', {}, [el('h3', { text: title }), sub ? el('p', { text: sub }) : null]), actions ? el('div', { class: 'row-end' }, actions) : null]), ...[].concat(children)]);
export const btn = (label, onclick, { kind = '', ic, title, disabled } = {}) => el('button', { class: `btn ${kind}`, onclick, title, disabled }, [ic ? el('span', { class: 'mi', text: ic }) : null, el('span', { text: label })]);
export const tabs = (items, onPick, initial = items[0][0]) => {
  const bar = el('div', { class: 'tabs' });
  const set = (k) => { for (const b of bar.children) b.classList.toggle('on', b.dataset.k === k); onPick(k); };
  for (const [k, label] of items) bar.append(el('button', { 'data-k': k, text: label, onclick: () => set(k) }));
  setTimeout(() => set(initial), 0);
  return Object.assign(bar, { set });
};
export const meter = (v, { max = 1, color = '#4E9A8E' } = {}) => el('span', { class: 'meter' }, el('i', { style: `width:${Math.max(0, Math.min(100, (N(v) / max) * 100)).toFixed(0)}%;background:${color}` }));
