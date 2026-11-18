/**
 * The field catalogue, built at run time from whatever semantic layer the app is bound to.
 *
 * Rows are the layer's view columns (string, date and boolean ones, plus any column a stored
 * dimension points at), named and described by the stored dimension when there is one. A row is
 * always the raw column key, because a chart click and a selection both select on the column.
 * Figures are the layer's governed measures, with the layer's own format pattern and description.
 * Nothing here names a field: the same code works on any layer.
 */
const ROW_TYPES = ['string', 'date', 'datetime', 'timestamp', 'boolean'];

export const buildCatalogue = (availableFields) => {
  const stored = new Map();
  for (const f of availableFields) {
    const key = f.kind === 'dimension' ? f.item?.dimension?.fieldKey : null;
    if (key) stored.set(key, f);
  }
  const rows = availableFields
    .filter((f) => f.kind === 'field' && (ROW_TYPES.includes(f.dataType) || stored.has(f.fieldKey)))
    .map((f) => {
      const dim = stored.get(f.fieldKey);
      return { key: f.fieldKey, name: dim?.name ?? f.name, desc: dim?.item?.description ?? '', date: /date|time/.test(f.dataType), governed: !!dim };
    })
    // Layer dimensions first, each group alphabetical.
    .sort((a, b) => Number(b.governed) - Number(a.governed) || a.name.localeCompare(b.name));
  const figures = availableFields
    .filter((f) => f.kind === 'calculation' || f.kind === 'measure')
    .map((f) => ({ key: f.fieldKey, name: f.name, desc: f.item?.description ?? '', pattern: f.item?.calculation?.format?.pattern ?? f.item?.format?.pattern ?? '#,##0' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const byKey = new Map([...rows, ...figures].map((x) => [x.key, x]));
  const byName = (list, name) => list.find((x) => x.name === name);
  return { rows, figures, get: (key) => byKey.get(key), row: (name) => byName(rows, name), figure: (name) => byName(figures, name) };
};

/** A layer format pattern as an Excel number format ('$#,###.00' → '$#,##0.00', '##0.0%' → '0.0%'). */
export const excelFormat = (pattern = '#,##0') => pattern.replace(/#,###/g, '#,##0').replace(/^([^#0]*)#+0/, '$10');

/** Is this figure a ratio? Its period change is then a difference in points, not a growth rate. */
export const isRatio = (figure) => /%/.test(figure?.pattern ?? '');
