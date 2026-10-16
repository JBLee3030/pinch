// Instagram caption for a recipe: "01. Dish name", then the recipe in short (ingredients, method).
// Plain text, in English like the recipes. Pure and tested.

export const LIMIT = 2200; // Instagram's caption limit

// items: [{ qty, amount ('150 g'), name }] in recipe order; steps: the method split into steps
export function recipeCaption(recipe, { number = 1, items = [], steps = [] } = {}) {
  const portions = Number(recipe.portions) || 1;
  const ingredients = items.map(it => (it.qty > 0 ? `${it.amount} ${it.name}` : `${it.name}, q.b.`));
  return [
    `${String(number).padStart(2, '0')}. ${recipe.name}`,
    ingredients.length ? [`Ingredients (${portions} portion${portions === 1 ? '' : 's'})`, ...ingredients].join('\n') : '',
    steps.length ? ['Method', ...steps.map((s, i) => `${i + 1}. ${s}`)].join('\n') : '',
  ].filter(Boolean).join('\n\n');
}

// Each recipe keeps its post number; a new one gets the next.
export const postNumber = (numbers, recipeId) => numbers[recipeId] ?? Math.max(0, ...Object.values(numbers)) + 1;
