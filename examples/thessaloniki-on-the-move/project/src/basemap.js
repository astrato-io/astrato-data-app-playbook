/**
 * A street basemap under a scatter "map": raster tiles laid behind the chart's plot canvas.
 *
 * The scatter's axes are pinned to a lon/lat extent (axisRange minmax), so the plot canvas spans
 * exactly that extent. Each tile is placed by its own lon/lat bounds, mapped linearly onto the
 * plot rectangle — the same linear mapping the chart uses — so stops land on their streets.
 * Tiles: see TILE below, attribution shown on the map.
 */
/*
 * Tile source. openstreetmap.org's volunteer servers block apps (their tile usage policy), so the
 * default is Esri World Street Map (no key, attribution shown). For production, put a MapTiler key
 * here to get the OpenStreetMap look from a provider that licenses app use.
 */
const MAPTILER_KEY = '';
const TILE = MAPTILER_KEY
  ? (z, x, y) => `https://api.maptiler.com/maps/openstreetmap/256/${z}/${x}/${y}.jpg?key=${MAPTILER_KEY}`
  : (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;
const CREDIT = MAPTILER_KEY
  ? '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  : 'Basemap © Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors';
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** The chart's plot canvas: the largest canvas inside the surface. */
export const plotRect = (surface, frame) => {
  const host = frame.getBoundingClientRect();
  let best = null;
  for (const c of surface.querySelectorAll('canvas')) {
    const r = c.getBoundingClientRect();
    if (!best || r.width * r.height > best.width * best.height) best = r;
  }
  return best && best.width > 40 ? { left: best.left - host.left, top: best.top - host.top, width: best.width, height: best.height } : null;
};

export const attachBasemap = (surface) => {
  const layer = document.createElement('div');
  layer.className = 'basemap';
  const credit = document.createElement('div');
  credit.className = 'basemap__credit';
  credit.innerHTML = CREDIT;
  // Outside the chart's own container (inserting into it disturbs the chart's sizing):
  // the card is the positioning frame, and the layer sits before the surface in paint order.
  const frame = surface.parentElement;
  frame.classList.add('has-basemap');
  frame.prepend(layer);
  frame.append(credit);
  let extent = null;
  let key = '';

  const draw = () => {
    const rect = plotRect(surface, frame);
    if (!rect || !extent) return;
    const { lon: [w, e], lat: [s, n] } = extent;
    const sig = `${rect.left},${rect.top},${rect.width},${rect.height},${w},${e},${s},${n}`;
    if (sig === key) return;
    key = sig;
    Object.assign(layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    // The credit sits inside the map's bottom-right corner, clear of the card's note below it.
    Object.assign(credit.style, { bottom: 'auto', top: `${rect.top + rect.height - credit.offsetHeight - 4}px`, right: `${frame.clientWidth - rect.left - rect.width + 4}px` });
    const z = Math.min(16, Math.max(3, Math.min(17, Math.ceil(Math.log2(((rect.width / (e - w)) * 360) / 256)) + 1)));
    const px = (lon) => ((lon - w) / (e - w)) * rect.width;
    const py = (lat) => ((n - lat) / (n - s)) * rect.height;
    const imgs = [];
    for (let x = Math.floor(lon2x(w, z)); x <= Math.floor(lon2x(e, z)); x++) {
      for (let y = Math.floor(lat2y(n, z)); y <= Math.floor(lat2y(s, z)); y++) {
        const img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.src = TILE(z, x, y);
        const left = px(x2lon(x, z));
        const top = py(y2lat(y, z));
        Object.assign(img.style, { left: `${left}px`, top: `${top}px`, width: `${px(x2lon(x + 1, z)) - left + 0.5}px`, height: `${py(y2lat(y + 1, z)) - top + 0.5}px` });
        imgs.push(img);
      }
    }
    layer.replaceChildren(...imgs);
  };

  const watch = new ResizeObserver(() => draw());
  watch.observe(surface);
  // The chart sizes its plot canvas after mount and again on layout changes the surface itself may
  // not report; re-measure cheaply (draw() returns early when nothing moved).
  window.addEventListener('resize', () => draw());
  setInterval(draw, 1000);
  return {
    setExtent(next) { extent = next; key = ''; draw(); },
    redraw() { key = ''; draw(); },
  };
};
