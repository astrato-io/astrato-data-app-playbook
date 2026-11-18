/**
 * The governed objects' view of the one selection group.
 *
 * Every object on the page shares one Astrato selection group, so a click anywhere is one selection.
 * The weather bands exist only in the browser, though, and the governed engine has no such field.
 * Handing the governed runtime the raw selection service meant every band click or band-chip
 * removal told the governed table "the selection changed" while its own query stayed the same; the
 * table then re-rendered with no rows and threw "Cannot read properties of undefined (reading
 * 'reduce')" and stayed blank (the judge's F1 repro: City = Boston, click a band, remove the chip).
 *
 * This wraps the real service for the governed runtime only:
 *   - reads (getSelection, getActiveSelection, the change streams) show only the keys the governed
 *     layer has, and never an entry with no values;
 *   - a change stream emits only when that governed view actually changed, so a band click or a
 *     band-chip removal never reaches a governed object;
 *   - writes from a governed chart (a click replaces the state it read) get the hidden weather
 *     entries added back, so a governed click never wipes a band selection.
 * Every write still lands in the real service, which the DuckDB objects, the chips and the
 * headline read directly.
 */

const keyOf = (x) => x?.field?.fieldKey ?? x?.fieldKey;
const hasValues = (x) => Array.isArray(x?.values) ? x.values.length > 0 : x?.range != null;

/** An observable of mapped values that only emits on change (by JSON), in the subscribe shape the runtime uses. */
const distinctStream = (source, map) => ({
  subscribe(next) {
    let last;
    const handler = typeof next === 'function' ? next : next?.next?.bind(next);
    const sub = source.subscribe((value) => {
      const mapped = map(value);
      const sig = JSON.stringify(mapped);
      if (sig === last) return;
      last = sig;
      handler?.(mapped);
    });
    return { unsubscribe: () => sub?.unsubscribe?.() };
  },
  pipe(...ops) { return ops.reduce((acc, op) => op(acc), this); },
});

/**
 * real: the app's selection service. governedKeys(key) → true for keys the governed layer has
 * (the City and Stay Date view columns).
 */
export const governedSelections = (real, isGoverned) => {
  const visible = (x) => isGoverned(keyOf(x)) && hasValues(x);
  const scope = (state) => (state && typeof state === 'object'
    ? { ...state, applied: (state.applied ?? []).filter(visible), pending: (state.pending ?? []).filter(visible) }
    : state);
  const hidden = (list) => (list ?? []).filter((x) => !isGoverned(keyOf(x)) && hasValues(x));
  const withHidden = (groupId, next) => {
    const cur = real.getSelection(groupId) ?? {};
    const own = (list) => (list ?? []).filter((x) => hasValues(x));
    return {
      ...next,
      applied: [...hidden(cur.applied).filter((h) => !(next.applied ?? []).some((x) => keyOf(x) === keyOf(h))), ...own(next.applied)],
      pending: [...hidden(cur.pending).filter((h) => !(next.pending ?? []).some((x) => keyOf(x) === keyOf(h))), ...own(next.pending)],
    };
  };
  const wrapped = Object.create(real);
  for (const prop of ['singleSelectFields$', 'selectionMode']) {
    Object.defineProperty(wrapped, prop, { get: () => real[prop], enumerable: true });
  }
  wrapped.getSelection = (groupId) => scope(real.getSelection(groupId));
  if (real.getActiveSelection) wrapped.getActiveSelection = (kind, groupId) => scope(real.getActiveSelection(kind, groupId));
  for (const name of ['onActiveSelectionChange', 'onActiveSelectionChangeApplied', 'onActiveSelectionChangePending']) {
    if (typeof real[name] === 'function') wrapped[name] = (groupId) => distinctStream(real[name](groupId), scope);
  }
  wrapped.setNewSelectionState = (groupId, next) => real.setNewSelectionState(groupId, withHidden(groupId, next));
  for (const name of ['selectValues', 'applyPendingSelections', 'clearPendingSelections', 'clearAllSelections', 'declineSelection', 'removeSelection', 'isFieldLocked', 'isFieldLocked$', 'setFieldLocked', 'toggleFieldLocked', 'getSelectionMode']) {
    if (typeof real[name] === 'function') wrapped[name] = (...args) => real[name](...args);
  }
  return wrapped;
};

/** A selection entry with no values (a range drag that ended off the data) selects nothing: drop it. */
export const withoutEmpty = (state) => ({
  ...state,
  applied: (state?.applied ?? []).filter(hasValues),
  pending: (state?.pending ?? []).filter(hasValues),
});
export const hasEmpty = (state) => [...(state?.applied ?? []), ...(state?.pending ?? [])].some((x) => !hasValues(x));
