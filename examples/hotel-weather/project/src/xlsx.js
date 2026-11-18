/**
 * A small, dependency-free .xlsx writer with real styling (copied from another example).
 *
 * SheetJS community drops cell styles, and a branded report needs fills,
 * fonts, borders and number formats, so this writes the OOXML parts directly
 * and packs them in an uncompressed (stored) zip. Strings are inline, so there
 * is no shared-string table.
 *
 * A workbook is `{ sheets: [{ name, cols, rows, merges, freeze, tab }] }`; a
 * row is an array of cells, a cell is `null`, a value, or `{ v, s }` where `s`
 * is a key of STYLES. `rows` may also carry `{ height, cells }`.
 */

const RED = 'FF2F6FED'; // house accent (header fills, rules): the app's governed blue
// Shown in every sheet footer. Set it to your own brand; it is written into XML, so escape & as &amp;.
export const FOOTER_BRAND = 'Hotel demand × weather';
const AQUA = 'FF41B6E6';
const INK = 'FF1B2A3A';
const GREY = 'FF5C6B7A';
const PALE = 'FFF6F4EF';
const RULE = 'FFE2E2E2';

const FORMATS = {
  int: '#,##0',
  usd: '$#,##0.0"m"',
  usd0: '$#,##0"m"',
  bn: '$#,##0.0,"bn"',
  pct: '0.0%',
  pct2: '0.00%',
  spct: '[Color10]+0.0%;[Red]-0.0%;0.0%',
  susd: '[Color10]+$#,##0.0"m";[Red]-$#,##0.0"m";0',
  dec: '0.0',
  usdint: '$#,##0',
  gbp: '£#,##0',
  ms: '#,##0" ms"',
  upt: '0.00"%"',
  gbpm: '£#,##0.0,,"m"',
  gbpk: '£#,##0,"k"',
  usdm: '$#,##0,,"m"',
  num1: '#,##0.0',
  pp: '[Color10]+0.0" pp";[Red]-0.0" pp";0.0" pp"',
  sdec: '+#,##0.0;-#,##0.0;0.0',
};

/** Style key → { font, fill, border, fmt, align }. Index order is the cellXfs order. */
const BASE = {
  default: {},
  title: { font: { b: true, sz: 20, color: 'FFFFFFFF' }, fill: INK, align: { v: 'center' } },
  band: { fill: INK },
  redband: { fill: RED },
  brand: { font: { b: true, sz: 20, color: 'FFFFFFFF' }, fill: RED, align: { h: 'center', v: 'center' } },
  subtitle: { font: { sz: 10, color: GREY, i: true } },
  section: { font: { b: true, sz: 13, color: INK }, border: { bottom: RED } },
  head: { font: { b: true, sz: 10, color: 'FFFFFFFF' }, fill: RED, align: { h: 'center', v: 'center', wrap: true }, border: { bottom: RED } },
  headl: { font: { b: true, sz: 10, color: 'FFFFFFFF' }, fill: RED, align: { v: 'center' }, border: { bottom: RED } },
  text: { border: { bottom: RULE } },
  label: { font: { sz: 10, color: GREY } },
  note: { font: { sz: 9, color: GREY }, align: { wrap: true, v: 'top' } },
  bold: { font: { b: true }, border: { bottom: RULE } },
  kpiLabel: { font: { sz: 9, color: GREY, b: true }, fill: PALE, border: { top: RED } },
  kpiValue: { font: { sz: 18, b: true, color: INK }, fill: PALE },
  kpiNote: { font: { sz: 9, color: GREY }, fill: PALE },
  bar: { font: { color: AQUA, sz: 10 }, border: { bottom: RULE } },
  barv: { font: { color: 'FFE0583A', sz: 10 }, border: { bottom: RULE } },
};
const NUMERIC = ['num1', 'pp', 'sdec', 'gbp', 'int', 'usd', 'usd0', 'bn', 'pct', 'pct2', 'spct', 'susd', 'dec', 'usdint', 'ms', 'upt', 'gbpm', 'gbpk', 'usdm'];
for (const f of NUMERIC) {
  BASE[f] = { fmt: f, border: { bottom: RULE } };
  BASE[`${f}T`] = { fmt: f, font: { b: true }, fill: PALE, border: { top: INK, bottom: INK } };
  BASE[`${f}K`] = { fmt: f, font: { sz: 18, b: true, color: INK }, fill: PALE, align: { h: 'left' } };
}
BASE.textT = { font: { b: true }, fill: PALE, border: { top: INK, bottom: INK } };
BASE.sub = { font: { b: true, color: INK }, fill: 'FFF5EFE4', border: { bottom: RULE } };
for (const f of NUMERIC) BASE[`${f}S`] = { fmt: f, font: { b: true }, fill: 'FFF5EFE4', border: { bottom: RULE } };

export const STYLES = Object.fromEntries(Object.keys(BASE).map((k, i) => [k, i]));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const stylesXml = () => {
  const specs = Object.values(BASE);
  const fontKey = (f = {}) => JSON.stringify(f);
  const fonts = [...new Set(specs.map((s) => fontKey(s.font)))];
  const fills = [...new Set(specs.map((s) => s.fill ?? ''))].filter(Boolean);
  const borderKey = (b = {}) => JSON.stringify(b);
  const borders = [...new Set(specs.map((s) => borderKey(s.border)))];
  const fmtIds = Object.fromEntries(Object.keys(FORMATS).map((k, i) => [k, 164 + i]));
  const fontXml = (k) => {
    const f = JSON.parse(k);
    return `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}<sz val="${f.sz ?? 10}"/><color rgb="${f.color ?? INK}"/><name val="Arial"/><family val="2"/></font>`;
  };
  const side = (name, rgb) => (rgb ? `<${name} style="${name === 'top' && rgb === RED ? 'medium' : 'thin'}"><color rgb="${rgb}"/></${name}>` : `<${name}/>`);
  const borderXml = (k) => {
    const b = JSON.parse(k);
    return `<border>${side('left')}${side('right')}${side('top', b.top)}${side('bottom', b.bottom)}<diagonal/></border>`;
  };
  const xf = (s) => {
    const fontId = fonts.indexOf(fontKey(s.font));
    const fillId = s.fill ? fills.indexOf(s.fill) + 2 : 0;
    const borderId = borders.indexOf(borderKey(s.border));
    const numFmtId = s.fmt ? fmtIds[s.fmt] : 0;
    const align = s.align ? `<alignment${s.align.h ? ` horizontal="${s.align.h}"` : ''}${s.align.v ? ` vertical="${s.align.v}"` : ''}${s.align.wrap ? ' wrapText="1"' : ''}/>` : '';
    return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`;
  };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${Object.keys(FORMATS).length}">${Object.entries(FORMATS).map(([k, code]) => `<numFmt numFmtId="${fmtIds[k]}" formatCode="${esc(code)}"/>`).join('')}</numFmts>
<fonts count="${fonts.length}">${fonts.map(fontXml).join('')}</fonts>
<fills count="${fills.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map((rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>
<borders count="${borders.length}">${borders.map(borderXml).join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${specs.length}">${specs.map(xf).join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
};

const colName = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const sheetXml = (sheet) => {
  const rows = sheet.rows.map((row, r) => {
    const cells = Array.isArray(row) ? row : row.cells;
    const height = Array.isArray(row) ? undefined : row.height;
    const xml = cells
      .map((cell, c) => {
        if (cell == null) return '';
        const { v, s } = typeof cell === 'object' ? cell : { v: cell };
        const ref = `${colName(c)}${r + 1}`;
        const st = s != null ? ` s="${STYLES[s] ?? 0}"` : '';
        if (v == null || v === '') return `<c r="${ref}"${st}/>`;
        if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      })
      .join('');
    return `<row r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}>${xml}</row>`;
  });
  const freeze = sheet.freeze
    ? `<sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${sheet.freeze.row}" xSplit="${sheet.freeze.col ?? 0}" topLeftCell="${colName(sheet.freeze.col ?? 0)}${sheet.freeze.row + 1}" activePane="bottomRight" state="frozen"/></sheetView>`
    : '<sheetView workbookViewId="0" showGridLines="0"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr>${sheet.tab ? `<tabColor rgb="${sheet.tab}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews>${freeze}</sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${sheet.cols ? `<cols>${sheet.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''}
<sheetData>${rows.join('')}</sheetData>
${sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L&amp;8${FOOTER_BRAND} · Illustrative data&amp;R&amp;8Page &amp;P of &amp;N</oddFooter></headerFooter>
</worksheet>`;
};

// ---------------------------------------------------------------- zip (stored)
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

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
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
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

export const workbookBlob = ({ sheets, title = 'Report', author = 'Astrato' }) => {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', stylesXml()],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(files);
};
