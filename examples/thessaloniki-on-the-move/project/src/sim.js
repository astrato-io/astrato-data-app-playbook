/**
 * A day on the buses: every scheduled trip of Tue 21 Jul 2026, moving stop to stop.
 *
 * public/sim-day.json holds the OSETH timetable for that day, compacted: stops [lon, lat], lines
 * [name, category], categories [name], stop-time patterns [stopIdx[], offsetSec[]] and trips
 * [startSec, line, pattern]. It is a trips extract, so it is NOT shipped in this repository: build
 * it from the feed's GTFS stop_times (see the example README). Without it, loadDay() rejects and
 * the app shows "needs a trips extract" in the live-day panel; everything else still works.
 * A bus's position is interpolated between the scheduled times of consecutive stops. Buses are
 * drawn on a canvas laid exactly over the stop map's plot canvas, so they run along the same
 * lon/lat frame as the Astrato scatter and the basemap.
 */
import { plotRect } from './basemap.js';

export const CAT_COLORS = ['#10263F', '#1F6F9F', '#2BB3C0', '#F2B33D', '#6C4A7E'];
const MAX_TRIP = 4 * 3600;

export const loadDay = async () => {
  const res = await fetch('./sim-day.json');
  // Vite's dev server answers a missing file with index.html, so check the type as well as the status.
  if (!res.ok || !/json/i.test(res.headers.get('content-type') ?? '')) throw new Error('No trips extract (public/sim-day.json)');
  const day = await res.json();
  if (!Array.isArray(day?.trips) || !Array.isArray(day?.patterns)) throw new Error('public/sim-day.json is not a trips extract');
  day.ends = day.trips.map(([start, , p]) => start + day.patterns[p][1].at(-1));
  day.starts = day.trips.map(([start]) => start);
  return day;
};

/** First index whose start is ≥ t. */
const lowerBound = (arr, t) => { let lo = 0; let hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < t) lo = mid + 1; else hi = mid; } return lo; };

/** The trips on the road at second t, with their positions. */
export const busesAt = (day, t) => {
  const out = [];
  const from = lowerBound(day.starts, t - MAX_TRIP);
  const to = lowerBound(day.starts, t + 1);
  for (let i = from; i < to; i++) {
    if (day.ends[i] < t) continue;
    const [start, line, p] = day.trips[i];
    const [stops, offs] = day.patterns[p];
    const dt = t - start;
    let k = lowerBound(offs, dt);
    if (k === 0) k = 1;
    if (k >= offs.length) k = offs.length - 1;
    const a = day.stops[stops[k - 1]];
    const b = day.stops[stops[k]];
    const span = offs[k] - offs[k - 1];
    const f = span > 0 ? Math.min(1, Math.max(0, (dt - offs[k - 1]) / span)) : 1;
    out.push({ i, line, cat: day.lines[line][1], lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f });
  }
  return out;
};

/** Mount the bus canvas over the stop map in `frame` (the card that holds `surface`). */
/** `onFit` runs after the canvas is resized (which wipes it), so a paused day can redraw. */
export const createBusLayer = (frame, surface, onFit) => {
  const canvas = document.createElement('canvas');
  canvas.className = 'buslayer';
  frame.append(canvas);
  const ctx = canvas.getContext('2d');
  let rect = null;
  const fit = () => {
    rect = plotRect(surface, frame);
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    Object.assign(canvas.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onFit?.();
  };
  new ResizeObserver(fit).observe(surface);
  let sig = '';
  setInterval(() => { const r = plotRect(surface, frame); const k = r ? `${r.left},${r.top},${r.width},${r.height}` : ''; if (k && k !== sig) { sig = k; fit(); } }, 1000);
  return {
    fit,
    /** Draw buses; trails fade by erasing a little of the previous frame. */
    draw(buses, extent, { trail = true, highlight = null } = {}) {
      if (!rect) fit();
      if (!rect) return;
      const { lon: [w, e], lat: [s, n] } = extent;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${trail ? 0.22 : 1})`;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.restore();
      for (const b of buses) {
        const x = ((b.lon - w) / (e - w)) * rect.width;
        const y = ((n - b.lat) / (n - s)) * rect.height;
        if (x < -4 || y < -4 || x > rect.width + 4 || y > rect.height + 4) continue;
        const hot = highlight != null && b.line === highlight;
        ctx.beginPath();
        ctx.arc(x, y, hot ? 5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = hot ? '#E0583A' : CAT_COLORS[b.cat];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,253,248,.9)';
        ctx.stroke();
      }
    },
    clear() { if (rect) ctx.clearRect(0, 0, rect.width, rect.height); },
  };
};

export const ROUTE_COLORS = ['#E0583A', '#1F6F9F', '#F2B33D', '#6C4A7E', '#2F9B6E', '#B3261E', '#2BB3C0', '#10263F'];

/** The busiest stop pattern of each direction of a line: its path through the city. */
export const linePaths = (day, lineName) => {
  const li = day.lines.findIndex(([name]) => name === lineName);
  if (li < 0) return [];
  const use = new Map();
  for (const [, line, p] of day.trips) if (line === li) use.set(p, (use.get(p) ?? 0) + 1);
  const ranked = [...use].sort((a, b) => b[1] - a[1]).map(([p]) => day.patterns[p][0]);
  const out = [];
  for (const stops of ranked) {
    // keep a second path only if it is a different direction (different first stop)
    if (out.length && out.some((o) => o[0] === stops[0])) continue;
    out.push(stops);
    if (out.length === 2) break;
  }
  return out.map((stops) => stops.map((i) => day.stops[i]));
};

/** A canvas over the route map's plot area that draws each selected line's path in its own colour. */
export const createRouteLayer = (frame, surface) => {
  const canvas = document.createElement('canvas');
  canvas.className = 'buslayer';
  frame.append(canvas);
  const ctx = canvas.getContext('2d');
  let rect = null;
  let last = null;
  const fit = () => {
    rect = plotRect(surface, frame);
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    Object.assign(canvas.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (last) draw(...last);
  };
  const draw = (paths, extent) => {
    last = [paths, extent];
    if (!rect) return;
    const { lon: [w, e], lat: [s, n] } = extent;
    const X = (lon) => ((lon - w) / (e - w)) * rect.width;
    const Y = (lat) => ((n - lat) / (n - s)) * rect.height;
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const { color, coords } of paths) {
      for (const line of coords) {
        ctx.beginPath();
        line.forEach(([lon, lat], k) => (k ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
        ctx.strokeStyle = 'rgba(255,253,248,.95)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const [lon, lat] = coords[0]?.[0] ?? [];
      if (lon != null) { ctx.beginPath(); ctx.arc(X(lon), Y(lat), 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    }
  };
  new ResizeObserver(fit).observe(surface);
  let sig = '';
  setInterval(() => { const r = plotRect(surface, frame); const k = r ? `${r.left},${r.top},${r.width},${r.height}` : ''; if (k && k !== sig) { sig = k; fit(); } }, 1000);
  return { fit, draw };
};
