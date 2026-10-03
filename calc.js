// Australian mandatory allergen declarations (FSANZ PEAL).
// ponytail: tree nuts as one entry, split per nut if a venue needs it.
export const ALLERGENS = ['Gluten', 'Wheat', 'Crustacean', 'Mollusc', 'Fish', 'Egg', 'Milk',
  'Peanut', 'Tree nuts', 'Sesame', 'Soy', 'Lupin', 'Sulphites'];

export const PURCHASE_UNITS = ['kg', 'L', 'each'];
export const UNITS = ['g', 'kg', 'ml', 'L', 'each'];
export const GST = 0.1;

// Ingredients added while writing a recipe have no price until filled in Pantry.
export const hasPrice = ing => ing.price != null && ing.price !== '';

const BASE = { g: ['kg', 0.001], kg: ['kg', 1], ml: ['L', 0.001], L: ['L', 1], each: ['each', 1] };

// NaN when units can't convert (e.g. g -> L).
export function convert(qty, from, to) {
  const [bf, f] = BASE[from] ?? [];
  const [bt, t] = BASE[to] ?? [];
  return bf && bf === bt ? qty * f / t : NaN;
}

// ---- Weight <-> volume by ingredient (g per ml). Approximate: spooned, not packed, unless noted.
// Specific names first; the first keyword found in the ingredient name wins.
export const DENSITIES = [
  ['icing sugar', 0.48], ['powdered sugar', 0.48], ['brown sugar', 0.90], ['caster sugar', 0.83], ['sugar', 0.84],
  ['tipo 00', 0.51], ['00 flour', 0.51], ['bread flour', 0.51], ['self-raising', 0.51], ['self raising', 0.51], ['flour', 0.51],
  ['semolina', 0.70], ['cocoa', 0.36], ['rolled oats', 0.38], ['oats', 0.38], ['panko', 0.25], ['breadcrumb', 0.47],
  ['arborio', 0.82], ['rice', 0.78], ['butter', 0.96], ['honey', 1.42], ['golden syrup', 1.42], ['maple', 1.32],
  ['oil', 0.92], ['cream', 1.0], ['milk', 1.03], ['yoghurt', 1.03], ['yogurt', 1.03], ['stock', 1.0], ['wine', 0.99],
  ['vinegar', 1.01], ['water', 1.0], ['passata', 1.04], ['parmesan', 0.42], ['parmigiano', 0.42], ['pecorino', 0.42],
  ['kosher salt', 0.57], ['salt flakes', 0.45], ['salt', 1.2], ['baking powder', 0.92], ['bicarb', 0.92], ['baking soda', 0.92],
];
export const densityFor = name => DENSITIES.find(([k]) => String(name ?? '').toLowerCase().includes(k))?.[1] ?? null;

const MASS = { g: 1, kg: 1000 }, VOLUME = { ml: 1, L: 1000 };
// Like convert(), but crosses weight and volume using the ingredient's density ("2 cups flour" priced per kg).
export function convertFor(qty, from, to, name) {
  const direct = convert(qty, from, to);
  if (Number.isFinite(direct)) return direct;
  const d = densityFor(name);
  if (!d) return NaN;
  if (VOLUME[from] && MASS[to]) return qty * VOLUME[from] * d / MASS[to];
  if (MASS[from] && VOLUME[to]) return qty * MASS[from] / d / VOLUME[to];
  return NaN;
}

// Cup and spoon sizes in ml
export const MEASURES = { au: { cup: 250, tbsp: 20, tsp: 5 }, us: { cup: 236.6, tbsp: 14.8, tsp: 4.93 } };

// Typical weight of one, for baker's percentages (whole egg without shell, 59 g egg)
const EACH_GRAMS = [['yolk', 18], ['white', 32], ['egg', 50]];
export const eachGrams = name => EACH_GRAMS.find(([k]) => String(name ?? '').toLowerCase().includes(k))?.[1] ?? null;

// An item is either { ingredientId, qty, unit } or a sub-recipe { recipeId, qty, unit }.
// Sub-recipe unit is 'portion', or any unit convertible to the sub-recipe's batch yield.
// `seen` holds the recipe ids above this item, to stop circular sub-recipes.
export function itemCost(it, ings, recs = new Map(), seen = new Set()) {
  const qty = Number(it.qty);
  if (it.recipeId) {
    const sub = recs.get(it.recipeId);
    if (!sub) return { cost: NaN, problems: ['A sub-recipe was deleted'] };
    if (seen.has(sub.id)) return { cost: NaN, problems: [`${sub.name}: circular sub-recipe`] };
    const c = recipeCost(sub, ings, recs, new Set([...seen, sub.id]));
    const problems = c.problems.map(p => `${sub.name} → ${p}`);
    if (it.unit === 'portion') return { cost: qty * c.perPortion, problems };
    const q = convert(qty, it.unit, sub.yieldUnit);
    if (!(sub.yieldQty > 0) || !Number.isFinite(q)) {
      return { cost: NaN, problems: [...problems, `${sub.name}: set its batch yield in ${it.unit}, or use portions`] };
    }
    return { cost: c.total * q / sub.yieldQty, problems };
  }
  const ing = ings.get(it.ingredientId);
  if (!ing) return { cost: NaN, problems: ['An ingredient was deleted from Pantry'] };
  if (!hasPrice(ing)) return { cost: NaN, problems: [`Price missing: ${ing.name}`] };
  const q = convertFor(qty, it.unit, ing.unit, ing.name);
  if (!Number.isFinite(q)) return { cost: NaN, problems: [`${ing.name}: can't convert ${it.unit} to ${ing.unit}`] };
  return { cost: q * (Number(ing.price) || 0) / ((Number(ing.yieldPct) || 100) / 100), problems: [] };
}

export function recipeCost(recipe, ings, recs = new Map(), seen = new Set([recipe.id])) {
  let total = 0;
  const problems = [];
  for (const it of recipe.items ?? []) {
    const c = itemCost(it, ings, recs, seen);
    if (Number.isFinite(c.cost)) total += c.cost;
    problems.push(...c.problems);
  }
  return { total, perPortion: total / Math.max(1, Number(recipe.portions) || 1), problems: [...new Set(problems)] };
}

// Food cost % is measured against the ex-GST price.
export function suggestedPrice(perPortion, targetPct) {
  const ex = targetPct > 0 ? perPortion / (targetPct / 100) : NaN;
  return { ex, inc: ex * (1 + GST) };
}

export const actualCostPct = (perPortion, menuPriceInc) =>
  menuPriceInc > 0 ? perPortion / (menuPriceInc / (1 + GST)) * 100 : NaN;

function allergenSet(recipe, ings, recs, seen, out = new Set()) {
  for (const it of recipe.items ?? []) {
    const sub = it.recipeId && recs.get(it.recipeId);
    if (sub && !seen.has(sub.id)) allergenSet(sub, ings, recs, new Set([...seen, sub.id]), out);
    else ings.get(it.ingredientId)?.allergens?.forEach(a => out.add(a));
  }
  return out;
}

export function recipeAllergens(recipe, ings, recs = new Map()) {
  const s = allergenSet(recipe, ings, recs, new Set([recipe.id]));
  return ALLERGENS.filter(a => s.has(a));
}

export const usesRecipe = (recipe, id) => (recipe.items ?? []).some(it => it.recipeId === id);

export const money = n => Number.isFinite(n) ? '$' + n.toFixed(2) : '-';
export const pct = n => Number.isFinite(n) ? n.toFixed(1) + '%' : '-';

// Expand a recipe (scaled by `factor` batches) into raw ingredient needs, in each
// ingredient's purchase unit, before trim yield. Sub-recipes are expanded recursively.
export function ingredientNeeds(recipe, factor, ings, recs, needs = new Map(), problems = [], seen = new Set([recipe.id])) {
  for (const it of recipe.items ?? []) {
    const qty = Number(it.qty) * factor;
    if (it.recipeId) {
      const sub = recs.get(it.recipeId);
      if (!sub) { problems.push('A sub-recipe was deleted'); continue; }
      if (seen.has(sub.id)) { problems.push(`${sub.name}: circular sub-recipe`); continue; }
      const subFactor = it.unit === 'portion'
        ? qty / Math.max(1, Number(sub.portions) || 1)
        : sub.yieldQty > 0 ? convert(qty, it.unit, sub.yieldUnit) / sub.yieldQty : NaN;
      if (!Number.isFinite(subFactor)) { problems.push(`${sub.name}: set its batch yield in ${it.unit}, or use portions`); continue; }
      ingredientNeeds(sub, subFactor, ings, recs, needs, problems, new Set([...seen, sub.id]));
      continue;
    }
    const ing = ings.get(it.ingredientId);
    if (!ing) { problems.push('An ingredient was deleted from Pantry'); continue; }
    const q = convertFor(qty, it.unit, ing.unit, ing.name);
    if (!Number.isFinite(q)) { problems.push(`${ing.name}: can't convert ${it.unit} to ${ing.unit}`); continue; }
    needs.set(it.ingredientId, (needs.get(it.ingredientId) ?? 0) + q);
  }
  return { needs, problems };
}

// plan: [{ recipeId, portions }]; onHand: { ingredientId: qty in purchase unit }.
// gross = need grossed up for trim yield; order = gross - on hand (min 0); 'each' rounds up.
export function orderList(plan, ings, recs, onHand = {}) {
  const needs = new Map(), problems = [];
  for (const { recipeId, portions } of plan) {
    const r = recs.get(recipeId);
    if (r && portions > 0) ingredientNeeds(r, portions / Math.max(1, Number(r.portions) || 1), ings, recs, needs, problems);
  }
  const lines = [...needs].map(([id, usable]) => {
    const ing = ings.get(id);
    const gross = usable / ((Number(ing.yieldPct) || 100) / 100);
    const have = Math.max(0, Number(onHand[id]) || 0);
    let order = Math.max(0, gross - have);
    if (ing.unit === 'each') order = Math.ceil(order - 1e-9);
    if (order > 0 && !hasPrice(ing)) problems.push(`Price missing: ${ing.name}`);
    return { id, ing, usable, gross, have, order, cost: hasPrice(ing) ? order * Number(ing.price) : order > 0 ? NaN : 0 };
  }).sort((a, b) => a.ing.name.localeCompare(b.ing.name));
  const total = lines.reduce((n, l) => n + (Number.isFinite(l.cost) ? l.cost : 0), 0);
  return { lines, total, problems: [...new Set(problems)] };
}

// 0.04 kg -> "40 g", 3.3 kg -> "3.3 kg", 6 each -> "6 each"
export function fmtAmount(q, unit) {
  const r = n => String(Math.round(n * 100) / 100);
  if (unit === 'kg' && q < 1) return `${Math.round(q * 1000)} g`;
  if (unit === 'L' && q < 1) return `${Math.round(q * 1000)} ml`;
  return `${r(q)} ${unit}`;
}

// Food safety temperature checks (FSANZ Standard 3.2.2; 75 °C core is common guidance).
export const TEMP_CHECKS = {
  fridge: { label: 'Fridge / cool room', max: 5 },
  freezer: { label: 'Freezer', max: -15 },
  delivery_chilled: { label: 'Delivery, chilled', max: 5 },
  delivery_frozen: { label: 'Delivery, frozen', max: -15 },
  hot_hold: { label: 'Hot holding', min: 60 },
  cooking: { label: 'Cooking (core)', min: 75 },
  reheat: { label: 'Reheating (core)', min: 75 },
  cooling: { label: 'Cooling (2-stage)' },
};

export const limitText = type => {
  const c = TEMP_CHECKS[type] ?? {};
  return c.max != null ? `≤ ${c.max} °C` : c.min != null ? `≥ ${c.min} °C` : '60 → 21 °C within 2 h → 5 °C within 6 h';
};

const minutesBetween = (a, b) => (new Date(b) - new Date(a)) / 60000;
const hasReading = r => r?.at && r.temp != null && r.temp !== '';

// -> { status: 'pass' | 'fail' | 'pending', note }
export function tempStatus(e) {
  const c = TEMP_CHECKS[e.type];
  if (!c) return { status: 'fail', note: 'Unknown check type' };
  if (e.type === 'cooling') {
    if (!hasReading(e.start)) return { status: 'pending', note: 'Add start time and temperature' };
    if (!hasReading(e.stage1)) return { status: 'pending', note: 'Check again within 2 h of start (≤ 21 °C)' };
    if (e.stage1.temp > 21 || minutesBetween(e.start.at, e.stage1.at) > 120) return { status: 'fail', note: 'Stage 1: must be ≤ 21 °C within 2 h of start' };
    if (!hasReading(e.stage2)) return { status: 'pending', note: 'Check again within 6 h of start (≤ 5 °C)' };
    if (e.stage2.temp > 5 || minutesBetween(e.start.at, e.stage2.at) > 360) return { status: 'fail', note: 'Stage 2: must be ≤ 5 °C within 6 h of start' };
    return { status: 'pass', note: 'Cooled within limits' };
  }
  if (e.temp == null || e.temp === '') return { status: 'pending', note: 'Enter temperature' };
  if ((c.max != null && e.temp > c.max) || (c.min != null && e.temp < c.min)) return { status: 'fail', note: `Must be ${limitText(e.type)}` };
  return { status: 'pass', note: limitText(e.type) };
}

// Butcher's / kitchen yield test. ap = as-purchased weight, ep = edible portion after trimming,
// trims = recorded trim and by-products [{ qty, value per unit }] (e.g. bones for stock).
export function yieldTest({ ap, ep, price, trims = [] }) {
  ap = Number(ap); ep = Number(ep); price = Number(price) || 0;
  if (!(ap > 0) || !(ep >= 0) || ep > ap) return null;
  const trimQty = trims.reduce((n, t) => n + (Number(t.qty) || 0), 0);
  const credit = trims.reduce((n, t) => n + (Number(t.qty) || 0) * (Number(t.value) || 0), 0);
  const totalCost = ap * price;
  const rest = ap - ep - trimQty;
  return {
    yieldPct: ep / ap * 100,
    totalCost,
    credit,
    costPerUsable: ep > 0 ? (totalCost - credit) / ep : NaN,
    unaccounted: Math.max(0, rest),
    overTrim: rest < -1e-9, // trims + EP weigh more than what was bought
  };
}

// ---- Scaling

const itemName = (it, ings, recs) => (it.recipeId ? recs.get(it.recipeId)?.name : ings.get(it.ingredientId)?.name) ?? '';

// "I have 3 kg of mince": how far does that go? -> { factor, portions }, or null if the units don't meet.
export function scaleFromIngredient(recipe, index, haveQty, haveUnit, ings, recs = new Map()) {
  const it = recipe.items?.[index];
  if (!it || !(Number(it.qty) > 0) || !(Number(haveQty) > 0)) return null;
  const have = convertFor(Number(haveQty), haveUnit, it.unit, itemName(it, ings, recs));
  if (!Number.isFinite(have)) return null;
  const factor = have / Number(it.qty);
  return { factor, portions: (Number(recipe.portions) || 1) * factor };
}

// An item's weight in grams: weight units directly, volume via density (water if unknown), eggs by count.
export function itemGrams(it, ings, recs = new Map()) {
  const q = Number(it.qty), name = itemName(it, ings, recs);
  if (MASS[it.unit]) return q * MASS[it.unit];
  if (VOLUME[it.unit]) return q * VOLUME[it.unit] * (densityFor(name) ?? 1);
  if (it.unit === 'each') { const g = eachGrams(name); return g ? q * g : null; }
  return null;
}

// Baker's percentages against one base item (usually the flour): base = 100%.
export function bakersPercent(recipe, ings, recs = new Map(), baseIndex) {
  const grams = (recipe.items ?? []).map(it => itemGrams(it, ings, recs));
  const base = grams[baseIndex];
  if (!(base > 0)) return null;
  return {
    base,
    rows: grams.map((g, i) => ({ i, grams: g, pct: g == null ? null : g / base * 100 })),
    total: grams.reduce((n, g) => n + (g ?? 0), 0),
  };
}

// The base for baker's %: the flour (or semolina) if there is one, else the heaviest item.
export function bakersBase(recipe, ings, recs = new Map()) {
  const items = recipe.items ?? [];
  const flour = items.findIndex(it => /flour|semolina/i.test(itemName(it, ings, recs)) && itemGrams(it, ings, recs) > 0);
  if (flour >= 0) return flour;
  let best = -1, max = 0;
  items.forEach((it, i) => { const g = itemGrams(it, ings, recs) ?? 0; if (g > max) { max = g; best = i; } });
  return best;
}

// Oven and small conversions
export const fToC = f => (f - 32) * 5 / 9;
export const cToF = c => c * 9 / 5 + 32;

// ---- Prep list: how many batches of each recipe (sub-recipes included) a service needs.
// plan: [{ recipeId, portions }] -> tasks sorted so sub-recipes come before the dishes that use them.
export function prepBatches(plan, recs) {
  const need = new Map(), depth = new Map(), problems = [];
  const visit = (r, factor, d, seen) => {
    need.set(r.id, (need.get(r.id) ?? 0) + factor);
    depth.set(r.id, Math.max(depth.get(r.id) ?? 0, d));
    for (const it of r.items ?? []) {
      if (!it.recipeId) continue;
      const sub = recs.get(it.recipeId);
      if (!sub) { problems.push('A sub-recipe was deleted'); continue; }
      if (seen.has(sub.id)) { problems.push(`${sub.name}: circular sub-recipe`); continue; }
      const qty = Number(it.qty) * factor;
      const f = it.unit === 'portion' ? qty / Math.max(1, Number(sub.portions) || 1)
        : sub.yieldQty > 0 ? convert(qty, it.unit, sub.yieldUnit) / sub.yieldQty : NaN;
      if (!Number.isFinite(f)) { problems.push(`${sub.name}: set its batch yield in ${it.unit}, or use portions`); continue; }
      visit(sub, f, d + 1, new Set([...seen, sub.id]));
    }
  };
  for (const { recipeId, portions } of plan) {
    const r = recs.get(recipeId);
    if (r && portions > 0) visit(r, portions / Math.max(1, Number(r.portions) || 1), 0, new Set([r.id]));
  }
  const tasks = [...need].map(([id, factor]) => ({ recipe: recs.get(id), factor, depth: depth.get(id) }))
    .sort((a, b) => b.depth - a.depth);
  return { tasks, problems: [...new Set(problems)] };
}

// Readable amounts for scaled quantities: 10681.82 g -> "10.7 kg", 0.04 kg -> "40 g", 4.267 each -> "4.27 each".
// Three significant-ish figures: >= 100 whole numbers, >= 10 one decimal, else two.
export function niceParts(q, unit) {
  let v = Number(q), u = unit;
  if (u === 'g' && v >= 1000) { v /= 1000; u = 'kg'; } else if (u === 'kg' && v > 0 && v < 1) { v *= 1000; u = 'g'; }
  if (u === 'ml' && v >= 1000) { v /= 1000; u = 'L'; } else if (u === 'L' && v > 0 && v < 1) { v *= 1000; u = 'ml'; }
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return [String(r), u];
}
export const niceAmount = (q, unit) => niceParts(q, unit).join(' ');

// ---- Food cost watch

// Price history kept on the ingredient: a new entry only when price or unit actually changes (newest last, max 24).
export function withPriceHistory(old, next, date) {
  const hist = [...(old?.priceHistory ?? [])];
  if (!hist.length && old && hasPrice(old)) hist.push({ date: old.priceDate ?? date, price: Number(old.price), unit: old.unit });
  const last = hist.at(-1);
  if (hasPrice(next) && (!last || last.price !== Number(next.price) || last.unit !== next.unit)) hist.push({ date, price: Number(next.price), unit: next.unit });
  return { ...next, priceHistory: hist.slice(-24) };
}

// Recipes whose cost per portion changes between two ingredient maps (sub-recipes included).
export function costImpact(recipes, before, after) {
  const recs = new Map(recipes.map(r => [r.id, r]));
  return recipes.map(r => {
    const a = recipeCost(r, before, recs).perPortion, b = recipeCost(r, after, recs).perPortion;
    return { recipe: r, before: a, after: b, beforePct: actualCostPct(a, r.menuPrice), afterPct: actualCostPct(b, r.menuPrice) };
  }).filter(x => Number.isFinite(x.before) && Number.isFinite(x.after) && Math.abs(x.after - x.before) >= 0.005)
    .sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before));
}

// Recipes with a menu price, by actual food cost %, flagged when above their target.
export function foodCostWatch(recipes, ings, defaultTarget) {
  const recs = new Map(recipes.map(r => [r.id, r]));
  return recipes.filter(r => r.menuPrice > 0).map(r => {
    const c = recipeCost(r, ings, recs), target = r.targetCostPct || defaultTarget, actual = actualCostPct(c.perPortion, r.menuPrice);
    return { recipe: r, perPortion: c.perPortion, actual, target, over: actual > target, incomplete: c.problems.length > 0 };
  }).sort((a, b) => b.actual - a.actual);
}

// Latest change for each ingredient with history: { ing, from, to, change % }
export const priceMoves = ings => [...ings.values()].map(ing => {
  const h = (ing.priceHistory ?? []).filter(x => x.unit === ing.unit);
  if (h.length < 2) return null;
  const from = h.at(-2), to = h.at(-1);
  return { ing, from, to, change: from.price > 0 ? (to.price - from.price) / from.price * 100 : NaN };
}).filter(Boolean).sort((a, b) => b.change - a.change);

// ---- Menu engineering (Kasavana & Smith)
// items: [{ recipeId, price (inc GST; falls back to the recipe's menu price), sold }]
// Contribution margin = price ex GST - food cost. Popular: menu mix >= 70% of an even share.
// Profitable: CM >= the sales-weighted average CM. Star / Plowhorse / Puzzle / Dog.
export const MENU_CLASSES = {
  star: { label: 'Star', advice: 'Popular and profitable. Keep it, feature it, protect the recipe.' },
  plowhorse: { label: 'Plowhorse', advice: 'Popular, low margin. Trim the cost or portion, or nudge the price up.' },
  puzzle: { label: 'Puzzle', advice: 'Profitable but slow. Move it up the menu, rename it, have staff recommend it.' },
  dog: { label: 'Dog', advice: 'Slow and low margin. Replace it or rework it.' },
};

export function menuEngineering(items, ings, recs) {
  const rows = items.filter(x => recs.get(x.recipeId)).map(x => {
    const r = recs.get(x.recipeId);
    const price = Number(x.price) > 0 ? Number(x.price) : Number(r.menuPrice) || 0;
    const c = recipeCost(r, ings, recs);
    return { recipe: r, price, sold: Math.max(0, Number(x.sold) || 0), cost: c.perPortion, cm: price / (1 + GST) - c.perPortion,
      foodCost: actualCostPct(c.perPortion, price), incomplete: c.problems.length > 0 || !(price > 0) };
  });
  const totalSold = rows.reduce((n, x) => n + x.sold, 0);
  const avgCm = totalSold ? rows.reduce((n, x) => n + x.cm * x.sold, 0) / totalSold : NaN;
  const popThreshold = rows.length ? 0.7 / rows.length : NaN;
  for (const x of rows) {
    x.mix = totalSold ? x.sold / totalSold : 0;
    x.class = totalSold ? (x.mix >= popThreshold ? (x.cm >= avgCm ? 'star' : 'plowhorse') : (x.cm >= avgCm ? 'puzzle' : 'dog')) : null;
  }
  const revenue = rows.reduce((n, x) => n + x.price / (1 + GST) * x.sold, 0);
  const foodCost = rows.reduce((n, x) => n + x.cost * x.sold, 0);
  return { rows, totalSold, avgCm, popThreshold, revenue, totalCm: revenue - foodCost, foodCostPct: revenue ? foodCost / revenue * 100 : NaN };
}

// ---- Exams and assessments

// Whole days from `today` to `date` (both 'YYYY-MM-DD'); negative when past.
export const daysUntil = (date, today) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);

// Practice readiness per recipe: ready when practised `target` times and the last attempt rated 3+.
export function examReadiness(exam, attempts) {
  const target = Math.max(1, Number(exam.target) || 3);
  const rows = (exam.recipeIds ?? []).map(recipeId => {
    const mine = attempts.filter(a => a.recipeId === recipeId).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
    const lastRating = mine.find(a => a.rating)?.rating ?? null;
    return { recipeId, count: mine.length, lastRating, ready: mine.length >= target && (lastRating ?? 0) >= 3 };
  });
  return { target, rows, ready: rows.filter(r => r.ready).length };
}

// ---- Stocktake and actual food cost
// A count line is { qty, price } in the ingredient's purchase unit, with the price as it was on the day.
// Lines without a price are counted as missing, never as $0.
export function stockValue(lines) {
  let value = 0, missing = 0;
  for (const l of lines) if (Number(l.qty) > 0) { if (Number.isFinite(l.price)) value += l.qty * l.price; else missing++; }
  return { value, missing };
}

// Each count after the first closes a period: food used = opening stock + purchases − closing stock,
// actual food cost % = food used ÷ food sales (ex GST). Waste is summed from the day after the opening count.
export function stockPeriods(counts, waste = []) {
  const sorted = [...counts].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(1).map((c, i) => {
    const open = sorted[i], opening = stockValue(open.lines ?? []).value, closing = stockValue(c.lines ?? []).value;
    const purchases = Number(c.purchases) || 0, sales = Number(c.sales) || 0;
    const used = opening + purchases - closing;
    const wasted = waste.filter(w => w.date > open.date && w.date <= c.date).reduce((n, w) => n + (Number(w.cost) || 0), 0);
    return { count: c, from: open.date, to: c.date, opening, purchases, closing, used, sales,
      pct: sales > 0 ? used / sales * 100 : NaN, waste: wasted, wastePct: used > 0 ? wasted / used * 100 : NaN };
  }).reverse();
}

// ---- Waste
export const WASTE_REASONS = { spoiled: 'Spoiled or out of date', over: 'Over-produced', prep: 'Prep and trim', mistake: 'Mistake or sent back', other: 'Other' };

// Raw ingredients cost as bought (no trim gross-up); prepared food costs what the recipe costs.
export function wasteCost(w, ings, recs = new Map()) {
  if (w.recipeId) return itemCost({ recipeId: w.recipeId, qty: w.qty, unit: w.unit }, ings, recs).cost;
  const ing = ings.get(w.ingredientId);
  if (!ing || !hasPrice(ing)) return NaN;
  return convertFor(Number(w.qty), w.unit, ing.unit, ing.name) * Number(ing.price);
}

// Total, by reason (largest first) and the items that cost the most.
export function wasteSummary(entries) {
  const sum = key => [...entries.reduce((m, w) => m.set(key(w), (m.get(key(w)) ?? 0) + (Number(w.cost) || 0)), new Map())]
    .map(([k, cost]) => ({ key: k, cost })).sort((a, b) => b.cost - a.cost);
  return { total: entries.reduce((n, w) => n + (Number(w.cost) || 0), 0), byReason: sum(w => w.reason), topItems: sum(w => w.name).slice(0, 3) };
}
