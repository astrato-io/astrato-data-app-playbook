# Theming: colours, fonts, icons, dark labels, RTL

The runtime has **no theme input**: every chart renders the built-in light look (white ground, dark
text, Roboto) until appearance operations write styling into its vSpec. Charts use no shadow DOM,
so host CSS reaches their DOM parts but not their canvases.

---

## Chart text renders in a serif font

- **Symptom:** axis labels, legends or table cells in Times-like serif; a custom page font is
  ignored by axes.
- **Cause:** the chart theme hard-codes `fonts.general.fontFamily: "Roboto"` with no fallback and
  ships no webfont. Canvas text (`bar`, `line`, `gauge`, `table` paint to `<canvas>`) uses only
  fonts that have **finished loading**; CSS does not reach it.
- **Fix:**
  1. Load Roboto (self-hosted preferably) and your page font.
  2. Force your font on DOM text, with `!important` because the package injects CSS at runtime:
     `.viz-surface, .viz-surface * { font-family: var(--font-family) !important; }`, and on `body`
     (filter popovers portal there).
  3. `await document.fonts.load('12px Roboto')` (and your font) before the first mount.
  4. To make canvas text use your font, the theme font must change in the vendored runtime (there
     is no option); tables also take `setTableHeaderFontFamily` / `setTableBodyFontFamily`.
  Check: `ctx.measureText` for `12px Roboto` vs `12px serif` must differ.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## Table icons render as boxes or blanks

- **Cause:** table indicator and sort icons are Material Icons ligatures/code points that the
  package does not load; a `.viz-surface *` font rule replaces their font.
- **Fix:** load Material Icons and exempt them from your font rule:
  `[data-testid="indicator-icon"], [data-testid="indicator-icon"] *, .material-icons`. Check
  `document.fonts.check('16px "Material Icons"')`. Or hide `[data-testid="indicator-icon"]`.
- **Verified on:** visualizations 0.4.0, 2026-09/10.

## Categorical colours collide, shift or ignore the palette

- **Symptoms:** two categories share a colour while palette entries go unused; a category changes
  colour when a filter removes another; three colours on three slices draw two.
- **Causes:**
  - Categorical colouring defaults to **persistent colours**, which hash each value onto the palette.
  - Without persistence the palette is dealt by position in the result (sort order), not by value,
    and a selection changes the positions. First mount and `updateInstance` have been seen to use
    different entries (0 and 2 vs 2 and 3) for two series. Repeated colours in a palette are not
    honoured.
- **Fix:**
  - When colour carries meaning, make each category its own measure and pin it:
    `setColoringType 'perEachMeasure'` + `setMeasureGraphColor { ...dataItem, graphColor }`
    (verified 0.5.2), with a measure filter per category where the measure is a raw field.
  - Otherwise send `setColoringPersistentColors false` before `setCustomPaletteColors`, sort the
    dimension alphabetically, and re-deal the palette to the categories left after a filter.
  - Supply more well-separated colours than categories; use near-identical shades rather than exact
    repeats. Sort stacked two-dimension bars by both dimensions to keep colours stable.
  - Verify by isolating one category and sampling canvas pixels, not by eye.
- **Verified on:** visualizations 0.4.0 and 0.5.2, 2026-09/10.

## A palette or colour operation is rejected

- Colours must match `^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`: no `transparent`, `rgba()` or names
  (use `#00000000` for transparent where accepted; filter backgrounds accept hex only).
- `setChartPalette 'custom-palette'` is rejected for categorical and gradient colouring;
  `setCustomPaletteColors { colors: [...] }` and `setCustomGradientColors` switch to the custom
  palette on their own.
- Gradients need `setCustomGradientColors`, not `setCustomPaletteColors`; without it every cell is
  nearly one hue. Gradient colouring takes a raw field + aggregation only: colour by a ratio via a
  layer expression field.
- `perEachDimension` is refused on line charts (use `categorical`); `sankey` needs `single` or
  `perEachDimension` (not `categorical`); a `treemap` draws default purple/navy unless themed with
  `setColoringType perEachDimension` + a custom palette.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## Highlight one category

- **Fix (0.5.2):** write `vSpec.coloring.overwrites = [{ operator: 'equals', value, color,
  backgroundColor: null, dataItemId: <dimension dataItemInternalKey> }]` and `updateInstance`; works
  on bars (single and gradient colouring) and scatter, no remount.
- **Alternative:** a 0/1 expression field, `setColoringType gradient` + `setCustomGradientColors
  [grey, accent]` + `setColoringGradientField { key, sourceKind: 'field', aggregation: 'MAX' }`
  with min 0, max 1. Data labels follow the point colour.
- **Verified on:** visualizations 0.5.2, 2026-10/11.

## Chart labels are unreadable on a dark background

- **Symptom:** value labels draw dark on a dark card.
- **Cause and fix by type:**
  - **Line:** the renderer uses `isColored ? textColor : dark`, so
    `setMeasureDataLabelIsColored true` + `setMeasureDataLabelTextColor <light>` + backdrop off.
    `isColored false` always draws dark. Lines draw some point labels even without data labels in
    the spec, so theme every line.
  - **Bar:** no text-colour operation from 0.5 (and on 0.4 it was ignored for labels outside the
    bar). The renderer picks black or white **against the label backdrop**:
    `setMeasureDataLabelShowBackdrop true` + `setMeasureDataLabelBackdropColor <card colour>` (not
    transparent), with placements `[{ position: 'outside' }, { position: 'inside' }]`.
  - **Combo:** no text-colour operation; no labels by default.
  - **Sankey:** node labels need `setSankeyNodeLabelShowBackdrop` + a backdrop colour; column headers
    are a fixed dark blue: turn them off and draw HTML headers.
  - **Brush-range bubbles** (labels at each end of a dragged range) are DOM with inline white fill:
    `.viz-surface [data-key*='-bubble-'], .viz-surface [data-key*='-bubble-'] input
    { background-color: var(--card) !important; color: var(--text) !important; }`.
- After any theme change, bump the cache key of stored vSpecs, or the old look stays cached.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## Theming operations by type (quick reference)

- Axes: `setAxisLabelColor { axisName, labelColor }`, `setAxisTitleColor`, `setAxisLineColor`,
  `setAxisTickColor`, for `axisName` in `dimension | primaryMeasure | secondaryMeasure`.
- Legend: `setLegendEnabled`, `setLegendItemLabelFill`, `setLegendItemLabelFontSize`.
- `number`: `setNumberFontColor`, `setNumberFontSize`, `setNumberFontWeight`, `setNumberFontFamily`.
- `filter`: `setFilterBackgroundColor` and `setFilterFontStyle { fontColor, fontSize }` together
  (a dark background alone leaves dark text).
- `table`: `setTableBackgroundColor`, `…Odd/EvenBackgroundColor`, `…HeaderBackgroundColor`,
  `…HeaderFontColor`, `…AllColumnsFontColor`, `…BorderColor`, `…HighlightBackgroundColor`.
- Order for palettes: `setColoringType` → (`setColoringPersistentColors false`) →
  `setCustomPaletteColors`.
- SVG-drawn types only: `.viz-surface svg > rect:first-child[fill='#ffffff'] { fill: transparent }`
  makes the ground transparent; canvas types composite correctly without it.
- **Verified on:** visualizations 0.4.0, 2026-09.

## Checking colours that are painted on a canvas

- **Fix:** sample pixels from the surface's canvases (`getImageData`, skip alpha < 200) and count
  colours. To prove which category got which colour, isolate one category and sample again. Legends
  are canvas too.
- **Verified on:** visualizations 0.4.0, 2026-09.

## Right-to-left (Hebrew, Arabic) layouts

- The native table has no RTL mode: render an RTL statement as your own pivot from governed queries.
- `setInvertAxis { invertAxis: true }` makes time run right to left; `changeMeasureAxis
  { secondaryAxis: true }` per measure puts the value axis on the right; `mmyyyy` gives
  language-neutral months; setting `vSpec.measures[i].label` after compile renames legend entries;
  table `reorderColumn { source, target }` swaps columns.
- No operation moves horizontal-bar labels to the right. The filter dropdown breaks under
  `direction: rtl`: reverse its flex rows by structure instead.
- Isolate signed amounts and Latin formulas inside RTL text with LRI/PDI.
- **Verified on:** visualizations 0.4.x, 2026-10.

## Translating an app, including data values

- **Fix:** translate page text with a dictionary `MutationObserver` (native tables and filters render
  DOM text too). For data values, wrap `engine.getData` once: untranslate strings in the request,
  translate a copy of the response, and keep an untouched path for code that must see source
  values. On a language switch, remap applied selection values, then release and remount objects.
  Selections and writebacks keep source-language values.
- **Verified on:** 2026-10/11.
