// Run: node calc.test.js
import assert from 'node:assert/strict';
import { convert, recipeCost, suggestedPrice, actualCostPct, recipeAllergens } from './calc.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

close(convert(200, 'g', 'kg'), 0.2);
close(convert(150, 'ml', 'L'), 0.15);
assert.ok(Number.isNaN(convert(1, 'g', 'L')));

const ings = new Map([
  ['onion', { name: 'Onion', unit: 'kg', price: 3, yieldPct: 90, allergens: [] }],
  ['flour', { name: 'Flour', unit: 'kg', price: 2, yieldPct: 100, allergens: ['Gluten', 'Wheat'] }],
]);
const r = {
  portions: 2,
  items: [
    { ingredientId: 'onion', qty: 200, unit: 'g' }, // 0.2 * 3 / 0.9
    { ingredientId: 'flour', qty: 500, unit: 'g' }, // 1.00
    { ingredientId: 'flour', qty: 1, unit: 'L' },   // bad unit
    { ingredientId: 'gone', qty: 1, unit: 'kg' },   // deleted
  ],
};
const c = recipeCost(r, ings);
close(c.total, 0.6 / 0.9 + 1);
close(c.perPortion, c.total / 2);
assert.equal(c.problems.length, 2);

const p = suggestedPrice(3, 30);
close(p.ex, 10);
close(p.inc, 11);
close(actualCostPct(3, 11), 30);
assert.deepEqual(recipeAllergens(r, ings), ['Gluten', 'Wheat']);

// Sub-recipes
const sauce = { id: 'sauce', name: 'Sauce', portions: 4, yieldQty: 2, yieldUnit: 'L', items: [{ ingredientId: 'flour', qty: 1, unit: 'kg' }] }; // $2 batch
const noYield = { id: 'ny', name: 'No yield', portions: 1, items: [] };
const dish = { id: 'dish', name: 'Dish', portions: 1, items: [
  { recipeId: 'sauce', qty: 500, unit: 'ml' },  // 0.5 / 2 L of $2 = 0.50
  { recipeId: 'sauce', qty: 1, unit: 'portion' }, // $2 / 4 = 0.50
] };
const recs = new Map([sauce, noYield, dish].map(x => [x.id, x]));
close(recipeCost(dish, ings, recs).total, 1);
assert.deepEqual(recipeAllergens(dish, ings, recs), ['Gluten', 'Wheat']);
assert.equal(recipeCost({ id: 'x', portions: 1, items: [{ recipeId: 'ny', qty: 1, unit: 'kg' }] }, ings, recs).problems.length, 1);
assert.equal(recipeCost({ id: 'x', portions: 1, items: [{ recipeId: 'gone', qty: 1, unit: 'portion' }] }, ings, recs).problems.length, 1);

// Circular: a uses b, b uses a -> finishes with a warning instead of recursing forever
const a = { id: 'a', name: 'A', portions: 1, items: [{ recipeId: 'b', qty: 1, unit: 'portion' }] };
const b = { id: 'b', name: 'B', portions: 1, items: [{ recipeId: 'a', qty: 1, unit: 'portion' }, { ingredientId: 'flour', qty: 1, unit: 'kg' }] };
const cyc = new Map([[a.id, a], [b.id, b]]);
const ca = recipeCost(a, ings, cyc);
close(ca.total, 2);
assert.ok(ca.problems.some(p => p.includes('circular')));
assert.deepEqual(recipeAllergens(a, ings, cyc), ['Gluten', 'Wheat']);

console.log('calc ok');
