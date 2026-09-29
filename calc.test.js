// Run: node calc.test.js
import assert from 'node:assert/strict';
import { remoteWins } from './db.js';
import { convert, recipeCost, suggestedPrice, actualCostPct, recipeAllergens, orderList, fmtAmount, tempStatus } from './calc.js';

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

// Missing price: flagged, not silently $0; a real $0 price is still allowed
const ings2 = new Map([...ings, ['salt', { name: 'Salt', unit: 'kg', price: null, yieldPct: 100 }], ['water', { name: 'Water', unit: 'L', price: 0, yieldPct: 100 }]]);
const mp = recipeCost({ id: 'm', portions: 1, items: [{ ingredientId: 'salt', qty: 5, unit: 'g' }, { ingredientId: 'water', qty: 1, unit: 'L' }, { ingredientId: 'flour', qty: 1, unit: 'kg' }] }, ings2);
close(mp.total, 2);
assert.deepEqual(mp.problems, ['Price missing: Salt']);

// Circular: a uses b, b uses a -> finishes with a warning instead of recursing forever
const a = { id: 'a', name: 'A', portions: 1, items: [{ recipeId: 'b', qty: 1, unit: 'portion' }] };
const b = { id: 'b', name: 'B', portions: 1, items: [{ recipeId: 'a', qty: 1, unit: 'portion' }, { ingredientId: 'flour', qty: 1, unit: 'kg' }] };
const cyc = new Map([[a.id, a], [b.id, b]]);
const ca = recipeCost(a, ings, cyc);
close(ca.total, 2);
assert.ok(ca.problems.some(p => p.includes('circular')));
assert.deepEqual(recipeAllergens(a, ings, cyc), ['Gluten', 'Wheat']);

// Order list: expands sub-recipes, grosses up for yield, and at 100% yield its cost equals recipe costing
{
  const I = new Map([
    ['tom', { name: 'Tomato', unit: 'kg', price: 4, yieldPct: 100 }],
    ['oni', { name: 'Onion', unit: 'kg', price: 3, yieldPct: 90 }],
    ['egg', { name: 'Egg', unit: 'each', price: 0.5, yieldPct: 100 }],
  ]);
  const sauce = { id: 'sauce', name: 'Sauce', portions: 10, yieldQty: 2, yieldUnit: 'L', items: [{ ingredientId: 'tom', qty: 2, unit: 'kg' }, { ingredientId: 'oni', qty: 450, unit: 'g' }] };
  const dish = { id: 'dish', name: 'Dish', portions: 4, items: [{ recipeId: 'sauce', qty: 500, unit: 'ml' }, { ingredientId: 'egg', qty: 3, unit: 'each' }, { ingredientId: 'tom', qty: 100, unit: 'g' }] };
  const R = new Map([[sauce.id, sauce], [dish.id, dish]]);
  // 8 dishes = 2 batches: sauce 1 L = half a sauce batch -> tom 1 kg + oni 0.225 kg; eggs 6; tom +0.2 kg
  const o = orderList([{ recipeId: 'dish', portions: 8 }, { recipeId: 'sauce', portions: 5 }, { recipeId: 'nope', portions: 3 }], I, R);
  const by = Object.fromEntries(o.lines.map(l => [l.ing.name, l]));
  close(by.Tomato.usable, 1 + 0.2 + 1);       // + 5 portions of sauce = half batch = 1 kg
  close(by.Onion.usable, 0.225 + 0.225);
  close(by.Onion.order, 0.45 / 0.9);          // grossed up for 90% yield
  assert.equal(by.Egg.order, 6);
  close(o.total, 2.2 * 4 + 0.5 * 3 + 6 * 0.5);
  close(o.total, recipeCost(dish, I, R).total * 2 + recipeCost(sauce, I, R).total * 0.5); // matches costing
  assert.deepEqual(o.problems, []);
  // eggs round up to whole units
  assert.equal(orderList([{ recipeId: 'dish', portions: 1 }], I, R).lines.find(l => l.ing.name === 'Egg').order, 1);
  // On hand: subtracted from the yield-adjusted gross, never below zero; eggs round up after subtracting
  const h = orderList([{ recipeId: 'dish', portions: 8 }], I, R, { tom: 0.5, oni: 10, egg: 2.5 });
  const hb = Object.fromEntries(h.lines.map(l => [l.ing.name, l]));
  close(hb.Tomato.order, 1.2 - 0.5);
  assert.equal(hb.Onion.order, 0);
  assert.equal(hb.Onion.cost, 0);
  assert.equal(hb.Egg.order, 4);                // 6 - 2.5 = 3.5 -> 4
  close(h.total, 0.7 * 4 + 4 * 0.5);
  // Missing price only matters if we actually need to order it
  const I2 = new Map([...I, ['oni', { ...I.get('oni'), price: null }]]);
  assert.deepEqual(orderList([{ recipeId: 'sauce', portions: 10 }], I2, R, { oni: 1 }).problems, []);
  assert.deepEqual(orderList([{ recipeId: 'sauce', portions: 10 }], I2, R).problems, ['Price missing: Onion']);
  assert.equal(fmtAmount(0.04, 'kg'), '40 g');
  assert.equal(fmtAmount(3.333, 'kg'), '3.33 kg');
  assert.equal(fmtAmount(6, 'each'), '6 each');
}

// Temperature checks
{
  const st = e => tempStatus(e).status;
  assert.equal(st({ type: 'fridge', temp: 5 }), 'pass');
  assert.equal(st({ type: 'fridge', temp: 5.1 }), 'fail');
  assert.equal(st({ type: 'freezer', temp: -18 }), 'pass');
  assert.equal(st({ type: 'freezer', temp: -10 }), 'fail');
  assert.equal(st({ type: 'hot_hold', temp: 59 }), 'fail');
  assert.equal(st({ type: 'cooking', temp: 75 }), 'pass');
  assert.equal(st({ type: 'fridge', temp: '' }), 'pending');
  assert.equal(st({ type: 'fridge', temp: 0 }), 'pass'); // 0 °C is a reading, not blank
  const R = (at, temp) => ({ at: '2026-09-29T' + at, temp });
  assert.equal(st({ type: 'cooling', start: R('14:00', 62) }), 'pending');
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('15:55', 20) }), 'pending');
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('16:05', 20) }), 'fail'); // over 2 h
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('15:30', 24) }), 'fail'); // too warm
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('15:30', 20), stage2: R('19:50', 4) }), 'pass');
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('15:30', 20), stage2: R('20:10', 4) }), 'fail'); // over 6 h
  assert.equal(st({ type: 'cooling', start: R('14:00', 62), stage1: R('15:30', 20), stage2: R('19:00', 7) }), 'fail');
}

// Sync: last write wins; rows from before sync existed (no _ts) lose to any remote edit
assert.equal(remoteWins(undefined, 5), true);
assert.equal(remoteWins({ _ts: 10 }, 11), true);
assert.equal(remoteWins({ _ts: 10 }, 10), false); // our own push echoing back
assert.equal(remoteWins({ _ts: 10 }, 9), false);
assert.equal(remoteWins({}, 1), true);

console.log('calc ok');
