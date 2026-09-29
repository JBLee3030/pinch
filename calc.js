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
  const q = convert(qty, it.unit, ing.unit);
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
    const q = convert(qty, it.unit, ing.unit);
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
