import * as db from './db.js';
import * as sync from './sync.js';
import { DECKS, ALL_CARDS, review, pickSession, isDue, isLearned } from './study.js';
import { parseIngredientLine, matchIngredient, parsePriceList, splitSteps, findDurations, fmtDuration } from './parse.js';
import { ALLERGENS, PURCHASE_UNITS, UNITS, recipeCost, itemCost, suggestedPrice, actualCostPct, recipeAllergens, usesRecipe, hasPrice, orderList, fmtAmount, TEMP_CHECKS, tempStatus, yieldTest, MEASURES, convertFor, densityFor, scaleFromIngredient, bakersPercent, bakersBase, fToC, cToF, prepBatches, niceAmount, niceParts, withPriceHistory, costImpact, foodCostWatch, priceMoves, menuEngineering, MENU_CLASSES, daysUntil, examReadiness, money, pct } from './calc.js';

const view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toLocaleDateString('en-CA');
const num = v => (v === '' || v == null ? null : Number(v));
const fmtQty = n => (Math.round(n * 100) / 100).toString();
const opts = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const datalist = (id, list) => `<datalist id="${id}">${[...new Set(list.filter(Boolean))].sort().map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
const byName = (a, b) => a.name.localeCompare(b.name);
const go = h => { location.hash = h; };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const APP_URL = 'https://jblee3030.github.io/pinch/';
const portionsLabel = n => `${n} portion${Number(n) === 1 ? '' : 's'}`;

async function settings() {
  return { targetCostPct: 30, logTarget: 48, lastBackup: null, cookName: '', ...(await db.get('settings', 'settings')) };
}
async function ingMap() {
  return new Map((await db.all('ingredients')).map(i => [i.id, i]));
}
const toMap = list => new Map(list.map(x => [x.id, x]));

// Tabler Icons (MIT), outline set: https://tabler.io/icons
const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6l6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>',
};

// Tab roots get a large title; sub pages get a compact bar with a back button and no tab bar.
function page(tab, title, body, { back, action = '' } = {}) {
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('on', a.dataset.tab === tab);
    a.toggleAttribute('aria-current', a.dataset.tab === tab);
  });
  document.body.classList.toggle('sub', !!back);
  view.innerHTML = `${db.DEMO ? '<div class="demo-bar">Demo with sample data. <a href="./">Open Pinch</a></div>' : ''}
    <header class="${back ? 'top' : 'top root'}">
      ${back ? `<a class="icon-btn" href="${back}" aria-label="Back">${ICON.back}</a><h1 class="bar-title">${esc(title)}</h1>` : `<h1 class="page-title">${esc(title)}</h1>`}
      <div class="bar-action">${action}</div>
    </header><main>${body}</main>`;
  window.scrollTo(0, 0);
  drawTimers(); // running kitchen timers follow you to other screens
}
const STAR = '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>';
const stars = n => `<span class="stars" role="img" aria-label="${n ? `${n} out of 5` : 'Not rated'}">${[1, 2, 3, 4, 5].map(i =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="${i <= Math.round(n || 0) ? 'on' : ''}">${STAR}</svg>`).join('')}</span>`;
const dateLabel = d => new Date(d + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const attemptsFor = async id => (await db.all('attempts')).filter(a => a.recipeId === id)
  .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
const newBtn = href => `<a class="btn sm tint" href="${href}">${ICON.plus}New</a>`;

async function readPhoto(file) {
  if (!file?.size) return null;
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
const photoField = cur => `<label>Photo<input type="file" name="photo" accept="image/*"></label>
  ${cur ? `<img class="hero" src="${esc(cur)}" alt=""><label class="inline"><input type="checkbox" name="rmPhoto"> Remove photo</label>` : ''}`;
const photoValue = async (fd, old) => fd.get('rmPhoto') ? null : (await readPhoto(fd.get('photo'))) ?? old ?? null;

// ---------- Recipes ----------

const costLine = c => `${money(c.perPortion)}<small>${c.problems.length ? '<span class="warn-text">Incomplete</span>' : 'per portion'}</small>`;

async function recipeList() {
  const [recipes, ings, todo] = await Promise.all([db.all('recipes'), ingMap(), todayItems()]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
  page('recipes', 'Recipes', recipes.length ? `
    ${todo.length ? `<div class="today"><h2 class="day">Today</h2><div class="links" role="navigation" aria-label="Today">${todo.map(([href, label, value, alert]) =>
      `<a href="${href}"><span>${esc(label)}</span><span class="count ${alert ? 'alert-text' : ''}">${esc(value)}</span></a>`).join('')}</div></div>` : ''}
    <div class="bar"><input type="search" id="q" placeholder="Search recipes or ingredients" aria-label="Search recipes or ingredients">
      <select id="cat" aria-label="Category"><option value="">All</option>${opts(cats)}</select></div>
    <div class="links" role="navigation" aria-label="Recipe tools"><a href="#/allergens">Allergen chart</a><a href="#/calc">Kitchen calculator</a><a href="#/timers">Timers</a><a href="#/prep">Prep list</a><a href="#/menus">Menus</a></div>
    <ul class="list">${recipes.map(r => `<li data-q="${esc([r.name, ...(r.items ?? []).map(it => it.recipeId ? recs.get(it.recipeId)?.name : ings.get(it.ingredientId)?.name)].filter(Boolean).join(' ').toLowerCase())}" data-cat="${esc(r.category)}"><a href="#/recipe/${esc(r.id)}">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : '<span class="ph" aria-hidden="true"></span>'}
      <div class="grow"><b>${esc(r.name)}</b><small>${esc(r.category || 'Uncategorised')}</small></div>
      <span class="trail">${costLine(recipeCost(r, ings, recs))}</span></a></li>`).join('')}</ul>`
    : `<div class="card welcome"><h2>Welcome to Pinch</h2>
        <ol class="steps">
          <li><b>Write a recipe.</b> Type ingredients as you go. Pinch works out cost per portion, allergens and a recipe card.</li>
          <li><b>Add prices</b> in <a href="#/pantry">Pantry</a> whenever you have them.</li>
          <li><b>Log your services</b> in <a href="#/log">Log</a> to build your portfolio.</li>
        </ol>
        <div class="actions"><a class="btn" href="#/recipe/new/edit">Write your first recipe</a><button class="ghost" id="sample">Load sample recipes</button></div></div>
      ${standalone() ? '' : `<div class="card"><h2>Install on your phone</h2><p class="muted">${/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? 'In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. Then always open Pinch from its icon.'
        : 'In Chrome, tap <b>⋮</b> → <b>Install app</b> (or Add to Home screen).'}</p></div>`}
      <p class="muted center">Already use Pinch on another device? <a href="#/settings">Sign in</a> to bring your recipes over.</p>`,
    { action: newBtn('#/recipe/new/edit') });

  const q = document.getElementById('q'), cat = document.getElementById('cat');
  const filter = () => document.querySelectorAll('.list li').forEach(li => {
    li.hidden = !li.dataset.q.includes(q.value.toLowerCase()) || (cat.value && li.dataset.cat !== cat.value);
  });
  q?.addEventListener('input', filter);
  cat?.addEventListener('change', filter);
  document.getElementById('sample')?.addEventListener('click', async () => { await loadSample(); recipeList(); });
}

async function recipeView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, s, recipes, attempts] = await Promise.all([ingMap(), settings(), db.all('recipes'), attemptsFor(id)]);
  const recs = toMap(recipes);
  const c = recipeCost(r, ings, recs);
  const rated = attempts.filter(a => a.rating), avg = rated.length ? rated.reduce((n, a) => n + a.rating, 0) / rated.length : 0;
  const lastNext = attempts.find(a => a.next)?.next;
  const target = r.targetCostPct || s.targetCostPct;
  const price = suggestedPrice(c.perPortion, target);
  const allergens = recipeAllergens(r, ings, recs);
  const usedIn = recipes.filter(x => usesRecipe(x, r.id)).sort(byName);

  page('recipes', r.name, `
    ${r.photo ? `<img class="hero" src="${esc(r.photo)}" alt="">` : ''}
    <p class="muted">${esc(r.category || 'Uncategorised')} · ${/^https?:\/\//.test(r.sourceUrl ?? '') ? `From <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(new URL(r.sourceUrl).hostname.replace(/^www\./, ''))}</a>` : esc({ school: 'From school', work: 'From work', own: 'My own', web: 'From the web' }[r.source] || '')}${r.yieldQty ? ` · Yields ${esc(r.yieldQty)} ${esc(r.yieldUnit)}` : ''}</p>
    ${usedIn.length ? `<p class="muted">Used in: ${usedIn.map(x => `<a href="#/recipe/${esc(x.id)}">${esc(x.name)}</a>`).join(', ')}</p>` : ''}
    <div class="card stat-card">
      <p class="stat-label">Cost per portion</p>
      <p class="stat">${money(c.perPortion)}</p>
      <p class="stat-sub">${r.menuPrice
        ? `Food cost <b>${pct(actualCostPct(c.perPortion, r.menuPrice))}</b> at ${money(r.menuPrice)}`
        : `Sell at <b>${money(price.inc)}</b> for ${pct(target)} food cost`}</p>
      ${c.problems.length ? `<p class="warn">⚠ ${c.problems.length === 1 ? esc(c.problems[0]) : `${c.problems.length} things to fix below`}</p>` : ''}
    </div>
    <div class="card"><h2>Allergens</h2>${allergens.length
      ? `<div class="chips">${allergens.map(a => `<span class="chip alert">${a}</span>`).join('')}</div>`
      : '<p class="muted">None declared in Pantry.</p>'}
      <small>Based on Pantry data. Always check supplier labels.</small></div>
    <div class="card"><h2>Costing</h2><dl class="kv">
      <dt>Batch cost (${esc(portionsLabel(r.portions))})</dt><dd>${money(c.total)}</dd>
      <dt>Target food cost</dt><dd>${pct(target)}</dd>
      <dt>Suggested price ex GST</dt><dd>${money(price.ex)}</dd>
      <dt>Suggested price inc GST</dt><dd>${money(price.inc)}</dd>
      ${r.menuPrice ? `<dt>Menu price inc GST</dt><dd>${money(r.menuPrice)}</dd><dt>Actual food cost</dt><dd>${pct(actualCostPct(c.perPortion, r.menuPrice))}</dd>` : ''}
    </dl>${c.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('')}
      <a class="btn ghost wide" href="#/recipe/${esc(r.id)}/card">Costed recipe card (PDF)</a></div>
    <div class="card"><h2>Ingredients</h2>
      <label class="inline">Scale to <input type="number" id="scale" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"> portions</label>
      <table><tbody id="items"></tbody></table>
      <a class="btn ghost wide" href="#/recipe/${esc(r.id)}/scale">Scale by an ingredient or baker's %</a></div>
    ${r.method ? `<div class="card"><h2>Method</h2><div class="method">${esc(r.method)}</div></div>` : ''}
    <div class="card practice"><h2>Practice</h2>
      ${attempts.length ? `
        <p class="practice-sum">${stars(avg)}<span class="muted">${rated.length ? `${fmtQty(avg)} average, ` : ''}${attempts.length} attempt${attempts.length === 1 ? '' : 's'}</span></p>
        ${lastNext ? `<p class="tip"><small><b>Next time:</b> ${esc(lastNext)}</small></p>` : ''}
        <ul class="list">${attempts.map(a => `<li><a href="#/attempt/${esc(a.id)}/edit">
          ${a.photo ? `<img src="${esc(a.photo)}" alt="">` : '<span class="ph" aria-hidden="true"></span>'}
          <div class="grow"><b>${esc(dateLabel(a.date))}</b><small>${esc(a.notes || a.next || 'No notes')}</small></div>
          <span class="trail">${stars(a.rating)}</span></a></li>`).join('')}</ul>`
        : '<p class="muted">Each time you cook this, note how it went and what to change. Your notes show up when you start cooking.</p>'}
      <a class="btn ghost wide" href="#/recipe/${esc(r.id)}/attempt">Log an attempt</a></div>
    <div class="cta-bar"><a class="btn" href="#/recipe/${esc(r.id)}/cook">Start cooking</a></div>`,
    { back: '#/recipes', action: `<a class="btn sm tint" href="#/recipe/${esc(r.id)}/edit">Edit</a>` });

  const scale = document.getElementById('scale');
  const drawItems = () => {
    const f = (Number(scale.value) || r.portions) / r.portions;
    let total = 0;
    document.getElementById('items').innerHTML = (r.items ?? []).map(it => {
      const cost = itemCost(it, ings, recs, new Set([r.id])).cost * f;
      if (Number.isFinite(cost)) total += cost;
      const sub = it.recipeId && recs.get(it.recipeId);
      const name = sub ? `<a href="#/recipe/${esc(sub.id)}">${esc(sub.name)}</a><br><small>Sub-recipe</small>`
        : esc(it.recipeId ? '(deleted)' : ings.get(it.ingredientId)?.name ?? '(deleted)');
      return `<tr><td>${name}</td><td class="n">${esc(niceAmount(it.qty * f, it.unit))}</td><td class="n muted">${money(cost)}</td></tr>`;
    }).join('') + `<tr><th>Total</th><td></td><td class="n"><b>${money(total)}</b></td></tr>`;
  };
  scale.addEventListener('input', drawItems);
  drawItems();
}

// Costed standard recipe card, printable to A4 / PDF.
async function recipeCard(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, s, recipes] = await Promise.all([ingMap(), settings(), db.all('recipes')]);
  const recs = toMap(recipes);
  const target = r.targetCostPct || s.targetCostPct;
  const sourceLabel = r.source === 'web' && r.sourceUrl ? `Source: ${r.sourceUrl}` : { school: 'School', work: 'Work', own: 'Own recipe', web: 'Web' }[r.source] || '';

  page('recipes', 'Recipe card', `
    <div class="no-print card"><label class="inline">Portions <input type="number" id="cp" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"></label></div>
    <div class="sheet-wrap"><article class="sheet" id="sheet"></article></div>
    <div class="cta-bar no-print"><button id="print">Print or save as PDF</button></div>`, { back: `#/recipe/${esc(r.id)}` });

  const cp = document.getElementById('cp'), sheet = document.getElementById('sheet');
  const draw = () => {
    const portions = Number(cp.value) || r.portions, f = portions / r.portions;
    const c = recipeCost(r, ings, recs);
    const price = suggestedPrice(c.perPortion, target);
    const allergens = recipeAllergens(r, ings, recs);
    const rows = (r.items ?? []).map(it => {
      const cost = itemCost(it, ings, recs, new Set([r.id])).cost * f;
      const sub = it.recipeId && recs.get(it.recipeId);
      let name, unitPrice = '-', yieldPct = '-';
      if (sub) {
        const sc = recipeCost(sub, ings, recs, new Set([r.id, sub.id]));
        name = `${esc(sub.name)} <small>(sub-recipe)</small>`;
        unitPrice = sub.yieldQty > 0 ? `${money(sc.total / sub.yieldQty)}/${esc(sub.yieldUnit)}` : `${money(sc.perPortion)}/portion`;
      } else {
        const ing = ings.get(it.ingredientId);
        name = esc(ing?.name ?? '(deleted)');
        if (ing) { unitPrice = `${money(ing.price)}/${esc(ing.unit)}`; yieldPct = `${esc(ing.yieldPct)}%`; }
      }
      return `<tr><td>${name}</td><td class="n">${esc(niceParts(it.qty * f, it.unit)[0])}</td><td>${esc(niceParts(it.qty * f, it.unit)[1])}</td><td class="n">${unitPrice}</td><td class="n">${yieldPct}</td><td class="n">${money(cost)}</td></tr>`;
    }).join('');

    sheet.innerHTML = `
      <div class="sheet-head">
        <div><p class="eyebrow">Standard recipe card</p><h1>${esc(r.name)}</h1>
          <p class="muted">${[r.category, sourceLabel, s.cookName && `Prepared by ${s.cookName}`, new Date().toLocaleDateString('en-AU')].filter(Boolean).map(esc).join(' · ')}</p></div>
        ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : ''}
      </div>
      <table class="costing">
        <thead><tr><th>Ingredient</th><th class="n">Qty</th><th>Unit</th><th class="n">Price</th><th class="n">Yield</th><th class="n">Cost</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th colspan="5">Total cost (${portionsLabel(portions)})</th><td class="n"><b>${money(c.total * f)}</b></td></tr></tfoot>
      </table>
      ${c.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('')}
      <div class="sheet-grid">
        <dl class="kv">
          <dt>Cost per portion</dt><dd><b>${money(c.perPortion)}</b></dd>
          <dt>Target food cost</dt><dd>${pct(target)}</dd>
          <dt>Suggested price ex GST</dt><dd>${money(price.ex)}</dd>
          <dt>Suggested price inc GST</dt><dd><b>${money(price.inc)}</b></dd>
          ${r.menuPrice ? `<dt>Menu price inc GST</dt><dd>${money(r.menuPrice)}</dd><dt>Actual food cost</dt><dd><b>${pct(actualCostPct(c.perPortion, r.menuPrice))}</b></dd>` : ''}
          ${r.yieldQty ? `<dt>Batch yield</dt><dd>${fmtQty(r.yieldQty * f)} ${esc(r.yieldUnit)}</dd>` : ''}
        </dl>
        <div><h2>Allergens</h2><p>${allergens.length ? allergens.map(a => `<b class="alert-text">${a}</b>`).join(', ') : 'None declared'}</p></div>
      </div>
      ${r.method ? `<h2>Method</h2><div class="method">${esc(r.method)}</div>` : ''}
      <p class="sheet-foot">Costs from Pinch pantry prices. Allergens based on recorded ingredients; check supplier labels.</p>`;
  };
  cp.addEventListener('input', draw);
  document.getElementById('print').onclick = () => window.print();
  draw();
  // Shrink the A4-width preview to fit the phone screen; print ignores this (zoom reset in print CSS).
  sheet.style.zoom = Math.min(1, sheet.parentElement.clientWidth / sheet.offsetWidth).toFixed(3);
}

async function recipeEdit(id) {
  const isNew = id === 'new';
  const r = isNew ? { id: uid(), items: [], portions: 1, source: 'school' } : await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ingList, recipes, s] = await Promise.all([db.all('ingredients'), db.all('recipes'), settings()]);
  ingList.sort(byName);
  const ingById = toMap(ingList), recs = toMap(recipes);
  const usage = { kg: 'g', L: 'ml', each: 'each' };
  // A recipe can't be a sub-recipe of itself or of anything it (indirectly) contains.
  const reaches = (x, target, seen = new Set()) => x.id === target ||
    (!seen.has(x.id) && seen.add(x.id) && (x.items ?? []).some(it => recs.has(it.recipeId) && reaches(recs.get(it.recipeId), target, seen)));
  const subs = recipes.filter(x => !reaches(x, r.id)).sort(byName);

  // Row keys: 'i:<ingredientId>', 'r:<recipeId>', or 'new' for a name not in Pantry yet.
  // The ingredient field is free text; it resolves to a key by name.
  const SUB = ' (sub-recipe)';
  const keyOf = it => it.recipeId ? 'r:' + it.recipeId : it.ingredientId ? 'i:' + it.ingredientId : '';
  const labelOf = k => k.startsWith('r:') ? (recs.get(k.slice(2))?.name ?? '(deleted)') + SUB : ingById.get(k.slice(2))?.name ?? '(deleted)';
  const byLabel = new Map();
  ingList.forEach(i => { const l = i.name.trim().toLowerCase(); if (!byLabel.has(l)) byLabel.set(l, 'i:' + i.id); });
  subs.forEach(x => byLabel.set((x.name + SUB).toLowerCase(), 'r:' + x.id));
  const resolve = el => {
    const inp = el.querySelector('[name=ing]'), v = inp.value.trim();
    if (!v) return '';
    if (v === inp.dataset.label) return inp.dataset.key; // unchanged row, even if its target was deleted
    return byLabel.get(v.toLowerCase()) ?? 'new';
  };
  const unitsFor = k => k.startsWith('r:') ? ['portion', ...UNITS] : UNITS;
  const defaultUnit = (k, cur) => k.startsWith('r:') ? recs.get(k.slice(2))?.yieldUnit || 'portion'
    : k.startsWith('i:') ? usage[ingById.get(k.slice(2))?.unit] ?? 'g' : UNITS.includes(cur) ? cur : 'g';
  const row = (it = {}) => {
    const k = keyOf(it), label = k ? labelOf(k) : '';
    return `<div class="item">
      <input name="ing" list="ingOpts" autocomplete="off" placeholder="Ingredient" aria-label="Ingredient or sub-recipe" value="${esc(label)}" data-key="${esc(k)}" data-label="${esc(label)}">
      <input name="qty" type="number" step="any" min="0" inputmode="decimal" placeholder="Qty" aria-label="Quantity" value="${esc(it.qty)}">
      <select name="unit" aria-label="Unit">${opts(unitsFor(k), it.unit ?? 'g')}</select>
      <button type="button" class="x" aria-label="Remove">×</button></div>`;
  };

  // Quick capture: name, ingredients as plain lines, save. Everything else is optional and folded away.
  const typing = !r.items.length; // no rows yet: ingredients start as a text box
  page('recipes', isNew ? 'New recipe' : 'Edit recipe', `<form id="f">
    ${isNew ? `<div class="card import-card">
      <h2>Import from a website</h2>
      <div class="bar"><input type="url" id="importUrl" inputmode="url" autocomplete="off" placeholder="Paste a recipe link" aria-label="Recipe link"><button type="button" id="importBtn">Import</button></div>
      <p id="importMsg"><small>Find a recipe on Google, copy its link and paste it here. Works with most recipe sites.</small></p>
    </div>` : ''}
    <input type="hidden" name="sourceUrl" value="${esc(r.sourceUrl)}">
    <label>Name<input name="name" required placeholder="e.g. Pomodoro sauce" value="${esc(r.name)}"></label>
    <h2>Ingredients</h2>
    <datalist id="ingOpts">${ingList.map(i => `<option value="${esc(i.name)}">`).join('')}${subs.map(x => `<option value="${esc(x.name + SUB)}">`).join('')}</datalist>
    <div class="paste" id="paste" ${typing ? '' : 'hidden'}>
      <label class="sr-only" for="pasteText">Ingredients, one per line</label>
      <textarea id="pasteText" placeholder="One per line, e.g.&#10;500 g tipo 00 flour&#10;5 eggs&#10;2 cloves garlic&#10;1/2 cup olive oil"></textarea>
      <p><small>Type or paste. Amounts and units are read for you, and names are matched to your Pantry.</small></p>
      <p class="tip"><small><b>From a printed recipe:</b> open the Camera, point it at the page, tap the text icon, select the ingredients and tap Copy. Then paste here.</small></p>
      ${typing ? '' : '<button type="button" id="pasteAdd">Add to recipe</button> <span id="pasteMsg" class="muted"></span>'}
    </div>
    <div id="rows">${r.items.map(row).join('')}</div>
    <div class="actions">
      <button type="button" class="ghost" id="add">${typing ? 'Add one at a time' : '+ Add ingredient'}</button>
      ${typing ? '' : '<button type="button" class="ghost" id="pasteOpen">Paste a list</button>'}
    </div>
    <label style="margin-top:16px">Portions<input name="portions" type="number" min="1" step="1" inputmode="numeric" required value="${esc(r.portions)}"></label>
    <label>Method <small>(optional)</small><textarea name="method" placeholder="1. …">${esc(r.method)}</textarea></label>
    ${photoField(r.photo)}
    <details class="more">
      <summary>More details <small>category, pricing, batch yield</small></summary>
      <div class="row2">
        <label>Category<input name="category" list="cats" placeholder="Pasta, Sauce…" value="${esc(r.category)}"></label>
        <label>Source<select name="source">${[['school', 'School'], ['work', 'Work'], ['own', 'My own'], ['web', 'Web']].map(([v, l]) => `<option value="${v}" ${v === r.source ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      ${datalist('cats', recipes.map(x => x.category))}
      <div class="row2">
        <label>Target food cost %<input name="targetCostPct" type="number" min="1" max="100" step="any" inputmode="decimal" placeholder="${s.targetCostPct}" value="${esc(r.targetCostPct)}"></label>
        <label>Menu price inc GST<input name="menuPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(r.menuPrice)}"></label>
      </div>
      <div class="row2">
        <label>Batch yield <small>(for sub-recipes)</small><input name="yieldQty" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 2.2" value="${esc(r.yieldQty)}"></label>
        <label>Yield unit<select name="yieldUnit">${opts(['L', 'ml', 'kg', 'g'], r.yieldUnit ?? 'L')}</select></label>
      </div>
    </details>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: isNew ? '#/recipes' : `#/recipe/${esc(r.id)}` });

  const rows = document.getElementById('rows');
  document.getElementById('add').addEventListener('click', () => { rows.insertAdjacentHTML('beforeend', row()); rows.lastElementChild.querySelector('input').focus(); });
  const paste = document.getElementById('paste');
  // Import from a link: fills the form, you check it and Save
  let importedPhoto = null;
  document.getElementById('importBtn')?.addEventListener('click', async e => {
    const url = document.getElementById('importUrl').value.trim(), msg = document.getElementById('importMsg');
    if (!url) { msg.innerHTML = '<small class="warn-text">Paste a link first.</small>'; return; }
    e.target.disabled = true;
    msg.innerHTML = '<small>Reading the recipe…</small>';
    try {
      const rec = await sync.importRecipe(url);
      const f = document.getElementById('f');
      f.elements.name.value = rec.name;
      document.getElementById('pasteText').value = rec.ingredients.join('\n');
      f.elements.method.value = rec.steps.map((st, i) => `${i + 1}. ${st}`).join('\n');
      if (rec.servings) f.elements.portions.value = rec.servings;
      f.elements.source.value = 'web';
      f.elements.sourceUrl.value = rec.url;
      if (rec.imageData) importedPhoto = await readPhoto(await (await fetch(rec.imageData)).blob()).catch(() => null);
      msg.innerHTML = `<small class="ok-text">Imported from ${esc(rec.site)}: ${rec.ingredients.length} ingredients, ${rec.steps.length} steps${importedPhoto ? ', photo' : ''}. Check it, then Save.</small>`;
    } catch (err) {
      msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`;
    } finally { e.target.disabled = false; }
  });
  const pasteOpen = document.getElementById('pasteOpen');
  if (pasteOpen) pasteOpen.onclick = () => { paste.hidden = !paste.hidden; if (!paste.hidden) document.getElementById('pasteText').focus(); };
  // Turns the text box lines into ingredient rows. Runs from "Add to recipe", and on Save for anything still typed.
  const addPasted = () => {
    const text = document.getElementById('pasteText'), msg = document.getElementById('pasteMsg');
    const lines = text.value.split(/\r?\n/).map(parseIngredientLine).filter(Boolean);
    if (!lines.length) { if (msg) msg.textContent = 'Paste at least one line.'; return; }
    // Replace the empty starter row rather than leaving it above the pasted list
    rows.querySelectorAll('.item').forEach(el => { if (!el.querySelector('[name=ing]').value && !el.querySelector('[name=qty]').value) el.remove(); });
    let matched = 0, unsure = 0;
    for (const p of lines) {
      const match = p.name && matchIngredient(p.name, ingList);
      rows.insertAdjacentHTML('beforeend', row(match ? { ingredientId: match.id } : {}));
      const el = rows.lastElementChild, inp = el.querySelector('[name=ing]');
      if (match) matched++; else inp.value = p.name;
      inp.dispatchEvent(new Event('change', { bubbles: true })); // sets unit choices and the "new" outline
      el.querySelector('[name=qty]').value = p.qty ?? '';
      el.querySelector('[name=unit]').value = p.unit;
      if (!p.ok) { el.classList.add('uncertain'); el.title = `Check this line: "${p.raw}"`; unsure++; }
    }
    text.value = '';
    paste.hidden = true;
    if (msg) msg.textContent = '';
    document.querySelector('.paste-note')?.remove();
    rows.insertAdjacentHTML('afterend', `<p class="paste-note muted"><small>Added ${lines.length} ingredients: ${matched} from Pantry, ${lines.length - matched} new.${unsure ? ` ${unsure} highlighted row(s) need a quantity.` : ''}</small></p>`);
  };
  document.getElementById('pasteAdd')?.addEventListener('click', addPasted);
  rows.addEventListener('click', e => e.target.matches('.x') && e.target.closest('.item').remove());
  rows.addEventListener('change', e => {
    if (e.target.name !== 'ing') return;
    const el = e.target.closest('.item'), unit = el.querySelector('[name=unit]'), k = resolve(el);
    unit.innerHTML = opts(unitsFor(k), defaultUnit(k, unit.value));
    el.classList.toggle('is-new', k === 'new');
  });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    if (document.getElementById('pasteText').value.trim()) addPasted();
    // Never drop a typed ingredient silently: a line without an amount stops the save.
    const missing = [...form.querySelectorAll('.item')].filter(el => el.querySelector('[name=ing]').value.trim() && !(num(el.querySelector('[name=qty]').value) > 0));
    if (missing.length) {
      missing.forEach(el => el.classList.add('uncertain'));
      document.querySelector('.paste-note')?.remove();
      rows.insertAdjacentHTML('afterend', `<p class="paste-note warn">Add an amount for ${missing.length === 1 ? 'the highlighted ingredient' : `the ${missing.length} highlighted ingredients`}, or remove ${missing.length === 1 ? 'it' : 'them'} with ×.</p>`);
      missing[0].querySelector('[name=qty]').focus();
      return;
    }
    const created = new Map(); // new Pantry items by lowercased name, so repeats share one
    const items = [];
    for (const el of form.querySelectorAll('.item')) {
      const k = resolve(el), qty = num(el.querySelector('[name=qty]').value), unit = el.querySelector('[name=unit]').value;
      if (!k || !(qty > 0)) continue;
      if (k !== 'new') { items.push({ [k.startsWith('r:') ? 'recipeId' : 'ingredientId']: k.slice(2), qty, unit }); continue; }
      const name = el.querySelector('[name=ing]').value.trim();
      let ing = created.get(name.toLowerCase());
      if (!ing) created.set(name.toLowerCase(), ing = { id: uid(), name, unit: { g: 'kg', kg: 'kg', ml: 'L', L: 'L' }[unit] ?? 'each', price: null, yieldPct: 100, allergens: [], updatedAt: Date.now() });
      items.push({ ingredientId: ing.id, qty, unit });
    }
    for (const ing of created.values()) await db.put('ingredients', ing);
    await db.put('recipes', {
      ...r,
      name: fd.get('name').trim(), category: fd.get('category').trim(), source: fd.get('source'),
      portions: num(fd.get('portions')), targetCostPct: num(fd.get('targetCostPct')), menuPrice: num(fd.get('menuPrice')),
      yieldQty: num(fd.get('yieldQty')), yieldUnit: fd.get('yieldUnit'),
      items, method: fd.get('method'), photo: await photoValue(fd, importedPhoto ?? r.photo), sourceUrl: fd.get('sourceUrl') || null,
      createdAt: r.createdAt ?? Date.now(), updatedAt: Date.now(),
    });
    go(`#/recipe/${r.id}`);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    const n = recipes.filter(x => usesRecipe(x, r.id)).length;
    if (confirm(n ? `"${r.name}" is a sub-recipe in ${n} recipe(s). Their costing will show a warning. Delete anyway?` : `Delete "${r.name}"?`)) {
      for (const a of await attemptsFor(r.id)) await db.del('attempts', a.id);
      await db.del('recipes', r.id); go('#/recipes');
    }
  });
}

async function allergenChart() {
  const [recipes, ings] = await Promise.all([db.all('recipes'), ingMap()]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  page('recipes', 'Allergen chart', recipes.length ? `
    <div class="matrix"><table><thead><tr><th>Recipe</th>${ALLERGENS.map(a => `<th class="v">${a}</th>`).join('')}</tr></thead>
    <tbody>${recipes.map(r => {
      const has = recipeAllergens(r, ings, recs);
      return `<tr><td><a href="#/recipe/${esc(r.id)}">${esc(r.name)}</a></td>${ALLERGENS.map(a => `<td class="c">${has.includes(a) ? '<span class="dot" aria-label="contains">●</span>' : ''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>
    <p><small>Based on Pantry data. Always check supplier labels.</small></p>`
    : '<p class="empty">No recipes yet.</p>', { back: '#/recipes' });
}

// ---------- Practice attempts ----------

async function attemptEdit(recipeId, attemptId) {
  const a = attemptId ? await db.get('attempts', attemptId) : { id: uid(), recipeId, date: today(), rating: null };
  const r = a && await db.get('recipes', a.recipeId);
  if (!a || !r) return go('#/recipes');
  const isNew = !attemptId;
  page('recipes', isNew ? 'How did it go?' : 'Attempt', `<form id="f">
    <p class="muted">${esc(r.name)}</p>
    <fieldset class="rating"><legend>Rating</legend>
      ${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="rating" value="${i}" ${i === a.rating ? 'checked' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg><span class="sr-only">${i} star${i > 1 ? 's' : ''}</span></label>`).join('')}
    </fieldset>
    <label>Date<input name="date" type="date" required value="${esc(a.date)}"></label>
    ${photoField(a.photo)}
    <label>How did it go?<textarea name="notes" placeholder="Taste, texture, timing, what chef said…">${esc(a.notes)}</textarea></label>
    <label>Next time<textarea name="next" placeholder="e.g. Salt the pasta water more. Pull the sauce off earlier.">${esc(a.next)}</textarea></label>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: `#/recipe/${esc(r.id)}` });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    await db.put('attempts', { ...a, date: fd.get('date'), rating: num(fd.get('rating')), notes: fd.get('notes').trim(), next: fd.get('next').trim(),
      photo: await photoValue(fd, a.photo), createdAt: a.createdAt ?? Date.now(), updatedAt: Date.now() });
    go(`#/recipe/${r.id}`);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this attempt?')) { await db.del('attempts', a.id); go(`#/recipe/${r.id}`); }
  });
}

// ---------- Menus: group dishes, menu engineering, allergen menu ----------

async function menusView() {
  const menus = (await db.all('menus')).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  page('recipes', 'Menus', menus.length ? `<ul class="list">${menus.map(m => `<li><a href="#/menu/${esc(m.id)}">
      <div class="grow"><b>${esc(m.name || 'Untitled menu')}</b><small>${esc([m.period, `${(m.items ?? []).length} dish${(m.items ?? []).length === 1 ? '' : 'es'}`].filter(Boolean).join(' · '))}</small></div></a></li>`).join('')}</ul>`
    : '<div class="empty"><p>No menus yet.</p><p>Group dishes into a menu, add what each sold, and see which to keep, push, re-cost or drop.</p></div>',
    { back: '#/recipes', action: newBtn('#/menu/new') });
}

async function menuView(id) {
  const [recipes, ings] = await Promise.all([db.all('recipes'), ingMap()]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let m = id === 'new' ? { id: uid(), name: '', period: '', items: [{}], createdAt: Date.now() } : await db.get('menus', id);
  if (!m) return go('#/menus');
  const isNew = id === 'new';
  const dishRow = (x = {}) => `<div class="dish-row">
    <select name="recipe" aria-label="Dish"><option value="">Choose dish…</option>
      ${recipes.map(r => `<option value="${esc(r.id)}" ${r.id === x.recipeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    <label>Price inc GST<input name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(x.price)}"></label>
    <label>Sold<input name="sold" type="number" min="0" step="1" inputmode="numeric" value="${esc(x.sold)}"></label>
    <button type="button" class="x" aria-label="Remove">×</button></div>`;

  // A saved menu leads with its analysis; while building a new one, results sit below so the form doesn't jump.
  page('recipes', isNew ? 'New menu' : m.name || 'Menu', `
    ${isNew ? '' : '<div id="me"></div>'}
    <form class="card" id="mf" onsubmit="return false">
      <label>Menu name<input name="name" placeholder="e.g. Lunch, Week 3 Italian" value="${esc(m.name)}"></label>
      <label>Sales period <small>(optional)</small><input name="period" placeholder="e.g. 1 to 7 Oct" value="${esc(m.period)}"></label>
      <h2>Dishes</h2>
      <div id="dishes">${(m.items?.length ? m.items : [{}]).map(dishRow).join('')}</div>
      <button type="button" class="ghost" id="addDish">+ Add dish</button>
      <p><small>Price defaults to the recipe's menu price. Sold is how many went out in the period.</small></p>
    </form>
    ${isNew ? '<div id="me"></div>' : ''}
    ${isNew ? '' : '<div class="stack no-print"><a class="btn ghost" id="allergenMenu" href="#/menu/' + esc(m.id) + '/allergens">Allergen menu to print</a><button type="button" class="danger" id="delMenu">Delete menu</button></div>'}`,
    { back: '#/menus' });

  const form = document.getElementById('mf'), dishes = document.getElementById('dishes'), me = document.getElementById('me');
  const read = () => ({ ...m, name: form.name.value.trim(), period: form.period.value.trim(),
    items: [...dishes.querySelectorAll('.dish-row')].map(el => ({ recipeId: el.querySelector('[name=recipe]').value, price: num(el.querySelector('[name=price]').value), sold: num(el.querySelector('[name=sold]').value) })),
    updatedAt: Date.now() });
  const draw = async () => {
    m = read();
    if (m.name || m.items.some(x => x.recipeId)) await db.put('menus', { ...m, items: m.items.filter(x => x.recipeId) });
    // placeholders show each dish's own menu price
    dishes.querySelectorAll('.dish-row').forEach(el => { const r = recs.get(el.querySelector('[name=recipe]').value); el.querySelector('[name=price]').placeholder = r?.menuPrice ? fmtQty(r.menuPrice) : ''; });
    const e = menuEngineering(m.items, ings, recs);
    if (!e.rows.length) { me.innerHTML = ''; return; }
    const by = c => e.rows.filter(x => x.class === c);
    const tile = c => `<div class="mx ${c}"><b>${MENU_CLASSES[c].label}</b><span>${by(c).map(x => esc(x.recipe.name)).join(', ') || '-'}</span></div>`;
    me.innerHTML = `<div class="card stat-card">
        <p class="stat-label">Food cost on sales</p><p class="stat">${pct(e.foodCostPct)}</p>
        <p class="stat-sub">${e.totalSold ? `${e.totalSold} sold, ${money(e.revenue)} ex GST, ${money(e.totalCm)} contribution margin` : 'Add how many of each dish sold to see the analysis.'}</p></div>
      ${e.totalSold ? `<div class="card"><h2>Menu engineering</h2>
        <div class="matrix4"><span class="ax ax-y">More profitable →</span>${tile('puzzle')}${tile('star')}${tile('dog')}${tile('plowhorse')}<span class="ax ax-x">More popular →</span></div>
        <p><small>Average margin ${money(e.avgCm)}. Popular means at least ${pct(e.popThreshold * 100)} of sales.</small></p></div>` : ''}
      <ul class="list">${e.rows.map(x => `<li><a href="#/recipe/${esc(x.recipe.id)}">
        <div class="grow"><b>${esc(x.recipe.name)}</b><small>${x.class ? esc(MENU_CLASSES[x.class].advice) : `${money(x.cost)} cost`}${x.incomplete ? ' <span class="warn-text">Check prices.</span>' : ''}</small></div>
        <span class="trail">${x.class ? `<span class="badge ${x.class}">${MENU_CLASSES[x.class].label}</span>` : ''}<small>${money(x.cm)} margin · ${pct(x.foodCost)}</small></span></a></li>`).join('')}</ul>`;
  };
  document.getElementById('addDish').onclick = () => { dishes.insertAdjacentHTML('beforeend', dishRow()); dishes.lastElementChild.querySelector('select').focus(); };
  dishes.addEventListener('click', e => { if (e.target.matches('.x')) { e.target.closest('.dish-row').remove(); draw(); } });
  form.addEventListener('input', draw);
  form.addEventListener('change', draw);
  document.getElementById('delMenu')?.addEventListener('click', async () => {
    if (confirm(`Delete "${m.name || 'this menu'}"? The recipes stay.`)) { await db.del('menus', m.id); go('#/menus'); }
  });
  if (isNew) history.replaceState(null, '', `#/menu/${m.id}`); // later edits update the same menu
  draw();
}

async function allergenMenuView(id) {
  const [m, recipes, ings] = await Promise.all([db.get('menus', id), db.all('recipes'), ingMap()]);
  if (!m) return go('#/menus');
  const recs = toMap(recipes);
  const dishes = (m.items ?? []).map(x => recs.get(x.recipeId)).filter(Boolean);
  page('recipes', 'Allergen menu', `
    <div class="sheet-wrap"><article class="sheet" id="sheet">
      <div class="sheet-head"><div><p class="eyebrow">Allergen information</p><h1>${esc(m.name || 'Menu')}</h1>
        <p class="muted">${esc(new Date().toLocaleDateString('en-AU'))}</p></div></div>
      <table><thead><tr><th>Dish</th><th>Contains</th></tr></thead><tbody>
        ${dishes.map(r => { const a = recipeAllergens(r, ings, recs); return `<tr><td><b>${esc(r.name)}</b></td><td>${a.length ? a.map(x => `<b class="alert-text">${x}</b>`).join(', ') : 'None of the declared allergens'}</td></tr>`; }).join('')}
      </tbody></table>
      <p class="sheet-foot">Please tell your server about any allergy before ordering. This list covers the allergens Australian law requires us to declare, based on the ingredients we record. Our kitchen handles all of these allergens, so cross-contact can occur.</p>
    </article></div>
    <div class="cta-bar no-print"><button id="print">Print or save as PDF</button></div>`, { back: `#/menu/${esc(m.id)}` });
  const sheet = document.getElementById('sheet');
  sheet.style.zoom = Math.min(1, sheet.parentElement.clientWidth / sheet.offsetWidth).toFixed(3);
  document.getElementById('print').onclick = () => window.print();
}

// ---------- Prep list for a service ----------
// Sub-recipes first (stocks, sauces, doughs), longest jobs first within a level; each task lists
// what to weigh out and the method as a checklist, with timer buttons. Ticks survive closing the app.

async function prepView() {
  const [recipes, ings, saved, orderPlan] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'prepPlan'), db.get('settings', 'orderPlan')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let done = new Set(saved?.done ?? []);
  const planRow = (p = {}) => `<div class="plan-row">
    <select name="recipe" aria-label="Recipe"><option value="">Choose recipe…</option>
      ${recipes.map(r => `<option value="${esc(r.id)}" ${r.id === p.recipeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    <input name="portions" type="number" min="0" step="1" inputmode="numeric" placeholder="Portions" aria-label="Portions" value="${esc(p.portions)}">
    <button type="button" class="x" aria-label="Remove">×</button></div>`;
  const hasOrder = orderPlan?.rows?.some(r => r.recipeId && r.portions > 0);
  page('recipes', 'Prep list', recipes.length ? `
    <div class="card no-print"><h2>What's on?</h2>
      <div id="plan">${(saved?.rows?.length ? saved.rows : [{}]).map(planRow).join('')}</div>
      <div class="actions"><button type="button" class="ghost" id="addPlan">+ Add recipe</button>${hasOrder ? '<button type="button" class="ghost" id="fromOrder">Use order list</button>' : ''}</div>
    </div>
    <div id="out"></div>` : '<p class="empty">Add recipes first.</p>', { back: '#/recipes' });
  if (!recipes.length) return;

  const planEl = document.getElementById('plan'), out = document.getElementById('out');
  const readPlan = () => [...planEl.querySelectorAll('.plan-row')].map(el => ({ recipeId: el.querySelector('[name=recipe]').value, portions: num(el.querySelector('[name=portions]').value) }));
  const save = () => db.put('settings', { id: 'prepPlan', rows: readPlan(), done: [...done] });
  const nameOf = it => it.recipeId ? `${recs.get(it.recipeId)?.name ?? '(deleted)'}` : ings.get(it.ingredientId)?.name ?? '(deleted)';
  const progress = () => {
    const boxes = out.querySelectorAll('.checklist input'), ticked = [...boxes].filter(b => b.checked).length;
    const el = out.querySelector('.prep-progress');
    if (el) el.innerHTML = `<p class="stat-label">Progress</p><p class="stat">${ticked} / ${boxes.length}</p>
      <div class="progress"><i style="width:${boxes.length ? ticked / boxes.length * 100 : 0}%"></i></div>`;
  };

  const draw = () => {
    save();
    const { tasks, problems } = prepBatches(readPlan(), recs);
    if (!tasks.length) { out.innerHTML = '<p class="muted center">Choose what you’re cooking and how many portions.</p>'; return; }
    // within each level, start the longest jobs first
    const minutes = r => splitSteps(r.method).flatMap(findDurations).reduce((n, d) => n + d.seconds, 0);
    tasks.sort((a, b) => b.depth - a.depth || minutes(b.recipe) - minutes(a.recipe));
    out.innerHTML = `<div class="card stat-card prep-progress"></div>
      ${problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('')}
      ${tasks.map(({ recipe: r, factor }, n) => {
        const steps = splitSteps(r.method), total = minutes(r);
        const makes = r.yieldQty ? `${fmtQty(r.yieldQty * factor)} ${esc(r.yieldUnit)} (${esc(portionsLabel(fmtQty(r.portions * factor)))})` : esc(portionsLabel(fmtQty(r.portions * factor)));
        const box = (key, text, extra = '') => `<li><label class="${done.has(key) ? 'got' : ''}"><input type="checkbox" data-k="${esc(key)}" ${done.has(key) ? 'checked' : ''}>
          <span class="grow">${text}</span>${extra}</label></li>`;
        return `<div class="card task">
          <h2><span class="task-n">${n + 1}</span>${esc(r.name)}</h2>
          <p class="muted">Make ${makes}${total ? `, about ${esc(fmtDuration(total))} of cooking time` : ''}</p>
          ${(r.items ?? []).length ? `<h3>Weigh out</h3><ul class="checklist">${r.items.map((it, i) => box(`${r.id}:i${i}`, esc(nameOf(it)) + (it.recipeId ? ' <small>(from above)</small>' : ''), `<b>${esc(niceAmount(it.qty * factor, it.unit))}</b>`)).join('')}</ul>` : ''}
          ${steps.length ? `<h3>Method</h3><ul class="checklist steps">${steps.map((st, i) => box(`${r.id}:s${i}`, esc(st),
            findDurations(st).map(d => `<button type="button" class="tint sm" data-timer="${d.seconds}" data-label="${esc(`${r.name}: ${fmtDuration(d.seconds)}`)}" data-rid="${esc(r.id)}">${esc(fmtDuration(d.seconds))}</button>`).join(''))).join('')}</ul>` : ''}
        </div>`;
      }).join('')}
      <div class="actions no-print"><button type="button" class="ghost" id="print">Print</button><button type="button" class="ghost" id="resetDone">Clear ticks</button></div>`;
    progress();
  };

  document.getElementById('addPlan').addEventListener('click', () => { planEl.insertAdjacentHTML('beforeend', planRow()); planEl.lastElementChild.querySelector('select').focus(); });
  document.getElementById('fromOrder')?.addEventListener('click', () => {
    planEl.innerHTML = orderPlan.rows.filter(r => r.recipeId).map(planRow).join('') || planRow();
    draw();
  });
  planEl.addEventListener('click', e => { if (e.target.matches('.x')) { e.target.closest('.plan-row').remove(); draw(); } });
  planEl.addEventListener('change', draw);
  planEl.addEventListener('input', e => { if (e.target.name === 'portions') draw(); });
  out.addEventListener('change', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (e.target.checked) done.add(k); else done.delete(k);
    e.target.closest('label').classList.toggle('got', e.target.checked);
    save();
    progress();
  });
  out.addEventListener('click', e => {
    const t = e.target.closest('[data-timer]');
    if (t) { e.preventDefault(); startTimer(t.dataset.label, Number(t.dataset.timer), t.dataset.rid); }
    if (e.target.id === 'print') window.print();
    if (e.target.id === 'resetDone' && confirm('Clear all ticks?')) { done = new Set(); draw(); }
  });
  draw();
}

// ---------- Kitchen timers (no recipe needed) ----------

async function timersView() {
  const PRESETS = [1, 3, 5, 10, 15, 30];
  page('recipes', 'Timers', `
    <div id="cookTimers" aria-live="polite"></div>
    <div class="card"><h2>Quick start</h2>
      <div class="preset-grid">${PRESETS.map(m => `<button type="button" class="ghost" data-min="${m}">${m} min</button>`).join('')}</div></div>
    <form class="card" id="tf">
      <h2>Custom</h2>
      <label>Name <small>(optional)</small><input name="label" placeholder="e.g. Stock, Bread proof" autocomplete="off"></label>
      <div class="row2"><label>Minutes<input name="min" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label>
        <label>Seconds<input name="sec" type="number" min="0" max="59" step="1" inputmode="numeric" placeholder="0"></label></div>
      <button type="submit">Start timer</button>
    </form>
    <p class="muted center"><small>Timers keep running while you use the rest of Pinch. Keep the app open: a locked phone can't ring.</small></p>`, { back: '#/recipes' });
  document.querySelector('.preset-grid').addEventListener('click', e => {
    const m = Number(e.target.closest('[data-min]')?.dataset.min);
    if (m) startTimer(`${m} min`, m * 60, null);
  });
  const f = document.getElementById('tf');
  f.onsubmit = e => {
    e.preventDefault();
    const secs = (num(f.min.value) || 0) * 60 + (num(f.sec.value) || 0);
    if (!(secs > 0)) { f.min.focus(); return; }
    startTimer(f.label.value.trim() || fmtDuration(secs), secs, null);
    f.reset();
  };
}

// ---------- Study: reference decks and flash cards ----------

const studyState = async () => (await db.get('settings', 'study'))?.cards ?? {};

const EXAM_TYPES = { practical: 'Practical', theory: 'Theory', assignment: 'Assignment' };
const dLabel = n => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 0 ? `${n} days` : `${-n} days ago`);

async function studyHome() {
  const [st, exams, attempts] = await Promise.all([studyState(), db.all('exams'), db.all('attempts')]);
  const now = Date.now();
  const upcoming = exams.filter(e => daysUntil(e.date, today()) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const past = exams.length - upcoming.length;
  const due = ALL_CARDS.filter(c => isDue(st, c.id, now)).length;
  const fresh = ALL_CARDS.filter(c => !st[c.id]).length;
  const learned = ALL_CARDS.filter(c => isLearned(st, c.id)).length;
  page('study', 'Study', `
    <div class="card stat-card">
      <p class="stat-label">Today</p>
      <p class="stat">${due ? `${due} to review` : fresh ? `${Math.min(10, fresh)} new cards` : 'All caught up'}</p>
      <p class="stat-sub">${learned} of ${ALL_CARDS.length} cards learned</p>
      <div class="progress"><i style="width:${learned / ALL_CARDS.length * 100}%"></i></div>
      ${due || fresh ? '<a class="btn wide" href="#/study/go">Study 10 cards</a>' : ''}
    </div>
    <h2 class="day">Coming up</h2>
    ${upcoming.length ? `<ul class="list">${upcoming.map(e => {
      const r = examReadiness(e, attempts), d = daysUntil(e.date, today());
      return `<li><a href="#/exam/${esc(e.id)}/edit"><div class="grow"><b>${esc(e.title)}</b>
        <small>${esc(EXAM_TYPES[e.type] ?? '')}, ${esc(dateLabel(e.date))}${r.rows.length ? ` · ${r.ready} of ${r.rows.length} dish${r.rows.length === 1 ? '' : 'es'} ready` : ''}</small></div>
        <span class="trail"><span class="${d <= 3 ? 'warn-text' : ''}">${esc(dLabel(d))}</span></span></a></li>`;
    }).join('')}</ul>` : ''}
    <a class="btn ghost wide" href="#/exam/new/edit" style="margin:0 0 var(--s3)">Add an exam or assessment</a>
    ${past ? `<p class="muted center"><small>${past} past exam${past === 1 ? '' : 's'} kept in your records.</small></p>` : ''}
    <h2 class="day">Decks</h2>
    <div class="links" role="navigation" aria-label="Decks">${DECKS.map(d => `<a href="#/study/deck/${d.id}"><span>${esc(d.title)}</span>
      <span class="count">${d.cards.filter(c => isLearned(st, c.id)).length}/${d.cards.length}</span></a>`).join('')}</div>
    <p class="muted center"><small>Cards you get right come back after 1, 3, 7, 14 and 30 days. Ones you miss come straight back.</small></p>`);
}

async function deckView(id) {
  const d = DECKS.find(x => x.id === id);
  if (!d) return go('#/study');
  const st = await studyState();
  page('study', d.title, `
    <p class="muted">${esc(d.note)}</p>
    <div class="card"><dl class="ref">${d.cards.map(c => `<dt>${esc(c.front)}${isLearned(st, c.id) ? ' <span class="badge pass">Learned</span>' : ''}</dt><dd>${esc(c.back)}</dd>`).join('')}</dl></div>
    <div class="cta-bar"><a class="btn" href="#/study/go/${d.id}">Study this deck</a></div>`, { back: '#/study' });
}

async function studySession(deckId) {
  const deck = deckId && DECKS.find(x => x.id === deckId);
  let st = await studyState();
  const pool = deck ? deck.cards : ALL_CARDS;
  let queue = pickSession(pool, st, Date.now(), 10);
  if (!queue.length && deck) queue = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 10); // all learned: practise anyway
  if (!queue.length) return go('#/study');
  const missedOnce = new Set();
  let i = 0, right = 0, again = 0;
  const back = deck ? `#/study/deck/${deck.id}` : '#/study';

  page('study', deck ? deck.title : 'Study', `
    <p class="step-count" id="count"></p>
    <button type="button" class="flash" id="flash" aria-live="polite"></button>
    <div class="cook-nav" id="nav"></div>`, { back });
  const flash = document.getElementById('flash'), nav = document.getElementById('nav'), count = document.getElementById('count');
  const show = revealed => {
    const c = queue[i];
    count.textContent = `Card ${i + 1} of ${queue.length}`;
    flash.innerHTML = `<span class="flash-deck">${esc(DECKS.find(x => x.id === c.deck).title)}</span>
      <span class="flash-front">${esc(c.front)}</span>
      ${revealed ? `<span class="flash-back">${esc(c.back)}</span>` : '<span class="flash-hint">Tap to show the answer</span>'}`;
    flash.disabled = revealed;
    nav.className = `cook-nav${revealed ? '' : ' single'}`;
    nav.innerHTML = revealed ? '<button type="button" class="ghost" id="again">Again</button><button type="button" id="got">Got it</button>'
      : '<button type="button" id="reveal">Show answer</button>';
  };
  const answer = async gotIt => {
    const c = queue[i];
    // A card missed earlier in this session restarts at box 1 even if you get it on the retry: see it again tomorrow
    st = review(gotIt && missedOnce.has(c.id) ? { ...st, [c.id]: { ...st[c.id], box: 0 } } : st, c.id, gotIt);
    await db.put('settings', { id: 'study', cards: st });
    if (gotIt) right++; else { again++; if (!missedOnce.has(c.id)) { missedOnce.add(c.id); queue.push(c); } }
    i++;
    if (i < queue.length) return show(false);
    count.textContent = 'Done';
    flash.disabled = true;
    flash.innerHTML = `<span class="flash-deck">Session complete</span><span class="flash-front">${right} got it</span>
      <span class="flash-back">${again ? `${again} to go again. They'll come back soon.` : 'Nothing missed.'}</span>`;
    nav.className = 'cook-nav single';
    nav.innerHTML = `<a class="btn" href="${back}">Done</a>`;
  };
  flash.onclick = () => show(true);
  nav.addEventListener('click', e => {
    if (e.target.id === 'reveal') show(true);
    if (e.target.id === 'again') answer(false);
    if (e.target.id === 'got') answer(true);
  });
  show(false);
}

// ---------- Exams and assessments ----------

async function examEdit(id) {
  const isNew = id === 'new';
  const [recipes, attempts] = await Promise.all([db.all('recipes'), db.all('attempts')]);
  recipes.sort(byName);
  const e = isNew ? { id: uid(), title: '', date: today(), type: 'practical', recipeIds: [], target: 3 } : await db.get('exams', id);
  if (!e) return go('#/study');
  const r = examReadiness(e, attempts), d = daysUntil(e.date, today());
  const byId = toMap(recipes);
  page('study', isNew ? 'New exam' : e.title || 'Exam', `
    ${!isNew && r.rows.length ? `<div class="card stat-card">
      <p class="stat-label">${esc(EXAM_TYPES[e.type] ?? 'Exam')}, ${esc(dateLabel(e.date))}</p>
      <p class="stat">${esc(dLabel(d))}</p>
      <p class="stat-sub">${r.ready} of ${r.rows.length} dish${r.rows.length === 1 ? '' : 'es'} ready (practised ${r.target}× with a last rating of 3+)</p>
      <div class="progress"><i style="width:${r.ready / r.rows.length * 100}%"></i></div></div>
    <ul class="list">${r.rows.map(x => { const rec = byId.get(x.recipeId); return rec ? `<li><a href="#/recipe/${esc(rec.id)}">
      <div class="grow"><b>${esc(rec.name)}</b><small>${x.count} of ${r.target} practices${x.lastRating ? `, last rated ${x.lastRating}/5` : ''}</small></div>
      <span class="trail"><span class="badge ${x.ready ? 'pass' : 'pending'}">${x.ready ? 'Ready' : 'Practise'}</span></span></a></li>` : ''; }).join('')}</ul>` : ''}
    <form id="f">
      <label>Title<input name="title" required placeholder="e.g. Practical: pasta and sauces" value="${esc(e.title)}"></label>
      <div class="row2"><label>Date<input name="date" type="date" required value="${esc(e.date)}"></label>
        <label>Type<select name="type">${Object.entries(EXAM_TYPES).map(([k, v]) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <h2>Dishes to practise</h2>
      ${recipes.length ? `<div class="checks">${recipes.map(rec => `<label><input type="checkbox" name="recipeIds" value="${esc(rec.id)}" ${e.recipeIds?.includes(rec.id) ? 'checked' : ''}> ${esc(rec.name)}</label>`).join('')}</div>`
        : '<p class="muted">Add the recipes first, then pick them here.</p>'}
      <label style="margin-top:16px">Practise each dish<select name="target">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === Number(e.target || 3) ? 'selected' : ''}>${n} time${n === 1 ? '' : 's'}</option>`).join('')}</select></label>
      <label>Notes <small>(optional)</small><textarea name="notes" placeholder="What's assessed, equipment, time limit…">${esc(e.notes)}</textarea></label>
      <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
    </form>`, { back: '#/study' });
  const form = document.getElementById('f');
  form.onsubmit = async ev => {
    ev.preventDefault();
    const fd = new FormData(form);
    await db.put('exams', { ...e, title: fd.get('title').trim(), date: fd.get('date'), type: fd.get('type'), recipeIds: fd.getAll('recipeIds'),
      target: num(fd.get('target')), notes: fd.get('notes').trim(), createdAt: e.createdAt ?? Date.now(), updatedAt: Date.now() });
    go('#/study');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this exam? Practice records stay.')) { await db.del('exams', e.id); go('#/study'); }
  });
}

// ---------- Today: what needs doing, gathered from every part of the app ----------

async function todayItems() {
  const [exams, attempts, st, temps, prep, logs, recipes, ings, s] = await Promise.all([db.all('exams'), db.all('attempts'), studyState(), db.all('temps'),
    db.get('settings', 'prepPlan'), db.all('logs'), db.all('recipes'), ingMap(), settings()]);
  const items = [], t = today();
  const next = exams.filter(e => daysUntil(e.date, t) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) {
    const r = examReadiness(next, attempts), d = daysUntil(next.date, t), behind = r.rows.length - r.ready;
    items.push([`#/exam/${next.id}/edit`, behind ? `${next.title}, ${behind} to practise` : next.title, dLabel(d), d <= 3 && behind]);
  }
  const due = ALL_CARDS.filter(c => isDue(st, c.id)).length;
  if (due) items.push(['#/study/go', 'Study cards to review', String(due)]);
  const open = temps.filter(x => tempStatus(x).status === 'pending').length;
  if (open) items.push(['#/temps', 'Temperature check still open', String(open), true]);
  if (prep?.rows?.some(r => r.recipeId && r.portions > 0)) {
    const { tasks } = prepBatches(prep.rows, toMap(recipes));
    const total = tasks.reduce((n, x) => n + (x.recipe.items?.length ?? 0) + splitSteps(x.recipe.method).length, 0);
    const done = (prep.done ?? []).length;
    if (total && done < total) items.push(['#/prep', 'Prep list', `${done} / ${total}`]);
  }
  if (logs.length && !logs.some(l => l.date === t && l.period === periodNow())) items.push(['#/log/new/edit', `Log today's ${periodNow().toLowerCase()} service`, '']);
  const over = foodCostWatch(recipes, ings, s.targetCostPct).filter(x => x.over).length;
  if (over) items.push(['#/costwatch', 'Over target food cost', String(over), true]);
  return items;
}

// ---------- Scaling: by portions, from an ingredient you have, baker's % ----------

async function scaleView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, recipes] = await Promise.all([ingMap(), db.all('recipes')]);
  const recs = toMap(recipes);
  const items = r.items ?? [];
  const nameOf = it => it.recipeId ? `${recs.get(it.recipeId)?.name ?? '(deleted)'}` : ings.get(it.ingredientId)?.name ?? '(deleted)';
  const baseIdx = bakersBase(r, ings, recs);
  let mode = 'have';

  page('recipes', 'Scale', `
    <p class="muted">${esc(r.name)} · makes ${esc(portionsLabel(r.portions))}</p>
    <div class="seg" role="tablist">
      <button type="button" role="tab" data-mode="have" aria-selected="true">I have…</button>
      <button type="button" role="tab" data-mode="portions" aria-selected="false">Portions</button>
      <button type="button" role="tab" data-mode="bakers" aria-selected="false">Baker's %</button>
    </div>
    <form class="card" id="sc" onsubmit="return false">
      <div data-for="have">
        <label>Ingredient<select name="item">${items.map((it, i) => `<option value="${i}">${esc(nameOf(it))} (${fmtQty(it.qty)} ${esc(it.unit)})</option>`).join('')}</select></label>
        <div class="row2"><label>I have<input name="have" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 3"></label>
          <label>Unit<select name="haveUnit">${opts(UNITS, items[0]?.unit)}</select></label></div>
      </div>
      <div data-for="portions" hidden><label>Portions<input name="portions" type="number" min="1" step="any" inputmode="decimal" value="${esc(r.portions)}"></label></div>
      <div data-for="bakers" hidden>
        ${baseIdx < 0 ? '<p class="muted">Baker\'s % needs weights (g or kg). Add them to the ingredients first.</p>' : `
        <label>Base (100%)<select name="base">${items.map((it, i) => `<option value="${i}" ${i === baseIdx ? 'selected' : ''}>${esc(nameOf(it))}</option>`).join('')}</select></label>
        <label>Base weight (g)<input name="baseG" type="number" min="0" step="any" inputmode="decimal"></label>`}
      </div>
    </form>
    <div class="card stat-card" id="scStat"></div>
    <div class="card"><table><tbody id="scRows"></tbody></table></div>`, { back: `#/recipe/${esc(r.id)}` });

  const f = document.getElementById('sc'), stat = document.getElementById('scStat'), rowsEl = document.getElementById('scRows');
  const row = (name, amount, extra = '') => `<tr><td>${esc(name)}${extra ? `<br><small>${extra}</small>` : ''}</td><td class="n">${amount}</td></tr>`;
  const scaled = factor => items.map(it => row(nameOf(it), esc(niceAmount(it.qty * factor, it.unit)))).join('');
  const draw = () => {
    document.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== mode; });
    if (mode === 'portions') {
      const p = num(f.portions.value) || r.portions, factor = p / r.portions;
      stat.innerHTML = `<p class="stat-label">Scale</p><p class="stat">×${fmtQty(factor)}</p><p class="stat-sub">${esc(portionsLabel(fmtQty(p)))}</p>`;
      rowsEl.innerHTML = scaled(factor);
    } else if (mode === 'have') {
      const it = items[num(f.item.value) ?? 0];
      const res = scaleFromIngredient(r, num(f.item.value) ?? 0, num(f.have.value), f.haveUnit.value, ings, recs);
      if (!res) {
        stat.innerHTML = `<p class="stat-label">How far does it go?</p><p class="stat-sub">${it ? `Enter how much ${esc(nameOf(it))} you have.` : 'This recipe has no ingredients yet.'}${f.have.value && it ? ` <span class="warn-text">${esc(f.haveUnit.value)} doesn’t convert to ${esc(it.unit)} for this ingredient.</span>` : ''}</p>`;
        rowsEl.innerHTML = scaled(1);
        return;
      }
      stat.innerHTML = `<p class="stat-label">That makes</p><p class="stat">${esc(portionsLabel(fmtQty(res.portions)))}</p><p class="stat-sub">×${fmtQty(res.factor)} of the recipe. You’ll need:</p>`;
      rowsEl.innerHTML = scaled(res.factor);
    } else {
      if (baseIdx < 0) { stat.innerHTML = ''; rowsEl.innerHTML = ''; return; }
      const b = bakersPercent(r, ings, recs, num(f.base.value) ?? baseIdx);
      if (!b) { stat.innerHTML = '<p class="stat-sub warn-text">Pick a base measured in g, kg or ml.</p>'; rowsEl.innerHTML = ''; return; }
      if (!f.baseG.value) f.baseG.value = fmtQty(b.base);
      const factor = (num(f.baseG.value) || b.base) / b.base;
      stat.innerHTML = `<p class="stat-label">Total weight</p><p class="stat">${fmtAmount(b.total * factor / 1000, 'kg')}</p><p class="stat-sub">Base ${esc(nameOf(items[num(f.base.value)]))} = 100%</p>`;
      rowsEl.innerHTML = `<tr><th>Ingredient</th><th class="n">%</th><th class="n">Amount</th></tr>` + b.rows.map(({ i, grams, pct: p }) => {
        const it = items[i];
        const amount = grams == null ? esc(niceAmount(it.qty * factor, it.unit)) : it.unit === 'each' ? `${fmtQty(it.qty * factor)} <small>(${esc(niceAmount(grams * factor, 'g'))})</small>` : esc(niceAmount(grams * factor, 'g'));
        return `<tr><td>${esc(nameOf(it))}</td><td class="n">${p == null ? '-' : `${fmtQty(p)}%`}</td><td class="n">${amount}</td></tr>`;
      }).join('') + `<tr><td colspan="3"><small>Volumes use ingredient densities; one egg counts as 50 g.</small></td></tr>`;
    }
  };
  document.querySelector('.seg').addEventListener('click', e => {
    const m = e.target.closest('[data-mode]')?.dataset.mode;
    if (!m) return;
    mode = m;
    document.querySelectorAll('.seg [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    draw();
  });
  f.addEventListener('input', draw);
  f.item.addEventListener('change', () => { f.haveUnit.value = items[num(f.item.value)]?.unit ?? 'g'; draw(); });
  f.base?.addEventListener('change', () => { f.baseG.value = ''; draw(); });
  draw();
}

// ---------- Kitchen calculator ----------

const CALC_INGREDIENTS = ['Plain flour', 'Tipo 00 flour', 'Bread flour', 'Semolina', 'Caster sugar', 'White sugar', 'Brown sugar (packed)',
  'Icing sugar', 'Butter', 'Cocoa powder', 'Rolled oats', 'Rice (uncooked)', 'Arborio rice', 'Breadcrumbs', 'Grated parmesan',
  'Honey', 'Milk', 'Cream', 'Water', 'Olive oil', 'Table salt', 'Kosher salt'];

async function calcView() {
  let sys = 'au';
  page('recipes', 'Kitchen calculator', `
    <form class="card" id="cups" onsubmit="return false">
      <h2>Cups and spoons to grams</h2>
      <div class="seg" role="tablist" aria-label="Measures">
        <button type="button" role="tab" data-sys="au" aria-selected="true">Australian</button>
        <button type="button" role="tab" data-sys="us" aria-selected="false">US</button>
      </div>
      <div class="row2"><label>Amount<input name="amt" type="text" inputmode="decimal" value="1"></label>
        <label>Measure<select name="unit"><option value="cup">cup</option><option value="tbsp">tbsp</option><option value="tsp">tsp</option></select></label></div>
      <label>Ingredient<select name="what">${CALC_INGREDIENTS.map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
      <p class="stat" id="cupOut"></p><p class="stat-sub" id="cupSub"></p>
    </form>
    <form class="card" onsubmit="return false" data-pair="temp">
      <h2>Oven temperature</h2>
      <div class="row2"><label>°F<input data-k="f" type="number" inputmode="decimal" value="350"></label><label>°C<input data-k="c" type="number" inputmode="decimal"></label></div>
      <p class="stat-sub" id="fan"></p>
    </form>
    <form class="card" onsubmit="return false" data-pair="weight">
      <h2>Weight and volume</h2>
      <div class="row2"><label>oz<input data-k="oz" type="number" inputmode="decimal"></label><label>g<input data-k="g" type="number" inputmode="decimal"></label></div>
      <div class="row2"><label>lb<input data-k="lb" type="number" inputmode="decimal"></label><label>kg<input data-k="kg" type="number" inputmode="decimal"></label></div>
      <div class="row2"><label>fl oz (US)<input data-k="floz" type="number" inputmode="decimal"></label><label>ml<input data-k="ml" type="number" inputmode="decimal"></label></div>
    </form>
    <p class="muted center"><small>Cup weights are approximate (spooned and levelled). Weigh when it matters.</small></p>`, { back: '#/recipes' });

  // "1 1/2", "½", "0.5" all work in the amount box
  const amount = v => { const p = parseIngredientLine(`${v} x`); return p?.qty ?? NaN; };
  const cups = document.getElementById('cups');
  const drawCups = () => {
    const ml = amount(cups.amt.value) * MEASURES[sys][cups.unit.value];
    const g = convertFor(ml, 'ml', 'g', cups.what.value);
    document.getElementById('cupOut').textContent = Number.isFinite(g) ? `≈ ${g >= 100 ? Math.round(g) : fmtQty(g)} g` : '-';
    document.getElementById('cupSub').textContent = Number.isFinite(ml) ? `${fmtQty(ml)} ml ${sys === 'au' ? 'Australian' : 'US'} measure, ${cups.what.value.toLowerCase()} at ${densityFor(cups.what.value)} g/ml` : 'Enter an amount, e.g. 1 1/2';
  };
  cups.addEventListener('input', drawCups);
  cups.querySelector('.seg').addEventListener('click', e => {
    const v = e.target.closest('[data-sys]')?.dataset.sys;
    if (!v) return;
    sys = v;
    cups.querySelectorAll('[data-sys]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sys === v)));
    drawCups();
  });

  // Two-way pairs: typing in one box fills its partner
  const PAIRS = { f: ['c', fToC], c: ['f', cToF], oz: ['g', x => x * 28.35], g: ['oz', x => x / 28.35], lb: ['kg', x => x * 0.4536], kg: ['lb', x => x / 0.4536],
    floz: ['ml', x => x * 29.57], ml: ['floz', x => x / 29.57] };
  const round = x => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 100) / 100);
  document.querySelectorAll('[data-pair]').forEach(form => form.addEventListener('input', e => {
    const k = e.target.dataset.k, [other, fn] = PAIRS[k] ?? [], v = num(e.target.value);
    if (!other) return;
    form.querySelector(`[data-k="${other}"]`).value = v == null ? '' : round(fn(v));
    if (form.dataset.pair === 'temp') { const c = num(form.querySelector('[data-k=c]').value); document.getElementById('fan').textContent = c == null ? '' : `Fan-forced oven: about ${Math.round((c - 20) / 5) * 5} °C`; }
  }));
  const f = document.querySelector('[data-k=f]');
  f.dispatchEvent(new Event('input', { bubbles: true }));
  drawCups();
}

// ---------- Cooking mode ----------
// Big one-step-at-a-time method, timers found in the text, a scaled ingredient checklist,
// and the screen kept awake. Timers live outside the view so they keep running (and ring)
// if you jump to another recipe.

const timers = []; // { id, label, recipeId, end, done }
let tickHandle = null, audio = null, wake = null;
const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function startTimer(label, seconds, recipeId) {
  // Audio must be unlocked by the tap that starts the timer (iOS)
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume?.();
  timers.push({ id: uid(), label, recipeId, end: Date.now() + seconds * 1000, done: false });
  tickHandle ??= setInterval(tick, 1000);
  drawTimers();
}

function ring() {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!audio) return;
  for (let i = 0; i < 3; i++) {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.45;
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.4);
  }
}

function tick() {
  for (const t of timers) if (!t.done && Date.now() >= t.end) { t.done = true; ring(); }
  if (!timers.length) { clearInterval(tickHandle); tickHandle = null; }
  drawTimers();
}

function drawTimers() {
  const html = timers.map(t => `<div class="timer ${t.done ? 'done' : ''}" role="timer">
    <span>${esc(t.label)}</span><b>${t.done ? 'Done' : clock(t.end - Date.now())}</b>
    <button type="button" class="x" data-stop="${t.id}" aria-label="${t.done ? 'Dismiss' : 'Stop'} timer ${esc(t.label)}">×</button></div>`).join('');
  const box = document.getElementById('cookTimers');
  if (box) box.innerHTML = html;
  // Elsewhere in the app, a pill shows the next timer and leads back to cooking mode
  const pill = document.getElementById('timerPill'), next = timers.find(t => !t.done) ?? timers[0];
  pill.hidden = !next || !!box;
  if (next && !box) {
    pill.href = next.recipeId ? `#/recipe/${encodeURIComponent(next.recipeId)}/cook` : '#/timers';
    pill.textContent = next.done ? `${next.label}: done` : `${next.label} ${clock(next.end - Date.now())}`;
    pill.classList.toggle('done', next.done);
  }
}
document.addEventListener('click', e => {
  const id = e.target.closest('[data-stop]')?.dataset.stop;
  if (!id) return;
  timers.splice(timers.findIndex(t => t.id === id), 1);
  drawTimers();
});

async function keepAwake(on) {
  try {
    if (on && !wake) { wake = await navigator.wakeLock?.request('screen'); wake?.addEventListener('release', () => { wake = null; }); }
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* not supported or not allowed: cooking mode still works */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.endsWith('/cook')) keepAwake(true);
});

async function cookView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, recipes, attempts] = await Promise.all([ingMap(), db.all('recipes'), attemptsFor(id)]);
  const lastNext = attempts.find(a => a.next);
  const recs = toMap(recipes);
  const steps = splitSteps(r.method);
  let at = 0, portions = r.portions;
  const ticked = new Set();

  page('recipes', r.name, `
    <div class="seg" role="tablist">
      <button type="button" role="tab" aria-selected="${steps.length ? 'true' : 'false'}" data-seg="steps">Steps${steps.length ? ` (${steps.length})` : ''}</button>
      <button type="button" role="tab" aria-selected="${steps.length ? 'false' : 'true'}" data-seg="ings">Ingredients (${(r.items ?? []).length})</button>
    </div>
    <div id="cookTimers" aria-live="polite"></div>
    ${lastNext ? `<p class="tip"><small><b>Last time (${esc(dateLabel(lastNext.date))}), you noted:</b> ${esc(lastNext.next)}</small></p>` : ''}
    <section id="steps" ${steps.length ? '' : 'hidden'}></section>
    <section id="ings" ${steps.length ? 'hidden' : ''}>
      <div class="card">
        <label class="inline">Portions <input id="cookPortions" type="number" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"></label>
        <ul class="checklist" id="checklist"></ul>
      </div>
      ${steps.length ? '' : `<p class="muted center">No method yet. <a href="#/recipe/${esc(r.id)}/edit">Add the steps</a> to cook step by step.</p>`}
    </section>
    <div class="cook-nav" id="cookNav" ${steps.length ? '' : 'hidden'}>
      <button type="button" class="ghost" id="prev">Back</button><button type="button" id="next">Next step</button>
    </div>`, { back: `#/recipe/${esc(r.id)}` });
  keepAwake(true);
  drawTimers();

  const stepsEl = document.getElementById('steps'), prev = document.getElementById('prev'), next = document.getElementById('next');
  const drawStep = () => {
    const text = steps[at] ?? '';
    stepsEl.innerHTML = `<p class="step-count">Step ${at + 1} of ${steps.length}</p>
      <p class="step-text">${esc(text)}</p>
      <div class="step-timers">${findDurations(text).map(d =>
        `<button type="button" class="tint" data-timer="${d.seconds}" data-label="${esc(`Step ${at + 1}: ${fmtDuration(d.seconds)}`)}">Start ${esc(fmtDuration(d.seconds))} timer</button>`).join('')}</div>`;
    prev.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? 'Finish' : 'Next step';
  };
  const drawChecklist = () => {
    const f = portions / r.portions;
    document.getElementById('checklist').innerHTML = (r.items ?? []).map((it, i) => {
      const name = it.recipeId ? `${recs.get(it.recipeId)?.name ?? '(deleted)'} (sub-recipe)` : ings.get(it.ingredientId)?.name ?? '(deleted)';
      return `<li><label class="${ticked.has(i) ? 'got' : ''}"><input type="checkbox" data-i="${i}" ${ticked.has(i) ? 'checked' : ''}>
        <span class="grow">${esc(name)}</span><b>${esc(niceAmount(it.qty * f, it.unit))}</b></label></li>`;
    }).join('') || '<li class="muted">No ingredients yet.</li>';
  };
  const go_ = d => {
    if (at + d >= steps.length) return go(`#/recipe/${r.id}/attempt`); // Finish: how did it go?
    at = Math.max(0, at + d);
    drawStep();
    window.scrollTo(0, 0);
  };
  if (steps.length) drawStep();
  drawChecklist();

  prev.onclick = () => go_(-1);
  next.onclick = () => go_(1);
  stepsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-timer]');
    if (b) startTimer(b.dataset.label, Number(b.dataset.timer), r.id);
  });
  // Swipe between steps (buttons do the same, for anyone who can't swipe)
  let x0 = null;
  stepsEl.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  stepsEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - (x0 ?? 0);
    if (x0 !== null && Math.abs(dx) > 60) go_(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.querySelector('.seg').addEventListener('click', e => {
    const tab = e.target.closest('[data-seg]')?.dataset.seg;
    if (!tab) return;
    document.querySelectorAll('.seg [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.seg === tab)));
    stepsEl.hidden = tab !== 'steps' || !steps.length;
    document.getElementById('cookNav').hidden = tab !== 'steps' || !steps.length;
    document.getElementById('ings').hidden = tab !== 'ings';
  });
  document.getElementById('cookPortions').addEventListener('input', e => { portions = Number(e.target.value) || r.portions; drawChecklist(); });
  document.getElementById('checklist').addEventListener('change', e => {
    const i = Number(e.target.dataset.i);
    if (e.target.checked) ticked.add(i); else ticked.delete(i);
    e.target.closest('label').classList.toggle('got', e.target.checked);
  });
}

// ---------- Pantry ----------

// Saves ingredients with price history, then works out which recipe costs moved, shown once on Pantry.
let priceNews = null;
async function saveIngredients(nexts, title) {
  const [before, recipes] = await Promise.all([ingMap(), db.all('recipes')]);
  const after = new Map(before);
  for (const n of nexts) {
    const saved = withPriceHistory(before.get(n.id), n, today());
    await db.put('ingredients', saved);
    after.set(saved.id, saved);
  }
  const impacts = costImpact(recipes, before, after);
  priceNews = impacts.length || title ? { title, impacts } : null;
}

const impactRows = impacts => `<ul class="list">${impacts.map(x => `<li><a href="#/recipe/${esc(x.recipe.id)}">
  <div class="grow"><b>${esc(x.recipe.name)}</b><small>${Number.isFinite(x.afterPct) ? `Food cost ${pct(x.beforePct)} to <span class="${x.after > x.before ? 'alert-text' : 'ok-text'}">${pct(x.afterPct)}</span>` : 'Cost per portion'}</small></div>
  <span class="trail">${money(x.before)} → ${money(x.after)}<small class="${x.after > x.before ? 'alert-text' : 'ok-text'}">${x.after > x.before ? '+' : ''}${money(x.after - x.before).replace('$-', '−$')}</small></span></a></li>`).join('')}</ul>`;

async function pantryList() {
  const [ings, recipes] = await Promise.all([db.all('ingredients'), db.all('recipes')]);
  ings.sort(byName);
  const used = id => recipes.filter(r => r.items?.some(it => it.ingredientId === id)).length;
  const missing = ings.filter(i => !hasPrice(i));
  const news = priceNews;
  priceNews = null;
  page('pantry', 'Pantry', ings.length ? `
    ${news ? `<div class="card news"><h2>${esc(news.title ?? 'Prices updated')}</h2>
      ${news.impacts.length ? `<p class="muted">${news.impacts.length} recipe${news.impacts.length === 1 ? '' : 's'} changed cost:</p>${impactRows(news.impacts)}` : '<p class="muted">No recipe costs changed.</p>'}</div>` : ''}
    <div class="links" role="navigation" aria-label="Pantry tools"><a href="#/order">Order list</a><a href="#/yield">Yield test</a><a href="#/pantry/import">Import prices</a><a href="#/costwatch">Food cost watch</a></div>
    ${missing.length ? `<div class="card"><h2>Needs price (${missing.length})</h2><div class="chips">${missing.map(i => `<a class="chip" href="#/ingredient/${esc(i.id)}/edit">${esc(i.name)}</a>`).join('')}</div></div>` : ''}
    <div class="bar"><input type="search" id="q" placeholder="Search ingredients" aria-label="Search ingredients"></div>
    <ul class="list">${ings.map(i => `<li data-q="${esc(i.name.toLowerCase())}"><a href="#/ingredient/${esc(i.id)}/edit">
      <div class="grow"><b>${esc(i.name)}</b><small>Yield ${esc(i.yieldPct)}%, in ${used(i.id)} recipe${used(i.id) === 1 ? '' : 's'}${i.allergens?.length ? `<br><span class="alert-text">${i.allergens.map(esc).join(', ')}</span>` : ''}</small></div>
      <span class="trail">${hasPrice(i) ? money(i.price) : '<span class="warn-text">No price</span>'}<small>${i.unit === 'each' ? 'each' : `per ${esc(i.unit)}`}</small></span></a></li>`).join('')}</ul>`
    : '<div class="empty"><p>No ingredients yet.</p><p>Add what you buy, with price per kg, litre or each.</p></div>',
    { action: newBtn('#/ingredient/new/edit') });
  const q = document.getElementById('q');
  q?.addEventListener('input', () => document.querySelectorAll('.list li').forEach(li => { li.hidden = !li.dataset.q.includes(q.value.toLowerCase()); }));
}

async function ingredientEdit(id) {
  const isNew = id === 'new';
  const i = isNew ? { id: uid(), unit: 'kg', yieldPct: 100, allergens: [] } : await db.get('ingredients', id);
  if (!i) return go('#/pantry');
  const usedIn = isNew ? [] : (await db.all('recipes')).filter(r => r.items?.some(it => it.ingredientId === i.id)).sort(byName);
  page('pantry', isNew ? 'New ingredient' : 'Edit ingredient', `<form id="f">
    <label>Name<input name="name" required value="${esc(i.name)}"></label>
    <div class="row2">
      <label>Price (AUD)<input name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Add later" value="${esc(i.price)}"></label>
      <label>Per<select name="unit">${opts(PURCHASE_UNITS, i.unit)}</select></label>
    </div>
    <label>Yield % <small>(usable after trimming/peeling)</small><input name="yieldPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(i.yieldPct)}"></label>
    ${(i.priceHistory ?? []).length > 1 ? `<p><small>Price history: ${i.priceHistory.slice(-5).reverse().map(h => `${esc(new Date(h.date + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))} ${money(h.price)}/${esc(h.unit)}`).join(', ')}</small></p>` : ''}
    ${isNew ? '' : `<p><small>${i.lastYieldTest ? `Last yield test ${esc(new Date(i.lastYieldTest.date + 'T00:00').toLocaleDateString('en-AU'))}: ${pct(i.lastYieldTest.yieldPct)}. ` : ''}<a href="#/yield/${esc(i.id)}">Run a yield test</a></small></p>`}
    <h2>Allergens</h2>
    <div class="checks">${ALLERGENS.map(a => `<label><input type="checkbox" name="allergens" value="${a}" ${i.allergens?.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>
    ${isNew ? '' : `<h2 style="margin-top:24px">Used in</h2>${usedIn.length
      ? `<div class="links" role="navigation" aria-label="Recipes using ${esc(i.name)}">${usedIn.map(r => `<a href="#/recipe/${esc(r.id)}">${esc(r.name)}</a>`).join('')}</div>`
      : '<p class="muted">Not used in any recipe yet.</p>'}`}
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: '#/pantry' });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const next = { ...i, name: fd.get('name').trim(), price: num(fd.get('price')), unit: fd.get('unit'),
      yieldPct: num(fd.get('yieldPct')), allergens: fd.getAll('allergens'), updatedAt: Date.now() };
    const changed = !isNew && (next.price !== i.price || next.unit !== i.unit || next.yieldPct !== i.yieldPct);
    await saveIngredients([next], changed ? `${next.name}: ${hasPrice(i) ? `${money(i.price)}/${i.unit} → ` : ''}${money(next.price)}/${next.unit}${next.yieldPct !== i.yieldPct ? `, yield ${next.yieldPct}%` : ''}` : null);
    if (!changed) priceNews = null;
    go('#/pantry');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    const n = (await db.all('recipes')).filter(r => r.items?.some(it => it.ingredientId === i.id)).length;
    if (confirm(n ? `"${i.name}" is used in ${n} recipe(s). Their costing will show a warning. Delete anyway?` : `Delete "${i.name}"?`)) {
      await db.del('ingredients', i.id); go('#/pantry');
    }
  });
}

// ---------- Food cost watch ----------

async function costWatchView() {
  const [recipes, ings, s] = await Promise.all([db.all('recipes'), ingMap(), settings()]);
  const rows = foodCostWatch(recipes, ings, s.targetCostPct);
  const over = rows.filter(r => r.over), moves = priceMoves(ings).filter(m => Number.isFinite(m.change) && m.change !== 0).slice(0, 8);
  const noPrice = recipes.filter(r => !(r.menuPrice > 0)).length;
  page('pantry', 'Food cost watch', `
    <div class="card stat-card">
      <p class="stat-label">Over target</p>
      <p class="stat ${over.length ? 'alert-text' : ''}">${over.length} of ${rows.length}</p>
      <p class="stat-sub">${rows.length ? `Recipes with a menu price, compared with their target food cost (default ${pct(s.targetCostPct)}).` : 'Add a menu price to a recipe (More details) to track its food cost.'}</p>
    </div>
    ${rows.length ? `<ul class="list">${rows.map(x => `<li><a href="#/recipe/${esc(x.recipe.id)}">
      <div class="grow"><b>${esc(x.recipe.name)}</b><small>${money(x.perPortion)} on a ${money(x.recipe.menuPrice)} menu price${x.incomplete ? ', <span class="warn-text">some prices missing</span>' : ''}</small></div>
      <span class="trail"><span class="${x.over ? 'alert-text' : 'ok-text'}">${pct(x.actual)}</span><small>target ${pct(x.target)}</small></span></a></li>`).join('')}</ul>` : ''}
    ${noPrice ? `<p class="muted center"><small>${noPrice} recipe${noPrice === 1 ? '' : 's'} without a menu price ${noPrice === 1 ? 'isn’t' : 'aren’t'} shown.</small></p>` : ''}
    ${moves.length ? `<h2 class="day">Latest price changes</h2><ul class="list">${moves.map(m => `<li><a href="#/ingredient/${esc(m.ing.id)}/edit">
      <div class="grow"><b>${esc(m.ing.name)}</b><small>${money(m.from.price)} → ${money(m.to.price)} per ${esc(m.ing.unit)}</small></div>
      <span class="trail"><span class="${m.change > 0 ? 'alert-text' : 'ok-text'}">${m.change > 0 ? '+' : ''}${pct(m.change)}</span><small>${esc(new Date(m.to.date + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }))}</small></span></a></li>`).join('')}</ul>` : ''}`,
    { back: '#/pantry' });
}

// ---------- Import supplier prices ----------

async function importPrices() {
  const ings = (await db.all('ingredients')).sort(byName);
  page('pantry', 'Import prices', `
    <div class="card">
      <p>Paste rows from a supplier price list or spreadsheet, or pick a CSV file.</p>
      <p class="muted"><small>Columns: <b>name</b>, <b>price</b>, <b>unit or pack</b> (kg, L, each, or a pack size like 5kg, 500g, dozen). Optional: <b>yield</b> %. Pack prices are converted to the price per kg / L / each.</small></p>
      <label>Paste<textarea id="csvText" placeholder="Tomatoes, canned whole&#9;2.5kg&#9;$10.50&#10;Flour tipo 00&#9;12.5kg&#9;$35.00&#10;Eggs free range&#9;dozen&#9;$7.20"></textarea></label>
      <label>…or choose a file<input type="file" id="csvFile" accept=".csv,.tsv,.txt,text/csv"></label>
      <button type="button" id="preview">Preview</button>
    </div>
    <div id="out"></div>`, { back: '#/pantry' });

  const out = document.getElementById('out');
  let rows = [];
  document.getElementById('csvFile').onchange = async e => {
    const f = e.target.files[0];
    if (f) { document.getElementById('csvText').value = await f.text(); document.getElementById('preview').click(); }
  };
  document.getElementById('preview').onclick = () => {
    rows = parsePriceList(document.getElementById('csvText').value);
    if (!rows.length) { out.innerHTML = '<p class="warn">Nothing to import yet. Paste some rows first.</p>'; return; }
    out.innerHTML = `<div class="card"><h2>Check before importing</h2>
      <p class="muted"><small>Matched items get the new price. Pick “New ingredient” if a match is wrong.</small></p>
      <div class="import-rows">${rows.map((r, i) => {
        const m = r.ok && matchIngredient(r.name, ings, 1);
        return `<div class="import-row ${r.ok ? '' : 'bad'}" data-i="${i}">
          <label class="inline"><input type="checkbox" name="use" ${r.ok ? 'checked' : 'disabled'}> <b>${esc(r.name || '(no name)')}</b></label>
          ${r.ok ? `<div class="row3">
            <span class="big-ish">${money(r.price)}</span>
            <select name="unit" aria-label="Unit">${opts(PURCHASE_UNITS, r.unit)}</select>
            <select name="target" aria-label="Update which ingredient"><option value="">New ingredient</option>
              ${ings.map(x => `<option value="${esc(x.id)}" ${m && m.id === x.id ? 'selected' : ''}>Update: ${esc(x.name)}${x.unit !== r.unit ? ` (${esc(x.unit)})` : ''}</option>`).join('')}</select>
          </div>` : `<small class="warn">Couldn't read price or unit: ${esc(r.raw)}</small>`}</div>`;
      }).join('')}</div>
      <button type="button" id="doImport">Import</button> <span id="impMsg" class="muted"></span></div>`;
  };
  out.addEventListener('click', async e => {
    if (e.target.id !== 'doImport') return;
    let added = 0, updated = 0;
    const nexts = [];
    for (const el of out.querySelectorAll('.import-row')) {
      if (!el.querySelector('[name=use]')?.checked) continue;
      const r = rows[el.dataset.i], unit = el.querySelector('[name=unit]').value, target = el.querySelector('[name=target]').value;
      const existing = target && ings.find(x => x.id === target);
      if (existing) { nexts.push({ ...existing, price: r.price, unit, ...(r.yieldPct ? { yieldPct: r.yieldPct } : {}), updatedAt: Date.now() }); updated++; }
      else { nexts.push({ id: uid(), name: r.name, price: r.price, unit, yieldPct: r.yieldPct ?? 100, allergens: [], updatedAt: Date.now() }); added++; }
    }
    await saveIngredients(nexts, `Imported: ${updated} updated, ${added} added`);
    go('#/pantry');
  });
}

// ---------- Yield test ----------

async function yieldView(id) {
  const ings = (await db.all('ingredients')).sort(byName);
  let ing = ings.find(x => x.id === id) ?? null;
  const unitOf = x => (x?.unit === 'L' ? 'L' : 'kg'); // weigh by kg (or L); 'each' items are weighed too
  const trimRow = (t = {}) => `<div class="trim-row">
    <input name="tname" placeholder="e.g. Bones, fat" aria-label="Trim" value="${esc(t.name)}">
    <input name="tqty" type="number" min="0" step="any" inputmode="decimal" placeholder="kg" aria-label="Trim weight" value="${esc(t.qty)}">
    <input name="tval" type="number" min="0" step="any" inputmode="decimal" placeholder="$ value" aria-label="Value per kg if reused" value="${esc(t.value)}">
    <button type="button" class="x" aria-label="Remove">×</button></div>`;

  page('pantry', 'Yield test', `
    <form class="card" id="yt" onsubmit="return false">
      <label>Ingredient<select name="ing"><option value="">Choose from Pantry…</option>
        ${ings.map(x => `<option value="${esc(x.id)}" ${x.id === ing?.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="row2">
        <label>Bought <span class="u">${unitOf(ing)}</span><input name="ap" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 5"></label>
        <label>Price per <span class="u">${unitOf(ing)}</span><input name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(ing && hasPrice(ing) ? ing.price : '')}"></label>
      </div>
      <label>Usable after trimming <span class="u">${unitOf(ing)}</span><input name="ep" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 3.6"></label>
      <h2>Trim <small>(optional; add a $ value per kg for anything you reuse, like bones for stock)</small></h2>
      <div id="trims">${trimRow()}</div>
      <button type="button" class="ghost" id="addTrim">+ Add trim</button>
    </form>
    <div id="result"></div>`, { back: ing ? `#/ingredient/${esc(ing.id)}/edit` : '#/pantry' });

  const form = document.getElementById('yt'), out = document.getElementById('result');
  const read = () => ({
    ap: num(form.ap.value), ep: num(form.ep.value), price: num(form.price.value),
    trims: [...form.querySelectorAll('.trim-row')].map(el => ({ name: el.querySelector('[name=tname]').value.trim(), qty: num(el.querySelector('[name=tqty]').value), value: num(el.querySelector('[name=tval]').value) })).filter(t => t.qty > 0),
  });
  const draw = () => {
    const v = read(), y = yieldTest(v), u = unitOf(ing);
    if (!y) {
      out.innerHTML = v.ep > v.ap ? '<p class="warn">Usable weight can’t be more than what you bought.</p>'
        : '<p class="muted center">Enter what you bought and what was usable after trimming.</p>';
      return;
    }
    out.innerHTML = `<div class="card stat-card">
        <p class="stat-label">Yield</p><p class="stat">${pct(y.yieldPct)}</p>
        <p class="stat-sub">Each usable ${u} really costs <b>${money(y.costPerUsable)}</b>${v.price ? `, not ${money(v.price)}` : ''}.</p>
        ${y.overTrim ? '<p class="warn">⚠ Usable weight plus trim is more than you bought. Check the weights.</p>' : ''}
      </div>
      <div class="card"><dl class="kv">
        <dt>Bought</dt><dd>${fmtQty(v.ap)} ${u} at ${money(v.price)}</dd>
        <dt>Total cost</dt><dd>${money(y.totalCost)}</dd>
        ${y.credit ? `<dt>Value of reused trim</dt><dd>− ${money(y.credit)}</dd>` : ''}
        <dt>Usable</dt><dd>${fmtQty(v.ep)} ${u}</dd>
        ${v.trims.map(t => `<dt>${esc(t.name || 'Trim')}</dt><dd>${fmtQty(t.qty)} ${u}</dd>`).join('')}
        <dt>Unaccounted loss</dt><dd>${fmtQty(y.unaccounted)} ${u}</dd>
      </dl>
      ${ing ? `<div class="stack no-print"><button type="button" id="apply">Use ${pct(y.yieldPct)} for ${esc(ing.name)}</button><button type="button" class="ghost" id="print">Print</button></div>
        <p id="applyMsg" class="muted"></p>`
        : '<p class="muted"><small>Choose an ingredient above to save this yield to your Pantry.</small></p>'}</div>`;
  };
  form.addEventListener('input', draw);
  form.ing.addEventListener('change', () => {
    ing = ings.find(x => x.id === form.ing.value) ?? null;
    form.querySelectorAll('.u').forEach(el => { el.textContent = unitOf(ing); });
    if (ing && hasPrice(ing)) form.price.value = ing.price;
    draw();
  });
  document.getElementById('addTrim').onclick = () => document.getElementById('trims').insertAdjacentHTML('beforeend', trimRow());
  document.getElementById('trims').addEventListener('click', e => { if (e.target.matches('.x')) { e.target.closest('.trim-row').remove(); draw(); } });
  out.addEventListener('click', async e => {
    if (e.target.id === 'print') window.print();
    if (e.target.id !== 'apply' || !ing) return;
    const v = read(), y = yieldTest(v);
    const yieldPct = Math.round(y.yieldPct * 10) / 10;
    ing = { ...ing, yieldPct, lastYieldTest: { date: today(), ap: v.ap, ep: v.ep, price: v.price, trims: v.trims, yieldPct }, updatedAt: Date.now() };
    await db.put('ingredients', ing);
    document.getElementById('applyMsg').innerHTML = `<span class="ok-text">Saved. ${esc(ing.name)} now uses ${pct(yieldPct)} yield in every recipe.</span>`;
  });
  draw();
}

// ---------- Order list ----------

async function orderView() {
  const [recipes, ings, saved] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'orderPlan')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  const planRow = (p = {}) => `<div class="plan-row">
    <select name="recipe" aria-label="Recipe"><option value="">Choose recipe…</option>
      ${recipes.map(r => `<option value="${esc(r.id)}" ${r.id === p.recipeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    <input name="portions" type="number" min="0" step="1" inputmode="numeric" placeholder="Portions" aria-label="Portions" value="${esc(p.portions)}">
    <button type="button" class="x" aria-label="Remove">×</button></div>`;
  page('pantry', 'Order list', recipes.length ? `
    <div class="card no-print"><h2>What are you cooking?</h2>
      <div id="plan">${(saved?.rows?.length ? saved.rows : [{}]).map(planRow).join('')}</div>
      <button type="button" class="ghost" id="addPlan">+ Add recipe</button></div>
    <div class="card" id="out"></div>` : '<p class="empty">Add recipes first.</p>', { back: '#/pantry' });
  if (!recipes.length) return;

  const planEl = document.getElementById('plan'), out = document.getElementById('out');
  let onHand = { ...(saved?.onHand ?? {}) }; // ingredientId -> qty in purchase unit
  const readPlan = () => [...planEl.querySelectorAll('.plan-row')].map(el => ({
    recipeId: el.querySelector('[name=recipe]').value, portions: num(el.querySelector('[name=portions]').value),
  }));
  const save = () => db.put('settings', { id: 'orderPlan', rows: readPlan(), onHand });
  const forLine = plan => plan.filter(p => recs.has(p.recipeId) && p.portions > 0).map(p => `${recs.get(p.recipeId).name} ×${p.portions}`).join(', ');
  let shareText = '';

  // Figures that depend on stock are patched in place, so the stock inputs keep focus while typing.
  const update = () => {
    const plan = readPlan(), o = orderList(plan, ings, recs, onHand);
    for (const l of o.lines) {
      const tr = out.querySelector(`li[data-id="${CSS.escape(l.id)}"]`);
      if (!tr) continue;
      tr.querySelector('.order').innerHTML = l.order > 0 ? `<b>${fmtAmount(l.order, l.ing.unit)}</b>` : '<span class="ok-text">In stock</span>';
      tr.querySelector('.cost').textContent = l.order > 0 ? money(l.cost) : '';
    }
    out.querySelector('.total').textContent = money(o.total);
    out.querySelector('.warns').innerHTML = o.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('');
    const toOrder = o.lines.filter(l => l.order > 0);
    shareText = [`Order list, ${new Date().toLocaleDateString('en-AU')}`, `For: ${forLine(plan)}`, '',
      ...(toOrder.length ? toOrder.map(l => `${l.ing.name}: ${fmtAmount(l.order, l.ing.unit)}`) : ['Nothing to order. Everything is in stock.']),
      '', `Est. cost: ${money(o.total)}`].join('\n');
  };

  const draw = () => {
    save();
    const plan = readPlan(), o = orderList(plan, ings, recs, onHand);
    if (!o.lines.length) { out.innerHTML = '<p class="muted">Choose recipes and portions to see what to order.</p>'; return; }
    out.innerHTML = `<h2>To order</h2><p class="muted">For: ${esc(forLine(plan))}</p>
      <ul class="order-rows">${o.lines.map(l => `<li data-id="${esc(l.id)}">
        <div class="grow"><b>${esc(l.ing.name)}</b>
          <small>Need ${fmtAmount(l.usable, l.ing.unit)}${Number(l.ing.yieldPct) < 100 ? `, yield ${esc(l.ing.yieldPct)}%` : ''}</small>
          <label class="have-field">On hand<input class="have" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${esc(l.have || '')}" aria-label="${esc(l.ing.name)} on hand in ${esc(l.ing.unit)}"><span>${esc(l.ing.unit)}</span></label></div>
        <div class="trail"><span class="order"></span><small class="cost"></small></div></li>`).join('')}</ul>
      <div class="total-row"><span>Estimated total</span><b class="total"></b></div>
      <div class="warns"></div>
      <p><small>Order = need ÷ trim yield − on hand. Count stock in the purchase unit (kg, L, each).</small></p>
      <div class="actions no-print"><button type="button" id="share">Share list</button><button type="button" class="ghost" id="print">Print</button><button type="button" class="ghost" id="resetHave">Reset on hand</button></div>`;
    update();
  };

  document.getElementById('addPlan').addEventListener('click', () => { planEl.insertAdjacentHTML('beforeend', planRow()); planEl.lastElementChild.querySelector('select').focus(); });
  planEl.addEventListener('click', e => { if (e.target.matches('.x')) { e.target.closest('.plan-row').remove(); draw(); } });
  planEl.addEventListener('input', draw);
  planEl.addEventListener('change', draw);
  out.addEventListener('input', e => {
    const tr = e.target.closest('li[data-id]');
    if (!tr || !e.target.matches('.have')) return;
    const v = num(e.target.value);
    if (v > 0) onHand[tr.dataset.id] = v; else delete onHand[tr.dataset.id];
    save();
    update();
  });
  out.addEventListener('click', async e => {
    if (e.target.id === 'print') window.print();
    if (e.target.id === 'resetHave' && confirm('Clear all on-hand amounts?')) { onHand = {}; draw(); }
    if (e.target.id !== 'share') return;
    try {
      if (navigator.share) await navigator.share({ title: 'Order list', text: shareText });
      else { await navigator.clipboard.writeText(shareText); e.target.textContent = 'Copied'; }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  });
  draw();
}

// ---------- Log ----------

const PERIODS = ['Breakfast', 'Lunch', 'Dinner', 'Function', 'Prep shift', 'Other'];
const STATIONS = ['Pasta', 'Sauce', 'Grill', 'Larder / Garde manger', 'Pastry', 'Fry', 'Prep', 'Pizza', 'Pass'];

async function logList() {
  const [logs, s] = await Promise.all([db.all('logs'), settings()]);
  logs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const school = logs.filter(l => l.type === 'school').length;
  const work = logs.filter(l => l.type === 'work');
  const hours = work.reduce((n, l) => n + (l.hours || 0), 0);
  const last = [...logs].sort((a, b) => b.createdAt - a.createdAt)[0];
  const doneNow = logs.some(l => l.date === today() && l.period === periodNow());
  page('log', 'Service log', `
    <a class="card quick-log" href="#/log/new/edit">
      <span class="grow"><b>${doneNow ? `${periodNow()} logged. Log another` : `Log today’s ${periodNow().toLowerCase()} service`}</b>
        <small>${last ? esc([last.venue, last.station].filter(Boolean).join(' · ') || 'Same as last time') : 'Takes a few seconds'}</small></span>
      <span class="btn sm">${ICON.plus}Log</span></a>
    <div class="links" role="navigation" aria-label="Log tools"><a href="#/temps">Temp log</a><a href="#/portfolio">Portfolio</a></div>
    <div class="card"><div class="row2">
      <div><small>School service periods</small><div class="big">${school} / ${esc(s.logTarget)}</div>
        <div class="progress"><i style="width:${Math.min(100, school / s.logTarget * 100)}%"></i></div></div>
      <div><small>Work shifts</small><div class="big">${work.length}</div><small>${fmtQty(hours)} hours</small></div>
    </div></div>
    ${logs.length ? `<ul class="list">${logs.map(l => `<li><a href="#/log/${esc(l.id)}/edit">
      ${l.photo ? `<img src="${esc(l.photo)}" alt="">` : `<span class="ph tag ${l.type}">${l.type === 'school' ? 'School' : 'Work'}</span>`}
      <div class="grow"><b>${esc(new Date(l.date + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }))}, ${esc(l.period)}</b>
        <small>${esc([l.venue, l.station].filter(Boolean).join(' · ') || 'No venue')}</small></div>
      ${l.hours ? `<span class="trail">${esc(l.hours)} h</span>` : ''}</a></li>`).join('')}</ul>`
      : '<p class="empty">Log every service: what you cooked, where, and what chef said.</p>'}`);
}

const periodNow = () => { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 15 ? 'Lunch' : 'Dinner'; };

async function logEdit(id) {
  const isNew = id === 'new';
  const logs = await db.all('logs');
  const last = logs.sort((a, b) => b.createdAt - a.createdAt)[0];
  // A new entry starts from your last one (kitchen, station, hours) and the service happening now
  const l = isNew ? { id: uid(), date: today(), type: last?.type ?? 'school', venue: last?.venue ?? '', station: last?.station ?? '', hours: last?.hours ?? null, period: periodNow() }
    : logs.find(x => x.id === id);
  if (!l) return go('#/log');
  page('log', isNew ? 'New service' : 'Edit service', `<form id="f">
    <div class="row2">
      <label>Date<input name="date" type="date" required value="${esc(l.date)}"></label>
      <label>Type<select name="type"><option value="school" ${l.type === 'school' ? 'selected' : ''}>School</option><option value="work" ${l.type === 'work' ? 'selected' : ''}>Work</option></select></label>
    </div>
    <label>Venue<input name="venue" list="venues" placeholder="AMCA kitchen, restaurant name…" value="${esc(l.venue)}"></label>
    ${datalist('venues', logs.map(x => x.venue))}
    <div class="row2">
      <label>Service<select name="period">${opts(PERIODS, l.period)}</select></label>
      <label>Hours<input name="hours" type="number" min="0" step="0.25" inputmode="decimal" value="${esc(l.hours)}"></label>
    </div>
    <label>Station<input name="station" list="stations" value="${esc(l.station)}"></label>
    ${datalist('stations', [...STATIONS, ...logs.map(x => x.station)])}
    <label>Dishes cooked<textarea name="dishes" placeholder="Tagliatelle al ragù ×18…">${esc(l.dishes)}</textarea></label>
    <label>Chef feedback / what to improve<textarea name="feedback">${esc(l.feedback)}</textarea></label>
    ${photoField(l.photo)}
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: '#/log' });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    await db.put('logs', { ...l, date: fd.get('date'), type: fd.get('type'), venue: fd.get('venue').trim(), period: fd.get('period'),
      hours: num(fd.get('hours')), station: fd.get('station').trim(), dishes: fd.get('dishes'), feedback: fd.get('feedback'),
      photo: await photoValue(fd, l.photo), createdAt: l.createdAt ?? Date.now(), updatedAt: Date.now() });
    go('#/log');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this service entry?')) { await db.del('logs', l.id); go('#/log'); }
  });
}

// ---------- Temperature log ----------

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const badge = st => `<span class="badge ${st.status}">${{ pass: 'PASS', fail: 'FAIL', pending: 'OPEN' }[st.status]}</span>`;
const tempValue = e => e.type === 'cooling'
  ? [e.start, e.stage1, e.stage2].filter(r => r?.temp != null && r.temp !== '').map(r => `${r.temp}°`).join(' → ')
  : `${e.temp ?? '-'} °C`;

async function tempList() {
  const temps = (await db.all('temps')).sort((a, b) => b.at.localeCompare(a.at));
  const todays = temps.filter(t => t.at.startsWith(today()));
  const fails = todays.filter(t => tempStatus(t).status === 'fail').length;
  const open = temps.filter(t => tempStatus(t).status === 'pending').length;
  const days = [...new Set(temps.map(t => t.at.slice(0, 10)))];
  page('log', 'Temp log', `
    <div class="card"><div class="row2">
      <div><small>Checks today</small><div class="big">${todays.length}</div></div>
      <div><small>Failed today</small><div class="big ${fails ? 'alert-text' : ''}">${fails}</div></div></div>
      ${open ? `<p class="warn">⚠ ${open} check(s) still open. Finish the cooling readings.</p>` : ''}</div>
    ${days.length ? days.map(d => `<h2 class="day">${esc(new Date(d + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</h2>
      <ul class="list">${temps.filter(t => t.at.startsWith(d)).map(t => {
        const st = tempStatus(t);
        return `<li><a href="#/temp/${esc(t.id)}/edit"><div class="grow"><b>${esc(t.item || TEMP_CHECKS[t.type]?.label)}</b>
          <small>${esc(t.at.slice(11, 16))} · ${esc(TEMP_CHECKS[t.type]?.label ?? t.type)}${t.action ? `<br>Action: ${esc(t.action)}` : ''}</small></div>
          <span class="trail">${esc(tempValue(t))}${badge(st)}</span></a></li>`;
      }).join('')}</ul>`).join('')
      : '<p class="empty">Record fridge, freezer, delivery, hot-holding, cooking and cooling temperatures. Each check is marked PASS or FAIL against food safety limits.</p>'}
    ${temps.length ? '<div class="actions no-print"><button type="button" class="ghost" id="print">Print</button></div>' : ''}`,
    { back: '#/log', action: newBtn('#/temp/new/edit') });
  document.getElementById('print')?.addEventListener('click', () => window.print());
}

async function tempEdit(id) {
  const isNew = id === 'new';
  const temps = await db.all('temps');
  const last = [...temps].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  const t = isNew ? { id: uid(), at: nowLocal(), type: last?.type ?? 'fridge' } : temps.find(x => x.id === id);
  if (!t) return go('#/temps');
  const reading = (key, label, hint) => `<fieldset class="reading"><legend>${label} <small>${hint}</small></legend><div class="row2 tt">
    <label>Time<input name="${key}At" type="datetime-local" value="${esc(t[key]?.at ?? (key === 'start' ? t.at : ''))}"></label>
    <label>°C<input name="${key}Temp" type="number" step="0.1" inputmode="decimal" value="${esc(t[key]?.temp)}"></label></div></fieldset>`;

  page('log', isNew ? 'New temp check' : 'Edit temp check', `<form id="f">
    <label>Check<select name="type">${Object.entries(TEMP_CHECKS).map(([k, c]) => `<option value="${k}" ${k === t.type ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
    <label>Equipment or food<input name="item" list="items" placeholder="Walk-in cool room, Bain-marie, Beef ragù…" value="${esc(t.item)}"></label>
    ${datalist('items', temps.map(x => x.item))}
    <div id="spot" class="row2 tt">
      <label>Time<input name="at" type="datetime-local" value="${esc(t.at)}"></label>
      <label>°C<input name="temp" type="number" step="0.1" inputmode="decimal" value="${esc(t.temp)}"></label></div>
    <div id="cool">${reading('start', 'Start', '~60 °C')}${reading('stage1', 'Stage 1', '≤ 21 °C within 2 h')}${reading('stage2', 'Stage 2', '≤ 5 °C within 6 h of start')}</div>
    <p id="status"></p>
    <label>Corrective action<input name="action" list="actions" placeholder="What you did if it failed" value="${esc(t.action)}"></label>
    ${datalist('actions', ['Discarded food', 'Moved food to another fridge', 'Reheated to 75 °C', 'Adjusted thermostat and rechecked', 'Reported to chef', ...temps.map(x => x.action)])}
    <label>Notes<input name="note" value="${esc(t.note)}"></label>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: '#/temps' });

  const form = document.getElementById('f');
  const read = () => {
    const fd = new FormData(form), type = fd.get('type');
    const rd = k => ({ at: fd.get(k + 'At'), temp: num(fd.get(k + 'Temp')) });
    const e = { ...t, type, item: fd.get('item').trim(), action: fd.get('action').trim(), note: fd.get('note').trim() };
    delete e.start; delete e.stage1; delete e.stage2;
    if (type === 'cooling') {
      Object.assign(e, { start: rd('start'), stage1: rd('stage1'), stage2: rd('stage2'), temp: null });
      e.at = e.start.at || fd.get('at') || nowLocal();
    } else {
      Object.assign(e, { at: fd.get('at') || nowLocal(), temp: num(fd.get('temp')) });
    }
    return e;
  };
  const refresh = () => {
    const e = read(), st = tempStatus(e);
    document.getElementById('spot').hidden = e.type === 'cooling';
    document.getElementById('cool').hidden = e.type !== 'cooling';
    document.getElementById('status').innerHTML = `${badge(st)} ${esc(st.note)}${st.status === 'fail' ? '. Record a corrective action.' : ''}`;
  };
  form.addEventListener('input', e => {
    // Typing a cooling reading stamps its time with now, if blank — no fiddling with date pickers mid-service.
    const m = e.target.name?.match(/^(start|stage1|stage2)Temp$/);
    const at = m && form.querySelector(`[name=${m[1]}At]`);
    if (at && !at.value && e.target.value !== '') at.value = nowLocal();
    refresh();
  });
  form.addEventListener('change', refresh);
  refresh();

  form.onsubmit = async ev => {
    ev.preventDefault();
    const e = read();
    if (tempStatus(e).status === 'fail' && !e.action && !confirm('This check failed and has no corrective action. Save anyway?')) return;
    await db.put('temps', { ...e, createdAt: t.createdAt ?? Date.now(), updatedAt: Date.now() });
    go('#/temps');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this temperature record?')) { await db.del('temps', t.id); go('#/temps'); }
  });
}

// ---------- Portfolio ----------

const monthYear = d => new Date(d + 'T00:00').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });

// Log entries grouped by kitchen, most recent first.
function experience(logs) {
  const m = new Map();
  for (const l of logs) {
    const venue = l.venue || 'Unnamed kitchen', key = venue + '\u0000' + l.type;
    const v = m.get(key) ?? { venue, type: l.type, count: 0, hours: 0, first: l.date, last: l.date, stations: new Set() };
    v.count++;
    v.hours += l.hours || 0;
    if (l.date < v.first) v.first = l.date;
    if (l.date > v.last) v.last = l.date;
    if (l.station) v.stations.add(l.station);
    m.set(key, v);
  }
  return [...m.values()].sort((a, b) => b.last.localeCompare(a.last)).map(v => {
    const a = monthYear(v.first), b = monthYear(v.last);
    return { ...v, stations: [...v.stations], range: a === b ? a : `${a} - ${b}` };
  });
}

async function portfolioView() {
  const [recipes, logs, ings, s, saved] = await Promise.all([db.all('recipes'), db.all('logs'), ingMap(), settings(), db.get('settings', 'portfolio')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let pf = { headline: '', contact: '', bio: '', recipeIds: [], showCosting: false, ...saved, id: 'portfolio' };
  const srcLabel = { school: 'Training', work: 'Work', own: 'Original', web: 'Web recipe' };

  page('log', 'Portfolio', `
    <details class="card no-print" ${pf.recipeIds.length ? '' : 'open'}><summary>Your details</summary>
      <form id="pf">
        <p class="muted">Name: ${s.cookName ? `<b>${esc(s.cookName)}</b> (from Settings)` : '<a href="#/settings">add your name in Settings</a>'}</p>
        <label>Headline<input name="headline" placeholder="Commis chef · Cert IV Kitchen Management" value="${esc(pf.headline)}"></label>
        <label>Contact<input name="contact" placeholder="email · phone · Instagram" value="${esc(pf.contact)}"></label>
        <label>About me<textarea name="bio" placeholder="What you cook, what you're learning, what you're looking for.">${esc(pf.bio)}</textarea></label>
        <h2>Featured dishes</h2>
        ${recipes.length ? `<div class="checks">${recipes.map(r => `<label><input type="checkbox" name="recipeIds" value="${esc(r.id)}" ${pf.recipeIds.includes(r.id) ? 'checked' : ''}> ${esc(r.name)}${r.photo ? '' : ' <small>(no photo)</small>'}</label>`).join('')}</div>`
          : '<p class="muted">No recipes yet.</p>'}
        <label class="inline" style="margin-top:12px"><input type="checkbox" name="showCosting" ${pf.showCosting ? 'checked' : ''}> Show costing on dishes</label>
      </form></details>
    <div class="sheet-wrap"><article class="sheet portfolio" id="sheet"></article></div>
    <div class="cta-bar no-print"><button id="print">Print or save as PDF</button></div>`, { back: '#/log' });

  const sheet = document.getElementById('sheet'), form = document.getElementById('pf');
  const dish = r => {
    const c = recipeCost(r, ings, recs);
    const costing = pf.showCosting && !c.problems.length
      ? (r.menuPrice ? `Food cost ${pct(actualCostPct(c.perPortion, r.menuPrice))}` : `${money(c.perPortion)} / portion`) : '';
    return `<figure class="dish">${r.photo ? `<img src="${esc(r.photo)}" alt="${esc(r.name)}">` : ''}
      <figcaption><b>${esc(r.name)}</b><small>${[r.category, srcLabel[r.source], costing].filter(Boolean).map(esc).join(' · ')}</small></figcaption></figure>`;
  };
  const draw = () => {
    const featured = recipes.filter(r => pf.recipeIds.includes(r.id));
    const school = logs.filter(l => l.type === 'school').length, work = logs.filter(l => l.type === 'work').length;
    const hours = logs.reduce((n, l) => n + (l.hours || 0), 0);
    const exp = experience(logs);
    sheet.innerHTML = `
      <div class="sheet-head"><div><p class="eyebrow">Culinary portfolio</p><h1>${esc(s.cookName || 'Your name')}</h1>
        ${pf.headline ? `<p><b>${esc(pf.headline)}</b></p>` : ''}${pf.contact ? `<p class="muted">${esc(pf.contact)}</p>` : ''}</div></div>
      ${pf.bio ? `<p class="bio">${esc(pf.bio)}</p>` : ''}
      <div class="stats">
        <div><b>${school}</b><small>school service periods</small></div><div><b>${work}</b><small>work shifts</small></div>
        <div><b>${fmtQty(hours)}</b><small>hours logged</small></div><div><b>${recipes.length}</b><small>recipes in my book</small></div></div>
      ${exp.length ? `<h2>Kitchen experience</h2><ul class="exp">${exp.map(v => `<li><b>${esc(v.venue)}</b> <small>· ${v.type === 'school' ? 'Training kitchen' : 'Work'}</small><br>
        <small>${esc(v.range)} · ${v.count} services${v.hours ? ` · ${fmtQty(v.hours)} h` : ''}${v.stations.length ? ` · ${v.stations.map(esc).join(', ')}` : ''}</small></li>`).join('')}</ul>` : ''}
      ${featured.length ? `<h2>Featured dishes</h2><div class="dishes">${featured.map(dish).join('')}</div>` : ''}
      <p class="sheet-foot">Made with Pinch · ${new Date().toLocaleDateString('en-AU')}</p>`;
    sheet.style.zoom = Math.min(1, sheet.parentElement.clientWidth / sheet.offsetWidth).toFixed(3);
  };

  form.addEventListener('input', () => {
    const fd = new FormData(form);
    pf = { ...pf, headline: fd.get('headline').trim(), contact: fd.get('contact').trim(), bio: fd.get('bio'),
      recipeIds: fd.getAll('recipeIds'), showCosting: !!fd.get('showCosting') };
    db.put('settings', pf);
    draw();
  });
  document.getElementById('print').onclick = () => window.print();
  draw();
}

// ---------- Password reset (from the emailed link) ----------

let recovery = null;

async function resetView() {
  if (!recovery) return go('#/settings');
  if (recovery.error) {
    page('settings', 'Reset password', `<div class="card"><p class="warn">⚠ ${esc(recovery.error)}</p>
      <p>Reset links work once and expire after a while. Request a new one from <a href="#/settings">Settings → Forgot password?</a></p></div>`);
    return;
  }
  page('settings', 'Reset password', `<form class="card" id="rp">
    <label>New password <small>(8+ characters)</small><input name="p1" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Repeat new password<input name="p2" type="password" autocomplete="new-password" minlength="8" required></label>
    <button type="submit">Set new password</button> <p id="rpMsg" class="muted"></p></form>`);
  const f = document.getElementById('rp'), msg = document.getElementById('rpMsg');
  f.onsubmit = async e => {
    e.preventDefault();
    if (f.p1.value !== f.p2.value) { msg.textContent = 'The passwords don’t match.'; return; }
    f.querySelector('button').disabled = true;
    msg.textContent = 'Saving…';
    try {
      // In the installed app, sign straight in. In a browser tab (e.g. iPhone opens email links in Safari),
      // only change the password: the recipes live in the installed app.
      await sync.finishReset(recovery, f.p1.value, standalone());
      recovery = null;
      f.outerHTML = standalone()
        ? '<div class="card"><p>Password updated. You’re signed in.</p><p><a class="btn" href="#/recipes">Go to my recipes</a></p></div>'
        : '<div class="card"><p><b>Password updated.</b></p><p>Now open Pinch from your home screen and sign in with the new password.</p></div>';
    } catch (err) {
      msg.textContent = err.status === 401 || err.status === 403
        ? 'This reset link is no longer valid. Request a new one from Settings → Forgot password?' : err.message;
      f.querySelector('button').disabled = false;
    }
  };
}

// ---------- Settings ----------

// Account card; redrawn on sync status changes while Settings is open.
let drawAccount = () => {};

async function settingsView() {
  const s = await settings();
  const est = await navigator.storage?.estimate?.().catch(() => null);
  page('settings', 'Settings', `
    <div class="card" id="acct"></div>
    <form id="f" class="card">
      <h2>You</h2>
      <label>Your name <small>(shown on recipe cards)</small><input name="cookName" autocomplete="name" value="${esc(s.cookName)}"></label>
      <label>Default target food cost %<input name="targetCostPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(s.targetCostPct)}"></label>
      <label>School service periods required<input name="logTarget" type="number" min="1" step="1" inputmode="numeric" required value="${esc(s.logTarget)}"></label>
      <button type="submit">Save</button> <span id="saved" class="muted"></span>
    </form>
    <div class="card"><h2>Backup</h2>
      <p class="muted">A backup file is a copy you keep yourself, in Files, Drive or email.</p>
      <p>Last backup: <b>${s.lastBackup ? esc(new Date(s.lastBackup).toLocaleString()) : 'never'}</b>${est ? ` · Using ${(est.usage / 1e6).toFixed(1)} MB` : ''}</p>
      <div class="actions"><button id="export">Export backup</button><label class="btn ghost">Import<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <form class="card" id="fb">
      <h2>Feedback</h2>
      <label>What's missing, confusing or broken?<textarea name="message" maxlength="2000" required placeholder="e.g. I'd like to…"></textarea></label>
      <button type="submit">Send feedback</button> <span id="fbMsg" class="muted"></span>
    </form>
    <div class="card"><h2>Invite classmates</h2><p class="muted">Pinch is free. Share the link. Everyone gets their own private recipe book.</p>
      <button type="button" class="ghost" id="invite">Share Pinch</button> <span id="inviteMsg" class="muted"></span></div>
    <p class="muted center"><small>Pinch v19</small></p>`);

  const acct = document.getElementById('acct');
  drawAccount = () => {
    if (!acct.isConnected) return;
    if (db.DEMO) { acct.innerHTML = '<h2>Account &amp; sync</h2><p class="muted">Turned off in the demo. <a href="./">Open Pinch</a> to use your own data.</p>'; return; }
    const st = sync.status();
    const err = st.error ? `<p class="warn">⚠ ${esc(st.error)}</p>` : '';
    acct.innerHTML = st.email ? `<h2>Account &amp; sync</h2>
      <p>Signed in as <b>${esc(st.email)}</b></p>
      <p class="muted">${st.syncing ? 'Syncing…' : st.lastSync ? `Last synced ${esc(new Date(st.lastSync).toLocaleString('en-AU'))}` : 'Not synced yet'}</p>${err}
      <div class="actions"><button type="button" id="syncNow">Sync now</button><button type="button" class="ghost" id="signOut">Sign out</button></div>`
    : `<h2>Account &amp; sync</h2>
      <p class="muted">Optional. Sign in to back up to the cloud and use Pinch on more than one device. Without an account, data stays on this phone only.</p>${err}
      <form id="auth">
        <label>Email<input name="email" type="email" autocomplete="username" required></label>
        <label>Password <small>(8+ characters)</small><input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <div class="actions"><button type="submit" value="in">Sign in</button><button type="submit" class="ghost" value="up">Create account</button></div>
        <p><button type="button" class="link" id="forgot">Forgot password?</button></p>
        <p id="authMsg" class="muted"></p>
      </form>
      <p><small>Synced data is stored with Supabase in Sydney. Only you can read it.</small></p>`;
  };
  acct.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target), up = e.submitter?.value === 'up';
    const msg = acct.querySelector('#authMsg'), buttons = acct.querySelectorAll('button');
    msg.textContent = up ? 'Creating account…' : 'Signing in…';
    buttons.forEach(b => { b.disabled = true; });
    try {
      await (up ? sync.signUp : sync.signIn)(fd.get('email').trim(), fd.get('password'));
      drawAccount();
    } catch (err) {
      msg.textContent = err.message;
      buttons.forEach(b => { b.disabled = false; });
    }
  });
  acct.addEventListener('click', async e => {
    if (e.target.id === 'syncNow') sync.sync();
    if (e.target.id === 'forgot') {
      const email = acct.querySelector('[name=email]'), msg = acct.querySelector('#authMsg');
      if (!email.value.trim()) { msg.textContent = 'Enter your email first, then tap Forgot password.'; email.focus(); return; }
      msg.textContent = 'Sending…';
      try {
        await sync.sendReset(email.value.trim());
        msg.textContent = 'If there is an account for that email, a reset link is on its way. Open it on this phone.';
      } catch (err) { msg.textContent = err.message; }
    }
    if (e.target.id === 'signOut' && confirm('Sign out? Your data stays on this phone.')) await sync.signOut();
  });
  drawAccount();

  const fb = document.getElementById('fb');
  fb.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('fbMsg'), button = fb.querySelector('button');
    button.disabled = true;
    msg.textContent = 'Sending…';
    try {
      await sync.sendFeedback(fb.message.value.trim(), `${standalone() ? 'installed' : 'browser'} · ${navigator.userAgent}`.slice(0, 500));
      fb.reset();
      msg.textContent = 'Thanks, got it!';
    } catch (err) {
      msg.textContent = navigator.onLine ? 'Could not send: ' + err.message : 'You are offline. Try again later.';
    } finally { button.disabled = false; }
  });
  document.getElementById('invite').onclick = async () => {
    const text = 'Pinch: free recipe costing, order lists and a service log for cooks. Open it on your phone and add it to your home screen.';
    try {
      if (navigator.share) await navigator.share({ title: 'Pinch', text, url: APP_URL });
      else { await navigator.clipboard.writeText(`${text} ${APP_URL}`); document.getElementById('inviteMsg').textContent = 'Link copied'; }
    } catch (err) { if (err.name !== 'AbortError') throw err; }
  };

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    await db.put('settings', { ...s, id: 'settings', targetCostPct: num(fd.get('targetCostPct')), logTarget: num(fd.get('logTarget')), cookName: fd.get('cookName').trim() });
    document.getElementById('saved').textContent = 'Saved';
  };

  document.getElementById('export').onclick = async () => {
    const file = new File([JSON.stringify(await db.exportAll())], `pinch-backup-${today()}.json`, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name }).click();
    } catch (err) {
      if (err.name === 'AbortError') return; // user closed the share sheet
      throw err;
    }
    await db.put('settings', { ...(await settings()), id: 'settings', lastBackup: Date.now() });
    settingsView();
  };

  document.getElementById('import').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('Replace ALL data on this phone with this backup?')) return;
      await db.importAll(data);
      alert('Backup restored.');
      go('#/recipes');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
}

// ---------- Sample data ----------

async function loadSample() {
  const I = (id, name, unit, price, yieldPct, allergens = []) => db.put('ingredients', { id, name, unit, price, yieldPct, allergens });
  await Promise.all([
    I('s-tom', 'Tomatoes, canned whole', 'kg', 4.2, 100),
    I('s-oil', 'Olive oil, extra virgin', 'L', 12, 100),
    I('s-gar', 'Garlic', 'kg', 18, 85),
    I('s-oni', 'Onion, brown', 'kg', 3, 90),
    I('s-bas', 'Basil, bunch', 'each', 3.5, 70),
    I('s-flo', 'Flour, tipo 00', 'kg', 2.8, 100, ['Gluten', 'Wheat']),
    I('s-egg', 'Eggs, free range', 'each', 0.6, 100, ['Egg']),
    I('s-par', 'Parmigiano Reggiano', 'kg', 45, 90, ['Milk']),
  ]);
  const t = Date.now();
  await db.put('recipes', { id: 's-pomo', name: 'Pomodoro sauce', category: 'Sauce', source: 'school', portions: 10, targetCostPct: null, menuPrice: null, yieldQty: 2.2, yieldUnit: 'L',
    items: [{ ingredientId: 's-tom', qty: 2500, unit: 'g' }, { ingredientId: 's-oil', qty: 150, unit: 'ml' }, { ingredientId: 's-gar', qty: 40, unit: 'g' },
      { ingredientId: 's-oni', qty: 300, unit: 'g' }, { ingredientId: 's-bas', qty: 1, unit: 'each' }],
    method: '1. Sweat onion and garlic in olive oil, no colour.\n2. Add crushed tomatoes, simmer 45 min.\n3. Finish with torn basil. Season.', createdAt: t, updatedAt: t });
  await db.put('recipes', { id: 's-pasta', name: 'Fresh egg pasta', category: 'Pasta', source: 'school', portions: 6, targetCostPct: null, menuPrice: null, yieldQty: 0.9, yieldUnit: 'kg',
    items: [{ ingredientId: 's-flo', qty: 600, unit: 'g' }, { ingredientId: 's-egg', qty: 6, unit: 'each' }, { ingredientId: 's-par', qty: 60, unit: 'g' }],
    method: '1. Well the flour, add eggs, bring together.\n2. Knead 10 min until smooth. Rest 30 min wrapped.\n3. Roll to setting 6, cut.', createdAt: t, updatedAt: t });
  await db.put('recipes', { id: 's-tag', name: 'Tagliatelle al pomodoro', category: 'Main', source: 'school', portions: 1, targetCostPct: null, menuPrice: 26,
    items: [{ recipeId: 's-pasta', qty: 150, unit: 'g' }, { recipeId: 's-pomo', qty: 180, unit: 'ml' }, { ingredientId: 's-par', qty: 15, unit: 'g' },
      { ingredientId: 's-oil', qty: 10, unit: 'ml' }],
    method: '1. Cook tagliatelle 2 min in salted boiling water.\n2. Toss with hot pomodoro and a splash of pasta water.\n3. Plate, finish with parmigiano and olive oil.', createdAt: t, updatedAt: t });
}

// Demo (?demo): sample recipes plus log, temps, order plan and portfolio, dated relative to today.
// Dish "photos" are simple drawn SVG plates, so the demo ships no third-party images.
const plate = inner => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#e6d8c1"/><circle cx="200" cy="150" r="128" fill="#d9cbb3"/>
  <circle cx="200" cy="146" r="124" fill="#fbf8f2"/><circle cx="200" cy="146" r="96" fill="#fffdf9" stroke="#ece5d8" stroke-width="3"/>${inner}</svg>`);
const strands = (color, n = 7) => `<g fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round">${Array.from({ length: n }, (_, i) =>
  `<ellipse cx="${196 + (i % 3) * 4}" cy="${144 + (i % 2) * 5}" rx="${30 + i * 7}" ry="${22 + i * 5}" transform="rotate(${i * 26} 200 146)" stroke-dasharray="${60 + i * 9} 24"/>`).join('')}</g>`;
const DEMO_ART = {
  pomo: plate(`<circle cx="200" cy="146" r="78" fill="#b3321d"/><circle cx="188" cy="136" r="52" fill="#cc4a2c"/>
    <ellipse cx="226" cy="118" rx="16" ry="8" fill="#3f7d3a" transform="rotate(-30 226 118)"/><ellipse cx="244" cy="130" rx="14" ry="7" fill="#4c8f45" transform="rotate(20 244 130)"/>`),
  pasta: plate(`${strands('#eed27a', 8)}<g fill="#fff"><circle cx="160" cy="110" r="3"/><circle cx="240" cy="180" r="3"/><circle cx="250" cy="105" r="2.5"/><circle cx="150" cy="185" r="2.5"/></g>`),
  tag: plate(`${strands('#efcf6e', 7)}<path d="M160 130 q40 -40 80 0 q10 40 -40 45 q-50 -5 -40 -45z" fill="#c23d24"/>
    <g fill="#fff6dc"><rect x="186" y="128" width="8" height="5" rx="1"/><rect x="210" y="140" width="7" height="5" rx="1"/><rect x="196" y="152" width="8" height="4" rx="1"/><rect x="222" y="126" width="6" height="4" rx="1"/></g>
    <ellipse cx="236" cy="112" rx="13" ry="7" fill="#3f7d3a" transform="rotate(-25 236 112)"/>`),
};

async function loadDemo() {
  await loadSample();
  for (const [id, art] of [['s-pomo', DEMO_ART.pomo], ['s-pasta', DEMO_ART.pasta], ['s-tag', DEMO_ART.tag]]) {
    await db.put('recipes', { ...(await db.get('recipes', id)), photo: art });
  }
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
  const at = hoursAgo => { const d = new Date(Date.now() - hoursAgo * 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const t = Date.now();
  const L = (n, type, venue, period, station, hours, dishes, feedback) =>
    db.put('logs', { id: `d-log-${n}`, date: day(n), type, venue, period, station, hours, dishes, feedback, createdAt: t - n });
  await L(40, 'school', 'AMCA training kitchen', 'Lunch', 'Pasta', 4, 'Tagliatelle al pomodoro ×18', 'Good pasta texture. Season the water more.');
  await L(33, 'school', 'AMCA training kitchen', 'Dinner', 'Sauce', 4, 'Pomodoro, ragù', 'Reduce the sauce further before service.');
  await L(26, 'school', 'AMCA training kitchen', 'Lunch', 'Larder / Garde manger', 4, 'Caprese, bruschetta ×24', 'Clean station, good speed.');
  await L(19, 'work', 'Trattoria Nonna (casual)', 'Dinner', 'Pasta', 5.5, 'Tagliatelle, gnocchi ×60', 'Keep the pass wiped between plates.');
  await L(12, 'school', 'AMCA training kitchen', 'Dinner', 'Pastry', 4, 'Tiramisu ×20', 'Mascarpone mix was perfect.');
  await L(9, 'work', 'Trattoria Nonna (casual)', 'Dinner', 'Larder / Garde manger', 6, 'Antipasti boards ×35', 'Faster plating this week.');
  await L(5, 'school', 'AMCA training kitchen', 'Lunch', 'Pass', 4, 'Expo for 40 covers', 'Called tickets clearly.');
  await L(2, 'work', 'Trattoria Nonna (casual)', 'Dinner', 'Pasta', 6, 'Tagliatelle al pomodoro ×42', '');
  const T = (id, hoursAgo, type, item, temp, action = '') => db.put('temps', { id, at: at(hoursAgo), type, item, temp, action, note: '', createdAt: t });
  await T('d-t1', 5, 'fridge', 'Walk-in cool room', 3.2);
  await T('d-t2', 5, 'freezer', 'Chest freezer', -18);
  await T('d-t3', 4.5, 'delivery_chilled', 'Dairy delivery', 4);
  await T('d-t4', 3, 'fridge', 'Dessert fridge', 6.5, 'Moved food to another fridge; reported to chef');
  await T('d-t5', 1, 'hot_hold', 'Bain-marie, ragù', 67);
  await db.put('temps', { id: 'd-t6', type: 'cooling', item: 'Beef ragù (10 L)', at: at(2.5), temp: null, action: '', note: '',
    start: { at: at(2.5), temp: 63 }, stage1: { at: at(0.8), temp: 19 }, stage2: { at: '', temp: null }, createdAt: t });
  await db.put('attempts', { id: 'd-a1', recipeId: 's-tag', date: day(12), rating: 3, photo: DEMO_ART.tag, createdAt: t - 12,
    notes: 'Pasta slightly overcooked, sauce a bit thin.', next: 'Pull the pasta at 90 seconds and finish it in the sauce.' });
  await db.put('attempts', { id: 'd-a2', recipeId: 's-tag', date: day(3), rating: 4, photo: DEMO_ART.tag, createdAt: t - 3,
    notes: 'Much better texture. Chef liked the gloss on the sauce.', next: 'Season the pasta water more; it tasted flat.' });
  await db.put('menus', { id: 'd-menu', name: 'Pasta bar lunch', period: 'Last week', createdAt: t, updatedAt: t,
    items: [{ recipeId: 's-tag', price: 26, sold: 48 }, { recipeId: 's-pasta', price: 9, sold: 6 }, { recipeId: 's-pomo', price: 12, sold: 30 }] });
  await db.put('exams', { id: 'd-exam', title: 'Practical: fresh pasta and sauce', date: day(-9), type: 'practical', recipeIds: ['s-tag', 's-pasta'], target: 3, createdAt: t });
  await db.put('settings', { ...(await settings()), id: 'settings', cookName: 'Demo Cook' });
  await db.put('settings', { id: 'orderPlan', rows: [{ recipeId: 's-tag', portions: 40 }, { recipeId: 's-pomo', portions: 10 }], onHand: { 's-tom': 5.5, 's-oni': 10 } });
  await db.put('settings', { id: 'portfolio', headline: 'Commis chef · Cert IV Kitchen Management', contact: 'demo@example.com',
    bio: 'Italian-trained cook focused on fresh pasta and sauces. I cost my recipes, plan prep and keep food safety records.',
    recipeIds: ['s-pasta', 's-pomo', 's-tag'], showCosting: true });
}

// ---------- Router ----------

const routes = [
  [/^#\/recipes$/, recipeList],
  [/^#\/allergens$/, allergenChart],
  [/^#\/recipe\/([^/]+)$/, recipeView],
  [/^#\/recipe\/([^/]+)\/edit$/, recipeEdit],
  [/^#\/recipe\/([^/]+)\/card$/, recipeCard],
  [/^#\/recipe\/([^/]+)\/cook$/, cookView],
  [/^#\/recipe\/([^/]+)\/scale$/, scaleView],
  [/^#\/recipe\/([^/]+)\/attempt$/, id => attemptEdit(id, null)],
  [/^#\/attempt\/([^/]+)\/edit$/, id => attemptEdit(null, id)],
  [/^#\/calc$/, calcView],
  [/^#\/timers$/, timersView],
  [/^#\/exam\/([^/]+)\/edit$/, examEdit],
  [/^#\/prep$/, prepView],
  [/^#\/menus$/, menusView],
  [/^#\/menu\/([^/]+)$/, menuView],
  [/^#\/menu\/([^/]+)\/allergens$/, allergenMenuView],
  [/^#\/study$/, studyHome],
  [/^#\/study\/deck\/([^/]+)$/, deckView],
  [/^#\/study\/go(?:\/([^/]+))?$/, id => studySession(id === 'undefined' ? null : id)],
  [/^#\/pantry$/, pantryList],
  [/^#\/order$/, orderView],
  [/^#\/pantry\/import$/, importPrices],
  [/^#\/costwatch$/, costWatchView],
  [/^#\/yield(?:\/([^/]+))?$/, yieldView],
  [/^#\/ingredient\/([^/]+)\/edit$/, ingredientEdit],
  [/^#\/log$/, logList],
  [/^#\/log\/([^/]+)\/edit$/, logEdit],
  [/^#\/portfolio$/, portfolioView],
  [/^#\/temps$/, tempList],
  [/^#\/temp\/([^/]+)\/edit$/, tempEdit],
  [/^#\/settings$/, settingsView],
  [/^#\/reset$/, resetView],
];

async function render() {
  const h = location.hash;
  if (!h.endsWith('/cook')) keepAwake(false);
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) return fn(...m.slice(1).map(decodeURIComponent));
  }
  go('#/recipes');
}

window.addEventListener('hashchange', render);
window.addEventListener('unhandledrejection', e => alert('Something went wrong: ' + (e.reason?.message ?? e.reason)));
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// After a sync brings in changes, refresh read-only screens (never a form mid-edit).
sync.onStatus(st => {
  drawAccount();
  if (st.changed && !/\/edit|order|portfolio|card|settings/.test(location.hash)) render();
});
recovery = sync.readRecoveryHash();
if (recovery) history.replaceState(null, '', location.pathname + location.search + '#/reset'); // drop tokens from the URL
if (db.DEMO && !(await db.all('recipes')).length) await loadDemo();
render();
sync.sync();
