// Fills the school's Work Flow Plan Word form (.docx) with a plan from workflow.js. A .docx is a zip of XML
// files: only word/document.xml changes, every other part is copied over byte for byte. The form's tables
// are found by their header text, so a small edit to the form (a moved row, a new logo) still works.
import { amount } from './workflow.js';
import { niceAmount } from './calc.js';

// ---- Zip: read the central directory, inflate with the browser's own DecompressionStream
const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

function entries(b) {
  let e = b.length - 22;
  while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Not a Word file (.docx)');
  const list = [];
  for (let i = 0, o = u32(b, e + 16); i < u16(b, e + 10); i++) {
    const n = u16(b, o + 28), local = u32(b, o + 42), size = u32(b, o + 20);
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    list.push({ name: new TextDecoder().decode(b.subarray(o + 46, o + 46 + n)), method: u16(b, o + 10), crc: u32(b, o + 16),
      usize: u32(b, o + 24), data: b.subarray(start, start + size) });
    o += 46 + n + u16(b, o + 30) + u16(b, o + 32);
  }
  return list;
}
const unpack = e => (e.method ? pipe(e.data, new DecompressionStream('deflate-raw')) : e.data);

const CRC = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc32 = b => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return ~c >>> 0; };

function zip(list) {
  const parts = [], dir = [];
  let offset = 0;
  for (const e of list) {
    const name = new TextEncoder().encode(e.name), head = (sig, size) => {
      const h = new DataView(new ArrayBuffer(size));
      h.setUint32(0, sig, true);
      return h;
    };
    const fields = (h, at) => { // version, flags, method, time, date, crc, sizes, name length
      [[20, 2], [0, 2], [e.method, 2], [0, 2], [33, 2], [e.crc, 4], [e.data.length, 4], [e.usize, 4], [name.length, 2]]
        .forEach(([v, n]) => { n === 2 ? h.setUint16(at, v, true) : h.setUint32(at, v, true); at += n; });
    };
    const local = head(0x04034b50, 30); fields(local, 4);
    const central = head(0x02014b50, 46); central.setUint16(4, 20, true); fields(central, 6); central.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, e.data);
    dir.push(new Uint8Array(central.buffer), name);
    offset += 30 + name.length + e.data.length;
  }
  const size = dir.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, list.length, true); end.setUint16(10, list.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const p of [...parts, ...dir, new Uint8Array(end.buffer)]) { out.set(p, at); at += p.length; }
  return out;
}

const DOC = 'word/document.xml';
export async function readDocument(bytes) {
  const e = entries(bytes).find(x => x.name === DOC);
  if (!e) throw new Error('Not a Word file (.docx)');
  return new TextDecoder().decode(await unpack(e));
}

// ---- WordprocessingML, as text. Tables in this form don't nest, so plain matching is enough.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textOf = x => [...x.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('').replace(/&amp;/g, '&').trim();
const split = (x, re) => x.split(re); // odd indexes are the matches
const TR = /(<w:tr[ >][\s\S]*?<\/w:tr>)/, TC = /(<w:tc[ >][\s\S]*?<\/w:tc>)/;
const fresh = x => x.replace(/ w14:(?:paraId|textId)="[^"]*"/g, ''); // copies need no ids of their own

// A run that looks like the paragraph's own text. Appending after a bold label ("Trainer:") drops the bold.
function run(p, text, append) {
  const own = append ? [...p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].pop()?.[0].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)
    : p.match(/<w:pPr>[\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/);
  let rPr = (own?.[1] ?? '').replace(/<w:(?:ins|del|moveFrom|moveTo)\b[^>]*\/>/g, '');
  if (append) rPr = rPr.replace(/<w:bC?s?\/>/g, '');
  const body = String(text).split('\n').map(t => `<w:t xml:space="preserve">${esc(t)}</w:t>`).join('<w:br/>');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${append ? '<w:t xml:space="preserve"> </w:t>' : ''}${body}</w:r>`;
}
function setCell(tc, text, append = false) {
  if (text == null || text === '') return tc;
  if (!append) tc = tc.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, '');
  return tc.replace(/(<w:p[ >][\s\S]*?)(<\/w:p>)/, (_, p, end) => p + run(p, text, append) + end);
}

// Table helpers: work on the row and cell strings, then join back
const table = x => { const parts = split(x, TR); return { parts, rows: () => parts.filter((_, i) => i % 2) }; };
function editRow(t, ri, values, append) { // values: { col: text }
  const idx = 2 * ri + 1, cells = split(t.parts[idx], TC);
  Object.entries(values).forEach(([c, v]) => { cells[2 * c + 1] = setCell(cells[2 * c + 1], v, append); });
  t.parts[idx] = cells.join('');
}
const cellTexts = row => split(row, TC).filter((_, i) => i % 2).map(textOf);
const insertRow = (t, ri, row) => t.parts.splice(2 * ri + 1, 0, fresh(row), ''); // before row ri

// Put `items` into the empty rows from..to (exclusive), adding copies of the last empty row when they run out.
function fillRows(t, from, to, items, valuesOf) {
  const spare = t.rows()[to - 1];
  items.forEach((it, k) => {
    if (from + k >= to) { insertRow(t, to, spare); to++; }
    editRow(t, from + k, valuesOf(it));
  });
  return to;
}

// ---- The form
const find = (tables, test) => tables.findIndex(x => test(cellTexts(table(x).rows()[0] ?? '')));

// plan: { name, studentId, assessment, trainer, group, date, recipes, timeline: { rows }, totals }
export function fillPlanXml(xml, plan) {
  // Cover sheet lines "Name: ", "Student ID: ", "Practical Assessment No: "
  for (const [label, v] of [['Name: ', plan.name], ['Student ID: ', plan.studentId], ['Practical Assessment No: ', plan.assessment]]) {
    const at = xml.indexOf(`>${label}</w:t>`);
    if (at < 0 || !v) continue;
    const s = Math.max(xml.lastIndexOf('<w:p ', at), xml.lastIndexOf('<w:p>', at)), e = xml.indexOf('</w:p>', at);
    const p = xml.slice(s, e);
    xml = xml.slice(0, s) + p + run(p, v, true).replace('<w:t xml:space="preserve"> </w:t>', '') + xml.slice(e);
  }

  const tables = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
  const done = tables.slice();
  const recipes = plan.recipes.slice(0, 7);

  const head = find(tables, c => c.some(x => /^Trainer:/.test(x)));
  if (head >= 0) {
    const t = table(tables[head]);
    t.rows().forEach((row, ri) => cellTexts(row).forEach((c, ci) => {
      const v = /^Trainer:/.test(c) ? plan.trainer : /^Group:/.test(c) ? plan.group : /^Date:/.test(c) ? plan.date : '';
      if (v) editRow(t, ri, { [ci]: v }, true);
    }));
    done[head] = t.parts.join('');
  }

  const list = find(tables, c => c[0] === '1.');
  if (list >= 0) {
    const t = table(tables[list]);
    recipes.forEach((r, i) => i < t.rows().length && editRow(t, i, { 0: r.name }, true));
    done[list] = t.parts.join('');
  }

  const times = find(tables, c => /^Task description/.test(c[1] ?? ''));
  if (times >= 0) {
    const t = table(tables[times]);
    const at = word => t.rows().findIndex(r => cellTexts(r).some(c => c.toUpperCase().includes(word)));
    const values = row => ({ 0: row.time, 1: row.task, 2: row.equipment });
    const rows = plan.timeline.rows;
    // Morning: after "Gather ingredients", up to lunch. Afternoon: after "SETUP", up to pack down.
    fillRows(t, at('GATHER') + 1, at('LUNCH'), rows.filter(r => r.part === 'am'), values);
    fillRows(t, at('SETUP') + 1, at('PACK DOWN'), rows.filter(r => r.part === 'pm'), values);
    done[times] = t.parts.join('');
  }

  const cards = tables.map((x, i) => i).filter(i => cellTexts(table(tables[i]).rows()[0])[0]?.startsWith('Recipe Name'));
  recipes.forEach((r, k) => {
    if (k >= cards.length) return;
    const t = table(tables[cards[k]]);
    const row = label => t.rows().findIndex(x => cellTexts(x)[0]?.toLowerCase().startsWith(label));
    for (const [label, v] of [['recipe name', r.name], ['preparation', r.prep], ['cooking', r.cook], ['equipment', r.equipment], ['yield', r.yield]])
      if (row(label) >= 0) editRow(t, row(label), { 1: v });
    const first = row('quantity') + 1;
    fillRows(t, first, row('method'), r.items, it => ({ 0: niceAmount(it.qty, it.unit), 1: it.name }));
    done[cards[k]] = t.parts.join('');
  });

  const shop = find(tables, c => c[0] === 'Ingredients' && /^TOTAL/.test(c[2] ?? ''));
  if (shop >= 0) {
    const t = table(tables[shop]);
    editRow(t, 0, Object.fromEntries(recipes.map((r, i) => [3 + i, r.name])));
    const used = new Set();
    for (const row of plan.totals) {
      const names = t.rows().map(x => cellTexts(x)[0].toLowerCase());
      let ri = names.findIndex((n, i) => i && !used.has(i) && n === row.name.toLowerCase());
      if (ri < 0) ri = names.findIndex((n, i) => i && !used.has(i) && !n);
      if (ri < 0) { insertRow(t, t.rows().length, t.rows().at(-1).replace(/<w:r[ >][\s\S]*?<\/w:r>/g, '')); ri = t.rows().length - 1; }
      used.add(ri);
      const per = Object.fromEntries(row.per.slice(0, 10).map((q, i) => [3 + i, amount(q)]));
      editRow(t, ri, { 0: row.name, 1: row.total > 0 ? row.unit : '', 2: row.total > 0 ? amount(row.total) : 'q.b.', ...per });
    }
    done[shop] = t.parts.join('');
  }

  let i = 0;
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, () => done[i++]);
}

// Template bytes + plan -> filled .docx bytes
export async function fillPlan(bytes, plan) {
  const list = entries(bytes);
  const out = await Promise.all(list.map(async e => {
    if (e.name !== DOC) return e;
    const data = new TextEncoder().encode(fillPlanXml(new TextDecoder().decode(await unpack(e)), plan));
    return { name: e.name, method: 8, crc: crc32(data), usize: data.length, data: await pipe(data, new CompressionStream('deflate-raw')) };
  }));
  return zip(out);
}

// '' when the file looks like the Work Flow Plan form, else what's missing
export async function templateProblem(bytes) {
  try {
    const xml = await readDocument(bytes);
    return xml.includes('Task description') && xml.includes('Recipe Name') ? '' : 'This Word file has no time plan or recipe cards';
  } catch { return 'Not a Word file (.docx)'; }
}
