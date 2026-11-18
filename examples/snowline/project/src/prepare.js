/**
 * The path every tile takes from compiled definition to the vSpec that mounts:
 * theme → governed what-if parameters → labels → (tables) column widths.
 * Shared by app.js and tools/compile-adapter.mjs, so the offline compile check runs exactly what
 * the browser runs. Adapted from the league-table-planner example (prepare.js).
 */
import { applyEach, themeVSpec } from './theme.js';

/** The marketing what-if levers, as the layer's measure parameters name them. */
export const LEVERS = {
  budget: { label: 'Marketing budget', min: 50000, max: 1000000, step: 25000, value: 250000, fmt: (v) => `€${Math.round(v / 1000)}k` },
  minSnow: { label: 'Powder: fresh snow of at least', min: 20, max: 80, step: 5, value: 40, fmt: (v) => `${v} cm` },
  maxCrowd: { label: 'Quiet: Crowd Index below', min: 45, max: 75, step: 1, value: 55, fmt: (v) => `${v}` },
};
/** Which parameters each parameterised measure declares (from the layer). */
const RULE = ['minSnow', 'maxCrowd'];
const PARAMS_OF = { 'Suggested Budget': ['budget', ...RULE], 'Target Weeks': RULE, 'Target Weeks This Season': RULE, 'Target Weeks Last Season': RULE, 'Target Weeks Change vs Last Season': RULE };

const itemOf = (item) => ({ dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature });

/** setMeasureDefinedParameter for every parameterised measure on a tile, at the given lever values. */
export const paramOps = (tile, values) => (tile.measures ?? []).flatMap((m) => {
  const item = tile.resolvedRefs?.[m.ref];
  const names = PARAMS_OF[m.name];
  if (!item || !names) return [];
  return names.map((parameterName) => ({ name: 'setMeasureDefinedParameter', payload: { ...itemOf(item), parameterName, value: { type: 'static', value: values[parameterName] } } }));
});


/**
 * Pixel column widths for a table at `width`, so no header or value ellipsises. Every column gets
 * at least what its header needs; the name column (`tile.flex`) takes what is left.
 */
export const widthOps = (tile, width) => {
  const font = width < 700 ? 11 : 12;
  const perChar = font * 0.6; // headers are bold; 0.56 left "Cro…" and "Ra…" at 1280
  const indicators = new Set((tile.ops ?? []).filter((op) => op.name === 'setColumnRepresentation' && op.payload?.representation === 'indicator').map((op) => op.ref));
  const sorted = tile.sort?.[0]?.by;
  const refs = Object.keys(tile.fitColumns ?? {});
  const flex = tile.flex ?? 'resort';
  // A column needs room for its header or its longest value (`tile.minChars`), whichever is wider.
  const charsOf = (ref) => Math.max((tile.columnLabels?.[ref] ?? ref).length, tile.minChars?.[ref] ?? 0);
  const minOf = (ref) => Math.ceil(charsOf(ref) * perChar) + 28 + (ref === sorted ? 22 : 0) + (indicators.has(ref) ? 14 : 0);
  const px = {};
  for (const ref of refs) if (ref !== flex) px[ref] = Math.max(minOf(ref), Math.floor(width * tile.fitColumns[ref] * 0.92));
  let rest = width - Object.values(px).reduce((a, b) => a + b, 0);
  const need = Math.ceil((tile.longest ?? 18) * font * 0.56) + 24;
  if (rest < need) {
    for (const ref of Object.keys(px)) { const take = Math.min(px[ref] - minOf(ref), need - rest); px[ref] -= take; rest += take; if (rest >= need) break; }
  }
  if (rest < need) { // still too wide: scale the fixed columns down proportionally
    const fixed = Object.values(px).reduce((a, b) => a + b, 0);
    const k = Math.max(0.5, (width - need) / fixed);
    for (const ref of Object.keys(px)) px[ref] = Math.floor(px[ref] * k);
    rest = width - Object.values(px).reduce((a, b) => a + b, 0);
  }
  if (refs.includes(flex)) px[flex] = Math.max(90, rest - 14);
  return [
    { name: 'setTableAllColumnsResponsiveWidth', payload: false },
    { name: 'setTableBodyFontSize', payload: font },
    { name: 'setTableHeaderFontSize', payload: font },
    ...refs.flatMap((ref) => {
      const item = tile.resolvedRefs?.[ref];
      return item ? [{ name: 'setColumnWidth', payload: { ...itemOf(item), width: `${px[ref]}px` } }] : [];
    }),
  ];
};

/** Theme a compiled tile and bind its governed parameters; returns { vSpec, failed }. */
export const prepareTile = async (tile, available, { dataBinding = {}, levers = Object.fromEntries(Object.entries(LEVERS).map(([k, v]) => [k, v.value])) } = {}) => {
  const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, available, tile);
  let { vSpec } = themed;
  const failed = [...themed.failed];
  const pOps = paramOps(tile, levers);
  if (pOps.length) {
    const out = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding }, available, tile.type, pOps);
    failed.push(...out.failed.map((f) => ({ ...f, on: 'param' })));
    vSpec = out.vSpec;
  }
  if (tile.labels && tile.type !== 'table') {
    // By position: two selections of one stored measure share a data-item key.
    const relabel = (items, decl) => items?.map((item, i) => (decl?.[i] && tile.labels[decl[i].ref] ? { ...item, label: tile.labels[decl[i].ref] } : item));
    vSpec = { ...vSpec, measures: relabel(vSpec.measures, tile.measures), dimensions: relabel(vSpec.dimensions, tile.dimensions) };
  }
  return { vSpec, failed };
};

/** Charts too narrow for their per-bar labels drop them rather than ellipsise them. */
const labelOps = (tile, width) => (tile.measures ?? []).flatMap((m) => {
  const item = tile.resolvedRefs?.[m.ref];
  return item ? [{ name: 'setMeasureDataLabelsShow', payload: { ...itemOf(item), show: width >= tile.labelsMinWidth } }] : [];
});

/** Does this tile adapt to its slot's width (re-applied on resize, never remounted)? */
export const fits = (tile) => Boolean(tile.fitColumns || tile.labelsMinWidth);
export const fitOps = (tile, width) => (tile.fitColumns ? widthOps(tile, width) : tile.labelsMinWidth ? labelOps(tile, width) : []);

/** Width-dependent operations applied just before mount, at the slot's width. */
export const fitTile = async (tile, vSpec, available, width, dataBinding = {}) => {
  if (!fits(tile)) return { vSpec, failed: [] };
  const out = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding }, available, tile.type, fitOps(tile, width));
  return { vSpec: out.vSpec, failed: out.failed };
};
