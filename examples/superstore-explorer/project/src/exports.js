/**
 * CSV and Excel exports of app-owned query results, written in the browser.
 *
 * CSV: UTF-8 with a byte-order mark, `sep=;` and semicolons, so Excel opens it
 * without an import dialog in any locale.
 * Excel: a real .xlsx — a zip (stored, no compression) of XML parts, one worksheet per table —
 * with numbers as numeric cells and text as inline strings. Each sheet opens with the table's
 * title and its scope (the period and filters its rows follow), then the header and the rows.
 */

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const safeName = (title) => title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'export';

// ------------------------------------------------------------------ CSV
export const toCsv = ({ columns, rows }) => {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return ['sep=;', columns.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))].join('\r\n');
};

export const exportCsv = (table) => {
  const blob = new Blob(['﻿', toCsv(table)], { type: 'text/csv;charset=utf-8' });
  download(blob, `${safeName(table.title)}.csv`);
  return blob.size;
};

// ----------------------------------------------------------------- XLSX
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A zip archive with every entry stored uncompressed. */
const zip = (files) => {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(local.buffer, nameBytes, data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, nameBytes.length, true);
    dir.setUint32(42, offset, true);
    central.push(dir.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

// XML 1.0 cannot carry control characters; Excel refuses a file that has them.
const xml = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));

// Sheet names: at most 31 characters, none of []:*?/\, unique.
const sheetName = (name, used) => {
  const base = String(name || 'Data').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Data';
  let out = base;
  for (let n = 2; used.has(out.toLowerCase()); n++) out = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
  used.add(out.toLowerCase());
  return out;
};

/** A workbook from one table or several, one sheet each. A table's `sheet` names its sheet. */
export const toXlsx = (input) => {
  const NS = 'http://schemas.openxmlformats.org';
  const tables = [].concat(input);
  const cell = (v, r, c) => {
    const ref = `${colName(c)}${r}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return '';
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const sheetXml = ({ title, scope, columns, rows }) => {
    const all = [[title], ...(scope ? [[scope]] : []), [], columns, ...rows];
    const body = all.map((row, i) => `<row r="${i + 1}">${row.map((v, c) => cell(v, i + 1, c)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };
  const used = new Set();
  const names = tables.map((t) => sheetName(t.sheet, used));
  const n = tables.map((_, i) => i + 1);
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${n.map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${n.map((i) => `<sheet name="${xml(names[i - 1])}" sheetId="${i}" r:id="rId${i}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${NS}/package/2006/relationships">${n.map((i) => `<Relationship Id="rId${i}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}</Relationships>`],
    ...tables.map((t, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(t)]),
  ]);
};

/** Download a workbook Blob built by toXlsx. */
export const downloadXlsx = (blob, title) => {
  download(blob, `${safeName(title)}.xlsx`);
  return blob.size;
};
