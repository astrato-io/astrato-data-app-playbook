/**
 * Offer flags: the revenue manager's one recorded action, with maker–checker and an audit trail.
 *
 * A revenue manager flags a city-week for a wet-night offer at the levers on screen (the uplift,
 * the discount and the wet-night share), with the governed estimate of what it adds. A general
 * manager approves or rejects it. The proposer can never approve their own flag; every attempt,
 * refused ones included, is written to the audit trail. Reset empties both.
 *
 * LABELLED FALLBACK: this is a browser-only demo store (localStorage, this browser only). A viewer of
 * this example cannot write to the warehouse, so nothing here reaches Astrato or Snowflake. In
 * production the same records would be writeback rows in governed views.
 *
 * `sandbox(fn)` runs fn against an in-memory copy and restores the real store afterwards, so the
 * app's own check exercises the rules through the real buttons without keeping anything.
 */
const KEY = 'hotel-weather.offer-flags.v1';

export const ROLES = {
  rm: { id: 'rm', person: 'Alex Reed', title: 'Revenue manager', can: 'propose' },
  gm: { id: 'gm', person: 'Sam Ortiz', title: 'General manager', can: 'decide' },
};

/** The next `n` Mondays from `from`, as YYYY-MM-DD: the weeks a flag can be raised for. */
export const upcomingWeeks = (from = new Date(), n = 6) => {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return Array.from({ length: n }, (_, i) => new Date(d.getTime() + i * 7 * 86400000).toISOString().slice(0, 10));
};

const empty = () => ({ items: [], audit: [], seq: 0 });

const browserStorage = () => {
  try {
    const s = window.localStorage;
    return { read: () => s.getItem(KEY), write: (v) => s.setItem(KEY, v), clear: () => s.removeItem(KEY) };
  } catch {
    return null;
  }
};
const memoryStorage = (initial = null) => {
  let value = initial;
  return { read: () => value, write: (v) => { value = v; }, clear: () => { value = null; } };
};

export const createOfferStore = ({ now = () => new Date() } = {}) => {
  let storage = browserStorage() ?? memoryStorage();
  const listeners = new Set();
  const load = () => {
    try { return { ...empty(), ...JSON.parse(storage.read() ?? 'null') }; } catch { return empty(); }
  };
  let state = load();
  const save = () => {
    try { storage.write(JSON.stringify(state)); } catch { /* storage full or blocked: the state stays in memory */ }
    for (const fn of listeners) fn(state);
  };
  const stamp = () => now().toISOString();
  const log = (actor, action, item, outcome, detail = '') => {
    state.audit.unshift({ at: stamp(), actor: actor.id, person: actor.person, role: actor.title, action, flag: item ? `${item.city} · w/c ${item.week}` : '—', id: item?.id ?? null, outcome, detail });
  };

  const api = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Maker: flag a city-week. levers: { wet_share, occ_uplift_pts, rate_discount_pct }; estGain: governed estimate ($). */
    propose(actor, { city, week, levers, estGain }) {
      const draft = { city, week };
      if (actor.can !== 'propose') { log(actor, 'Propose', draft, 'refused', 'Only a revenue manager raises a flag.'); save(); return { ok: false, message: 'Only a revenue manager can raise a flag.' }; }
      if (!city || !week) { return { ok: false, message: 'Pick a city and a week.' }; }
      if (state.items.some((x) => x.city === city && x.week === week && x.status === 'proposed')) {
        log(actor, 'Propose', draft, 'refused', 'An open flag already exists for this city-week.'); save();
        return { ok: false, message: `${city}, week of ${week} is already flagged and waiting for a decision.` };
      }
      state.seq += 1;
      const item = { id: `F${String(state.seq).padStart(3, '0')}`, city, week, levers, estGain, status: 'proposed', proposedBy: actor.id, proposedAt: stamp(), decidedBy: null, decidedAt: null };
      state.items.unshift(item);
      log(actor, 'Propose', item, 'done', `Uplift ${levers.occ_uplift_pts} pts, discount ${levers.rate_discount_pct}%, wet share ${Math.round(levers.wet_share * 100)}%; governed estimate ${estGain == null ? 'n/a' : `$${Math.round(estGain).toLocaleString('en-US')}`}`);
      save();
      return { ok: true, message: `${item.id} flagged: ${city}, week of ${week}. Waiting for a general manager.`, item };
    },

    /** Checker: approve or reject. The proposer can never decide their own flag. */
    decide(actor, id, decision) {
      const item = state.items.find((x) => x.id === id);
      const verb = decision === 'approved' ? 'Approve' : 'Reject';
      if (!item) return { ok: false, message: 'No such flag.' };
      if (item.status !== 'proposed') { log(actor, verb, item, 'refused', `Already ${item.status}.`); save(); return { ok: false, message: `${id} is already ${item.status}.` }; }
      if (actor.id === item.proposedBy) { log(actor, verb, item, 'refused', 'Maker–checker: the proposer cannot decide their own flag.'); save(); return { ok: false, message: `Maker–checker: ${actor.person} raised ${id}, so cannot ${verb.toLowerCase()} it.` }; }
      if (actor.can !== 'decide') { log(actor, verb, item, 'refused', 'Only a general manager decides.'); save(); return { ok: false, message: 'Only a general manager can approve or reject.' }; }
      item.status = decision;
      item.decidedBy = actor.id;
      item.decidedAt = stamp();
      log(actor, verb, item, 'done');
      save();
      return { ok: true, message: `${id} ${decision} by ${actor.person}.`, item };
    },

    reset(actor) {
      state = empty();
      log(actor, 'Reset', null, 'done', 'All flags and the trail before this entry were cleared.');
      save();
    },

    /** Run fn against an in-memory copy; the real store is untouched and restored afterwards. */
    async sandbox(fn) {
      const realStorage = storage;
      const realState = state;
      storage = memoryStorage(JSON.stringify(state));
      state = load();
      try { return await fn(); } finally {
        storage = realStorage;
        state = realState;
        for (const l of listeners) l(state);
      }
    },
  };
  return api;
};
