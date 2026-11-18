/**
 * "Excel view": renders the same sheets the .xlsx pack is written from (buildSheets in main.js) as an
 * in-browser spreadsheet — ribbon, name box + formula bar, lettered columns, numbered rows,
 * gridlines, frozen header rows and sheet tabs. Numbers carry the pack's number formats.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nf = (v, d = 0) => Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, f) => (v > 0 ? `+${f(v)}` : v < 0 ? `-${f(-v)}` : f(0));
const FMT = {
  int: (v) => nf(v), gbp: (v) => `£${nf(v)}`, psf: (v) => `£${nf(v, 2)}`, x: (v) => `${nf(v, 2)}x`, dec: (v) => nf(v, 1),
  pct: (v) => `${nf(v * 100, 1)}%`, pct2: (v) => `${nf(v * 100, 2)}%`,
  spct: (v) => signed(v, (a) => `${nf(a * 100, 1)}%`), sint: (v) => signed(v, (a) => nf(a)), sgbp: (v) => signed(v, (a) => `£${nf(a)}`), spos: (v) => signed(v, (a) => nf(a, 1)),
};
/** Signed formats colour like the pack: green up, red down (position: down is good). */
const tone = (s, v) => (!['spct', 'sint', 'sgbp', 'spos'].includes(s) || !v ? '' : (s === 'spos' ? v < 0 : v > 0) ? 'up' : 'dn');
const col = (i) => { let s = ''; for (i += 1; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

export const mountSheetView = (host, { clients, build, download }) => {
  let client = 'Glow & Co Skincare', data = null, sheet = 0, sel = [4, 1];
  const root = document.createElement('div');
  root.className = 'xl';
  host.append(root);

  const load = async () => {
    data = null; render();
    try { data = await build(client); } catch (e) { root.querySelector('.xl-grid').textContent = `Could not build: ${e?.message ?? e}`; return; }
    sheet = Math.min(sheet, data.sheets.length - 1); render();
  };

  const cellAt = (r, c) => data?.sheets[sheet].rows[r]?.[c] ?? null;
  const raw = (cell) => (cell == null ? '' : typeof cell.v === 'number' ? String(Math.round(cell.v * 1e6) / 1e6) : String(cell.v ?? ''));

  const render = async () => {
    const names = await clients();
    const sh = data?.sheets[sheet];
    const ncol = sh ? Math.max(sh.cols?.length ?? 0, ...sh.rows.map((r) => r?.length ?? 0)) + 2 : 10;
    const nrow = sh ? Math.max(sh.rows.length + 6, 30) : 30;
    const widths = Array.from({ length: ncol }, (_, i) => Math.max(64, Math.round((sh?.cols?.[i] ?? 9) * 7.4)));
    const freeze = sh?.freeze?.row ?? 0;
    const cur = sh ? cellAt(...sel) : null;
    let skip = 0;
    root.innerHTML = `
      <div class="xl-title"><span class="xl-logo">X</span><b>${esc(data?.title ?? 'Building…')}.xlsx</b><span class="xl-saved">Saved · live from the Astrato semantic layer</span>
        <label>Client <select data-client>${names.map((n) => `<option ${n === client ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option ${client === null ? 'selected' : ''} value="">All clients (portfolio)</option></select></label>
        <button class="xl-dl" data-dl>⬇ Download .xlsx</button></div>
      <div class="xl-ribbon">${['File', 'Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map((t, i) => `<span class="${i === 1 ? 'on' : ''}">${t}</span>`).join('')}</div>
      <div class="xl-tools"><span><b>Calibri</b> ▾</span><span>11 ▾</span><span><b>B</b></span><span><i>I</i></span><span><u>U</u></span><span class="sep"></span><span>£</span><span>%</span><span>,</span><span>.00</span><span class="sep"></span><span>⊞ Freeze panes</span><span>▦ Conditional formatting</span><span>∑ AutoSum</span><span>⇅ Sort &amp; filter</span></div>
      <div class="xl-fx"><span class="xl-name">${col(sel[1])}${sel[0] + 1}</span><span class="xl-fxi">fx</span><span class="xl-fxv">${esc(raw(cur))}</span></div>
      <div class="xl-grid">${!sh ? '<div class="xl-wait">Building the report from the governed layer…</div>' : `
        <table style="width:${42 + widths.reduce((a, b) => a + b, 0)}px"><colgroup><col style="width:42px">${widths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>
        <thead><tr><th class="xl-corner"></th>${widths.map((_, i) => `<th class="${i === sel[1] ? 'on' : ''}">${col(i)}</th>`).join('')}</tr></thead>
        <tbody>${Array.from({ length: nrow }, (_, r) => `<tr class="${r < freeze ? 'xl-frz' : ''}" style="${r < freeze ? `--t:${22 + r * 22}px` : ''}"><th class="${r === sel[0] ? 'on' : ''}">${r + 1}</th>${(skip = 0, '')}${widths.map((_, c) => {
          if (c < skip) return '';
          const cell = cellAt(r, c);
          let span = 1;
          if (cell && typeof cell.v === 'string' && cell.v && !/^head/.test(cell.s ?? '')) while (c + span < ncol && (cellAt(r, c + span) == null || cellAt(r, c + span).v === '')) span += 1;
          skip = c + span;
          const s = cell?.s ?? '';
          const num = typeof cell?.v === 'number';
          const txt = cell == null ? '' : num ? (FMT[s] ?? FMT.int)(cell.v) : esc(cell.v);
          return `<td data-r="${r}" data-c="${c}" ${span > 1 ? `colspan="${span}"` : ''} class="xs-${s} ${num ? 'n' : ''} ${tone(s, cell?.v)} ${r === sel[0] && c === sel[1] ? 'sel' : ''}">${txt}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table>`}</div>
      <div class="xl-tabs"><span class="xl-nav">◀ ▶</span>${(data?.sheets ?? []).map((s, i) => `<button data-sheet="${i}" class="${i === sheet ? 'on' : ''}">${esc(s.name)}</button>`).join('')}<span class="xl-plus">+</span></div>
      <div class="xl-status"><span>Ready</span><span>${cur && typeof cur.v === 'number' ? `Sum: ${nf(cur.v, 2)}` : ''}</span><span>▦ ▤ ▥ &nbsp; 100%</span></div>`;

    root.querySelector('[data-client]').onchange = (e) => { client = e.target.value || null; load(); };
    root.querySelector('[data-dl]').onclick = () => download(client);
    root.querySelectorAll('[data-sheet]').forEach((b) => (b.onclick = () => { sheet = Number(b.dataset.sheet); sel = [4, 1]; render(); }));
    root.querySelector('.xl-grid table')?.addEventListener('click', (e) => {
      const td = e.target.closest('td[data-r]');
      if (!td) return;
      sel = [Number(td.dataset.r), Number(td.dataset.c)];
      const grid = root.querySelector('.xl-grid'); const top = grid.scrollTop, left = grid.scrollLeft;
      render().then(() => { const g = root.querySelector('.xl-grid'); g.scrollTop = top; g.scrollLeft = left; });
    });
  };
  load();
};
