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

console.log('calc ok');
