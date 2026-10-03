// Run: node calc.test.js
import assert from 'node:assert/strict';
import { remoteWins } from './db.js';
import { DECKS, ALL_CARDS, review, pickSession, isDue, isLearned } from './study.js';
import { extractRecipe, safeUrl } from './supabase/functions/recipe-import/index.js';
import { parseIngredientLine as P, matchIngredient, parsePriceList, packUnit, splitSteps, findDurations, fmtDuration } from './parse.js';
import { convert, recipeCost, suggestedPrice, actualCostPct, recipeAllergens, orderList, fmtAmount, tempStatus, yieldTest, convertFor, densityFor, MEASURES, scaleFromIngredient, itemGrams, bakersPercent, bakersBase, fToC, cToF, prepBatches, niceAmount, withPriceHistory, costImpact, foodCostWatch, priceMoves, menuEngineering, daysUntil, examReadiness } from './calc.js';

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
    { ingredientId: 'onion', qty: 1, unit: 'L' },   // bad unit: no density for onion (flour by volume now converts)
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

// Pasted recipe lines
{
  const q = l => { const r = P(l); return r && [r.qty, r.unit, r.name, r.ok]; };
  assert.deepEqual(q('500 g tipo 00 flour'), [500, 'g', 'Tipo 00 flour', true]);
  assert.deepEqual(q('500g flour'), [500, 'g', 'Flour', true]);
  assert.deepEqual(q('5 eggs'), [5, 'each', 'Eggs', true]);
  assert.deepEqual(q('50ml olive oil'), [50, 'ml', 'Olive oil', true]);
  assert.deepEqual(q('1.5kg beef chuck, diced'), [1.5, 'kg', 'Beef chuck', true]);
  assert.deepEqual(q('1,5 kg beef'), [1.5, 'kg', 'Beef', true]);
  assert.deepEqual(q('1 bunch basil'), [1, 'each', 'Basil', true]);
  assert.deepEqual(q('2 cloves garlic'), [10, 'g', 'Garlic', true]);
  assert.deepEqual(q('½ cup (125ml) milk'), [125, 'ml', 'Milk', true]);
  assert.deepEqual(q('1 1/2 cups of stock'), [375, 'ml', 'Stock', true]);
  assert.deepEqual(q('1½ tbsp sugar'), [30, 'ml', 'Sugar', true]);   // AU tbsp = 20 ml
  assert.deepEqual(q('2 tsp salt'), [10, 'ml', 'Salt', true]);
  assert.deepEqual(q('2 x 400g tins tomatoes'), [800, 'g', 'Tomatoes', true]);
  assert.deepEqual(q('1 lb butter'), [453.6, 'g', 'Butter', true]);
  assert.deepEqual(q('2-3 carrots'), [2, 'each', 'Carrots', true]);
  assert.deepEqual(q('- 200 g pancetta'), [200, 'g', 'Pancetta', true]);
  assert.deepEqual(q('3. 100g parmesan'), [100, 'g', 'Parmesan', true]);
  assert.deepEqual(q('2 limes'), [2, 'each', 'Limes', true]);          // 'limes' is not litres
  assert.deepEqual(q('Salt and pepper, to taste'), [null, 'each', 'Salt and pepper', false]);
  // Web recipe notations: keep the metric amount
  assert.deepEqual(q('175g/6 oz guanciale (pancetta or block bacon), ( weight after skin removed (Note 1))'), [175, 'g', 'Guanciale', true]);
  assert.deepEqual(q('1 quart (1L) homemade chicken stock'), [1, 'L', 'Homemade chicken stock', true]);
  assert.deepEqual(q('1 (28-ounce; 800g) can peeled whole tomatoes'), [800, 'g', 'Peeled whole tomatoes', true]);
  assert.deepEqual(q('2 (400g) cans chickpeas'), [800, 'g', 'Chickpeas', true]);
  assert.deepEqual(q('1 to 1 1/2 ounces powdered gelatin'), [28.35, 'g', 'Powdered gelatin', true]);
  assert.deepEqual(q('2 large eggs ((Note 2))'), [2, 'each', 'Large eggs', true]);
  assert.deepEqual(q('1 cup (250ml) milk'), [250, 'ml', 'Milk', true]);
  assert.equal(P('   '), null);
}

// Matching to Pantry
{
  const pantry = [{ name: 'Olive oil, extra virgin' }, { name: 'Basil, bunch' }, { name: 'Tomatoes, canned whole' }, { name: 'Onion, brown' }, { name: 'Flour, tipo 00' }, { name: 'Eggs, free range' }, { name: 'Oil' }];
  const m = n => matchIngredient(n, pantry)?.name ?? null;
  assert.equal(m('olive oil'), 'Olive oil, extra virgin');
  assert.equal(m('Extra virgin olive oil'), 'Olive oil, extra virgin');
  assert.equal(m('fresh basil'), 'Basil, bunch');
  assert.equal(m('Canned tomatoes'), 'Tomatoes, canned whole');
  assert.equal(m('brown onion'), 'Onion, brown');
  assert.equal(m('Tipo 00 flour'), 'Flour, tipo 00');
  assert.equal(m('egg'), 'Eggs, free range');
  assert.equal(m('oil'), 'Oil');                 // exact beats partial
  assert.equal(m('red onion'), null);            // different ingredient: new
  assert.equal(m('San Marzano tomatoes'), null);
}

// Supplier price lists
{
  assert.deepEqual(packUnit('5kg'), ['kg', 5]);
  assert.deepEqual(packUnit('500g'), ['kg', 0.5]);
  assert.deepEqual(packUnit('per kg'), ['kg', 1]);
  assert.deepEqual(packUnit('dozen'), ['each', 12]);
  assert.deepEqual(packUnit('bunch'), ['each', 1]);
  assert.deepEqual(packUnit('box'), ['each', 1]);
  assert.equal(packUnit('mystery'), null);
  const csv = 'Product,Pack,Price,Yield %\n"Tomatoes, canned whole",2.5kg,"$10.50",\nFlour tipo 00,12.5 kg bag,$35.00,\nEggs free range,dozen,7.20,\nBasil,bunch,3.50,70\nMystery,???,4\n';
  const rows = parsePriceList(csv);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => [r.name, r.price, r.unit, r.ok]), [
    ['Tomatoes, canned whole', 4.2, 'kg', true],
    ['Flour tipo 00', 2.8, 'kg', true],
    ['Eggs free range', 0.6, 'each', true],
    ['Basil', 3.5, 'each', true],
    ['Mystery', null, 'kg', false],
  ]);
  assert.equal(rows[3].yieldPct, 70);
  // Pasted from a spreadsheet (tabs), no header
  assert.deepEqual(parsePriceList('Garlic\t18\tkg\nMilk\t1.80\tL').map(r => [r.name, r.price, r.unit]), [['Garlic', 18, 'kg'], ['Milk', 1.8, 'L']]);
  // "Price per L" header gives the unit
  assert.deepEqual(parsePriceList('Item,Price per L\nCream,6.40').map(r => [r.name, r.price, r.unit]), [['Cream', 6.4, 'L']]);
  // Semicolon CSV (European Excel)
  assert.deepEqual(parsePriceList('Name;Price;Unit\nButter;12,50;kg').map(r => [r.name, r.price, r.unit]), [['Butter', 12.5, 'kg']]);
  assert.equal(parsePriceList('Name,Price\nWagyu,"$1,234.50"')[0].price, 1234.5); // thousands separator
}

// Cooking mode: steps and timers
{
  assert.deepEqual(splitSteps('1. Sweat onion.\n2) Add tomatoes\n\n- Season'), ['Sweat onion.', 'Add tomatoes', 'Season']);
  assert.deepEqual(splitSteps('Step 1 Boil water'), ['Boil water']);
  assert.deepEqual(splitSteps(''), []);
  assert.equal(splitSteps('Bring the stock to the boil and skim well. Add the rice and stir for a minute or two until glossy. Ladle in stock slowly.').length, 3);
  const d = t => findDurations(t).map(x => x.seconds);
  assert.deepEqual(d('Simmer 45 min, stirring'), [2700]);
  assert.deepEqual(d('Rest 30 minutes wrapped'), [1800]);
  assert.deepEqual(d('Braise 1 hr 30 min'), [5400]);               // one timer, not two
  assert.deepEqual(d('Roast 1½ hours'), [5400]);
  assert.deepEqual(d('Cook 8-10 minutes'), [480]);                  // range: first number
  assert.deepEqual(d('Blanch 30 sec, then refresh. Bake 12 mins.'), [30, 720]);
  assert.deepEqual(d('Roll to setting 6, cut 5 mm wide'), []);      // not a time
  assert.deepEqual(d('Heat to 180 C for 2h'), [7200]);
  assert.equal(fmtDuration(2700), '45 min');
  assert.equal(fmtDuration(5400), '1 h 30 min');
  assert.equal(fmtDuration(30), '30 s');
}

// Recipe import (JSON-LD on recipe sites)
{
  const page = ld => `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head></html>`;
  // WordPress / Yoast style: @graph with sections of HowToSteps, entities, yield as a list
  const r = extractRecipe(page({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', name: 'x' },
    { '@type': ['Recipe', 'NewsArticle'], name: 'Spaghetti Carbonara &amp; Guanciale',
      recipeYield: ['4', '4 serves'],
      image: [{ '@type': 'ImageObject', url: '/img/carbonara.jpg' }],
      recipeIngredient: ['400 g spaghetti', '150&nbsp;g guanciale, diced', '<b>4</b> egg yolks', ''],
      recipeInstructions: [
        { '@type': 'HowToSection', name: 'Pasta', itemListElement: [{ '@type': 'HowToStep', text: 'Boil the spaghetti 9 min.' }] },
        { '@type': 'HowToStep', text: 'Render the guanciale.' },
        'Toss off the heat with yolks.' ] },
  ] }), 'https://www.example.com.au/recipes/carbonara');
  assert.equal(r.name, 'Spaghetti Carbonara & Guanciale');
  assert.deepEqual(r.ingredients, ['400 g spaghetti', '150 g guanciale, diced', '4 egg yolks']);
  assert.deepEqual(r.steps, ['Boil the spaghetti 9 min.', 'Render the guanciale.', 'Toss off the heat with yolks.']);
  assert.equal(r.servings, 4);
  assert.equal(r.image, 'https://www.example.com.au/img/carbonara.jpg');
  assert.equal(r.site, 'example.com.au');
  // Instructions as one HTML string; recipe as a top-level array; broken JSON block skipped
  const r2 = extractRecipe('<script type="application/ld+json">{ not json</script>' + page([{ '@type': 'Recipe', name: 'Soup', recipeYield: 'Serves 6',
    recipeIngredient: ['1 onion'], recipeInstructions: '<p>Chop.</p><p>Simmer 20 min.</p>' }]), 'https://soup.test/x');
  assert.deepEqual([r2.name, r2.servings, r2.steps], ['Soup', 6, ['Chop.', 'Simmer 20 min.']]);
  assert.equal(extractRecipe(page({ '@type': 'Article', name: 'Not a recipe' })), null);
  assert.equal(extractRecipe('<html>no data</html>'), null);
  // Only public web pages
  assert.ok(safeUrl('https://www.taste.com.au/recipes/x'));
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'http://localhost:3000', 'http://192.168.0.1/', 'http://[::1]/', 'http://printer.local/', 'https://x.com:8443/', 'not a url'])
    assert.equal(safeUrl(bad), null, bad);
}

// Yield test: 5 kg beef at $18/kg -> 3.6 kg usable, 0.9 kg bones worth $2/kg, 0.3 kg fat
{
  const y = yieldTest({ ap: 5, ep: 3.6, price: 18, trims: [{ qty: 0.9, value: 2 }, { qty: 0.3 }] });
  close(y.yieldPct, 72);
  close(y.totalCost, 90);
  close(y.credit, 1.8);
  close(y.costPerUsable, (90 - 1.8) / 3.6);           // $24.50 per usable kg
  close(y.unaccounted, 0.2);
  assert.equal(y.overTrim, false);
  // Consistent with recipe costing: with no credit, price / yield = cost per usable kg
  close(yieldTest({ ap: 2, ep: 1.5, price: 12 }).costPerUsable, 12 / 0.75);
  assert.equal(yieldTest({ ap: 5, ep: 3, price: 18, trims: [{ qty: 2.5 }] }).overTrim, true);
  assert.equal(yieldTest({ ap: 0, ep: 0, price: 1 }), null);
  assert.equal(yieldTest({ ap: 2, ep: 3, price: 1 }), null); // can't get more than you bought
}

// Weight <-> volume by ingredient
{
  close(convertFor(250, 'ml', 'kg', 'Flour, tipo 00'), 0.1275);            // 1 AU cup of flour ~ 128 g
  close(convertFor(MEASURES.us.cup, 'ml', 'g', 'Plain flour'), 236.6 * 0.51); // US cup ~ 121 g
  close(convertFor(100, 'g', 'L', 'Olive oil, extra virgin'), 100 / 0.92 / 1000);
  close(convertFor(1, 'kg', 'g', 'anything'), 1000);                       // same family: no density needed
  assert.ok(Number.isNaN(convertFor(1, 'ml', 'kg', 'Mystery powder')));
  assert.equal(densityFor('Brown sugar, packed'), 0.90);                   // specific beats 'sugar'
  assert.equal(densityFor('Olive oil'), 0.92);
  // costing now works for cups of flour priced per kg
  const I = new Map([['f', { name: 'Flour, plain', unit: 'kg', price: 2, yieldPct: 100 }]]);
  const c = recipeCost({ id: 'x', portions: 1, items: [{ ingredientId: 'f', qty: 500, unit: 'ml' }] }, I);
  close(c.total, 0.5 * 0.51 * 2);
  assert.deepEqual(c.problems, []);
}

// Scaling from an ingredient you have, baker's percentages
{
  const I = new Map([['mince', { name: 'Beef mince' }], ['flour', { name: 'Flour, tipo 00' }], ['egg', { name: 'Eggs, free range' }],
    ['salt', { name: 'Salt' }], ['water', { name: 'Water' }]]);
  const ragu = { portions: 10, items: [{ ingredientId: 'mince', qty: 800, unit: 'g' }] };
  const s1 = scaleFromIngredient(ragu, 0, 3, 'kg', I);
  close(s1.factor, 3.75);
  close(s1.portions, 37.5);
  assert.equal(scaleFromIngredient(ragu, 0, 3, 'L', I), null);             // no density for mince
  const pasta = { portions: 6, items: [
    { ingredientId: 'flour', qty: 600, unit: 'g' }, { ingredientId: 'egg', qty: 6, unit: 'each' },
    { ingredientId: 'salt', qty: 1, unit: 'tsp' }, { ingredientId: 'water', qty: 30, unit: 'ml' }] };
  assert.equal(bakersBase(pasta, I), 0);
  const b = bakersPercent(pasta, I, new Map(), 0);
  close(b.base, 600);
  close(b.rows[1].pct, 50);                                                 // 6 eggs x 50 g = 300 g = 50%
  assert.equal(b.rows[2].pct, null);                                         // 'tsp' isn't a stored unit
  close(b.rows[3].pct, 5);                                                   // 30 ml water = 30 g
  close(b.total, 600 + 300 + 30);
  close(itemGrams({ ingredientId: 'flour', qty: 250, unit: 'ml' }, I), 127.5);
  close(fToC(350), 530 / 3);
  close(cToF(180), 356);
}

// Study cards and spaced repetition
{
  const ids = ALL_CARDS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);                                   // ids unique (progress is keyed by id)
  assert.ok(DECKS.every(d => d.cards.length && d.note));
  assert.ok(ALL_CARDS.every(c => c.front && c.back && !/[—–]/.test(c.front + c.back))); // copy rule: no em/en dashes
  const DAY = 86400000, t0 = Date.UTC(2026, 9, 1);
  let st = {};
  st = review(st, 'cuts-julienne', true, t0);
  assert.deepEqual([st['cuts-julienne'].box, st['cuts-julienne'].due], [1, t0 + DAY]);
  st = review(st, 'cuts-julienne', true, t0 + DAY);
  assert.equal(st['cuts-julienne'].box, 2);
  assert.equal(st['cuts-julienne'].due, t0 + DAY + 3 * DAY);
  st = review(st, 'cuts-julienne', false, t0 + 5 * DAY);                          // wrong: back to box 1, due now
  assert.deepEqual([st['cuts-julienne'].box, st['cuts-julienne'].due, st['cuts-julienne'].seen], [1, t0 + 5 * DAY, 3]);
  assert.equal(isDue(st, 'cuts-julienne', t0 + 5 * DAY), true);
  for (let i = 0; i < 6; i++) st = review(st, 'cuts-brunoise', true, t0);
  assert.equal(st['cuts-brunoise'].box, 5);                                       // caps at 5
  assert.equal(isLearned(st, 'cuts-brunoise'), true);
  const s1 = pickSession(DECKS[0].cards, st, t0 + 5 * DAY, 4);
  assert.equal(s1[0].id, 'cuts-julienne');                                         // due first
  assert.ok(!s1.some(c => c.id === 'cuts-brunoise'));                              // not due yet, not new
  assert.equal(s1.length, 4);
}

// Prep list batches
{
  const stock = { id: 'stock', name: 'Stock', portions: 10, yieldQty: 5, yieldUnit: 'L', items: [] };
  const sauce = { id: 'sauce', name: 'Sauce', portions: 10, yieldQty: 2, yieldUnit: 'L', items: [{ recipeId: 'stock', qty: 1, unit: 'L' }] };
  const pasta = { id: 'pasta', name: 'Pasta', portions: 6, items: [] };
  const dish = { id: 'dish', name: 'Dish', portions: 1, items: [{ recipeId: 'sauce', qty: 200, unit: 'ml' }, { recipeId: 'pasta', qty: 1, unit: 'portion' }] };
  const R = new Map([stock, sauce, pasta, dish].map(x => [x.id, x]));
  const { tasks, problems } = prepBatches([{ recipeId: 'dish', portions: 30 }, { recipeId: 'sauce', portions: 5 }], R);
  const by = Object.fromEntries(tasks.map(t => [t.recipe.id, t]));
  close(by.dish.factor, 30);
  close(by.sauce.factor, 30 * 0.2 / 2 + 0.5);        // 6 L for dishes = 3 batches, plus half a batch on its own
  close(by.stock.factor, 3.5 * 1 / 5);               // each sauce batch takes 1 L of a 5 L stock
  close(by.pasta.factor, 30 / 6);
  assert.deepEqual(tasks.map(t => t.recipe.id).slice(0, 1), ['stock']);   // deepest first
  assert.equal(tasks.at(-1).recipe.id, 'dish');                            // the dish itself last
  assert.deepEqual(problems, []);
  const bad = prepBatches([{ recipeId: 'x', portions: 2 }], new Map([['x', { id: 'x', name: 'X', portions: 1, items: [{ recipeId: 'y', qty: 1, unit: 'kg' }] }],
    ['y', { id: 'y', name: 'Y', portions: 1, items: [] }]]));
  assert.deepEqual(bad.problems, ['Y: set its batch yield in kg, or use portions']);
}

// Readable scaled amounts
assert.equal(niceAmount(10681.82, 'g'), '10.7 kg');
assert.equal(niceAmount(0.04, 'kg'), '40 g');
assert.equal(niceAmount(1250, 'ml'), '1.25 L');
assert.equal(niceAmount(187.5, 'g'), '188 g');
assert.equal(niceAmount(12.345, 'ml'), '12.3 ml');
assert.equal(niceAmount(4.2666, 'each'), '4.27 each');
assert.equal(niceAmount(2, 'portion'), '2 portion');

// Food cost watch
{
  const g0 = { id: 'g', name: 'Garlic', unit: 'kg', price: 18, yieldPct: 100 };
  let g1 = withPriceHistory(g0, { ...g0, price: 22 }, '2026-10-03');
  assert.deepEqual(g1.priceHistory.map(h => h.price), [18, 22]);              // old price seeded, new one added
  assert.equal(withPriceHistory(g1, { ...g1, name: 'Garlic, peeled' }, '2026-10-04').priceHistory.length, 2); // no price change, no entry
  assert.equal(withPriceHistory(undefined, { name: 'New', unit: 'kg', price: null }, 'x').priceHistory.length, 0); // unpriced new item
  const sauce = { id: 'sauce', name: 'Sauce', portions: 10, yieldQty: 1, yieldUnit: 'L', items: [{ ingredientId: 'g', qty: 100, unit: 'g' }] };
  const dish = { id: 'dish', name: 'Dish', portions: 1, menuPrice: 11, targetCostPct: 30, items: [{ recipeId: 'sauce', qty: 500, unit: 'ml' }] };
  const other = { id: 'other', name: 'Other', portions: 1, menuPrice: 11, items: [] };
  const before = new Map([['g', g0]]), after = new Map([['g', g1]]);
  const imp = costImpact([sauce, dish, other], before, after);
  assert.deepEqual(imp.map(x => x.recipe.id), ['dish', 'sauce']);              // the dish changes through its sub-recipe; 'other' untouched
  close(imp[0].before, 0.9); close(imp[0].after, 1.1);                         // half of a 1.8 -> 2.2 batch
  close(imp[0].afterPct, 1.1 / 10 * 100);                                       // vs $10 ex GST
  const w = foodCostWatch([sauce, dish, { ...other, items: [{ ingredientId: 'g', qty: 200, unit: 'g' }] }], after, 30);
  assert.deepEqual(w.map(x => x.recipe.id), ['other', 'dish']);                // highest % first; only recipes with a menu price
  assert.equal(w[0].over, true);                                                // 0.2 kg x $22 = $4.40 on $10 ex GST = 44%
  assert.equal(w[1].over, false);
  const moves = priceMoves(new Map([['g', g1]]));
  close(moves[0].change, (22 - 18) / 18 * 100);
}

// Menu engineering: textbook four-dish example
{
  const unit = new Map([['u', { name: 'Cost unit', unit: 'each', price: 1, yieldPct: 100 }]]);
  const dish = (id, cost, menuPrice) => ({ id, name: id, portions: 1, menuPrice, items: [{ ingredientId: 'u', qty: cost, unit: 'each' }] });
  const R = new Map([dish('A', 9, 33), dish('B', 8, 22), dish('C', 6, 33), dish('D', 12, 22)].map(r => [r.id, r]));
  const m = menuEngineering([{ recipeId: 'A', sold: 50 }, { recipeId: 'B', sold: 60 }, { recipeId: 'C', sold: 10 }, { recipeId: 'D', sold: 5 }, { recipeId: 'gone', sold: 9 }], unit, R);
  assert.equal(m.rows.length, 4);                                   // deleted recipe ignored
  close(m.avgCm, (21 * 50 + 12 * 60 + 24 * 10 + 8 * 5) / 125);     // 16.4
  close(m.popThreshold, 0.175);
  assert.deepEqual(m.rows.map(x => x.class), ['star', 'plowhorse', 'puzzle', 'dog']);
  close(m.revenue, 30 * 50 + 20 * 60 + 30 * 10 + 20 * 5);
  close(m.foodCostPct, (9 * 50 + 8 * 60 + 6 * 10 + 12 * 5) / 3100 * 100);
  // price override beats the recipe's menu price; no sales yet -> no classes
  const m2 = menuEngineering([{ recipeId: 'A', price: 44, sold: 0 }], unit, R);
  close(m2.rows[0].cm, 40 - 9);
  assert.equal(m2.rows[0].class, null);
}

// Exams
{
  assert.equal(daysUntil('2026-10-15', '2026-10-03'), 12);
  assert.equal(daysUntil('2026-10-03', '2026-10-03'), 0);
  assert.equal(daysUntil('2026-10-01', '2026-10-03'), -2);
  assert.equal(daysUntil('2027-04-05', '2027-04-02'), 3);            // across the April DST change in Melbourne
  const at = (recipeId, date, rating) => ({ recipeId, date, rating });
  const r = examReadiness({ recipeIds: ['tag', 'tira', 'risotto'], target: 2 }, [
    at('tag', '2026-10-01', 4), at('tag', '2026-09-20', 2),          // 2 practices, last 4 stars -> ready
    at('tira', '2026-10-02', 2), at('tira', '2026-09-28', 5),        // 2 practices, last only 2 stars -> not ready
  ]);
  assert.deepEqual(r.rows.map(x => [x.recipeId, x.count, x.lastRating, x.ready]), [['tag', 2, 4, true], ['tira', 2, 2, false], ['risotto', 0, null, false]]);
  assert.equal(r.ready, 1);
  assert.equal(examReadiness({ recipeIds: [] }, []).target, 3);     // default target
}

console.log('calc ok');
