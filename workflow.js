// Practical assessment work flow plan, from pasted recipes: recipe cards, a timed task plan with
// equipment, and the combined ingredients list. Rules only (no AI): it reads the usual recipe layout
// (title, Yield / Prep / Cook / Equipment lines, an Ingredients list, a Method), then plans the day so
// the longest jobs (simmering, resting, infusing) start first and other work fits in while they run.
// Pure and tested; docx.js puts the result into the school's Word form.
import { parseIngredientLine, splitSteps, findDurations, fmtDuration } from './parse.js';
import { convert } from './calc.js';

const ING = /^(?:ingredients?(?: list)?|quantity\s*(?:\(unit\))?\s*ingredients?(?: description)?)\s*:?$/i;
const METHOD = /^(?:method|directions|instructions|procedure)\s*:?$/i;
const META = { yield: /^(?:yield|yields|serves|makes)\b\s*[:\-]?\s*(.*)$/i, prep: /^prep(?:aration)?\s*time\s*[:\-]?\s*(.*)$/i,
  cook: /^cook(?:ing)?\s*time\s*[:\-]?\s*(.*)$/i, equipment: /^equipment(?:\s*\/\s*tools)?\s*[:\-]?\s*(.*)$/i };
const metaOf = l => Object.entries(META).find(([, re]) => re.test(l));
const SKIP = /^(?:recipe card\s*#?\s*\d*|follow\s+src|quantity\s*\(unit\)|ingredients description)$/i;

const titleCase = s => (s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase().replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) : s);
const cleanTitle = s => titleCase(s.replace(/^(?:recipe(?: card)?\s*#?\s*\d+\s*[:.\-]?\s*|recipe name\s*:\s*)/i, '').trim());

// "Carrots 200 g" or "Carrots\t200\tg" (name first, as copied from a table) -> "200 g Carrots"
const nameFirst = l => l.match(/^([A-Za-z][^\d]*?)\s+(\d[\d.,/½¼¾ ]*)\s*(kg|g|ml|l|lt|ltr|each|ea|pcs?|bunch(?:es)?|cloves?|tbsp|tsp|cups?)?\.?$/i);
function ingredient(line) {
  const m = nameFirst(line);
  const p = parseIngredientLine(m ? `${m[2]} ${m[3] ?? ''} ${m[1]}` : line);
  return p?.name ? { qty: p.qty, unit: p.unit, name: p.name } : null;
}

// text -> [{ name, yield, prep, cook, equipment, items: [{ qty, unit, name }], steps: [...] }]
export function parseRecipes(text) {
  const lines = String(text ?? '').split(/\r?\n/).map(l => l.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim());
  const heads = lines.map((l, i) => (ING.test(l) ? i : -1)).filter(i => i >= 0);
  // Each Ingredients heading starts a recipe; its title and Yield/Prep lines sit just above it.
  const starts = heads.map(h => {
    let i = h - 1;
    while (i >= 0 && (!lines[i] || metaOf(lines[i]) || SKIP.test(lines[i]))) i--;
    return Math.max(0, i);
  });
  if (!heads.length) starts.push(0);
  return starts.map((s, k) => {
    const block = lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length);
    const r = { name: '', yield: '', prep: '', cook: '', equipment: '', items: [], steps: [] };
    let section = heads.length ? 'head' : 'guess', method = [];
    for (const l of block) {
      if (!l || SKIP.test(l)) continue;
      if (ING.test(l)) { section = 'ing'; continue; }
      if (METHOD.test(l)) { section = 'method'; continue; }
      const meta = metaOf(l);
      if (meta && section !== 'method') { r[meta[0]] = l.match(meta[1])[1].trim().replace(/^(\d+)$/, '$1 portions'); continue; }
      if (section === 'head' || (section === 'guess' && !r.name && !ingredient(l)?.qty)) { r.name ||= cleanTitle(l); continue; }
      if (section === 'ing' || (section === 'guess' && ingredient(l)?.qty != null)) { const it = ingredient(l); if (it) r.items.push(it); continue; }
      method.push(l);
    }
    r.steps = splitSteps(method.join('\n'));
    r.name ||= `Recipe ${k + 1}`;
    return r;
  }).filter(r => r.items.length || r.steps.length);
}

// ---- Equipment, from what the text says
const TOOLS = [
  ['Stockpot', /\bstock ?pot\b/i], ['Saucepan', /\b(saucepan|pot)\b/i], ['Frying pan', /\b(frying pan|fry pan|saut[ée] pan|skillet|pan)\b/i],
  ['Oven', /\b(oven|bake|baked|roast|roasted)\b/i], ['Baking tray', /\b(tray|baking sheet)\b/i], ['Mixing bowl', /\bbowls?\b/i],
  ['Whisk', /\bwhisk/i], ['Blender', /\b(blend|blender)\b/i], ['Food processor', /\bfood processor\b/i],
  ['Knife and chopping board', /\b(cut|chop|dice|slice|julienne|brunoise|mince|trim|core|deseed|halve|quarter)/i], ['Peeler', /\bpeel/i],
  ['Sieve', /\b(sieve|strain|sift)/i], ['Colander', /\b(colander|drain)/i], ['Pasta machine', /\b(pasta machine|setting \d)/i],
  ['Rolling pin', /\b(rolling pin|roll out)\b/i], ['Grater', /\bgrat(e|ed|er)\b/i], ['Ladle', /\bladle/i], ['Tongs', /\btongs\b/i],
  ['Spatula', /\b(spatula|fold)\b/i], ['Jar', /\bjars?\b/i], ['Probe thermometer', /\b(thermometer|core temp)/i], ['Piping bag', /\bpip(e|ing)\b/i],
  ['Mandoline', /\bmandolin/i], ['Mortar and pestle', /\b(mortar|pestle)\b/i], ['Cling wrap', /\b(cling|wrap)\b/i], ['Scales', /\bweigh/i],
];
export const equipmentIn = text => TOOLS.filter(([, re]) => re.test(text)).map(([name]) => name);

// ---- The day: 08:00 wash and gather, work until lunch at 12:00, 12:30 set up, work until 2:00 pack down
export const DAY = { start: 8 * 60 + 15, lunch: 12 * 60, back: 12 * 60 + 40, end: 14 * 60 };
const SERVE = /\b(serve|plate|plating|garnish)\b/i;
const PASSIVE = 20; // a step that waits 20 min or more (simmer, rest, infuse) runs in the background
export const clockLabel = m => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0'); return h < 12 ? `${String(h).padStart(2, '0')}:${mm} am` : `${h === 12 ? 12 : h - 12}:${mm} pm`; };

// A step's hands-on minutes (work) and its hands-off wait. Steps without a time count as 10 min of work.
const minutes = s => Math.round(findDurations(s).reduce((n, d) => n + d.seconds, 0) / 60);
export function stepTime(text) {
  const wait = minutes(text);
  return wait >= PASSIVE ? { text, work: 5, wait } : { text, work: Math.max(10, Math.min(wait, 30)), wait: 0 };
}

// -> { rows: [{ at (minutes), time, task, equipment, part: 'am' | 'pm', ri, si }], over: minutes past 2:00 pm }
// A recipe's needs (indexes of other recipes in the list, its sub-recipes) must be finished before it starts.
export function buildTimeline(recipes, day = DAY) {
  const jobs = recipes.map((r, ri) => ({ ri, name: r.name, next: 0, ready: day.start, steps: r.steps.map(stepTime),
    needs: (r.needs ?? []).filter(k => k !== ri && recipes[k]) }));
  const left = j => j.steps.slice(j.next).reduce((n, s) => n + s.work + s.wait, 0);
  // The longest chain goes first: a dish's own time plus the longest dish waiting on it
  const chain = (j, seen = new Set([j])) => left(j) + Math.max(0, ...jobs.filter(d => d.needs.includes(j.ri) && !seen.has(d)).map(d => chain(d, new Set([...seen, d]))));
  const doneAt = j => (j.next >= j.steps.length ? j.ready : Infinity);
  // Plating and serving wait for the afternoon service, after set up
  const avail = j => Math.max(j.ready, ...j.needs.map(k => doneAt(jobs[k])), SERVE.test(j.steps[j.next].text) ? day.back : 0);
  const rows = [];
  let t = day.start;
  while (jobs.some(j => j.next < j.steps.length)) {
    if (t >= day.lunch && t < day.back) t = day.back;
    const open = jobs.filter(j => j.next < j.steps.length && avail(j) <= t);
    if (!open.length) {
      const waiting = jobs.filter(j => j.next < j.steps.length), soonest = Math.min(...waiting.map(avail));
      if (soonest === Infinity) waiting.forEach(j => { j.needs = []; }); // recipes that need each other: drop the rule
      else t = Math.max(t, soonest);
      continue;
    }
    const j = open.sort((a, b) => chain(b) - chain(a) || a.ri - b.ri)[0], s = j.steps[j.next++];
    const until = s.wait ? ` (until ${clockLabel(t + s.work + s.wait)})` : '';
    rows.push({ at: t, time: clockLabel(t), task: `${j.name}: ${s.text}${until}`, equipment: equipmentIn(s.text).join(', '), part: t < day.lunch ? 'am' : 'pm',
      ri: j.ri, si: j.next - 1 }); // which recipe and step, for the app's order list
    t += s.work;
    j.ready = t + s.wait;
  }
  const finish = Math.max(t, ...jobs.map(j => j.ready));
  return { rows, over: Math.max(0, finish - day.end) };
}

// ---- Ingredients list: one row per ingredient, quantity per recipe and in total, in g, ml or each
const BASE = { g: 'g', kg: 'g', ml: 'ml', L: 'ml', each: 'each' };
const key = n => n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(\w+?)(es|s)\b/g, '$1').trim();
export function ingredientTotals(recipes) {
  const rows = new Map();
  recipes.forEach((r, ri) => r.items.forEach(it => {
    const unit = BASE[it.unit] ?? 'each', k = `${key(it.name)}|${unit}`;
    if (!rows.has(k)) rows.set(k, { name: it.name, unit, per: recipes.map(() => null), total: 0, qb: false });
    const row = rows.get(k), q = it.qty > 0 ? convert(it.qty, it.unit, unit) : NaN;
    if (Number.isFinite(q)) { row.per[ri] = (row.per[ri] ?? 0) + q; row.total += q; } else { row.qb = true; row.per[ri] ??= 'q.b.'; }
  }));
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export const amount = q => (typeof q === 'number' ? String(Math.round(q * 100) / 100) : q ?? '');

const COOK = /\b(cook|simmer|boil|bake|roast|fry|saut[ée]|braise|poach|steam|grill|reduce|blanch|sear|toast)/i;
// Recipes -> everything the form needs. Equipment and cooking time come from the method when not given.
export function plan(recipes) {
  recipes = recipes.map(r => {
    const cook = r.steps.filter(s => COOK.test(s)).reduce((n, s) => n + minutes(s), 0);
    const prep = r.steps.filter(s => !COOK.test(s)).reduce((n, s) => n + stepTime(s).work, 0);
    return { ...r, equipment: r.equipment || equipmentIn(r.steps.join('\n')).join(', '),
      prep: r.prep || (prep ? fmtDuration(prep * 60) : ''), cook: r.cook || (cook ? fmtDuration(cook * 60) : '') };
  });
  return { recipes, timeline: buildTimeline(recipes), totals: ingredientTotals(recipes) };
}

// The whole day as it runs: the school's fixed blocks (wash and gather, lunch, set up, pack down) around the tasks
const FIXED = [[0, 'Wash hands, sanitise work area, prepare workstation'], [0, 'Gather ingredients as per the ingredients list'],
  ['lunch', 'Lunch break'], ['setup', 'Set up: wash hands, set up benches'], ['end', 'Pack down and clean up']];
export function dayRows(timeline, day = DAY) {
  const at = { 0: day.start - 15, lunch: day.lunch, setup: day.back - 10, end: day.end };
  const fixed = FIXED.map(([k, task]) => ({ at: at[k], time: clockLabel(at[k]), task, equipment: '', fixed: true }));
  return [...fixed, ...timeline.rows].sort((a, b) => a.at - b.at || (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0));
}
