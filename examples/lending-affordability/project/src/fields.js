/**
 * Field resolution.
 *
 * Field keys are opaque engine identifiers. Nothing here builds or parses one
 * from a name: a field is looked up in the live catalogue the runtime handed
 * us, and its key is used verbatim. A tile is declared against semantic-layer
 * item *names*, and a name that does not resolve is reported, never guessed.
 */

const readKind = (field) => {
  const kind = field?.kind;
  return kind === 'dimension' || kind === 'measure' || kind === 'calculation' ? kind : 'field';
};

/**
 * The single column-and-aggregation a governed calculation is defined as, when
 * it is exactly that (`{m1}` over one column) and nothing more. Read from the
 * layer's own definition of the measure, never written here.
 *
 * Needed because a measure-only object (a `number`) cannot receive selections
 * through a calculation key in this package version — the runtime's
 * connectivity check has no column to test — while the same aggregation over
 * the column it is defined on narrows like any other object.
 */
const columnOf = (field) => {
  const calculation = field?.item?.calculation;
  if (!calculation || calculation.calculation !== '{m1}' || !Array.isArray(calculation.measures)) return {};
  const [measure, ...rest] = calculation.measures;
  if (rest.length > 0 || !measure || !Array.isArray(measure.fieldKeys) || measure.fieldKeys.length !== 1) return {};
  if (typeof measure.aggregation !== 'string') return {};
  const aggregation = measure.distinct ? `${measure.aggregation}_DISTINCT` : measure.aggregation;
  return { column: { fieldKey: measure.fieldKeys[0], aggregation } };
};

/** @param {unknown[]} fields the catalogue from createVisualizationAvailableFields */
export const createFieldIndex = (fields) => {
  // Skip anything that is not a usable field rather than letting one odd entry
  // fail the whole bootstrap.
  const all = fields.flatMap((field) => {
    const { fieldKey, name } = field ?? {};
    if (typeof fieldKey !== 'string' || !fieldKey || typeof name !== 'string') return [];
    // A governed dimension wraps one view column. A chart click selects on
    // that column's key, not the dimension's, so both are kept together.
    const rawKey = field?.item?.dimension?.fieldKey;
    return [{ fieldKey, kind: readKind(field), name, ...(typeof rawKey === 'string' ? { rawKey } : {}), ...columnOf(field) }];
  });

  const norm = (name) => name.trim().toLowerCase();
  const byKind = (name, kind) => all.find((field) => field.kind === kind && norm(field.name) === norm(name));
  /** The governed dimension over a raw column, when there is one. */
  const dimensionOver = (rawKey) => all.find((field) => field.kind === 'dimension' && field.rawKey === rawKey);

  return {
    all,
    dimensionOver,
    /**
     * A governed dimension. Several dimensions in this layer share a name with
     * the raw view column behind them (`Age Band` is both `[dimension].[Age
     * Band]` and `[ER Visits].[Age Band]`), so kind is always stated.
     */
    dimension: (name) => byKind(name, 'dimension'),
    /** A governed measure. The layer stores these as calculations. */
    measure: (name) => byKind(name, 'calculation') ?? byKind(name, 'measure'),
    /**
     * A physical view field, never the semantic item of the same name. Several
     * views share column names here (`Country`, `Label`), so a view narrows the
     * match to the field whose catalogue key names that view.
     */
    raw: (name, view) => {
      const matches = all.filter((field) => field.kind === 'field' && norm(field.name) === norm(name));
      if (!view) return matches[0];
      return matches.find((field) => field.fieldKey === `[${view}].[${name}]`) ?? matches.find((field) => field.fieldKey.includes(`[${view}]`));
    },
    /**
     * The reader-facing name of a key, for the selection bar: a raw column's
     * key reads as the dimension built on it.
     */
    nameOf: (fieldKey) =>
      dimensionOver(fieldKey)?.name ?? all.find((field) => field.fieldKey === fieldKey)?.name ?? fieldKey,
    /** Every key a selection on this dimension may carry. */
    keysOf: (field) => [field.fieldKey, ...(field.rawKey ? [field.rawKey] : [])],
  };
};

/** A measure reference: raw fields carry an aggregation, semantic items never do. */
export const measureRef = (field, ref, aggregation = 'SUM') =>
  field.kind === 'field' ? { aggregation, fieldKey: field.fieldKey, ref } : { fieldKey: field.fieldKey, ref };
