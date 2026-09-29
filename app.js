import * as db from './db.js';
import { ALLERGENS, PURCHASE_UNITS, UNITS, recipeCost, itemCost, suggestedPrice, actualCostPct, recipeAllergens, usesRecipe, hasPrice, money, pct } from './calc.js';

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

async function settings() {
  return { targetCostPct: 30, logTarget: 48, lastBackup: null, cookName: '', ...(await db.get('settings', 'settings')) };
}
async function ingMap() {
  return new Map((await db.all('ingredients')).map(i => [i.id, i]));
}
const toMap = list => new Map(list.map(x => [x.id, x]));

function page(tab, title, body, { back, action = '' } = {}) {
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  view.innerHTML = `<header>${back ? `<a class="back" href="${back}" aria-label="Back">‹</a>` : ''}<h1>${esc(title)}</h1>${action}</header><main>${body}</main>`;
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
    : `<div class="empty"><p>No recipes yet.</p><p>Add ingredients with prices in <a href="#/pantry">Pantry</a>, then create a recipe.</p>
       <button class="ghost" id="sample">Load sample Italian recipes</button></div>`,
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
      <dt>Batch cost (${esc(r.portions)} portions)</dt><dd>${money(c.total)}</dd>
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
        <tfoot><tr><th colspan="5">Total cost (${portions} portions)</th><td class="n"><b>${money(c.total * f)}</b></td></tr></tfoot>
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

// ---------- Settings ----------

async function settingsView() {
  const s = await settings();
  const est = await navigator.storage?.estimate?.().catch(() => null);
  page('settings', 'Settings', `
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

// ---------- Router ----------

const routes = [
  [/^#\/recipes$/, recipeList],
  [/^#\/allergens$/, allergenChart],
  [/^#\/recipe\/([^/]+)$/, recipeView],
  [/^#\/recipe\/([^/]+)\/edit$/, recipeEdit],
  [/^#\/recipe\/([^/]+)\/card$/, recipeCard],
  [/^#\/pantry$/, pantryList],
  [/^#\/ingredient\/([^/]+)\/edit$/, ingredientEdit],
  [/^#\/log$/, logList],
  [/^#\/log\/([^/]+)\/edit$/, logEdit],
  [/^#\/settings$/, settingsView],
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
render();
