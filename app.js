import * as db from './db.js';
import * as sync from './sync.js';
import { ALLERGENS, PURCHASE_UNITS, UNITS, recipeCost, itemCost, suggestedPrice, actualCostPct, recipeAllergens, usesRecipe, hasPrice, orderList, fmtAmount, TEMP_CHECKS, tempStatus, money, pct } from './calc.js';

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

function page(tab, title, body, { back, action = '' } = {}) {
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  view.innerHTML = `${db.DEMO ? '<div class="demo-bar">Demo with sample data · <a href="./">Open Pinch</a></div>' : ''}<header>${back ? `<a class="back" href="${back}" aria-label="Back">‹</a>` : ''}<h1>${esc(title)}</h1>${action}</header><main>${body}</main>`;
  window.scrollTo(0, 0);
}

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

const costLine = c => `${money(c.perPortion)} / portion${c.problems.length ? ' · <span class="warn-text">⚠ incomplete</span>' : ''}`;

async function recipeList() {
  const [recipes, ings] = await Promise.all([db.all('recipes'), ingMap()]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
  page('recipes', 'Recipes', recipes.length ? `
    <div class="bar"><input type="search" id="q" placeholder="Search recipes" aria-label="Search recipes">
      <select id="cat" aria-label="Category"><option value="">All</option>${opts(cats)}</select></div>
    <p><a href="#/allergens">Allergen chart →</a></p>
    <ul class="list">${recipes.map(r => `<li data-q="${esc(r.name.toLowerCase())}" data-cat="${esc(r.category)}"><a href="#/recipe/${esc(r.id)}">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : '<span class="ph"></span>'}
      <div><b>${esc(r.name)}</b><small>${esc(r.category || 'Uncategorised')} · ${costLine(recipeCost(r, ings, recs))}</small></div></a></li>`).join('')}</ul>`
    : `<div class="card welcome"><h2>Welcome to Pinch</h2>
        <ol class="steps">
          <li><b>Write a recipe.</b> Type ingredients as you go — cost per portion, allergens and a recipe card are worked out for you.</li>
          <li><b>Add prices</b> in <a href="#/pantry">Pantry</a> whenever you have them.</li>
          <li><b>Log your services</b> in <a href="#/log">Log</a> — it builds your portfolio.</li>
        </ol>
        <div class="actions"><a class="btn" href="#/recipe/new/edit">Write your first recipe</a><button class="ghost" id="sample">Load sample recipes</button></div></div>
      ${standalone() ? '' : `<div class="card"><h2>Install on your phone</h2><p class="muted">${/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? 'In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. Then always open Pinch from its icon.'
        : 'In Chrome, tap <b>⋮</b> → <b>Install app</b> (or Add to Home screen).'}</p></div>`}
      <p class="muted center">Already use Pinch on another device? <a href="#/settings">Sign in</a> to bring your recipes over.</p>`,
    { action: '<a class="btn" href="#/recipe/new/edit">+ New</a>' });

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
  const [ings, s, recipes] = await Promise.all([ingMap(), settings(), db.all('recipes')]);
  const recs = toMap(recipes);
  const c = recipeCost(r, ings, recs);
  const target = r.targetCostPct || s.targetCostPct;
  const price = suggestedPrice(c.perPortion, target);
  const allergens = recipeAllergens(r, ings, recs);
  const usedIn = recipes.filter(x => usesRecipe(x, r.id)).sort(byName);

  page('recipes', r.name, `
    ${r.photo ? `<img class="hero" src="${esc(r.photo)}" alt="">` : ''}
    <p class="muted">${esc(r.category || 'Uncategorised')} · ${esc({ school: 'From school', work: 'From work', own: 'My own' }[r.source] || '')}${r.yieldQty ? ` · Yields ${esc(r.yieldQty)} ${esc(r.yieldUnit)}` : ''}</p>
    ${usedIn.length ? `<p class="muted">Used in: ${usedIn.map(x => `<a href="#/recipe/${esc(x.id)}">${esc(x.name)}</a>`).join(', ')}</p>` : ''}
    <div class="card"><h2>Allergens</h2>${allergens.length
      ? `<div class="chips">${allergens.map(a => `<span class="chip alert">${a}</span>`).join('')}</div>`
      : '<p class="muted">None declared in Pantry.</p>'}
      <small>Based on Pantry data. Always check supplier labels.</small></div>
    <div class="card"><h2>Costing</h2><dl class="kv">
      <dt>Batch cost (${esc(portionsLabel(r.portions))})</dt><dd>${money(c.total)}</dd>
      <dt>Cost per portion</dt><dd class="big">${money(c.perPortion)}</dd>
      <dt>Target food cost</dt><dd>${pct(target)}</dd>
      <dt>Suggested price ex GST</dt><dd>${money(price.ex)}</dd>
      <dt>Suggested menu price inc GST</dt><dd class="big">${money(price.inc)}</dd>
      ${r.menuPrice ? `<dt>Menu price inc GST</dt><dd>${money(r.menuPrice)}</dd><dt>Actual food cost</dt><dd class="big">${pct(actualCostPct(c.perPortion, r.menuPrice))}</dd>` : ''}
    </dl>${c.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('')}
      <a class="btn ghost wide" href="#/recipe/${esc(r.id)}/card">Costed recipe card (PDF)</a></div>
    <div class="card"><h2>Ingredients</h2>
      <label class="inline">Scale to <input type="number" id="scale" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"> portions</label>
      <table><tbody id="items"></tbody></table></div>
    ${r.method ? `<div class="card"><h2>Method</h2><div class="method">${esc(r.method)}</div></div>` : ''}`,
    { back: '#/recipes', action: `<a class="btn ghost" href="#/recipe/${esc(r.id)}/edit">Edit</a>` });

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
      return `<tr><td>${name}</td><td class="n">${fmtQty(it.qty * f)} ${esc(it.unit)}</td><td class="n muted">${money(cost)}</td></tr>`;
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
  const sourceLabel = { school: 'School', work: 'Work', own: 'Own recipe' }[r.source] || '';

  page('recipes', 'Recipe card', `
    <div class="no-print bar"><label class="inline">Portions <input type="number" id="cp" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"></label>
      <button id="print">Print / Save PDF</button></div>
    <div class="sheet-wrap"><article class="sheet" id="sheet"></article></div>`, { back: `#/recipe/${esc(r.id)}` });

  const cp = document.getElementById('cp'), sheet = document.getElementById('sheet');
  const draw = () => {
    const portions = Number(cp.value) || r.portions, f = portions / r.portions;
    const c = recipeCost(r, ings, recs);
    const price = suggestedPrice(c.perPortion, target);
    const allergens = recipeAllergens(r, ings, recs);
    const rows = (r.items ?? []).map(it => {
      const cost = itemCost(it, ings, recs, new Set([r.id])).cost * f;
      const sub = it.recipeId && recs.get(it.recipeId);
      let name, unitPrice = '—', yieldPct = '—';
      if (sub) {
        const sc = recipeCost(sub, ings, recs, new Set([r.id, sub.id]));
        name = `${esc(sub.name)} <small>(sub-recipe)</small>`;
        unitPrice = sub.yieldQty > 0 ? `${money(sc.total / sub.yieldQty)}/${esc(sub.yieldUnit)}` : `${money(sc.perPortion)}/portion`;
      } else {
        const ing = ings.get(it.ingredientId);
        name = esc(ing?.name ?? '(deleted)');
        if (ing) { unitPrice = `${money(ing.price)}/${esc(ing.unit)}`; yieldPct = `${esc(ing.yieldPct)}%`; }
      }
      return `<tr><td>${name}</td><td class="n">${fmtQty(it.qty * f)}</td><td>${esc(it.unit)}</td><td class="n">${unitPrice}</td><td class="n">${yieldPct}</td><td class="n">${money(cost)}</td></tr>`;
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

  page('recipes', isNew ? 'New recipe' : 'Edit recipe', `<form id="f">
    <label>Name<input name="name" required value="${esc(r.name)}"></label>
    <div class="row2">
      <label>Category<input name="category" list="cats" placeholder="Pasta, Sauce…" value="${esc(r.category)}"></label>
      <label>Source<select name="source">${[['school', 'School'], ['work', 'Work'], ['own', 'My own']].map(([v, l]) => `<option value="${v}" ${v === r.source ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${datalist('cats', recipes.map(x => x.category))}
    <div class="row2">
      <label>Portions<input name="portions" type="number" min="1" step="1" inputmode="numeric" required value="${esc(r.portions)}"></label>
      <label>Target food cost %<input name="targetCostPct" type="number" min="1" max="100" step="any" inputmode="decimal" placeholder="${s.targetCostPct}" value="${esc(r.targetCostPct)}"></label>
    </div>
    <label>Menu price inc GST (optional)<input name="menuPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(r.menuPrice)}"></label>
    <div class="row2">
      <label>Batch yield <small>(to use as sub-recipe by weight/volume)</small><input name="yieldQty" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 2.2" value="${esc(r.yieldQty)}"></label>
      <label>Yield unit<select name="yieldUnit">${opts(['L', 'ml', 'kg', 'g'], r.yieldUnit ?? 'L')}</select></label>
    </div>
    <h2>Ingredients</h2>
    <datalist id="ingOpts">${ingList.map(i => `<option value="${esc(i.name)}">`).join('')}${subs.map(x => `<option value="${esc(x.name + SUB)}">`).join('')}</datalist>
    <div id="rows">${(r.items.length ? r.items : [{}]).map(row).join('')}</div>
    <p><small>Type any ingredient. New ones are added to Pantry when you save — fill in prices later.</small></p>
    <button type="button" class="ghost" id="add">+ Add ingredient</button>
    <label style="margin-top:16px">Method<textarea name="method" placeholder="1. …">${esc(r.method)}</textarea></label>
    ${photoField(r.photo)}
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: isNew ? '#/recipes' : `#/recipe/${esc(r.id)}` });

  const rows = document.getElementById('rows');
  document.getElementById('add').addEventListener('click', () => { rows.insertAdjacentHTML('beforeend', row()); rows.lastElementChild.querySelector('input').focus(); });
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
      items, method: fd.get('method'), photo: await photoValue(fd, r.photo),
      createdAt: r.createdAt ?? Date.now(), updatedAt: Date.now(),
    });
    go(`#/recipe/${r.id}`);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    const n = recipes.filter(x => usesRecipe(x, r.id)).length;
    if (confirm(n ? `"${r.name}" is a sub-recipe in ${n} recipe(s). Their costing will show a warning. Delete anyway?` : `Delete "${r.name}"?`)) {
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

// ---------- Pantry ----------

async function pantryList() {
  const [ings, recipes] = await Promise.all([db.all('ingredients'), db.all('recipes')]);
  ings.sort(byName);
  const used = id => recipes.filter(r => r.items?.some(it => it.ingredientId === id)).length;
  const missing = ings.filter(i => !hasPrice(i));
  page('pantry', 'Pantry', ings.length ? `
    <p><a href="#/order">Order list →</a></p>
    ${missing.length ? `<div class="card"><h2>Needs price (${missing.length})</h2><div class="chips">${missing.map(i => `<a class="chip" href="#/ingredient/${esc(i.id)}/edit">${esc(i.name)}</a>`).join('')}</div></div>` : ''}
    <div class="bar"><input type="search" id="q" placeholder="Search ingredients" aria-label="Search ingredients"></div>
    <ul class="list">${ings.map(i => `<li data-q="${esc(i.name.toLowerCase())}"><a href="#/ingredient/${esc(i.id)}/edit"><div>
      <b>${esc(i.name)}</b><small>${hasPrice(i) ? money(i.price) : '<span class="warn-text">No price</span>'} / ${esc(i.unit)} · yield ${esc(i.yieldPct)}% · in ${used(i.id)} recipes
      ${i.allergens?.length ? `<br><span class="alert-text">${i.allergens.map(esc).join(', ')}</span>` : ''}</small></div></a></li>`).join('')}</ul>`
    : '<div class="empty"><p>No ingredients yet.</p><p>Add what you buy, with price per kg, litre or each.</p></div>',
    { action: '<a class="btn" href="#/ingredient/new/edit">+ New</a>' });
  const q = document.getElementById('q');
  q?.addEventListener('input', () => document.querySelectorAll('.list li').forEach(li => { li.hidden = !li.dataset.q.includes(q.value.toLowerCase()); }));
}

async function ingredientEdit(id) {
  const isNew = id === 'new';
  const i = isNew ? { id: uid(), unit: 'kg', yieldPct: 100, allergens: [] } : await db.get('ingredients', id);
  if (!i) return go('#/pantry');
  page('pantry', isNew ? 'New ingredient' : 'Edit ingredient', `<form id="f">
    <label>Name<input name="name" required value="${esc(i.name)}"></label>
    <div class="row2">
      <label>Price (AUD)<input name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Add later" value="${esc(i.price)}"></label>
      <label>Per<select name="unit">${opts(PURCHASE_UNITS, i.unit)}</select></label>
    </div>
    <label>Yield % <small>(usable after trimming/peeling)</small><input name="yieldPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(i.yieldPct)}"></label>
    <h2>Allergens</h2>
    <div class="checks">${ALLERGENS.map(a => `<label><input type="checkbox" name="allergens" value="${a}" ${i.allergens?.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: '#/pantry' });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    await db.put('ingredients', { ...i, name: fd.get('name').trim(), price: num(fd.get('price')), unit: fd.get('unit'),
      yieldPct: num(fd.get('yieldPct')), allergens: fd.getAll('allergens'), updatedAt: Date.now() });
    go('#/pantry');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    const n = (await db.all('recipes')).filter(r => r.items?.some(it => it.ingredientId === i.id)).length;
    if (confirm(n ? `"${i.name}" is used in ${n} recipe(s). Their costing will show a warning. Delete anyway?` : `Delete "${i.name}"?`)) {
      await db.del('ingredients', i.id); go('#/pantry');
    }
  });
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
      const tr = out.querySelector(`tr[data-id="${CSS.escape(l.id)}"]`);
      if (!tr) continue;
      tr.querySelector('.order').innerHTML = l.order > 0 ? `<b>${fmtAmount(l.order, l.ing.unit)}</b>` : '<span class="ok-text">In stock</span>';
      tr.querySelector('.cost').textContent = l.order > 0 ? money(l.cost) : '—';
    }
    out.querySelector('.total').textContent = money(o.total);
    out.querySelector('.warns').innerHTML = o.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('');
    const toOrder = o.lines.filter(l => l.order > 0);
    shareText = [`Order list — ${new Date().toLocaleDateString('en-AU')}`, `For: ${forLine(plan)}`, '',
      ...(toOrder.length ? toOrder.map(l => `${l.ing.name} — ${fmtAmount(l.order, l.ing.unit)}`) : ['Nothing to order — all in stock.']),
      '', `Est. cost: ${money(o.total)}`].join('\n');
  };

  const draw = () => {
    save();
    const plan = readPlan(), o = orderList(plan, ings, recs, onHand);
    if (!o.lines.length) { out.innerHTML = '<p class="muted">Choose recipes and portions to see what to order.</p>'; return; }
    out.innerHTML = `<h2>To order</h2><p class="muted">For: ${esc(forLine(plan))}</p>
      <table class="order"><thead><tr><th>Ingredient</th><th class="n">On hand</th><th class="n">Order</th><th class="n">Est.</th></tr></thead>
      <tbody>${o.lines.map(l => `<tr data-id="${esc(l.id)}">
        <td>${esc(l.ing.name)}<br><small>need ${fmtAmount(l.usable, l.ing.unit)}${Number(l.ing.yieldPct) < 100 ? ` · yield ${esc(l.ing.yieldPct)}%` : ''}</small></td>
        <td class="n"><input class="have" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${esc(l.have || '')}" aria-label="${esc(l.ing.name)} on hand in ${esc(l.ing.unit)}"><small>${esc(l.ing.unit)}</small></td>
        <td class="n order"></td><td class="n muted cost"></td></tr>`).join('')}</tbody>
      <tfoot><tr><th colspan="3">Estimated total</th><td class="n"><b class="total"></b></td></tr></tfoot></table>
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
    const tr = e.target.closest('tr[data-id]');
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
  page('log', 'Service log', `
    <div class="links"><a href="#/temps">Temp log →</a><a href="#/portfolio">Portfolio →</a></div>
    <div class="card"><div class="row2">
      <div><small>School service periods</small><div class="big">${school} / ${esc(s.logTarget)}</div>
        <div class="progress"><i style="width:${Math.min(100, school / s.logTarget * 100)}%"></i></div></div>
      <div><small>Work shifts</small><div class="big">${work.length}</div><small>${fmtQty(hours)} hours</small></div>
    </div></div>
    ${logs.length ? `<ul class="list">${logs.map(l => `<li><a href="#/log/${esc(l.id)}/edit">
      ${l.photo ? `<img src="${esc(l.photo)}" alt="">` : `<span class="ph tag ${l.type}">${l.type === 'school' ? 'SCH' : 'WRK'}</span>`}
      <div><b>${esc(l.date)} · ${esc(l.period)}</b><small>${esc(l.venue || '—')}${l.station ? ' · ' + esc(l.station) : ''}${l.hours ? ' · ' + esc(l.hours) + 'h' : ''}</small></div></a></li>`).join('')}</ul>`
      : '<p class="empty">Log every service: what you cooked, where, and what chef said.</p>'}`,
    { action: '<a class="btn" href="#/log/new/edit">+ New</a>' });
}

async function logEdit(id) {
  const isNew = id === 'new';
  const logs = await db.all('logs');
  const last = logs.sort((a, b) => b.createdAt - a.createdAt)[0];
  const l = isNew ? { id: uid(), date: today(), type: last?.type ?? 'school', venue: last?.venue ?? '', period: 'Dinner' } : logs.find(x => x.id === id);
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
  : `${e.temp ?? '—'} °C`;

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
      ${open ? `<p class="warn">⚠ ${open} check(s) still open — finish the cooling readings.</p>` : ''}</div>
    ${days.length ? days.map(d => `<h2 class="day">${esc(new Date(d + 'T00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</h2>
      <ul class="list">${temps.filter(t => t.at.startsWith(d)).map(t => {
        const st = tempStatus(t);
        return `<li><a href="#/temp/${esc(t.id)}/edit"><div class="grow"><b>${esc(t.item || TEMP_CHECKS[t.type]?.label)}</b>
          <small>${esc(t.at.slice(11, 16))} · ${esc(TEMP_CHECKS[t.type]?.label ?? t.type)} · ${esc(tempValue(t))}${t.action ? `<br>Action: ${esc(t.action)}` : ''}</small></div>${badge(st)}</a></li>`;
      }).join('')}</ul>`).join('')
      : '<p class="empty">Record fridge, freezer, delivery, hot-holding, cooking and cooling temperatures. Each check is marked PASS or FAIL against food safety limits.</p>'}
    ${temps.length ? '<div class="actions no-print"><button type="button" class="ghost" id="print">Print</button></div>' : ''}`,
    { back: '#/log', action: '<a class="btn" href="#/temp/new/edit">+ New</a>' });
  document.getElementById('print')?.addEventListener('click', () => window.print());
}

async function tempEdit(id) {
  const isNew = id === 'new';
  const temps = await db.all('temps');
  const last = [...temps].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  const t = isNew ? { id: uid(), at: nowLocal(), type: last?.type ?? 'fridge' } : temps.find(x => x.id === id);
  if (!t) return go('#/temps');
  const reading = (key, label, hint) => `<fieldset class="reading"><legend>${label} <small>${hint}</small></legend><div class="row2">
    <label>Time<input name="${key}At" type="datetime-local" value="${esc(t[key]?.at ?? (key === 'start' ? t.at : ''))}"></label>
    <label>°C<input name="${key}Temp" type="number" step="0.1" inputmode="decimal" value="${esc(t[key]?.temp)}"></label></div></fieldset>`;

  page('log', isNew ? 'New temp check' : 'Edit temp check', `<form id="f">
    <label>Check<select name="type">${Object.entries(TEMP_CHECKS).map(([k, c]) => `<option value="${k}" ${k === t.type ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
    <label>Equipment or food<input name="item" list="items" placeholder="Walk-in cool room, Bain-marie, Beef ragù…" value="${esc(t.item)}"></label>
    ${datalist('items', temps.map(x => x.item))}
    <div id="spot" class="row2">
      <label>Time<input name="at" type="datetime-local" value="${esc(t.at)}"></label>
      <label>Temperature °C<input name="temp" type="number" step="0.1" inputmode="decimal" value="${esc(t.temp)}"></label></div>
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
    document.getElementById('status').innerHTML = `${badge(st)} ${esc(st.note)}${st.status === 'fail' ? ' — record a corrective action.' : ''}`;
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
    return { ...v, stations: [...v.stations], range: a === b ? a : `${a} – ${b}` };
  });
}

async function portfolioView() {
  const [recipes, logs, ings, s, saved] = await Promise.all([db.all('recipes'), db.all('logs'), ingMap(), settings(), db.get('settings', 'portfolio')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let pf = { headline: '', contact: '', bio: '', recipeIds: [], showCosting: false, ...saved, id: 'portfolio' };
  const srcLabel = { school: 'Training', work: 'Work', own: 'Original' };

  page('log', 'Portfolio', `
    <details class="card no-print" ${pf.recipeIds.length ? '' : 'open'}><summary><b>Edit portfolio</b></summary>
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
    <div class="no-print bar"><button id="print">Print / Save PDF</button></div>
    <div class="sheet-wrap"><article class="sheet portfolio" id="sheet"></article></div>`, { back: '#/log' });

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
        ? '<div class="card"><p>Password updated — you’re signed in.</p><p><a class="btn" href="#/recipes">Go to my recipes</a></p></div>'
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
    <form class="card" id="fb">
      <h2>Feedback</h2>
      <label>What's missing, confusing or broken?<textarea name="message" maxlength="2000" required placeholder="e.g. I'd like to…"></textarea></label>
      <button type="submit">Send feedback</button> <span id="fbMsg" class="muted"></span>
    </form>
    <div class="card"><h2>Invite classmates</h2><p class="muted">Pinch is free. Share the link — everyone gets their own private recipe book.</p>
      <button type="button" class="ghost" id="invite">Share Pinch</button> <span id="inviteMsg" class="muted"></span></div>
    <form id="f" class="card">
      <label>Your name <small>(shown on recipe cards)</small><input name="cookName" autocomplete="name" value="${esc(s.cookName)}"></label>
      <label>Default target food cost %<input name="targetCostPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(s.targetCostPct)}"></label>
      <label>School service periods required<input name="logTarget" type="number" min="1" step="1" inputmode="numeric" required value="${esc(s.logTarget)}"></label>
      <button type="submit">Save</button> <span id="saved" class="muted"></span>
    </form>
    <div class="card"><h2>Backup</h2>
      <p class="muted">Your data lives only on this phone. Export a backup regularly and keep it in Files, Drive or email.</p>
      <p>Last backup: <b>${s.lastBackup ? esc(new Date(s.lastBackup).toLocaleString()) : 'never'}</b>${est ? ` · Using ${(est.usage / 1e6).toFixed(1)} MB` : ''}</p>
      <div class="actions"><button id="export">Export backup</button><label class="btn ghost">Import<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <p class="muted"><small>Pinch v1</small></p>`);

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
      msg.textContent = 'Thanks — got it!';
    } catch (err) {
      msg.textContent = navigator.onLine ? 'Could not send: ' + err.message : 'You are offline — try again later.';
    } finally { button.disabled = false; }
  });
  document.getElementById('invite').onclick = async () => {
    const text = 'Pinch — free recipe costing, order lists and a service log for cooks. Open on your phone and add it to your home screen:';
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
  await T('d-t5', 1, 'hot_hold', 'Bain-marie — ragù', 67);
  await db.put('temps', { id: 'd-t6', type: 'cooling', item: 'Beef ragù (10 L)', at: at(2.5), temp: null, action: '', note: '',
    start: { at: at(2.5), temp: 63 }, stage1: { at: at(0.8), temp: 19 }, stage2: { at: '', temp: null }, createdAt: t });
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
  [/^#\/pantry$/, pantryList],
  [/^#\/order$/, orderView],
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
