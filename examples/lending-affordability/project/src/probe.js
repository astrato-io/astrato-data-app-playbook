/**
 * Text-only diagnostics.
 *
 * This app is checked without looking at it. Everything a reviewer needs to
 * judge it is exposed as data on `window.__astrato`: every uncaught error, each
 * object's measured box and what it actually drew, and the rows each object's
 * own query returned. Nothing here writes to disk or captures pixels.
 */

/** Uncaught errors and unhandled rejections, in order. */
export const errors = [];
window.addEventListener('error', (event) => {
  errors.push({ kind: 'error', message: String(event.message), source: `${event.filename ?? ''}:${event.lineno ?? ''}`, at: Date.now() });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  errors.push({ kind: 'rejection', message: String(reason?.message ?? reason), stack: String(reason?.stack ?? '').split('\n').slice(0, 4).join(' | '), at: Date.now() });
});

/**
 * Every query, newest last. A chart's request carries no object id, so each
 * entry is matched to its object by the set of field keys it asks for.
 */
export const queries = [];

/** Every field key named under a value, ignoring filters (selections live there). */
export const keySetOf = (value) => {
  const keys = new Set();
  const walk = (node, parent) => {
    if (Array.isArray(node)) return node.forEach((item) => walk(item, parent));
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'filters' || key === 'associativeListFilter' || key === 'format') continue;
      if ((key === 'itemKey' || key === 'fieldKey') && typeof child === 'string') keys.add(child);
      else if (key === 'fieldKeys' && Array.isArray(child)) child.forEach((entry) => typeof entry === 'string' && keys.add(entry));
      else walk(child, key);
    }
  };
  walk(value);
  return [...keys].sort().join(' | ');
};

const rowsOf = (response) => {
  const body = response?.response ?? response;
  const data = body?.data ?? body?.rows ?? body?.result;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.values(data);
  return undefined;
};

/**
 * Record every query: who asked, what came back, how long it took. Charts
 * query through `hostServices.data.query`; direct `engine.getData` calls are
 * recorded too. Neither service is frozen, so both are wrapped in place.
 */
export const recordQueries = (hostServices) => {
  const wrap = (service, method) => {
    const original = service[method].bind(service);
    service[method] = async (request) => {
      const entry = { via: method, keys: keySetOf(request?.query), filters: request?.query?.filters, query: request?.query, at: Date.now() };
      queries.push(entry);
      if (queries.length > 300) queries.shift();
      const started = performance.now();
      try {
        const response = await original(request);
        const rows = rowsOf(response);
        Object.assign(entry, {
          ms: Math.round(performance.now() - started),
          columns: (response?.response?.fields ?? []).map((field) => field.name),
          rowCount: rows?.length,
          rows: rows?.slice(0, 200),
        });
        return response;
      } catch (error) {
        entry.error = String(error?.message ?? error);
        throw error;
      }
    };
  };
  wrap(hostServices.data, 'query');
  wrap(hostServices.engine, 'getData');
};

const box = (node) => {
  const rect = node.getBoundingClientRect();
  return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
};

/** What an object's surface actually contains, as numbers and text. */
const contentsOf = (surface) => {
  const canvases = [...surface.querySelectorAll('canvas')].map((canvas) => ({ w: canvas.width, h: canvas.height, css: box(canvas) }));
  const svgs = [...surface.querySelectorAll('svg')].map((svg) => ({ css: box(svg), marks: svg.querySelectorAll('path,rect,circle,line,text').length }));
  const text = (surface.innerText ?? '').replace(/\s+/g, ' ').trim();
  return {
    canvases,
    svgs,
    tableRows: surface.querySelectorAll('[role="row"], tr').length,
    elements: surface.querySelectorAll('*').length,
    text: text.slice(0, 240),
  };
};

/**
 * Probe every mounted object and list what fails. An object fails when its
 * container had no size at mount, when it did not report `rendered`, or when
 * it drew nothing — no canvas, no svg and no text.
 */
export const createProbe = ({ mounted, root, tileKeys }) => () => {
  // Field keys alone can be shared (a KPI table and its trend ask for the same
  // two items), so the row limit and the calculation count are compared too.
  const latestQueryFor = (id) => {
    const signature = tileKeys(id);
    if (!signature) return undefined;
    for (let index = queries.length - 1; index >= 0; index -= 1) {
      const entry = queries[index];
      if (entry.keys !== signature.keys) continue;
      if (signature.limit !== undefined && entry.query?.limit !== signature.limit) continue;
      if (signature.measures !== undefined && (entry.query?.calculations?.length ?? 0) + (entry.query?.measures?.length ?? 0) !== signature.measures) continue;
      return entry;
    }
    return undefined;
  };
  const objects = [...mounted.values()].map((record) => {
    const surface = record.container;
    const style = getComputedStyle(surface);
    const now = box(surface);
    const contents = contentsOf(surface);
    const query = latestQueryFor(record.id);
    const drew = contents.canvases.some((c) => c.w > 0 && c.h > 0) || contents.svgs.length > 0 || contents.text.length > 0;
    const problems = [];
    if (!record.sizeAtMount || record.sizeAtMount.width < 1 || record.sizeAtMount.height < 1) problems.push('zero-size container at mount');
    if (record.render !== 'rendered') problems.push(`render=${record.render}`);
    if (!drew) problems.push('drew nothing');
    // Sub-pixel layout rounds either way, so 1px is noise, not a resize.
    if (Math.abs(now.w - (record.sizeAtMount?.width ?? 0)) > 1 || Math.abs(now.h - (record.sizeAtMount?.height ?? 0)) > 1) problems.push(`resized since mount (${record.sizeAtMount?.width}x${record.sizeAtMount?.height} → ${now.w}x${now.h})`);
    if (now.x + now.w > window.innerWidth + 1) problems.push('overflows viewport to the right');
    if (query?.error) problems.push(`query error: ${query.error}`);
    return {
      id: record.id,
      type: record.type,
      mount: record.mount,
      render: record.render,
      readyMs: record.readyMs,
      sizeAtMount: record.sizeAtMount,
      box: now,
      display: style.display,
      overflow: style.overflow,
      ...contents,
      query: query ? { columns: query.columns, rowCount: query.rowCount, rows: query.rows?.slice(0, 30), filters: query.filters, ms: query.ms } : undefined,
      problems,
    };
  });
  const pageOverflow = document.documentElement.scrollWidth > window.innerWidth;
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, hidden: document.hidden, scrollH: document.documentElement.scrollHeight },
    pageOverflowsHorizontally: pageOverflow,
    errors: errors.slice(-20),
    visibleErrorsInPage: [...root.querySelectorAll('.viz-error, .failures li')].map((node) => node.textContent),
    failing: objects.filter((object) => object.problems.length > 0).map((object) => ({ id: object.id, problems: object.problems })),
    objects,
  };
};
