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

export function lineCost(item, ing) {
  if (!ing) return NaN;
  const qty = convert(Number(item.qty), item.unit, ing.unit);
  const yieldFrac = (Number(ing.yieldPct) || 100) / 100;
  return qty * (Number(ing.price) || 0) / yieldFrac;
}

export function recipeCost(recipe, ings) {
  let total = 0;
  const problems = [];
  for (const it of recipe.items ?? []) {
    const ing = ings.get(it.ingredientId);
    const c = lineCost(it, ing);
    if (Number.isFinite(c)) total += c;
    else problems.push(ing ? `${ing.name}: can't convert ${it.unit} to ${ing.unit}` : 'An ingredient was deleted from Pantry');
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

export const recipeAllergens = (recipe, ings) =>
  ALLERGENS.filter(a => (recipe.items ?? []).some(it => ings.get(it.ingredientId)?.allergens?.includes(a)));

export const money = n => Number.isFinite(n) ? '$' + n.toFixed(2) : '—';
export const pct = n => Number.isFinite(n) ? n.toFixed(1) + '%' : '—';
