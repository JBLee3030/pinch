// Australian mandatory allergen declarations (FSANZ PEAL).
// ponytail: tree nuts as one entry, split per nut if a venue needs it.
export const ALLERGENS = ['Gluten', 'Wheat', 'Crustacean', 'Mollusc', 'Fish', 'Egg', 'Milk',
  'Peanut', 'Tree nuts', 'Sesame', 'Soy', 'Lupin', 'Sulphites'];

export const PURCHASE_UNITS = ['kg', 'L', 'each'];
export const UNITS = ['g', 'kg', 'ml', 'L', 'each'];
export const GST = 0.1;

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
  return { total, perPortion: total / Math.max(1, Number(recipe.portions) || 1), problems };
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

export const money = n => Number.isFinite(n) ? '$' + n.toFixed(2) : '—';
export const pct = n => Number.isFinite(n) ? n.toFixed(1) + '%' : '—';
