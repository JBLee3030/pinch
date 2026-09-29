// Parsing for pasted recipes and supplier price lists. Pure functions, tested in calc.test.js.

const FRACTIONS = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FR = Object.keys(FRACTIONS).join('');
// "1 1/2", "1/2", "1.5", "1,5", "1½", "½"
const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*[.,]?\d+\s*[${FR}]?|[${FR}])`;

function toNumber(s) {
  s = s.trim().replace(',', '.');
  let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
  const f = FRACTIONS[s.at(-1)];
  return f ? (parseFloat(s.slice(0, -1)) || 0) + f : parseFloat(s);
}

// Unit words -> [unit, multiplier]. Australian measures: cup 250 ml, tbsp 20 ml, tsp 5 ml.
const UNIT_WORDS = [
  [/^(g|gm|gms|grams?|grammes?)$/, 'g', 1],
  [/^(kg|kgs|kilos?|kilograms?)$/, 'kg', 1],
  [/^(ml|mls|millilit(re|er)s?)$/, 'ml', 1],
  [/^(l|lt|ltr|lit(re|er)s?)$/, 'L', 1],
  [/^cups?$/, 'ml', 250],
  [/^(tbsp|tbs|tbl|tablespoons?)$/, 'ml', 20],
  [/^(tsp|teaspoons?)$/, 'ml', 5],
  [/^(oz|ounces?)$/, 'g', 28.35],
  [/^(lbs?|pounds?)$/, 'g', 453.6],
  [/^cloves?$/, 'g', 5], // garlic clove ≈ 5 g
  [/^pinch(es)?$/, 'g', 0.5],
  [/^dash(es)?$/, 'ml', 1],
  [/^(each|ea|pcs?|pieces?|whole|bunch(es)?|sprigs?|slices?|heads?|stalks?|sticks?|leaf|leaves|sheets?)$/, 'each', 1],
];
const unitOf = w => { const u = UNIT_WORDS.find(([re]) => re.test(w.toLowerCase())); return u && [u[1], u[2]]; };

const cleanName = s => {
  const n = s.replace(/\([^)]*\)/g, ' ').replace(/[()]/g, ' ').split(',')[0]
    .replace(/^\s*(?:of|x)\s+/i, '')
    .replace(/^(?:cans?|tins?|packets?|jars?|bottles?|bags?)\s+(?:of\s+)?/i, '')
    .replace(/\s+/g, ' ').trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
};

// "500g tipo 00 flour" -> { qty: 500, unit: 'g', name: 'Tipo 00 flour', ok: true }
// ok is false when there's no quantity ("Salt, to taste") so the row can be flagged.
export function parseIngredientLine(raw) {
  let s = raw.replace(/^\s*(?:[-•*·–]|\d+[.)](?=\s))\s*/, '').trim();
  if (!s) return null;
  let qty = null, unit = 'each', m;
  // Web recipes give both systems; keep the metric one.
  // "175g/6 oz guanciale" -> "175g guanciale"
  s = s.replace(new RegExp(`^(${NUM}\\s*(?:kg|g|ml|l)\\b)\\s*\\/\\s*(?:${NUM})\\s*(?:fl\\.?\\s*)?(?:oz|ounces?|lbs?|pounds?|cups?|pints?)\\b\\.?`, 'i'), '$1');
  // "1 quart (1L) stock" -> 1 L; "1 (28-ounce; 800g) can tomatoes" / "2 (400g) cans" -> count × metric
  if ((m = s.match(new RegExp(`^(${NUM})\\s*([a-zA-Z]*)\\s*\\([^)]*?(${NUM})\\s*(kg|g|ml|l)\\b[^)]*\\)\\s*(.*)$`, 'i')))) {
    const lead = unitOf(m[2] || 'x');
    if (!lead || lead[0] === 'each' || !['g', 'kg', 'ml', 'L'].includes(lead[0])) {
      const u = unitOf(m[4]);
      qty = toNumber(m[3]) * u[1] * (m[2] && !lead ? 1 : toNumber(m[1]));
      unit = u[0];
      s = m[5];
    }
  }
  // "2 x 400g tins tomatoes"
  if (qty == null && (m = s.match(new RegExp(`^(${NUM})\\s*[x×]\\s*(${NUM})\\s*([a-zA-Z]+)\\.?\\s+(.*)$`)))) {
    const u = unitOf(m[3]);
    if (u) { qty = toNumber(m[1]) * toNumber(m[2]) * u[1]; unit = u[0]; s = m[4]; }
  }
  // "500g flour", "1 1/2 cups milk", "2-3 carrots" (takes the first number)
  if (qty == null && (m = s.match(new RegExp(`^(${NUM})(?:\\s*(?:[-–]|to)\\s*${NUM})?\\s*(.*)$`)))) {
    qty = toNumber(m[1]);
    s = m[2];
    const w = s.match(/^([a-zA-Z]+)\.?(?:\s+|$)(.*)$/);
    const u = w && unitOf(w[1]);
    if (u) { qty *= u[1]; unit = u[0]; s = w[2]; }
  }
  const name = cleanName(s);
  return { qty: qty == null ? null : Math.round(qty * 1000) / 1000, unit, name, raw: raw.trim(), ok: qty != null && !!name };
}

// ---- Matching names to Pantry ("olive oil" -> "Olive oil, extra virgin")

const STOP = new Set(['of', 'and', 'the', 'a', 'an', 'fresh', 'large', 'small', 'medium', 'chopped', 'diced', 'sliced',
  'minced', 'finely', 'roughly', 'peeled', 'ground', 'to', 'taste']);
const singular = w => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/oes$/, 'o').replace(/([^s])s$/, '$1') : w);
const tokens = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !STOP.has(w)).map(singular));

// Best match by shared words: 3 = same words, 2 = all of `name`'s words are in the item, 1 = the item's words are all in `name`.
export function matchIngredient(name, list, minScore = 2) {
  const q = tokens(name);
  if (!q.size) return null;
  let best = null, bestScore = 0, bestExtra = Infinity;
  for (const it of list) {
    const c = tokens(it.name);
    const qInC = [...q].every(w => c.has(w)), cInQ = [...c].every(w => q.has(w));
    const score = qInC && cInQ ? 3 : qInC ? 2 : cInQ && c.size ? 1 : 0;
    const extra = Math.abs(c.size - q.size);
    if (score >= minScore && (score > bestScore || (score === bestScore && extra < bestExtra))) { best = it; bestScore = score; bestExtra = extra; }
  }
  return best;
}

// ---- Supplier price lists (CSV file, or cells pasted from a spreadsheet)

export function parseCSV(text) {
  const first = text.split(/\r?\n/, 1)[0];
  const d = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}

// Pack or unit text -> [purchase unit, how many of it the price covers].
// "kg" -> ['kg', 1], "5kg" -> ['kg', 5], "500g" -> ['kg', 0.5], "dozen" -> ['each', 12], "bunch" -> ['each', 1]
export function packUnit(text) {
  const m = String(text ?? '').toLowerCase().trim().replace(/^(?:per|\/)\s*/, '').match(/^([\d.]+)?\s*([a-z]*)/);
  const n = m[1] ? parseFloat(m[1]) : 1, w = m[2];
  if (/^(kg|kgs|kilos?)$/.test(w)) return ['kg', n];
  if (/^(g|gm|grams?)$/.test(w)) return ['kg', n / 1000];
  if (/^(l|lt|ltr|lit(re|er)s?)$/.test(w)) return ['L', n];
  if (/^(ml|mls)$/.test(w)) return ['L', n / 1000];
  if (/^(dozen|doz)$/.test(w)) return ['each', 12 * n];
  if (/^(ea|each|pcs?|pieces?|units?|bunch(es)?|heads?|cans?|tins?|bags?|box(es)?|packs?|packets?|trays?|punnets?|bottles?|jars?)$/.test(w)) return ['each', n];
  if (!w && m[1]) return ['each', n];
  return null;
}

// Rows of { name, price (per purchase unit), unit, yieldPct, ok }. Recognises headers like
// Name/Item/Product, Price/Cost, Unit/Pack/Size, Yield; without headers: name, price, unit.
export function parsePriceList(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const h = rows[0].map(c => c.toLowerCase());
  const find = (re, not = -1) => h.findIndex((c, i) => i !== not && re.test(c));
  let ni = find(/name|item|product|description|ingredient/), pi = find(/price|cost|\$|amount/, ni);
  const header = ni >= 0 && pi >= 0;
  let ui = header ? find(/unit|uom|per|pack|size/, pi) : rows[0].length > 2 ? 2 : -1;
  const yi = header ? find(/yield/) : -1;
  if (!header) { ni = 0; pi = 1; }
  // "Price per kg" / "Price/L" header supplies the unit when there's no unit column
  const headerUnit = header && ui < 0 ? packUnit((h[pi].match(/(?:per|\/)\s*(.+)$/) ?? [])[1]) : null;
  return rows.slice(header ? 1 : 0).map(r => {
    const name = r[ni] ?? '';
    // "$1,234.50" -> 1234.5, but "12,50" (decimal comma) -> 12.5
    const p = String(r[pi] ?? '').replace(/[$\s]/g, '');
    const price = parseFloat(/^\d+,\d{1,2}$/.test(p) ? p.replace(',', '.') : p.replace(/,/g, ''));
    const pack = ui >= 0 ? packUnit(r[ui]) : headerUnit ?? ['kg', 1];
    const y = yi >= 0 ? parseFloat(r[yi]) : NaN;
    const ok = !!name && Number.isFinite(price) && price >= 0 && !!pack;
    return { name, unit: pack?.[0] ?? 'kg', price: ok ? Math.round(price / pack[1] * 10000) / 10000 : null,
      yieldPct: y > 0 && y <= 100 ? y : null, ok, raw: r.join(', ') };
  });
}

// ---- Cooking mode: method steps and timers

// Method text -> steps. One per line (list numbers and bullets stripped); a single long
// paragraph is split into sentences.
export function splitSteps(method) {
  let lines = String(method ?? '').split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:step\s*\d+[.):]?|\d+[.)]|[-•*])\s*/i, '').trim())
    .filter(Boolean);
  if (lines.length === 1 && lines[0].length > 120) lines = lines[0].split(/(?<=[.!?])\s+(?=[A-Z])/);
  return lines;
}

const DUR_NUM = String.raw`\d+(?:[.,]\d+)?\s*[${FR}]?|[${FR}]`;
const DUR_RE = new RegExp(
  `(${DUR_NUM})(?:\\s*(?:-|–|to)\\s*(?:${DUR_NUM}))?\\s*(hours?|hrs?|hr|h|minutes?|mins?|min|seconds?|secs?|sec)\\b` +
  `(?:\\s*(?:and\\s*)?(${DUR_NUM})\\s*(minutes?|mins?|min)\\b)?`, 'gi');
const SECS = u => (/^h/i.test(u) ? 3600 : /^m/i.test(u) ? 60 : 1);

// "Simmer 45 min" -> [{ text: '45 min', seconds: 2700 }]. "1 hr 30 min" is one timer;
// a range ("8-10 min") starts from the first number so you check early.
export function findDurations(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(DUR_RE)) {
    let seconds = toNumber(m[1]) * SECS(m[2]);
    if (m[3]) seconds += toNumber(m[3]) * 60;
    if (seconds > 0 && seconds <= 24 * 3600) out.push({ text: m[0].trim(), seconds: Math.round(seconds) });
  }
  return out;
}

// 2700 -> "45 min", 5400 -> "1 h 30 min", 30 -> "30 s"
export function fmtDuration(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h && `${h} h`, m && `${m} min`, !h && !m && `${sec} s`].filter(Boolean).join(' ');
}
