/**
 * A small, dependency-free .xlsx writer with real styling, lifted from the people-intelligence
 * example and cut down: fills, fonts, borders and number formats, written as OOXML parts in an
 * uncompressed (stored) zip, strings inline. Number formats are not a fixed list: a cell's style
 * may be `{ fmt: '<Excel format>' }`, so each figure keeps the format its layer gives it.
 *
 * A workbook is `{ sheets: [{ name, cols, rows, freeze }] }`; a row is an array of cells; a cell is
 * `null`, a value, or `{ v, s }` where `s` is a style name below or `{ fmt, bold }` for a number.
 */
const INK = 'FF1F2937';
const MUTED = 'FF6B7280';
const ACCENT = 'FF2563EB';
const RULE = 'FFE5E7EB';
const BASE = {
  default: {},
  title: { font: { b: true, sz: 16, color: INK } },
  note: { font: { sz: 9, color: MUTED } },
  head: { font: { b: true, sz: 10, color: 'FFFFFFFF' }, fill: ACCENT, align: { v: 'center', wrap: true } },
  headr: { font: { b: true, sz: 10, color: 'FFFFFFFF' }, fill: ACCENT, align: { h: 'right', v: 'center', wrap: true } },
  text: { border: RULE },
  label: { font: { b: true, sz: 10, color: INK } },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Collect every style the sheets use; number styles are keyed by their format. */
const styleTable = (sheets) => {
  const styles = { ...BASE };
  for (const s of sheets) for (const row of s.rows) for (const cell of row ?? []) {
    const st = cell && typeof cell === 'object' ? cell.s : null;
    if (st && typeof st === 'object') styles[`n:${st.fmt}:${st.bold ? 1 : 0}`] ??= { fmt: st.fmt, font: st.bold ? { b: true } : undefined, border: RULE };
  }
  return styles;
};

const stylesXml = (styles) => {
  const specs = Object.values(styles);
  const fonts = [...new Set(specs.map((s) => JSON.stringify(s.font ?? {})))];
  const fills = [...new Set(specs.map((s) => s.fill).filter(Boolean))];
  const borders = ['', ...new Set(specs.map((s) => s.border).filter(Boolean))];
  const fmts = [...new Set(specs.map((s) => s.fmt).filter(Boolean))];
  const fontXml = (k) => { const f = JSON.parse(k); return `<font>${f.b ? '<b/>' : ''}<sz val="${f.sz ?? 10}"/><color rgb="${f.color ?? INK}"/><name val="Arial"/><family val="2"/></font>`; };
  const borderXml = (rgb) => `<border><left/><right/><top/>${rgb ? `<bottom style="thin"><color rgb="${rgb}"/></bottom>` : '<bottom/>'}<diagonal/></border>`;
  const xf = (s) => {
    const align = s.align ? `<alignment${s.align.h ? ` horizontal="${s.align.h}"` : ''}${s.align.v ? ` vertical="${s.align.v}"` : ''}${s.align.wrap ? ' wrapText="1"' : ''}/>` : '';
    return `<xf numFmtId="${s.fmt ? 164 + fmts.indexOf(s.fmt) : 0}" fontId="${fonts.indexOf(JSON.stringify(s.font ?? {}))}" fillId="${s.fill ? fills.indexOf(s.fill) + 2 : 0}" borderId="${borders.indexOf(s.border ?? '')}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ` applyAlignment="1">${align}</xf>` : '/>'}`;
  };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${fmts.length}">${fmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>
<fonts count="${fonts.length}">${fonts.map(fontXml).join('')}</fonts>
<fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>
<borders count="${borders.length}">${borders.map(borderXml).join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${specs.length}">${specs.map(xf).join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
};

const colName = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

const sheetXml = (sheet, index) => {
  const rows = sheet.rows.map((row, r) => `<row r="${r + 1}">${(row ?? []).map((cell, c) => {
    if (cell == null) return '';
    const { v, s } = typeof cell === 'object' ? cell : { v: cell };
    const key = s && typeof s === 'object' ? `n:${s.fmt}:${s.bold ? 1 : 0}` : s;
    const ref = `${colName(c)}${r + 1}`;
    const st = key ? ` s="${index[key] ?? 0}"` : '';
    if (v == null || v === '') return `<c r="${ref}"${st}/>`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('')}</row>`);
  const view = sheet.freeze ? `<sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView>` : '<sheetView workbookViewId="0" showGridLines="0"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews>${view}</sheetViews><sheetFormatPr defaultRowHeight="15"/>${sheet.cols ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}<sheetData>${rows.join('')}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
};

// ---------------------------------------------------------------- zip (stored)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

const zip = (files) => {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, nameBytes.length, 2]].forEach(([at, v, n]) => (n === 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, nameBytes.length, 2], [42, offset, 4]].forEach(([at, v, n]) => (n === 4 ? cd.setUint32(at, v, true) : cd.setUint16(at, v, true)));
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const workbookBlob = ({ sheets, title = 'Report' }) => {
  const styles = styleTable(sheets);
  const index = Object.fromEntries(Object.keys(styles).map((k, i) => [k, i]));
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zip([
    ['[Content_Types].xml', `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `${xml}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', stylesXml(styles)],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s, index)]),
  ]);
};
