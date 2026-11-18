/**
 * The path every tile takes from compiled definition to the vSpec that mounts:
 * theme → governed parameters → labels → (tables) column widths.
 * Shared by app.js and tools/compile-adapter.mjs, so the offline compile check
 * runs exactly what the browser runs.
 */
import { applyEach, themeVSpec } from './theme.js';

export const GAIN_DEFAULT = 25;

/**
 * Pixel column widths for a table at `width` (tables only), so no header or value ellipsises.
 * Every column gets at least what its header needs (label length at the font size, plus room
 * for a sort arrow or an indicator icon); the name column (`tile.flex`) takes what is left and
 * wraps, and the rows grow to the number of lines the longest name (`tile.longest` characters)
 * then needs. Narrow slots drop the font a point. Shares only add room above the minimums.
 */
export const widthOps = (tile, width) => {
  const font = width < 760 ? 11 : 12;
  const perChar = font * 0.58;
  const indicators = new Set((tile.ops ?? []).filter((op) => op.name === 'setColumnRepresentation' && op.payload?.representation === 'indicator').map((op) => op.ref));
  const sorted = tile.sort?.[0]?.by;
  // Below 760px a table may drop columns another tab shows in full (`tile.narrowHide`).
  const hidden = new Set(width < 760 ? tile.narrowHide ?? [] : []);
  const refs = Object.keys(tile.fitColumns ?? {}).filter((ref) => !hidden.has(ref));
  const flex = tile.flex ?? 'uni';
  const minOf = (ref) => Math.max(tile.minWidths?.[ref] ?? 0, Math.ceil((tile.columnLabels?.[ref] ?? ref).length * perChar) + 22 + (ref === sorted ? 26 : 0) + (indicators.has(ref) ? 10 : 0));
  const px = {};
  for (const ref of refs) if (ref !== flex) px[ref] = Math.max(minOf(ref), Math.floor(width * tile.fitColumns[ref] * 0.9));
  let rest = width - Object.values(px).reduce((a, b) => a + b, 0);
  // The name column wants one line for the longest name (bold): take share-based extra back from the others.
  const bodyChar = font * 0.49; // bold body text, measured on the 1440 screenshots
  const need = Math.ceil((tile.longest ?? 24) * bodyChar) + 24;
  if (rest < need) {
    for (const ref of Object.keys(px)) { const take = Math.min(px[ref] - minOf(ref), need - rest); px[ref] -= take; rest += take; if (rest >= need) break; }
  }
  const ops = [
    { name: 'setTableAllColumnsResponsiveWidth', payload: false },
    { name: 'setTableBodyFontSize', payload: font },
    { name: 'setTableHeaderFontSize', payload: font },
  ];
  if (refs.includes(flex)) {
    px[flex] = Math.max(90, rest - 12); // a little slack: the table's own borders
    // Words wrap whole, so allow a little slack per line.
    const lines = Math.min(3, Math.ceil((need - 24) / Math.max(1, px[flex] - 24 - bodyChar)));
    ops.push({ name: 'setTableWordWrap', payload: lines > 1 });
    ops.push({ name: 'setTableFixedRowHeightValue', payload: Math.max(tile.rowHeight ?? 28, lines * Math.round(font * 1.35) + 12) });
  }
  for (const ref of tile.narrowHide ?? []) {
    const item = tile.resolvedRefs?.[ref];
    if (item) ops.push({ name: 'setColumnHidden', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, hidden: hidden.has(ref) } });
  }
  return [...ops, ...refs.flatMap((ref) => {
    const item = tile.resolvedRefs?.[ref];
    return item ? [{ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${px[ref]}px` } }] : [];
  })];
};

/** The what-if parameter operation for the projected-rank KPI. */
export const scoreParamOp = (item, score) => ({ name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, parameterName: 'score', value: { type: 'static', value: score } } });

/** Theme a compiled tile and bind its governed parameters; returns { vSpec, failed }. */
export const prepareTile = async (tile, available, { dataBinding = {}, ourScore }) => {
  const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, available, tile);
  let { vSpec } = themed;
  const failed = [...themed.failed];
  // Governed parameters bound before mount: our score as the benchmark; the what-if score.
  const paramOps = [];
  for (const [ref, item] of Object.entries(tile.resolvedRefs ?? {})) {
    const m = tile.measures?.find((x) => x.ref === ref);
    if (!m) continue;
    if (m.name === 'Score Gap to Benchmark') paramOps.push({ name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, parameterName: 'benchmark', value: { type: 'static', value: ourScore } } });
    if (m.name === 'Projected Rank at Score') paramOps.push(scoreParamOp(item, ourScore + GAIN_DEFAULT));
  }
  if (paramOps.length) {
    const out = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding }, available, tile.type, paramOps);
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
  return item ? [{ name: 'setMeasureDataLabelsShow', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, show: width >= tile.labelsMinWidth } }] : [];
});

/** Does this tile adapt to its slot's width (re-applied on resize, never remounted)? */
export const fits = (tile) => Boolean(tile.fitColumns || tile.labelsMinWidth);

/** The width-dependent operations for a tile. */
export const fitOps = (tile, width) => (tile.fitColumns ? widthOps(tile, width) : tile.labelsMinWidth ? labelOps(tile, width) : []);

/** Width-dependent operations applied just before mount, at the slot's width. */
export const fitTile = async (tile, vSpec, available, width, dataBinding = {}) => {
  if (!fits(tile)) return { vSpec, failed: [] };
  const out = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding }, available, tile.type, fitOps(tile, width));
  return { vSpec: out.vSpec, failed: out.failed };
};
