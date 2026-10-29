import * as db from './db.js';
import * as sync from './sync.js';
import { LANG, locale, setLang } from './i18n.js';
import { DECKS, review, pickSession, isDue, isLearned } from './study.js';
import { cardArt } from './cardart.js';
import { plan as workflowPlan } from './workflow.js';
import { fillPlan, templateProblem } from './docx.js';
import { recipeCaption, postNumber, LIMIT } from './caption.js';
import { parseIngredientLine, matchIngredient, splitSteps, findDurations, fmtDuration } from './parse.js';
import { ALLERGENS, PURCHASE_UNITS, UNITS, recipeCost, itemCost, suggestedPrice, actualCostPct, recipeAllergens, usesRecipe, hasPrice, fmtAmount, TEMP_CHECKS, tempStatus, yieldTest, MEASURES, convertFor, densityFor, scaleFromIngredient, bakersPercent, bakersBase, fToC, cToF, prepBatches, niceAmount, niceParts, withPriceHistory, menuEngineering, MENU_CLASSES, daysUntil, examReadiness, periodKey, checkProgress, shareBundle, importBundle, money, pct } from './calc.js';

const VERSION = new URL(import.meta.url).searchParams.get('v') ?? 'dev'; // set once, in index.html
const view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toLocaleDateString('en-CA');
const num = v => (v === '' || v == null ? null : Number(v));
const fmtQty = n => (Math.round(n * 100) / 100).toString();
const opts = (list, sel) => list.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
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
// Share sheet on phones (Save to Files), a plain download elsewhere. False when the share sheet was closed.
async function saveFile(file) {
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name }).click();
    return true;
  } catch (err) { if (err.name === 'AbortError') return false; throw err; }
}

// Tabler Icons (MIT), outline set: https://tabler.io/icons
const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6l6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>',
  timer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M12 10l0 3l2 0"/><path d="M7 4l-2.75 2"/><path d="M17 4l2.75 2"/></svg>',
  calculator: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M8 7m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z"/><path d="M8 14l0 .01"/><path d="M12 14l0 .01"/><path d="M16 14l0 .01"/><path d="M8 17l0 .01"/><path d="M12 17l0 .01"/><path d="M16 17l0 .01"/></svg>',
  prep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/></svg>',
  temp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5"/><path d="M10 9l4 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12zm0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3"/></svg>',
  scaleIc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20l10 0"/><path d="M6 6l6 -1l6 1"/><path d="M12 3l0 17"/><path d="M9 12l-3 -6l-3 6a3 3 0 0 0 6 0"/><path d="M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/></svg>',
  basket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5.001 8h13.999a2 2 0 0 1 1.977 2.304l-1.255 7.152a3 3 0 0 1 -2.966 2.544h-9.512a3 3 0 0 1 -2.965 -2.544l-1.255 -7.152a2 2 0 0 1 1.977 -2.304z"/><path d="M17 10l-2 -6"/><path d="M7 10l2 -6"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2"/><path d="M12 12l0 .01"/><path d="M3 13a20 20 0 0 0 18 0"/></svg>',
  resize: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4l4 0l0 4"/><path d="M14 10l6 -6"/><path d="M8 20l-4 0l0 -4"/><path d="M4 20l6 -6"/><path d="M16 20l4 0l0 -4"/><path d="M14 14l6 6"/><path d="M8 4l-4 0l0 4"/><path d="M4 4l6 6"/></svg>',
  printer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2"/><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4"/><path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 9l1 0"/><path d="M9 13l6 0"/><path d="M9 17l6 0"/></svg>',
  checkbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3l8 -8"/><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>',
};

// Every tool lives on Home, so each tab stays about one thing. Most used in class first.
const TOOLS = [
  ['#/timers', 'Timers', 'timer'], ['#/calc', 'Calculator', 'calculator'], ['#/prep', 'Prep', 'prep'], ['#/workflow', 'Work flow', 'doc'], ['#/ingredients', 'Ingredients', 'basket'],
  ['#/allergens', 'Allergy chart', 'alert'], ['#/yield', 'Yield', 'scaleIc'], ['#/menus', 'Menus', 'menu'], ['#/portfolio', 'Portfolio', 'briefcase'],
  ['#/temps', 'Temps', 'temp'], ['#/checks', 'Checklists', 'checkbox'],
];

// Tab roots get a large title; sub pages get a compact bar with a back button and no tab bar.
function page(tab, title, body, { back, action = '' } = {}) {
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('on', a.dataset.tab === tab);
    a.toggleAttribute('aria-current', a.dataset.tab === tab);
  });
  document.body.classList.toggle('sub', !!back);
  document.onpaste = null; // a screen that takes pasted photos sets its own
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
const dateLabel = d => new Date(d + 'T00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
const attemptsFor = async id => (await db.all('attempts')).filter(a => a.recipeId === id)
  .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
const newBtn = href => `<a class="btn sm tint" href="${href}">${ICON.plus}New</a>`;

async function readPhoto(file, max = 1200, quality = 0.8) {
  if (!file?.size) return null;
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}
// The image in a paste (a copied photo or screenshot), if there is one
const pastedImage = e => [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'));
const photoField = cur => `<label>Photo<input type="file" name="photo" accept="image/*"></label>
  ${cur ? `<img class="hero" src="${esc(cur)}" alt=""><label class="inline"><input type="checkbox" name="rmPhoto"> Remove photo</label>` : ''}`;
const photoValue = async (fd, old) => fd.get('rmPhoto') ? null : (await readPhoto(fd.get('photo'))) ?? old ?? null;

// ---------- Home: what needs doing today, and every tool ----------

async function homeView() {
  const [todo, recipes] = await Promise.all([todayItems(), db.all('recipes')]);
  const favs = recipes.filter(r => r.fav).sort(byName);
  page('home', 'Today', `
    <p class="muted home-date">${esc(new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
    ${todo.length ? `<div class="links" role="navigation" aria-label="To do">${todo.map(([href, label, value, alert]) =>
      `<a href="${href}"><span>${esc(label)}</span><span class="count ${alert ? 'alert-text' : ''}">${esc(value)}</span></a>`).join('')}</div>`
      : '<div class="card all-done"><b>All done for now</b><small>Nothing needs doing. Nice work.</small></div>'}
    ${favs.length ? `<h2 class="day">Favourites</h2><ul class="list">${favs.map(r => `<li><a href="#/recipe/${esc(r.id)}">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : '<span class="ph" aria-hidden="true"></span>'}
      <div class="grow"><b>${esc(r.name)}</b><small>${r.italian ? `<i translate="no">${esc(r.italian)}</i> · ` : ''}${esc(r.category || 'Uncategorised')}</small></div></a></li>`).join('')}</ul>` : ''}
    <h2 class="day">Tools</h2>
    <div class="tiles" role="navigation" aria-label="Tools">${TOOLS.map(([href, label, icon]) =>
      `<a href="${href}"><span class="tile-ic">${ICON[icon]}</span><span>${label}</span></a>`).join('')}</div>`,
    { action: `<a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.settings}</a>` });
}

// ---------- Shared recipe links ----------
// The bundle travels in the link itself (deflate + base64url), so sharing needs no server or account.

const toB64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const squeeze = (data, how) => new Response(new Blob([data]).stream().pipeThrough(how)).arrayBuffer();

async function shareLink(r, recs, ings) {
  const packed = await squeeze(JSON.stringify(shareBundle(r, recs, ings)), new CompressionStream('deflate-raw'));
  return `${APP_URL}#/r/${toB64(packed)}`;
}

async function sharedRecipe(data) {
  let b = null;
  try { b = JSON.parse(new TextDecoder().decode(await squeeze(fromB64(data), new DecompressionStream('deflate-raw')))); } catch {}
  if (!b?.recipes?.length) {
    page('recipes', 'Shared recipe', '<div class="empty"><p>This link is broken or cut short.</p><p>Ask for the recipe to be shared again.</p></div>', { back: '#/recipes' });
    return;
  }
  const [main, ...subs] = b.recipes;
  const ingName = new Map((b.ingredients ?? []).map(i => [i.id, i.name])), recName = new Map(b.recipes.map(x => [x.id, x.name]));
  const [myIngs, myRecs] = await Promise.all([db.all('ingredients'), db.all('recipes')]);
  const have = myRecs.some(x => x.name.trim().toLowerCase() === main.name.trim().toLowerCase());
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  page('recipes', 'Shared recipe', `
    <div class="card"><p class="stat-label">Shared with you</p><h2 class="shared-name">${esc(main.name)}</h2>
      <p class="muted">${esc([main.category, portionsLabel(main.portions || 1)].filter(Boolean).join(' · '))}</p>
      <table><tbody>${(main.items ?? []).map(it => `<tr><td>${esc(it.recipeId ? recName.get(it.recipeId) ?? '' : ingName.get(it.ingredientId) ?? '')}${it.recipeId ? '<br><small>Sub-recipe</small>' : ''}</td>
        <td class="n">${esc(niceAmount(it.qty, it.unit))}</td></tr>`).join('')}</tbody></table>
      ${subs.length ? `<p class="muted"><small>Comes with ${subs.length === 1 ? 'its sub-recipe' : `its ${subs.length} sub-recipes`}: ${subs.map(x => esc(x.name)).join(', ')}</small></p>` : ''}</div>
    ${main.method ? `<div class="card"><h2>Method</h2><div class="method">${esc(main.method)}</div></div>` : ''}
    ${have ? `<p class="muted center"><small>You already have a recipe called ${esc(main.name)}. Saving adds a second one.</small></p>` : ''}
    ${ios && !standalone() ? `<div class="card tip-card"><p><small><b>Using Pinch from your home screen?</b> It keeps its own recipes. Copy this link, then in the app tap New recipe and paste it under Import.</small></p>
      <div class="actions"><button type="button" class="ghost" id="copy">Copy link</button></div></div>` : ''}
    <div class="cta-bar"><button type="button" id="save">Save to my recipes</button></div>`, { back: '#/recipes' });
  document.getElementById('copy')?.addEventListener('click', async e => { await navigator.clipboard.writeText(location.href); e.target.textContent = 'Copied'; });
  document.getElementById('save').onclick = async e => {
    e.target.disabled = true;
    const t = Date.now(), into = importBundle(b, myIngs, myRecs, uid);
    for (const i of into.ingredients) await db.put('ingredients', { ...i, updatedAt: t });
    for (const x of into.recipes) await db.put('recipes', { ...x, createdAt: t, updatedAt: t });
    go(`#/recipe/${into.mainId}`);
  };
}

// ---------- Sharing a recipe: send it to a classmate, or post it on Instagram ----------

async function shareView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, recipes] = await Promise.all([ingMap(), db.all('recipes')]);
  const url = await shareLink(r, toMap(recipes), ings); // ready before the tap: the share sheet must open straight from it
  page('recipes', 'Share', `
    <ul class="list share-opts">
      <li><a href="#" id="sendLink">${ICON.share}<div class="grow"><b>Send to a classmate</b><small>A link with the recipe, its sub-recipes and ingredients. They save it into their own Pinch.</small></div></a></li>
      <li><a href="#/recipe/${esc(r.id)}/instagram">${ICON.camera}<div class="grow"><b>Post on Instagram</b><small>A numbered caption with the recipe in short, ready to paste.</small></div></a></li>
    </ul>
    <p id="shareMsg" class="muted center"></p>`, { back: `#/recipe/${esc(r.id)}` });
  document.getElementById('sendLink').onclick = async e => {
    e.preventDefault();
    try {
      if (navigator.share) await navigator.share({ title: r.name, text: `${r.name}, a recipe from Pinch`, url });
      else { await navigator.clipboard.writeText(url); document.getElementById('shareMsg').textContent = 'Link copied'; }
    } catch (err) { if (err.name !== 'AbortError') throw err; }
  };
}

// The caption: "01. Dish name", then the recipe in short. The number is remembered per recipe.
async function instagramView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, recipes, saved] = await Promise.all([ingMap(), db.all('recipes'), db.get('settings', 'instagram')]);
  const recs = toMap(recipes), numbers = saved?.numbers ?? {};
  const items = (r.items ?? []).map(it => ({ qty: it.qty, amount: niceAmount(it.qty, it.unit),
    name: it.recipeId ? recs.get(it.recipeId)?.name ?? '' : ings.get(it.ingredientId)?.name ?? '' }));
  const caption = n => recipeCaption(r, { number: n, items, steps: splitSteps(r.method) });
  const n0 = postNumber(numbers, r.id);
  page('recipes', 'Instagram caption', `
    <form onsubmit="return false">
    <label>Post number<input id="num" type="number" min="1" step="1" inputmode="numeric" value="${n0}"></label>
    <label>Caption<textarea id="cap" rows="16" translate="no">${esc(caption(n0))}</textarea></label>
    <p class="muted"><small id="len"></small></p></form>
    <div class="cta-bar"><button type="button" id="copy">Copy caption</button></div>`, { back: `#/recipe/${esc(r.id)}/share` });
  const num = document.getElementById('num'), cap = document.getElementById('cap'), len = document.getElementById('len');
  const count = () => { len.textContent = `${cap.value.length} of ${LIMIT} characters`; len.className = cap.value.length > LIMIT ? 'warn-text' : ''; };
  // A new number rewrites the title line and leaves your edits to the rest alone
  num.addEventListener('input', () => { cap.value = cap.value.replace(/^\d+\. /, `${String(Math.max(1, Number(num.value) || 1)).padStart(2, '0')}. `); count(); });
  cap.addEventListener('input', count);
  document.getElementById('copy').onclick = async e => {
    await navigator.clipboard.writeText(cap.value);
    await db.put('settings', { id: 'instagram', numbers: { ...numbers, [r.id]: Math.max(1, Number(num.value) || n0) } });
    e.target.textContent = 'Copied. Paste it into Instagram';
  };
  count();
}

// ---------- Recipes ----------

const costLine = c => `${money(c.perPortion)}<small>${c.problems.length ? '<span class="warn-text">Incomplete</span>' : 'per portion'}</small>`;

async function recipeList() {
  const [recipes, ings, saved] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'recipeSort')]);
  const recs = toMap(recipes);
  const costs = new Map(recipes.map(r => [r.id, recipeCost(r, ings, recs)]));
  const per = r => { const c = costs.get(r.id); return c.problems.length ? Infinity : c.perPortion; }; // incomplete last
  const SORTS = {
    name: byName,
    new: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || byName(a, b),
    edited: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || byName(a, b),
    cost: (a, b) => per(a) - per(b) || byName(a, b),
  };
  let by = SORTS[saved?.by] ? saved.by : 'name';
  recipes.sort(SORTS[by]);
  const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))].sort();
  page('recipes', 'Recipes', recipes.length ? `
    <div class="bar"><input type="search" id="q" placeholder="Search recipes or ingredients" aria-label="Search recipes or ingredients">
      <select id="cat" aria-label="Category"><option value="">All</option>${opts(cats)}</select>
      <select id="sort" aria-label="Sort">${[['name', 'A–Z'], ['new', 'Newest'], ['edited', 'Last edited'], ['cost', 'Lowest cost']]
        .map(([v, l]) => `<option value="${v}"${v === by ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <ul class="list">${recipes.map(r => `<li data-id="${esc(r.id)}" data-q="${esc([r.name, r.italian, ...(r.items ?? []).map(it => it.recipeId ? recs.get(it.recipeId)?.name : ings.get(it.ingredientId)?.name)].filter(Boolean).join(' ').toLowerCase())}" data-cat="${esc(r.category)}"><a href="#/recipe/${esc(r.id)}">
      ${r.photo ? `<img src="${esc(r.photo)}" alt="">` : '<span class="ph" aria-hidden="true"></span>'}
      <div class="grow"><b>${esc(r.name)}</b><small>${r.italian ? `<i translate="no">${esc(r.italian)}</i> · ` : ''}${esc(r.category || 'Uncategorised')}</small></div>
      <span class="trail">${costLine(costs.get(r.id))}</span></a></li>`).join('')}</ul>
    <a class="btn ghost wide" href="#/recipes/names">English and Italian names</a>`
    : `<div class="card welcome"><h2>Welcome to Pinch</h2>
        <ol class="steps">
          <li><b>Write a recipe.</b> Type ingredients as you go. Pinch works out cost per portion, allergens and a recipe card.</li>
          <li><b>Practise it.</b> After each cook, rate it and note what to change next time.</li>
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
  document.getElementById('sort')?.addEventListener('change', e => {
    by = e.target.value;
    const ul = document.querySelector('.list'), li = new Map([...ul.children].map(x => [x.dataset.id, x]));
    ul.append(...recipes.sort(SORTS[by]).map(r => li.get(r.id)));
    db.put('settings', { id: 'recipeSort', by });
  });
  document.getElementById('sample')?.addEventListener('click', async () => { await loadSample(); recipeList(); });
}

// Method steps, numbered the way cook mode draws them.
const stepItems = steps => steps.map((t, i) => `<li><span class="step-n" aria-hidden="true">${i + 1}</span><span>${esc(t)}</span></li>`).join('');

// The method in Korean: translated once by Claude, kept with the recipe until the method changes.
// Step by step, so step 3 in Korean is always step 3 in English.
const hasKo = r => r.methodKo?.from === r.method && Array.isArray(r.methodKo.steps);
async function methodKo(r) {
  if (!hasKo(r)) {
    r.methodKo = { from: r.method, steps: await sync.stepsInKorean(splitSteps(r.method)) };
    await db.put('recipes', { ...(await db.get('recipes', r.id)), methodKo: r.methodKo }); // not an edit: "Last edited" stays
  }
  return r.methodKo.steps;
}

// Every recipe's English name (the title) and Italian name (the subtitle) on one screen; Claude can fill them.
async function recipeNames() {
  const recipes = (await db.all('recipes')).sort(byName);
  page('recipes', 'Recipe names', `
    <div class="card"><button type="button" class="wide" id="tr">Fill in with Claude</button>
      <p id="trMsg"><small>Translates the names of recipes with no Italian name yet: English as the title, Italian underneath. Check them, then Save.</small></p></div>
    <form id="f">${recipes.map(r => `<div class="card">
      <label>English<input name="n-${esc(r.id)}" required value="${esc(r.name)}"></label>
      <label>Italian <small>(optional)</small><input name="i-${esc(r.id)}" value="${esc(r.italian)}"></label></div>`).join('')}
      <div class="cta-bar"><button>Save</button></div></form>`, { back: '#/recipes' });

  const f = document.getElementById('f'), msg = document.getElementById('trMsg');
  const field = (k, r) => f.elements[`${k}-${r.id}`];
  document.getElementById('tr').onclick = async e => {
    const todo = recipes.filter(r => !field('i', r).value.trim());
    if (!todo.length) { msg.innerHTML = '<small class="ok-text">Every recipe has an Italian name.</small>'; return; }
    e.target.classList.add('busy');
    msg.innerHTML = '<small>Translating… this takes a few seconds.</small>';
    try {
      const out = await sync.translateNames(todo.map(r => field('n', r).value.trim() || r.name));
      todo.forEach((r, i) => { field('n', r).value = out[i].name; field('i', r).value = out[i].italian; });
      msg.innerHTML = `<small class="ok-text">Filled ${todo.length} recipes. Check them, then Save.</small>`;
    } catch (err) {
      msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`;
    } finally { e.target.classList.remove('busy'); }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    for (const r of recipes) {
      const name = field('n', r).value.trim(), italian = field('i', r).value.trim();
      if (name !== r.name || italian !== (r.italian ?? '')) await db.put('recipes', { ...r, name, italian, updatedAt: Date.now() });
    }
    go('#/recipes');
  };
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
    <h1 class="detail-title">${esc(r.name)}</h1>
    ${r.italian ? `<p class="it-name" translate="no">${esc(r.italian)}</p>` : ''}
    <p class="muted">${esc(r.category || 'Uncategorised')} · ${/^https?:\/\//.test(r.sourceUrl ?? '') ? `From <a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(new URL(r.sourceUrl).hostname.replace(/^www\./, ''))}</a>` : esc({ school: 'From school', work: 'From work', own: 'My own', web: 'From the web', shared: 'Shared with me' }[r.source] || '')}${r.yieldQty ? ` · Yields ${esc(r.yieldQty)} ${esc(r.yieldUnit)}` : ''}</p>
    ${usedIn.length ? `<p class="muted">Used in: ${usedIn.map(x => `<a href="#/recipe/${esc(x.id)}">${esc(x.name)}</a>`).join(', ')}</p>` : ''}
    <div class="quick" role="navigation" aria-label="Recipe tools">
      <a href="#/recipe/${esc(r.id)}/scale">${ICON.resize}<span>Scale</span></a>
      <a href="#/recipe/${esc(r.id)}/card">${ICON.printer}<span>Recipe card</span></a>
      <a href="#/recipe/${esc(r.id)}/attempt">${ICON.pencil}<span>Log practice</span></a>
      <a href="#/recipe/${esc(r.id)}/share">${ICON.share}<span>Share</span></a>
    </div>
    <div class="card stat-card">
      <p class="stat-label">Cost per portion</p>
      <p class="stat">${money(c.perPortion)}</p>
      <p class="stat-sub">${r.menuPrice
        ? `Food cost <b>${pct(actualCostPct(c.perPortion, r.menuPrice))}</b> at ${money(r.menuPrice)}`
        : `Sell at <b>${money(price.inc)}</b> for ${pct(target)} food cost`}</p>
      ${c.problems.length ? `<p class="warn">⚠ ${c.problems.length === 1 ? esc(c.problems[0]) : `${c.problems.length} things to fix in Costing`}</p>` : ''}
      <div class="chips stat-chips">${allergens.length ? allergens.map(a => `<span class="chip alert">${a}</span>`).join('') : '<span class="chip">No allergens recorded</span>'}</div>
    </div>
    <details class="more"><summary>Costing</summary>
      <dl class="kv">
        <dt>Batch cost (${esc(portionsLabel(r.portions))})</dt><dd>${money(c.total)}</dd>
        <dt>Target food cost</dt><dd>${pct(target)}</dd>
        <dt>Suggested price ex GST</dt><dd>${money(price.ex)}</dd>
        <dt>Suggested price inc GST</dt><dd>${money(price.inc)}</dd>
        ${r.menuPrice ? `<dt>Menu price inc GST</dt><dd>${money(r.menuPrice)}</dd><dt>Actual food cost</dt><dd>${pct(actualCostPct(c.perPortion, r.menuPrice))}</dd>` : ''}
      </dl>${c.problems.map(p => `<p class="warn">⚠ ${esc(p)}</p>`).join('')}
      <p><small>Allergens come from your ingredient list. Always check supplier labels.</small></p></details>
    <div class="card"><div class="card-head"><h2>Ingredients</h2>
        <div class="stepper"><button type="button" class="ghost" data-step="-1" aria-label="Fewer portions">−</button>
          <input type="number" id="scale" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}" aria-label="Portions">
          <button type="button" class="ghost" data-step="1" aria-label="More portions">+</button></div></div>
      <table><tbody id="items"></tbody></table></div>
    ${r.method ? `<div class="card"><div class="wf-head"><h2>Method</h2><button type="button" class="ghost sm" id="ko">${hasKo(r) ? 'Show Korean' : 'Translate to Korean'}</button></div>
      <ol class="method step-list" id="method">${stepItems(splitSteps(r.method))}</ol><p id="koMsg"></p></div>` : ''}
    <div class="card practice"><h2>Practice</h2>
      ${attempts.length ? `
        <p class="practice-sum">${stars(avg)}<span class="muted">${rated.length ? `${fmtQty(avg)} average, ` : ''}${attempts.length} attempt${attempts.length === 1 ? '' : 's'}</span></p>
        ${lastNext ? `<p class="tip"><small><b>Next time:</b> ${esc(lastNext)}</small></p>` : ''}
        <ul class="list">${attempts.slice(0, 3).map(a => `<li><a href="#/attempt/${esc(a.id)}/edit">
          ${a.photo ? `<img src="${esc(a.photo)}" alt="">` : '<span class="ph" aria-hidden="true"></span>'}
          <div class="grow"><span class="row-top"><b>${esc(dateLabel(a.date))}</b>${stars(a.rating)}</span><small>${esc(a.logId ? ['Class service', a.notes].filter(Boolean).join('. ') : a.notes || a.next || 'No notes')}</small></div>
          </a></li>`).join('')}</ul>`
        : '<p class="muted">Each time you cook this, note how it went and what to change. Your notes show up when you start cooking.</p>'}</div>
    <div class="cta-bar"><a class="btn" href="#/recipe/${esc(r.id)}/cook">Start cooking</a></div>`,
    { back: '#/recipes', action: `<button type="button" class="icon-btn fav" id="fav" aria-pressed="${!!r.fav}" aria-label="Favourite"><svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg></button>
      <a class="btn sm tint" href="#/recipe/${esc(r.id)}/edit">Edit</a>` });

  // The small title in the top bar appears only once the big one has scrolled away.
  const barTitle = document.querySelector('.bar-title');
  barTitle.classList.add('on-scroll');
  new IntersectionObserver(([e]) => barTitle.classList.toggle('shown', !e.isIntersecting), { rootMargin: '-56px 0px 0px' })
    .observe(document.querySelector('.detail-title'));
  const favBtn = document.getElementById('fav');
  favBtn.onclick = async () => {
    const now = await db.get('recipes', r.id), fav = !now.fav;
    favBtn.setAttribute('aria-pressed', String(fav));
    await db.put('recipes', { ...now, fav, updatedAt: Date.now() });
  };
  const koBtn = document.getElementById('ko');
  if (koBtn) koBtn.onclick = async () => {
    const box = document.getElementById('method'), msg = document.getElementById('koMsg');
    if (box.dataset.ko) { delete box.dataset.ko; box.innerHTML = stepItems(splitSteps(r.method)); koBtn.textContent = 'Show Korean'; return; }
    koBtn.classList.add('busy');
    msg.innerHTML = '<small>Translating…</small>';
    try {
      const en = splitSteps(r.method);
      box.innerHTML = stepItems((await methodKo(r)).map((k, i) => k || en[i])); // a step Claude missed stays in English
      box.dataset.ko = '1';
      koBtn.textContent = 'Show original';
      msg.textContent = '';
    } catch (err) {
      msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`;
    } finally { koBtn.classList.remove('busy'); }
  };
  const scale = document.getElementById('scale');
  const drawItems = () => {
    const f = (Number(scale.value) || r.portions) / r.portions;
    let total = 0;
    document.getElementById('items').innerHTML = (r.items ?? []).map(it => {
      const cost = itemCost(it, ings, recs, new Set([r.id])).cost * f;
      if (Number.isFinite(cost)) total += cost;
      const sub = it.recipeId && recs.get(it.recipeId);
      const name = sub ? `<a href="#/recipe/${esc(sub.id)}">${esc(sub.name)}</a><br><small>Sub-recipe</small>`
        : ings.has(it.ingredientId) ? `<a href="#/ingredient/${esc(it.ingredientId)}/edit">${esc(ings.get(it.ingredientId).name)}</a>` : '(deleted)';
      return `<tr><td>${name}</td><td class="n">${esc(niceAmount(it.qty * f, it.unit))}</td><td class="n muted">${it.qty > 0 ? money(cost) : '-'}</td></tr>`;
    }).join('') + `<tr><th>Total</th><td></td><td class="n"><b>${money(total)}</b></td></tr>`;
  };
  scale.addEventListener('input', drawItems);
  document.querySelector('.stepper').addEventListener('click', e => {
    const d = Number(e.target.closest('[data-step]')?.dataset.step);
    if (!d) return;
    scale.value = Math.max(1, (Number(scale.value) || r.portions) + d);
    drawItems();
  });
  drawItems();
}

// Costed standard recipe card, printable to A4 / PDF.
async function recipeCard(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, s, recipes] = await Promise.all([ingMap(), settings(), db.all('recipes')]);
  const recs = toMap(recipes);
  const target = r.targetCostPct || s.targetCostPct;
  const sourceLabel = r.source === 'web' && r.sourceUrl ? `Source: ${r.sourceUrl}` : { school: 'School', work: 'Work', own: 'Own recipe', web: 'Web', shared: 'Shared recipe' }[r.source] || '';

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
      return `<tr><td>${name}</td><td class="n">${esc(niceParts(it.qty * f, it.unit)[0])}</td><td>${esc(niceParts(it.qty * f, it.unit)[1])}</td><td class="n">${unitPrice}</td><td class="n">${yieldPct}</td><td class="n">${it.qty > 0 ? money(cost) : '-'}</td></tr>`;
    }).join('');

    sheet.innerHTML = `
      <div class="sheet-head">
        <div><p class="eyebrow">Standard recipe card</p><h1>${esc(r.name)}</h1>${r.italian ? `<p class="it-name" translate="no">${esc(r.italian)}</p>` : ''}
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
      <p class="sheet-foot">Costs from ingredient prices in Pinch. Allergens based on recorded ingredients; check supplier labels.</p>`;
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

  // Row keys: 'i:<ingredientId>', 'r:<recipeId>', or 'new' for a name not in the ingredient list yet.
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
      <input name="qty" type="number" step="any" min="0" inputmode="decimal" placeholder="q.b." aria-label="Quantity (empty for q.b., as much as needed)" value="${esc(it.qty)}">
      <select name="unit" aria-label="Unit">${opts(unitsFor(k), it.unit ?? 'g')}</select>
      <button type="button" class="x" aria-label="Remove">×</button></div>`;
  };

  // Quick capture: name, ingredients as plain lines, save. Everything else is optional and folded away.
  const typing = !r.items.length; // no rows yet: ingredients start as a text box
  page('recipes', isNew ? 'New recipe' : 'Edit recipe', `<form id="f">
    ${isNew ? `<div class="card import-card">
      <h2>Import a recipe</h2>
      <div class="bar"><input type="url" id="importUrl" inputmode="url" autocomplete="off" placeholder="Paste a recipe link" aria-label="Recipe link"><button type="button" id="importBtn">Import</button></div>
      <label class="btn ghost wide photo-read">${ICON.camera}Read a recipe photo<input type="file" id="photoRead" accept="image/*" hidden></label>
      <p id="importMsg"><small>Paste a recipe link, take a photo of a printed or handwritten recipe, or paste a copied photo or screenshot here. Pinch fills in the form for you to check.</small></p>
    </div>` : ''}
    <input type="hidden" name="sourceUrl" value="${esc(r.sourceUrl)}">
    <label>Name<input name="name" required placeholder="e.g. Tomato sauce" value="${esc(r.name)}"></label>
    <label>Italian name <small>(optional)</small><input name="italian" placeholder="e.g. Salsa di pomodoro" value="${esc(r.italian)}"></label>
    <h2>Ingredients</h2>
    <datalist id="ingOpts">${ingList.map(i => `<option value="${esc(i.name)}">`).join('')}${subs.map(x => `<option value="${esc(x.name + SUB)}">`).join('')}</datalist>
    <div class="paste" id="paste" ${typing ? '' : 'hidden'}>
      <label class="sr-only" for="pasteText">Ingredients, one per line</label>
      <textarea id="pasteText" placeholder="One per line, e.g.&#10;500 g tipo 00 flour&#10;5 eggs&#10;2 cloves garlic&#10;1/2 cup olive oil"></textarea>
      <p><small>Type or paste. Amounts and units are read for you, and names are matched to your ingredients. No amount (oil, salt, to taste) is fine: it's saved as q.b.</small></p>
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
        <label>Source<select name="source">${[['school', 'School'], ['work', 'Work'], ['own', 'My own'], ['web', 'Web'], ['shared', 'Shared']].map(([v, l]) => `<option value="${v}" ${v === r.source ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
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
    const shared = url.match(/#\/r\/([\w-]+)/);
    if (shared) return go(`#/r/${shared[1]}`);
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
  // Read a photo: Claude reads the recipe on the server; the form is filled for you to check, then Save
  const photoRead = document.getElementById('photoRead');
  const readRecipe = async file => {
    const msg = document.getElementById('importMsg'), label = photoRead.closest('label');
    label.classList.add('busy');
    msg.innerHTML = '<small>Reading the photo… this takes about 10 to 30 seconds.</small>';
    try {
      const jpeg = await readPhoto(file, 1600, 0.85); // big enough for small print, small enough to send quickly
      const rec = await sync.readRecipePhoto(jpeg.split(',')[1], 'image/jpeg');
      const f = document.getElementById('f');
      f.elements.name.value = rec.name;
      if (rec.italian) f.elements.italian.value = rec.italian;
      document.getElementById('pasteText').value = rec.ingredients.join('\n');
      f.elements.method.value = rec.steps.map((st, i) => `${i + 1}. ${st}`).join('\n');
      if (rec.servings) f.elements.portions.value = rec.servings;
      msg.innerHTML = `<small class="ok-text">Read ${rec.ingredients.length} ingredients and ${rec.steps.length} steps. Check them, then Save.</small>`;
    } catch (err) {
      msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`;
    } finally { label.classList.remove('busy'); photoRead.value = ''; }
  };
  if (photoRead) {
    photoRead.onchange = () => photoRead.files[0] && readRecipe(photoRead.files[0]);
    document.onpaste = e => { const img = pastedImage(e); if (img) { e.preventDefault(); readRecipe(img); } };
  }
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
      if (!p.name) { el.classList.add('uncertain'); el.title = `Check this line: "${p.raw}"`; unsure++; }
    }
    text.value = '';
    paste.hidden = true;
    if (msg) msg.textContent = '';
    document.querySelector('.paste-note')?.remove();
    rows.insertAdjacentHTML('afterend', `<p class="paste-note muted"><small>Added ${lines.length} ingredients: ${matched} already in your list, ${lines.length - matched} new.${unsure ? ` ${unsure} highlighted row(s) need a name.` : ''}</small></p>`);
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
    const created = new Map(); // new ingredients by lowercased name, so repeats share one
    const items = [];
    for (const el of form.querySelectorAll('.item')) {
      const k = resolve(el), q = num(el.querySelector('[name=qty]').value), qty = q > 0 ? q : null, unit = el.querySelector('[name=unit]').value;
      if (!k) continue; // an empty amount is kept as q.b.
      if (k !== 'new') { items.push({ [k.startsWith('r:') ? 'recipeId' : 'ingredientId']: k.slice(2), qty, unit }); continue; }
      const name = el.querySelector('[name=ing]').value.trim();
      let ing = created.get(name.toLowerCase());
      if (!ing) created.set(name.toLowerCase(), ing = { id: uid(), name, unit: { g: 'kg', kg: 'kg', ml: 'L', L: 'L' }[unit] ?? (qty ? 'each' : 'kg'), price: null, yieldPct: 100, allergens: [], updatedAt: Date.now() });
      items.push({ ingredientId: ing.id, qty, unit });
    }
    for (const ing of created.values()) await db.put('ingredients', ing);
    await db.put('recipes', {
      ...r,
      name: fd.get('name').trim(), italian: fd.get('italian').trim(), category: fd.get('category').trim(), source: fd.get('source'),
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
  const [recipes, ings, saved] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'recipeSort')]);
  const recs = toMap(recipes);
  const costs = new Map(recipes.map(r => [r.id, recipeCost(r, ings, recs)]));
  const per = r => { const c = costs.get(r.id); return c.problems.length ? Infinity : c.perPortion; }; // incomplete last
  const SORTS = {
    name: byName,
    new: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || byName(a, b),
    edited: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || byName(a, b),
    cost: (a, b) => per(a) - per(b) || byName(a, b),
  };
  let by = SORTS[saved?.by] ? saved.by : 'name';
  recipes.sort(SORTS[by]);
  page('recipes', 'Allergen chart', recipes.length ? `
    <div class="matrix"><table><thead><tr><th>Recipe</th>${ALLERGENS.map(a => `<th class="v">${a}</th>`).join('')}</tr></thead>
    <tbody>${recipes.map(r => {
      const has = recipeAllergens(r, ings, recs);
      return `<tr><td><a href="#/recipe/${esc(r.id)}">${esc(r.name)}</a></td>${ALLERGENS.map(a => `<td class="c">${has.includes(a) ? '<span class="dot" aria-label="contains">●</span>' : ''}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>
    <p><small>Based on your ingredient list. Always check supplier labels.</small></p>`
    : '<p class="empty">No recipes yet.</p>', { back: '#/home' });
}

// ---------- Practice attempts ----------

async function attemptEdit(recipeId, attemptId) {
  const a = attemptId ? await db.get('attempts', attemptId) : { id: uid(), recipeId, date: today(), rating: null };
  const r = a && await db.get('recipes', a.recipeId);
  if (!a || !r) return go('#/recipes');
  const isNew = !attemptId;
  page('recipes', isNew ? 'How did it go?' : 'Attempt', `<form id="f">
    <p class="muted">${esc(r.name)}</p>
    ${a.logId ? `<p class="tip"><small>From your class log. <a href="#/log/${esc(a.logId)}/edit">Open the log</a></small></p>` : ''}
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
    { back: '#/home', action: newBtn('#/menu/new') });
}

async function menuView(id) {
  const [recipes, ings, saved] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'recipeSort')]);
  const recs = toMap(recipes);
  const costs = new Map(recipes.map(r => [r.id, recipeCost(r, ings, recs)]));
  const per = r => { const c = costs.get(r.id); return c.problems.length ? Infinity : c.perPortion; }; // incomplete last
  const SORTS = {
    name: byName,
    new: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || byName(a, b),
    edited: (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || byName(a, b),
    cost: (a, b) => per(a) - per(b) || byName(a, b),
  };
  let by = SORTS[saved?.by] ? saved.by : 'name';
  recipes.sort(SORTS[by]);
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
  const [recipes, ings, saved] = await Promise.all([db.all('recipes'), ingMap(), db.get('settings', 'prepPlan')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let done = new Set(saved?.done ?? []);
  const planRow = (p = {}) => `<div class="plan-row">
    <select name="recipe" aria-label="Recipe"><option value="">Choose recipe…</option>
      ${recipes.map(r => `<option value="${esc(r.id)}" ${r.id === p.recipeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
    <input name="portions" type="number" min="0" step="1" inputmode="numeric" placeholder="Portions" aria-label="Portions" value="${esc(p.portions)}">
    <button type="button" class="x" aria-label="Remove">×</button></div>`;
  page('recipes', 'Prep list', recipes.length ? `
    <div class="card no-print"><h2>What's on?</h2>
      <div id="plan">${(saved?.rows?.length ? saved.rows : [{}]).map(planRow).join('')}</div>
      <button type="button" class="ghost" id="addPlan">+ Add recipe</button>
    </div>
    <div id="out"></div>` : '<p class="empty">Add recipes first.</p>', { back: '#/home' });
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
    <p class="muted center"><small>Timers keep running while you use the rest of Pinch. Keep the app open: a locked phone can't ring.</small></p>`, { back: '#/home' });
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

// The built-in decks, then your own cards grouped by the deck name you gave them. Same review schedule for all.
const MY = 'my:';
async function decks() {
  const own = new Map();
  for (const c of (await db.all('cards')).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))) {
    const name = c.deck?.trim() || 'My cards';
    if (!own.has(name)) own.set(name, []);
    own.get(name).push({ ...c, deckName: name, deck: MY + name });
  }
  return [...DECKS, ...[...own].map(([name, cards]) => ({ id: MY + name, title: name, mine: true, cards }))];
}
const cardsOf = ds => ds.flatMap(d => d.cards);
const deckHref = d => `#/study/deck/${encodeURIComponent(d.id)}`;
// What a card shows with its answer: your photo, or the built-in diagram
const cardPicture = c => (c.photo ? `<img class="card-photo" src="${esc(c.photo)}" alt="">` : cardArt(c.id));

const EXAM_TYPES = { practical: 'Practical', theory: 'Theory', assignment: 'Assignment' };
const dLabel = n => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 0 ? `${n} days` : `${-n} days ago`);

async function studyHome() {
  const [st, exams, attempts, ds] = await Promise.all([studyState(), db.all('exams'), db.all('attempts'), decks()]);
  const ALL_CARDS = cardsOf(ds), own = ds.filter(d => d.mine);
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
    <div class="links" role="navigation" aria-label="Decks">${DECKS.map(d => `<a href="${deckHref(d)}"><span>${esc(d.title)}</span>
      <span class="count">${d.cards.filter(c => isLearned(st, c.id)).length}/${d.cards.length}</span></a>`).join('')}</div>
    <h2 class="day">My cards</h2>
    ${own.length ? `<div class="links" role="navigation" aria-label="My decks">${own.map(d => `<a href="${deckHref(d)}"><span translate="no">${esc(d.title)}</span>
      <span class="count">${d.cards.filter(c => isLearned(st, c.id)).length}/${d.cards.length}</span></a>`).join('')}</div>`
      : '<p class="muted">Make cards from class: theory notes, what chef stressed, a photo of the plating.</p>'}
    <a class="btn ghost wide" href="#/card/new/edit" style="margin:0 0 var(--s3)">Make a card</a>
    <p class="muted center"><small>Cards you get right come back after 1, 3, 7, 14 and 30 days. Ones you miss come straight back.</small></p>`);
}

async function deckView(id) {
  const [ds, st] = await Promise.all([decks(), studyState()]);
  const d = ds.find(x => x.id === id);
  if (!d) return go('#/study');
  const learned = c => (isLearned(st, c.id) ? ' <span class="badge pass">Learned</span>' : '');
  page('study', d.title, `
    ${d.note ? `<p class="muted">${esc(d.note)}</p>` : ''}
    ${d.mine ? `<ul class="list">${d.cards.map(c => `<li><a href="#/card/${esc(c.id)}/edit">
        ${c.photo ? `<img src="${esc(c.photo)}" alt="">` : ''}
        <div class="grow" translate="no"><b>${esc(c.front)}</b><small>${esc(c.back)}</small></div>${learned(c)}</a></li>`).join('')}</ul>
      <a class="btn ghost wide" href="#/card/new/edit/${encodeURIComponent(d.title)}" style="margin:0 0 var(--s3)">Add a card</a>`
    : `<div class="card ref-list">${d.cards.map(c => `<div class="ref-item"><div translate="no"><b>${esc(c.front)}</b>${learned(c)}<p>${esc(c.back)}</p></div>${cardArt(c.id)}</div>`).join('')}</div>`}
    <div class="cta-bar"><a class="btn" href="#/study/go/${encodeURIComponent(d.id)}">Study this deck</a></div>`, { back: '#/study' });
}

// ---------- Your own study cards ----------

async function cardEdit(id, deckName) {
  const isNew = id === 'new';
  const all = await db.all('cards');
  const last = [...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  const c = isNew ? { id: 'u-' + uid(), deck: deckName || last?.deck || 'My cards' } : all.find(x => x.id === id);
  if (!c) return go('#/study');
  const back = all.some(x => x.deck === c.deck) ? `#/study/deck/${encodeURIComponent(MY + c.deck)}` : '#/study';
  page('study', isNew ? 'New card' : 'Edit card', `<form id="f">
    <label>Deck<input name="deck" list="deckNames" required placeholder="e.g. Week 3 theory" value="${esc(c.deck)}"></label>
    ${datalist('deckNames', all.map(x => x.deck))}
    <label>Question <small>(or a term)</small><textarea name="front" required rows="2" placeholder="e.g. What does CCP stand for?">${esc(c.front)}</textarea></label>
    <label>Answer<textarea name="back" required rows="4">${esc(c.back)}</textarea></label>
    ${photoField(c.photo)}
    <p><small>A photo shows with the answer: a plating, a cut, a page of class notes.</small></p>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back });
  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form), deck = fd.get('deck').trim() || 'My cards';
    await db.put('cards', { ...c, deck, front: fd.get('front').trim(), back: fd.get('back').trim(), photo: await photoValue(fd, c.photo),
      createdAt: c.createdAt ?? Date.now(), updatedAt: Date.now() });
    go(`#/study/deck/${encodeURIComponent(MY + deck)}`);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this card?')) { await db.del('cards', c.id); go(all.length > 1 ? back : '#/study'); }
  });
}

async function studySession(deckId) {
  const [ds, st0] = await Promise.all([decks(), studyState()]);
  let st = st0;
  const deck = deckId && ds.find(x => x.id === deckId);
  const pool = deck ? deck.cards : cardsOf(ds);
  let queue = pickSession(pool, st, Date.now(), 10);
  if (!queue.length && deck) queue = [...deck.cards].sort(() => Math.random() - 0.5).slice(0, 10); // all learned: practise anyway
  if (!queue.length) return go('#/study');
  const missedOnce = new Set();
  let i = 0, right = 0, again = 0;
  const back = deck ? deckHref(deck) : '#/study';

  page('study', deck ? deck.title : 'Study', `
    <p class="step-count" id="count"></p>
    <button type="button" class="flash" id="flash" aria-live="polite"></button>
    <div class="cook-nav" id="nav"></div>`, { back });
  const flash = document.getElementById('flash'), nav = document.getElementById('nav'), count = document.getElementById('count');
  const show = revealed => {
    const c = queue[i];
    count.textContent = `Card ${i + 1} of ${queue.length}`;
    flash.innerHTML = `<span class="flash-deck" translate="${c.deckName ? 'no' : 'yes'}">${esc(ds.find(x => x.id === c.deck)?.title ?? '')}</span>
      <span class="flash-front" translate="no">${esc(c.front)}</span>
      ${revealed ? `<span class="flash-back" translate="no">${esc(c.back)}</span>${cardPicture(c)}` : '<span class="flash-hint">Tap to show the answer</span>'}`;
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

// ---------- Work flow plan: recipes in, the school's Word form out ----------

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const toBase64 = file => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(file); });
const fromBase64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function workflowView(examId) {
  const [recipes, ings, s, saved, tpl, exam, koPref] = await Promise.all([db.all('recipes'), ingMap(), settings(),
    db.get('settings', 'workflow'), db.get('settings', 'workflowTemplate'), examId ? db.get('exams', examId) : null, db.get('settings', 'cookKo')]);
  recipes.sort(byName);
  const recs = toMap(recipes), w = { name: s.cookName, picked: [], ...saved };
  w.date = exam?.date ?? today(); // the plan is for one day: never yesterday's date
  if (exam) w.picked = exam.recipeIds ?? [];
  const fromBook = r => ({ name: r.name, yield: r.portions ? portionsLabel(r.portions) : '', prep: '', cook: '', equipment: '',
    items: (r.items ?? []).map(it => ({ qty: it.qty, unit: it.unit, name: it.recipeId ? recs.get(it.recipeId)?.name ?? '' : ings.get(it.ingredientId)?.name ?? '' })).filter(it => it.name),
    steps: splitSteps(r.method) });
  // Does r use recipe id, directly or through its own sub-recipes?
  const uses = (r, id, seen = new Set()) => (r.items ?? []).some(it => it.recipeId && !seen.has(it.recipeId)
    && (seen.add(it.recipeId), it.recipeId === id || uses(recs.get(it.recipeId) ?? {}, id, seen)));
  const field = (k, label, attrs = '') => `<label>${label}<input name="${k}" value="${esc(w[k])}" ${attrs}></label>`;
  // Pick the day's dishes, get every step in the order to do it. The picker folds away once dishes are chosen.
  page('home', 'Work flow plan', `
    <form id="f" class="no-print" onsubmit="return false">
      <details class="more" id="pickBox" ${w.picked.length ? '' : 'open'}><summary>Today's dishes <span class="muted" id="pickN"></span></summary>
        <div class="checks">${recipes.map(r => `<label><input type="checkbox" name="picked" value="${esc(r.id)}" ${w.picked.includes(r.id) ? 'checked' : ''}> <span translate="no">${esc(r.name)}</span></label>`).join('')}</div>
      </details>
      <details class="more" id="notesBox"><summary>My notes</summary>
        <textarea name="notes" rows="8" aria-label="My notes">${esc(w.notes ?? '')}</textarea>
        <button type="button" class="wide" id="merge">Make one plan with my notes</button><p id="mergeMsg"></p>
      </details>
    </form>
    <div id="out"></div>
    <details class="more no-print" id="word"><summary>Fill the school's Word form</summary>
      <label class="btn ghost">${tpl ? 'Change form' : 'Choose the Word file'}<input type="file" id="tplFile" accept=".docx,${DOCX}" hidden></label>
      <p id="tplMsg"></p>
      <form id="details" onsubmit="return false">
        <div class="row2">${field('name', 'Name')}${field('studentId', 'Student ID')}</div>
        <div class="row2">${field('trainer', 'Trainer')}${field('group', 'Group')}</div>
        <div class="row2"><label>Date<input name="date" type="date" value="${esc(w.date)}"></label>${field('assessment', 'Assessment no.', 'inputmode="numeric"')}</div>
      </form>
      <button type="button" class="wide" id="dl" ${tpl ? '' : 'disabled'}>Download Word file</button>
    </details>`, { back: exam ? `#/exam/${esc(exam.id)}/edit` : '#/home' });

  const form = document.getElementById('f'), details = document.getElementById('details'), out = document.getElementById('out');
  let current = null, books = [], merged = w.merged ?? null, steps = [];
  const read = () => {
    const fd = new FormData(form), dd = new FormData(details);
    return { ...Object.fromEntries(['name', 'studentId', 'trainer', 'group', 'date', 'assessment'].map(k => [k, dd.get(k).trim()])),
      picked: fd.getAll('picked'), notes: fd.get('notes') };
  };
  const save = () => db.put('settings', { id: 'workflow', ...read(), merged });
  // A plan merged with the notes stays in use until the dishes or the notes change
  const keyOf = v => `${v.picked.join(',')}\n${v.notes.trim()}`;
  const useMerged = () => merged?.key === keyOf(read());
  // Korean under each step: each dish's method is translated once and kept with the recipe, like cook mode.
  const showKo = async on => {
    const btn = document.getElementById('ko'), msg = document.getElementById('koMsg');
    let ko = [];
    if (on) {
      btn.classList.add('busy');
      msg.innerHTML = '<small>Translating…</small>';
      try { ko = await koFor(steps, books); msg.textContent = ''; }
      catch (err) { msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`; on = false; }
      finally { btn.classList.remove('busy'); }
    }
    out.querySelectorAll('.order .step-ko').forEach((el, i) => { el.textContent = ko[i] ?? ''; el.hidden = !ko[i]; });
    btn.setAttribute('aria-pressed', String(on));
    return on;
  };
  const draw = () => {
    const v = read();
    books = v.picked.map(id => recs.get(id)).filter(Boolean);
    document.getElementById('pickN').textContent = books.length ? `(${books.length})` : '';
    current = books.length ? workflowPlan(books.map(r => ({ ...fromBook(r), needs: books.flatMap((b, k) => uses(r, b.id) ? [k] : []) }))) : null;
    if (!current) { out.innerHTML = ''; return; }
    const { recipes: rs, timeline, totals } = current, mine = useMerged();
    // [{ text, dish, ko? (merged), ri, si (from the recipes) }]
    steps = mine ? merged.steps.map(x => ({ text: x.en || x.ko, dish: x.dish, ko: x.ko }))
      : timeline.rows.map(x => ({ text: rs[x.ri].steps[x.si], dish: rs[x.ri].name, ri: x.ri, si: x.si }));
    const koReady = mine || books.every(hasKo);
    out.innerHTML = `<div class="card"><div class="wf-head"><h2>Order${mine ? ' <span class="tag">With my notes</span>' : ''}</h2><button type="button" class="ghost sm no-print" id="ko" aria-pressed="false">Korean</button></div>
        <p id="koMsg"></p>
        <ol class="step-list order">${steps.map((x, i) => `<li><span class="step-n" aria-hidden="true">${i + 1}</span>
          <span>${x.dish ? `<small class="order-dish" translate="no">${esc(x.dish)}</small>` : ''}<span translate="no">${esc(x.text)}</span><small class="step-ko" translate="no" hidden></small></span></li>`).join('')}</ol></div>
      <div class="card wf"><h2>Ingredients</h2>
        <table><tbody>${totals.map(t => { const used = t.per.map((q, i) => q == null ? '' : `${rs[i].name} ${typeof q === 'number' ? niceAmount(q, t.unit) : q}`).filter(Boolean);
          return `<tr><td><span translate="no">${esc(t.name)}</span>${used.length > 1 ? `<br><small translate="no">${esc(used.join(' · '))}</small>` : ''}</td>
          <td class="n">${esc(t.total > 0 ? niceAmount(t.total, t.unit) : 'q.b.')}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="cta-bar no-print"><button type="button" id="cook">Start cooking</button></div>`;
    // The same plan picks up where you left off; a new plan starts at step 1
    document.getElementById('cook').onclick = async () => {
      const was = await db.get('settings', 'dayCook'), same = JSON.stringify(was?.steps) === JSON.stringify(steps);
      await db.put('settings', { id: 'dayCook', steps, bookIds: books.map(b => b.id), at: same ? was.at ?? 0 : 0 });
      go('#/workflow/cook');
    };
    const btn = document.getElementById('ko');
    btn.onclick = async () => db.put('settings', { id: 'cookKo', on: await showKo(btn.getAttribute('aria-pressed') !== 'true') });
    if (koPref?.on && koReady) showKo(true); // Korean already there: no call to Claude
  };
  form.addEventListener('change', () => { draw(); save(); });
  details.addEventListener('change', save);
  draw();
  document.getElementById('merge').onclick = async e => {
    const v = read(), msg = document.getElementById('mergeMsg');
    if (!books.length) { msg.innerHTML = '<small class="warn-text">Pick today\'s dishes first.</small>'; return; }
    e.target.classList.add('busy');
    msg.innerHTML = '<small>Making the plan… this takes up to a minute.</small>';
    try {
      merged = { key: keyOf(v), steps: await sync.mergePlan(books.map(r => ({ name: r.name, steps: splitSteps(r.method) })), v.notes) };
      await save();
      msg.textContent = '';
      document.getElementById('notesBox').open = false;
      draw();
    } catch (err) {
      msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`;
    } finally { e.target.classList.remove('busy'); }
  };

  document.getElementById('tplFile').onchange = async e => {
    const file = e.target.files[0], msg = document.getElementById('tplMsg');
    if (!file) return;
    const problem = await templateProblem(new Uint8Array(await file.arrayBuffer()));
    if (problem) { msg.innerHTML = `<small class="warn-text">${esc(problem)}</small>`; return; }
    await save();
    await db.put('settings', { id: 'workflowTemplate', name: file.name, data: await toBase64(file) });
    await workflowView(examId);
    document.getElementById('word').open = true;
  };
  document.getElementById('dl').onclick = async () => {
    const t = await db.get('settings', 'workflowTemplate'), msg = document.getElementById('tplMsg');
    if (!current) { msg.innerHTML = '<small class="warn-text">Paste your recipes first.</small>'; return; }
    const v = read();
    await save();
    const bytes = await fillPlan(fromBase64(t.data), { ...current, ...v, date: v.date ? v.date.split('-').reverse().join('/') : '' });
    await saveFile(new File([bytes], `Work flow plan ${v.date || today()}.docx`, { type: DOCX }));
  };
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
    ${!isNew && e.type === 'practical' ? `<div class="links" role="navigation" aria-label="Plan"><a href="#/workflow/${esc(e.id)}"><span>Work flow plan</span></a></div>` : ''}
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


// ---------- Checklists: opening, closing, weekly cleaning ----------

const DEFAULT_CHECKLISTS = {
  en: [
    ['Opening', 'day', ['Hands washed, apron and hat on', 'Fridge and freezer temperatures checked', 'Sanitiser made up and test strip checked', 'Benches and boards cleaned and sanitised',
      'Hand basin stocked with soap and paper towel', 'Deliveries checked and put away', 'Prep list checked']],
    ['Closing', 'day', ['Food covered, labelled and dated', 'Fridges closed and at 5 °C or below', 'Benches, boards and equipment cleaned and sanitised', 'Floors swept and mopped',
      'Bins emptied and cleaned', 'Gas, ovens and equipment off', 'Hand basin restocked']],
    ['Weekly clean', 'week', ['Fridge shelves and door seals cleaned', 'Oven and grill degreased', 'Extraction filters cleaned', 'Dry store checked for pests and use-by dates',
      'Freezer checked for frost and damaged seals', 'Floor drains cleaned']],
  ],
  ko: [
    ['오픈', 'day', ['손 씻기, 앞치마와 모자 착용', '냉장·냉동 온도 확인', '소독제 준비, 테스트 스트립 확인', '작업대와 도마 세척·소독', '손 세정대에 비누와 페이퍼 타월 채우기', '입고 물품 확인 후 정리', '프렙 리스트 확인']],
    ['마감', 'day', ['음식 덮고 라벨과 날짜 붙이기', '냉장고 문 닫힘, 5 °C 이하 확인', '작업대·도마·장비 세척·소독', '바닥 쓸고 닦기', '쓰레기통 비우고 세척', '가스, 오븐, 장비 끄기', '손 세정대 다시 채우기']],
    ['주간 청소', 'week', ['냉장고 선반과 문 고무패킹 청소', '오븐과 그릴 기름때 제거', '후드 필터 청소', '건식 창고 해충과 유통기한 점검', '냉동고 성에와 패킹 점검', '바닥 배수구 청소']],
  ],
};

// First visit: start from the usual kitchen lists (in the app's language). Deleting them all doesn't bring them back.
async function checklists() {
  let lists = await db.all('checklists');
  if (!lists.length && !(await db.get('settings', 'seeded'))?.checklists) {
    const t = Date.now();
    lists = DEFAULT_CHECKLISTS[LANG].map(([name, every, items], n) => ({ id: uid(), name, every, items, order: n, createdAt: t }));
    for (const l of lists) await db.put('checklists', l);
    await db.put('settings', { ...(await db.get('settings', 'seeded')), id: 'seeded', checklists: true });
  }
  return lists.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
}
const checkRecordId = (list, date = today()) => `${list.id}:${periodKey(list.every, date)}`;
const EVERY = { day: 'Every day', week: 'Every week' };

async function checklistsView() {
  const [lists, days] = await Promise.all([checklists(), db.all('checkdays')]);
  const rec = new Map(days.map(d => [d.id, d]));
  page('home', 'Checklists', lists.length ? `<ul class="list">${lists.map(l => {
    const p = checkProgress(l, rec.get(checkRecordId(l)));
    return `<li><a href="#/check/${esc(l.id)}"><div class="grow"><b>${esc(l.name)}</b><small>${EVERY[l.every]}</small></div>
      <span class="trail"><span class="${p.done === p.total ? 'ok-text' : ''}">${p.done} / ${p.total}</span><small>${l.every === 'week' ? 'this week' : 'today'}</small></span></a></li>`;
  }).join('')}</ul>
    <p class="muted center"><small>Ticks are saved with the date, so the lists double as your cleaning records.</small></p>`
    : '<div class="empty"><p>No checklists.</p><p>Make one for opening, closing or cleaning.</p></div>',
    { back: '#/home', action: newBtn('#/check/new/edit') });
}

async function checklistDay(id) {
  const [l, days] = await Promise.all([db.get('checklists', id), db.all('checkdays')]);
  if (!l) return go('#/checks');
  const rid = checkRecordId(l);
  let record = days.find(d => d.id === rid) ?? { id: rid, listId: l.id, period: periodKey(l.every, today()), done: [] };
  const history = days.filter(d => d.listId === l.id && d.id !== rid).sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8);
  page('home', l.name, `
    <div class="card stat-card prep-progress" id="prog"></div>
    <div class="card"><ul class="checklist">${(l.items ?? []).map((x, i) => `<li><label class="${record.done.includes(x) ? 'got' : ''}">
      <input type="checkbox" data-i="${i}" ${record.done.includes(x) ? 'checked' : ''}><span class="grow">${esc(x)}</span></label></li>`).join('')}</ul></div>
    ${history.length ? `<h2 class="day">Earlier</h2><ul class="list">${history.map(d => { const p = checkProgress(l, d); return `<li><div class="row-static">
      <div class="grow"><b>${esc(l.every === 'week' ? `Week of ${shortDate(d.period)}` : dateLabel(d.period))}</b></div>
      <span class="trail"><span class="${p.done === p.total ? 'ok-text' : 'warn-text'}">${p.done} / ${p.total}</span></span></div></li>`; }).join('')}</ul>` : ''}`,
    { back: '#/checks', action: `<a class="btn sm tint" href="#/check/${esc(l.id)}/edit">Edit</a>` });
  const prog = () => {
    const p = checkProgress(l, record);
    document.getElementById('prog').innerHTML = `<p class="stat-label">${l.every === 'week' ? 'This week' : 'Today'}</p><p class="stat ${p.done === p.total ? 'ok-text' : ''}">${p.done} / ${p.total}</p>
      <div class="progress"><i style="width:${p.total ? p.done / p.total * 100 : 0}%"></i></div>`;
  };
  document.querySelector('.checklist').addEventListener('change', async e => {
    const x = l.items[Number(e.target.dataset.i)];
    const done = new Set(record.done);
    if (e.target.checked) done.add(x); else done.delete(x);
    record = { ...record, done: l.items.filter(i => done.has(i)), updatedAt: Date.now() };
    e.target.closest('label').classList.toggle('got', e.target.checked);
    prog();
    await db.put('checkdays', record);
  });
  prog();
}

async function checklistEdit(id) {
  const isNew = id === 'new';
  const l = isNew ? { id: uid(), name: '', every: 'day', items: [], order: Date.now(), createdAt: Date.now() } : await db.get('checklists', id);
  if (!l) return go('#/checks');
  page('home', isNew ? 'New checklist' : 'Edit checklist', `<form id="f">
    <label>Name<input name="name" required placeholder="e.g. Closing, Pastry section" value="${esc(l.name)}"></label>
    <label>How often<select name="every">${Object.entries(EVERY).map(([k, v]) => `<option value="${k}" ${k === l.every ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Items, one per line<textarea name="items" required rows="9">${esc((l.items ?? []).join('\n'))}</textarea></label>
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: isNew ? '#/checks' : `#/check/${esc(l.id)}` });
  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const items = [...new Set(fd.get('items').split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
    await db.put('checklists', { ...l, name: fd.get('name').trim(), every: fd.get('every'), items, updatedAt: Date.now() });
    go(`#/check/${l.id}`);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm(`Delete "${l.name}"? Its past records go too.`)) {
      for (const d of (await db.all('checkdays')).filter(d => d.listId === l.id)) await db.del('checkdays', d.id);
      await db.del('checklists', l.id); go('#/checks');
    }
  });
}

// ---------- Today: what needs doing, gathered from every part of the app ----------

async function todayItems() {
  const [exams, attempts, st, temps, prep, logs, recipes] = await Promise.all([db.all('exams'), db.all('attempts'), studyState(), db.all('temps'),
    db.get('settings', 'prepPlan'), classLogs(), db.all('recipes')]);
  const items = [], t = today();
  const next = exams.filter(e => daysUntil(e.date, t) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) {
    const r = examReadiness(next, attempts), d = daysUntil(next.date, t), behind = r.rows.length - r.ready;
    items.push([`#/exam/${next.id}/edit`, behind ? `${next.title}, ${behind} to practise` : next.title, dLabel(d), d <= 3 && behind]);
  }
  const due = cardsOf(await decks()).filter(c => isDue(st, c.id)).length;
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
  // Checklists, once you use them: the next unfinished daily list (opening, then closing) and this week's
  const days = await db.all('checkdays');
  if (days.length) {
    const lists = await checklists(), rec = new Map(days.map(d => [d.id, d]));
    const rows = ['day', 'week'].map(every => lists.find(x => x.every === every && (y => y.done < y.total)(checkProgress(x, rec.get(checkRecordId(x)))))).filter(Boolean)
      .map(l => { const p = checkProgress(l, rec.get(checkRecordId(l))); return [`#/check/${l.id}`, l.name, `${p.done} / ${p.total}`]; });
    items.unshift(...rows);
  }
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
        <label>Ingredient<select name="item">${items.map((it, i) => (it.qty > 0 ? `<option value="${i}">${esc(nameOf(it))} (${fmtQty(it.qty)} ${esc(it.unit)})</option>` : '')).join('')}</select></label>
        <div class="row2"><label>I have<input name="have" type="number" min="0" step="any" inputmode="decimal" placeholder="e.g. 3"></label>
          <label>Unit<select name="haveUnit">${opts(UNITS, items.find(it => it.qty > 0)?.unit)}</select></label></div>
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
      <label>Ingredient<select name="what">${CALC_INGREDIENTS.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></label>
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
    <p class="muted center"><small>Cup weights are approximate (spooned and levelled). Weigh when it matters.</small></p>`, { back: '#/home' });

  // "1 1/2", "½", "0.5" all work in the amount box
  const amount = v => { const p = parseIngredientLine(`${v} x`); return p?.qty ?? NaN; };
  const cups = document.getElementById('cups');
  const drawCups = () => {
    const ml = amount(cups.amt.value) * MEASURES[sys][cups.unit.value];
    const g = convertFor(ml, 'ml', 'g', cups.what.value);
    document.getElementById('cupOut').textContent = Number.isFinite(g) ? `≈ ${g >= 100 ? Math.round(g) : fmtQty(g)} g` : '-';
    document.getElementById('cupSub').textContent = Number.isFinite(ml) ? `${fmtQty(ml)} ml ${sys === 'au' ? 'Australian' : 'US'} measure, ${cups.what.selectedOptions[0].text.toLowerCase()} at ${densityFor(cups.what.value)} g/ml` : 'Enter an amount, e.g. 1 1/2';
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
  // A step's timer button counts down in place while its timer runs
  document.querySelectorAll('button[data-timer][data-label]').forEach(b => {
    b.dataset.idle ??= b.textContent;
    const t = timers.find(x => x.label === b.dataset.label);
    if (!t && !b.classList.contains('running')) return; // idle and never ran: leave it alone
    b.classList.toggle('running', !!t);
    b.textContent = !t ? b.dataset.idle : t.done ? 'Done' : clock(t.end - Date.now());
  });
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

// Step-by-step cooking, shared by one recipe and the day's work flow plan. steps: [{ text, dish? }].
// The step you're on is big and outlined, done ones are dimmed, the rest wait below.
function cookStepsHtml(steps) {
  return `<div class="cook-head"><p class="step-count" id="stepCount"></p>
      <button type="button" class="ghost sm" id="ko" aria-pressed="false">Korean</button></div><p id="koMsg"></p>
    <ol class="cook-steps" id="steps">${steps.map(({ text, dish }, i) => {
      const ds = findDurations(text);
      return `<li data-i="${i}"><button type="button" class="cook-step" data-go="${i}"><span class="step-n" aria-hidden="true">${i + 1}</span>
        <span>${dish ? `<small class="order-dish" translate="no">${esc(dish)}</small>` : ''}${esc(text)}<small class="step-ko" translate="no" hidden></small></span></button>
        ${ds.length ? `<div class="step-timers">${ds.map(d => `<button type="button" class="tint sm" data-timer="${d.seconds}" data-label="${esc(`Step ${i + 1}: ${fmtDuration(d.seconds)}`)}">Start ${esc(fmtDuration(d.seconds))} timer</button>`).join('')}</div>` : ''}</li>`;
    }).join('')}</ol>
    <div class="cook-dock"><div id="cookTimers" aria-live="polite"></div>
      <div class="cook-nav" id="cookNav"><button type="button" class="ghost" id="prev">Back</button><button type="button" id="next">Next step</button></div></div>`;
}
// ko(): the Korean for every step (may ask Claude); koReady: it's already there, so it can show on open.
// start: the step to open on; onStep(at) hears every move, to remember it.
async function cookSteps(steps, { ko, koReady, finish, timerId = null, start = 0, onStep = () => {} }) {
  keepAwake(true);
  drawTimers();
  const koPref = await db.get('settings', 'cookKo');
  const stepsEl = document.getElementById('steps'), prev = document.getElementById('prev'), next = document.getElementById('next');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let at = start;
  const drawSteps = scroll => {
    onStep(at);
    stepsEl.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('now', i === at);
      li.classList.toggle('done', i < at);
      li.querySelector('.cook-step').toggleAttribute('aria-current', i === at);
      li.querySelector('.step-n').textContent = i < at ? '✓' : i + 1;
    });
    document.getElementById('stepCount').textContent = `Step ${at + 1} of ${steps.length}`;
    prev.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? 'Finish' : 'Next step';
    if (scroll) stepsEl.children[at].scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  };
  // Korean under each step, for reading along; the choice is remembered everywhere.
  const koBtn = document.getElementById('ko');
  const showKo = async on => {
    const msg = document.getElementById('koMsg');
    let k = [];
    if (on) {
      koBtn.classList.add('busy');
      msg.innerHTML = '<small>Translating…</small>';
      try { k = await ko(); msg.textContent = ''; }
      catch (err) { msg.innerHTML = `<small class="warn-text">${esc(err.message)}</small>`; on = false; }
      finally { koBtn.classList.remove('busy'); }
    }
    stepsEl.querySelectorAll('.step-ko').forEach((el, i) => { el.textContent = k[i] ?? ''; el.hidden = !k[i]; });
    koBtn.setAttribute('aria-pressed', String(on));
    return on;
  };
  if (koPref?.on && koReady) showKo(true); // no call to Claude on open
  koBtn.onclick = async () => db.put('settings', { id: 'cookKo', on: await showKo(koBtn.getAttribute('aria-pressed') !== 'true') });
  drawSteps(at > 0);
  prev.onclick = () => { at = Math.max(0, at - 1); drawSteps(true); };
  next.onclick = () => {
    if (at === steps.length - 1) return finish();
    at++;
    drawSteps(true);
  };
  stepsEl.addEventListener('click', e => {
    const t = e.target.closest('[data-timer]');
    if (t) return timers.some(x => x.label === t.dataset.label && !x.done) || startTimer(t.dataset.label, Number(t.dataset.timer), timerId); // already running: no second one
    const s = e.target.closest('[data-go]');
    if (s) { at = Number(s.dataset.go); drawSteps(false); }
  });
}

async function cookView(id) {
  const r = await db.get('recipes', id);
  if (!r) return go('#/recipes');
  const [ings, recipes, attempts] = await Promise.all([ingMap(), db.all('recipes'), attemptsFor(id)]);
  const lastNext = attempts.find(a => a.next);
  const recs = toMap(recipes);
  const steps = splitSteps(r.method);
  let portions = r.portions;
  const ticked = new Set();

  page('recipes', r.name, `
    ${lastNext ? `<p class="tip"><small><b>Last time (${esc(dateLabel(lastNext.date))}), you noted:</b> ${esc(lastNext.next)}</small></p>` : ''}
    <details class="more cook-ings" ${steps.length ? '' : 'open'}><summary>Ingredients (${(r.items ?? []).length})</summary>
      <label class="inline">Portions <input id="cookPortions" type="number" min="1" step="1" inputmode="numeric" value="${esc(r.portions)}"></label>
      <ul class="checklist" id="checklist"></ul></details>
    ${steps.length ? cookStepsHtml(steps.map(text => ({ text })))
      : `<p class="muted center">No method yet. <a href="#/recipe/${esc(r.id)}/edit">Add the steps</a> to cook step by step.</p>`}`, { back: `#/recipe/${esc(r.id)}` });

  const drawChecklist = () => {
    const f = portions / r.portions;
    document.getElementById('checklist').innerHTML = (r.items ?? []).map((it, i) => {
      const name = it.recipeId ? `${recs.get(it.recipeId)?.name ?? '(deleted)'} (sub-recipe)` : ings.get(it.ingredientId)?.name ?? '(deleted)';
      return `<li><label class="${ticked.has(i) ? 'got' : ''}"><input type="checkbox" data-i="${i}" ${ticked.has(i) ? 'checked' : ''}>
        <span class="grow">${esc(name)}</span><b>${esc(niceAmount(it.qty * f, it.unit))}</b></label></li>`;
    }).join('') || '<li class="muted">No ingredients yet.</li>';
  };
  drawChecklist();
  if (steps.length) cookSteps(steps.map(text => ({ text })), { ko: () => methodKo(r), koReady: hasKo(r), timerId: r.id, finish: () => go(`#/recipe/${r.id}/attempt`) });
  else keepAwake(true);
  document.getElementById('cookPortions').addEventListener('input', e => { portions = Number(e.target.value) || r.portions; drawChecklist(); });
  document.getElementById('checklist').addEventListener('change', e => {
    const i = Number(e.target.dataset.i);
    if (e.target.checked) ticked.add(i); else ticked.delete(i);
    e.target.closest('label').classList.toggle('got', e.target.checked);
  });
}

// Korean for plan steps: a merged plan carries its own; recipe steps use each recipe's translation.
async function koFor(steps, books) {
  if (!steps.some(x => x.ri != null)) return steps.map(x => x.ko ?? '');
  const ko = await Promise.all(books.map(b => (b ? methodKo(b) : []))); // a recipe deleted since: no Korean
  return steps.map(x => ko[x.ri]?.[x.si] ?? '');
}

// The day's work flow plan, cooked step by step. The plan screen saves it (settings 'dayCook':
// steps, the recipes' ids, and the step you're on), so a reload or another phone opens where you left off.
async function dayCookView() {
  const d = await db.get('settings', 'dayCook');
  if (!d?.steps?.length) return go('#/workflow');
  const books = await Promise.all(d.bookIds.map(id => db.get('recipes', id)));
  page('home', 'Work flow plan', cookStepsHtml(d.steps), { back: '#/workflow' });
  cookSteps(d.steps, {
    ko: () => koFor(d.steps, books),
    koReady: !d.steps.some(x => x.ri != null) || books.every(b => !b || hasKo(b)),
    start: Math.min(d.at ?? 0, d.steps.length - 1),
    onStep: at => at !== d.at && db.put('settings', Object.assign(d, { at })),
    finish: async () => { await db.put('settings', { ...d, at: 0 }); go('#/workflow'); },
  });
}

// ---------- Ingredients: price, trim yield and allergens, used by recipe costing and allergen lists ----------

// Saves ingredients, keeping a short price history.
async function saveIngredients(nexts) {
  const before = await ingMap();
  for (const n of nexts) await db.put('ingredients', withPriceHistory(before.get(n.id), n, today()));
}

async function ingredientsList() {
  const [ings, recipes] = await Promise.all([db.all('ingredients'), db.all('recipes')]);
  ings.sort(byName);
  const used = id => recipes.filter(r => r.items?.some(it => it.ingredientId === id)).length;
  const missing = ings.filter(i => !hasPrice(i)).length;
  page('home', 'Ingredients', ings.length ? `
    <p class="muted">Prices are optional: add them when a recipe needs costing. Allergens set here show on every recipe that uses the ingredient.</p>
    <div class="bar"><input type="search" id="q" placeholder="Search ingredients" aria-label="Search ingredients"></div>
    <ul class="list">${ings.map(i => `<li data-q="${esc(i.name.toLowerCase())}"><a href="#/ingredient/${esc(i.id)}/edit">
      <div class="grow"><b>${esc(i.name)}</b><small>${i.allergens?.length ? `<span class="alert-text">${i.allergens.map(esc).join(', ')}</span>` : `in ${used(i.id)} recipe${used(i.id) === 1 ? '' : 's'}`}</small></div>
      <span class="trail">${hasPrice(i) ? money(i.price) : '<span class="muted">-</span>'}<small>${hasPrice(i) ? (i.unit === 'each' ? 'each' : `per ${esc(i.unit)}`) : ''}</small></span></a></li>`).join('')}</ul>
    ${missing ? `<p class="muted center"><small>${missing} without a price. Recipes using them show an incomplete cost.</small></p>` : ''}`
    : '<div class="empty"><p>No ingredients yet.</p><p>They are added for you as you write recipes.</p></div>',
    { back: '#/home', action: newBtn('#/ingredient/new/edit') });
  const q = document.getElementById('q');
  q?.addEventListener('input', () => document.querySelectorAll('.list li').forEach(li => { li.hidden = !li.dataset.q.includes(q.value.toLowerCase()); }));
}

async function ingredientEdit(id) {
  const isNew = id === 'new';
  const i = isNew ? { id: uid(), unit: 'kg', yieldPct: 100, allergens: [] } : await db.get('ingredients', id);
  if (!i) return go('#/ingredients');
  const back = /^#\/recipe\//.test(prevHash) ? prevHash : '#/ingredients';
  const usedIn = isNew ? [] : (await db.all('recipes')).filter(r => r.items?.some(it => it.ingredientId === i.id)).sort(byName);
  page('home', isNew ? 'New ingredient' : 'Edit ingredient', `<form id="f">
    <label>Name<input name="name" required value="${esc(i.name)}"></label>
    <div class="row2">
      <label>Price (AUD)<input name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Add later" value="${esc(i.price)}"></label>
      <label>Per<select name="unit">${opts(PURCHASE_UNITS, i.unit)}</select></label>
    </div>
    <label>Yield % <small>(usable after trimming/peeling)</small><input name="yieldPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(i.yieldPct)}"></label>
    ${(i.priceHistory ?? []).length > 1 ? `<p><small>Price history: ${i.priceHistory.slice(-5).reverse().map(h => `${esc(new Date(h.date + 'T00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' }))} ${money(h.price)}/${esc(h.unit)}`).join(', ')}</small></p>` : ''}
    ${isNew ? '' : `<p><small>${i.lastYieldTest ? `Last yield test ${esc(dateLabel(i.lastYieldTest.date))}: ${pct(i.lastYieldTest.yieldPct)}. ` : ''}<a href="#/yield/${esc(i.id)}">Run a yield test</a></small></p>`}
    <h2>Allergens</h2>
    <div class="checks">${ALLERGENS.map(a => `<label><input type="checkbox" name="allergens" value="${a}" ${i.allergens?.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div>
    ${isNew ? '' : `<h2 style="margin-top:24px">Used in</h2>${usedIn.length
      ? `<div class="links" role="navigation" aria-label="Recipes using ${esc(i.name)}">${usedIn.map(r => `<a href="#/recipe/${esc(r.id)}">${esc(r.name)}</a>`).join('')}</div>`
      : '<p class="muted">Not used in any recipe yet.</p>'}`}
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back });

  const form = document.getElementById('f');
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    await saveIngredients([{ ...i, name: fd.get('name').trim(), price: num(fd.get('price')), unit: fd.get('unit'),
      yieldPct: num(fd.get('yieldPct')), allergens: fd.getAll('allergens'), updatedAt: Date.now() }]);
    go(back);
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    const n = (await db.all('recipes')).filter(r => r.items?.some(it => it.ingredientId === i.id)).length;
    if (confirm(n ? `"${i.name}" is used in ${n} recipe(s). Their costing will show a warning. Delete anyway?` : `Delete "${i.name}"?`)) {
      await db.del('ingredients', i.id); go('#/ingredients');
    }
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

  page('home', 'Yield test', `
    <form class="card" id="yt" onsubmit="return false">
      <label>Ingredient<select name="ing"><option value="">Choose an ingredient…</option>
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
    <div id="result"></div>`, { back: ing ? `#/ingredient/${esc(ing.id)}/edit` : '#/home' });

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
        : '<p class="muted"><small>Choose an ingredient above to save this yield to it.</small></p>'}</div>`;
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

// ---------- Log ----------

const PERIODS = ['Breakfast', 'Lunch', 'Dinner', 'Function', 'Prep shift', 'Other'];
// The log is for class services. Work shifts logged by older versions stay in storage but aren't shown or counted.
const classLogs = async () => (await db.all('logs')).filter(l => l.type !== 'work');

// Each recipe ticked in a class log is also a practice cook of it (rating and chef feedback), so the
// recipe's practice list, cooking-mode notes and exam readiness all count class services. One record
// per log and recipe: re-saving the log updates it, unticking or deleting the log removes it.
async function syncLogPractice(log) {
  const mine = (await db.all('attempts')).filter(a => a.logId === log.id);
  const keep = new Set((log.cooked ?? []).map(c => c.recipeId));
  for (const a of mine) if (!keep.has(a.recipeId)) await db.del('attempts', a.id);
  for (const c of log.cooked ?? []) {
    const id = `${log.id}:${c.recipeId}`, old = mine.find(a => a.id === id);
    await db.put('attempts', { ...old, id, recipeId: c.recipeId, logId: log.id, date: log.date, rating: c.rating ?? null,
      notes: log.feedback?.trim() || old?.notes || '', createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now() });
  }
}
const STATIONS = ['Pasta', 'Sauce', 'Grill', 'Larder / Garde manger', 'Pastry', 'Fry', 'Prep', 'Pizza', 'Pass'];

async function logList() {
  const [logs, s, recipes] = await Promise.all([classLogs(), settings(), db.all('recipes')]);
  logs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const recs = toMap(recipes);
  const what = l => [...(l.cooked ?? []).map(c => recs.get(c.recipeId)?.name).filter(Boolean), l.dishes?.trim()].filter(Boolean).join(', ');
  const hours = logs.reduce((n, l) => n + (l.hours || 0), 0);
  const last = [...logs].sort((a, b) => b.createdAt - a.createdAt)[0];
  const doneNow = logs.some(l => l.date === today() && l.period === periodNow());
  page('log', 'Class log', `
    <a class="card quick-log" href="#/log/new/edit">
      <span class="grow"><b>${doneNow ? `${periodNow()} logged. Log another` : `Log today’s ${periodNow().toLowerCase()} service`}</b>
        <small>${last ? esc([last.venue, last.station].filter(Boolean).join(' · ') || 'Same as last time') : 'Takes a few seconds'}</small></span>
      <span class="btn sm">${ICON.plus}Log</span></a>
    <div class="card stat-card"><p class="stat-label">School service periods</p>
      <p class="stat">${logs.length} / ${esc(s.logTarget)}</p>
      <div class="progress"><i style="width:${Math.min(100, logs.length / s.logTarget * 100)}%"></i></div>
      <p class="stat-sub">${fmtQty(hours)} hours in the kitchen</p></div>
    ${logs.length ? `<ul class="list">${logs.map(l => `<li><a href="#/log/${esc(l.id)}/edit">
      ${l.photo ? `<img src="${esc(l.photo)}" alt="">` : ''}
      <div class="grow"><b>${esc(new Date(l.date + 'T00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }))}, ${esc(l.period)}</b>
        <small>${esc([l.station, what(l)].filter(Boolean).join(' · ') || l.venue || 'No venue')}</small></div>
      ${l.hours ? `<span class="trail">${esc(l.hours)} h</span>` : ''}</a></li>`).join('')}</ul>`
      : '<p class="empty">Log every class service: what you cooked, your station and what chef said.</p>'}`);
}

const periodNow = () => { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 15 ? 'Lunch' : 'Dinner'; };

async function logEdit(id) {
  const isNew = id === 'new';
  const logs = await classLogs();
  const last = logs.sort((a, b) => b.createdAt - a.createdAt)[0];
  // A new entry starts from your last one (kitchen, station, hours) and the service happening now
  const l = isNew ? { id: uid(), date: today(), venue: last?.venue ?? '', station: last?.station ?? '', hours: last?.hours ?? null, period: periodNow() }
    : logs.find(x => x.id === id);
  if (!l) return go('#/log');
  const [recipes, attempts] = await Promise.all([db.all('recipes'), db.all('attempts')]);
  // Ticked dishes and their portions and ratings (a rating changed on the recipe's practice record wins)
  const cooked = new Map((l.cooked ?? []).map(c => [c.recipeId, { ...c, rating: attempts.find(a => a.id === `${l.id}:${c.recipeId}`)?.rating ?? c.rating }]));
  // Most likely first: what you cooked in recent classes, then favourites, then A to Z
  const recent = new Map();
  [...logs].sort((a, b) => b.date.localeCompare(a.date)).forEach(x => (x.cooked ?? []).forEach(c => recent.has(c.recipeId) || recent.set(c.recipeId, recent.size)));
  const rank = r => recent.get(r.id) ?? (r.fav ? 1e4 : 2e4);
  recipes.sort((a, b) => rank(a) - rank(b) || byName(a, b));
  const SHOW = 8;
  page('log', isNew ? 'New service' : 'Edit service', `<form id="f">
    <div class="row2">
      <label>Date<input name="date" type="date" required value="${esc(l.date)}"></label>
      <label>Service<select name="period">${opts(PERIODS, l.period)}</select></label>
    </div>
    <label>Kitchen<input name="venue" list="venues" placeholder="e.g. AMCA training kitchen" value="${esc(l.venue)}"></label>
    ${datalist('venues', logs.map(x => x.venue))}
    <div class="row2">
      <label>Station<input name="station" list="stations" value="${esc(l.station)}"></label>
      <label>Hours<input name="hours" type="number" min="0" step="0.25" inputmode="decimal" value="${esc(l.hours)}"></label>
    </div>
    ${datalist('stations', [...STATIONS, ...logs.map(x => x.station)])}
    <h2>What did you cook?</h2>
    ${recipes.length ? `${recipes.length > SHOW ? '<div class="bar"><input type="search" id="dq" placeholder="Search your recipes" aria-label="Search your recipes"></div>' : ''}
      <div class="checks" id="dishPick">${recipes.map((r, i) => `<label data-q="${esc(r.name.toLowerCase())}" ${i >= SHOW && !cooked.has(r.id) ? 'hidden' : ''}>
        <input type="checkbox" name="cooked" value="${esc(r.id)}" ${cooked.has(r.id) ? 'checked' : ''}> ${esc(r.name)}</label>`).join('')}</div>
      ${recipes.length > SHOW ? `<button type="button" class="link" id="allDishes">Show all ${recipes.length} recipes</button>` : ''}
      <div id="cookedRows"></div>`
      : '<p class="muted">Add your class recipes to the book, then tick them here.</p>'}
    <label style="margin-top:16px">Other dishes <small>(not in your book)</small><input name="dishes" placeholder="e.g. staff meal" value="${esc(l.dishes)}"></label>
    <label>Chef feedback / what to improve <small>(saved with each dish's practice)</small><textarea name="feedback">${esc(l.feedback)}</textarea></label>
    ${photoField(l.photo)}
    <div class="actions"><button type="submit">Save</button>${isNew ? '' : '<button type="button" class="danger" id="del">Delete</button>'}</div>
  </form>`, { back: '#/log' });

  const form = document.getElementById('f'), rows = document.getElementById('cookedRows'), pick = document.getElementById('dishPick');
  const recs = toMap(recipes);
  // One row per ticked dish: portions and a rating. Values live in `cooked`, so redrawing keeps them.
  const drawRows = () => {
    if (!rows) return;
    const ids = [...pick.querySelectorAll('input:checked')].map(x => x.value);
    rows.innerHTML = ids.length ? `<div class="card cooked-card"><h3>How did each go?</h3>${ids.map(rid => { const c = cooked.get(rid) ?? {}, name = recs.get(rid)?.name ?? '';
      return `<div class="cooked-row" data-id="${esc(rid)}"><div class="cooked-head"><b>${esc(name)}</b>
        <input type="number" min="0" step="1" inputmode="numeric" data-k="portions" placeholder="Portions" aria-label="Portions of ${esc(name)}" value="${esc(c.portions)}"></div>
        <fieldset class="rating"><legend class="sr-only">Rating for ${esc(name)}</legend>${[1, 2, 3, 4, 5].map(i => `<label><input type="radio" name="rate-${esc(rid)}" value="${i}" ${i === c.rating ? 'checked' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg><span class="sr-only">${i} star${i > 1 ? 's' : ''}</span></label>`).join('')}</fieldset></div>`; }).join('')}</div>` : '';
  };
  rows?.addEventListener('input', e => {
    const id = e.target.closest('.cooked-row')?.dataset.id;
    if (!id) return;
    const c = { recipeId: id, ...cooked.get(id) };
    if (e.target.dataset.k === 'portions') c.portions = num(e.target.value); else c.rating = Number(e.target.value);
    cooked.set(id, c);
  });
  pick?.addEventListener('change', drawRows);
  const dq = document.getElementById('dq');
  dq?.addEventListener('input', () => pick.querySelectorAll('label').forEach((lb, i) => {
    lb.hidden = dq.value ? !lb.dataset.q.includes(dq.value.toLowerCase()) : i >= SHOW && !lb.querySelector('input').checked;
  }));
  document.getElementById('allDishes')?.addEventListener('click', e => { pick.querySelectorAll('label').forEach(lb => { lb.hidden = false; }); e.target.remove(); });
  drawRows();

  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const next = { ...l, date: fd.get('date'), type: 'school', venue: fd.get('venue').trim(), period: fd.get('period'),
      hours: num(fd.get('hours')), station: fd.get('station').trim(), dishes: fd.get('dishes').trim(), feedback: fd.get('feedback'),
      cooked: fd.getAll('cooked').map(rid => ({ recipeId: rid, portions: cooked.get(rid)?.portions ?? null, rating: cooked.get(rid)?.rating ?? null })),
      photo: await photoValue(fd, l.photo), createdAt: l.createdAt ?? Date.now(), updatedAt: Date.now() };
    await db.put('logs', next);
    await syncLogPractice(next);
    go('#/log');
  };
  document.getElementById('del')?.addEventListener('click', async () => {
    if (confirm('Delete this service entry? Its practice records on recipes go too.')) {
      await syncLogPractice({ id: l.id, cooked: [] });
      await db.del('logs', l.id); go('#/log');
    }
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
    ${days.length ? days.map(d => `<h2 class="day">${esc(new Date(d + 'T00:00').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</h2>
      <ul class="list">${temps.filter(t => t.at.startsWith(d)).map(t => {
        const st = tempStatus(t);
        return `<li><a href="#/temp/${esc(t.id)}/edit"><div class="grow"><b>${esc(t.item || TEMP_CHECKS[t.type]?.label)}</b>
          <small>${esc(t.at.slice(11, 16))} · ${esc(TEMP_CHECKS[t.type]?.label ?? t.type)}${t.action ? `<br>Action: ${esc(t.action)}` : ''}</small></div>
          <span class="trail">${esc(tempValue(t))}${badge(st)}</span></a></li>`;
      }).join('')}</ul>`).join('')
      : '<p class="empty">Record fridge, freezer, delivery, hot-holding, cooking and cooling temperatures. Each check is marked PASS or FAIL against food safety limits.</p>'}
    ${temps.length ? '<div class="actions no-print"><button type="button" class="ghost" id="print">Print</button></div>' : ''}`,
    { back: '#/home', action: newBtn('#/temp/new/edit') });
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
    const venue = l.venue || 'Training kitchen', key = venue;
    const v = m.get(key) ?? { venue, count: 0, hours: 0, first: l.date, last: l.date, stations: new Set() };
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
  const [recipes, logs, ings, s, saved, attempts] = await Promise.all([db.all('recipes'), classLogs(), ingMap(), settings(), db.get('settings', 'portfolio'), db.all('attempts')]);
  recipes.sort(byName);
  const recs = toMap(recipes);
  let pf = { headline: '', contact: '', bio: '', recipeIds: [], showCosting: false, ...saved, id: 'portfolio' };
  const srcLabel = { school: 'Training', work: 'Work', own: 'Original', web: 'Web recipe', shared: 'Shared recipe' };

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
    <div class="cta-bar no-print"><button id="print">Print or save as PDF</button></div>`, { back: '#/home' });

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
    const hours = logs.reduce((n, l) => n + (l.hours || 0), 0);
    const exp = experience(logs);
    sheet.innerHTML = `
      <div class="sheet-head"><div><p class="eyebrow">Culinary portfolio</p><h1>${esc(s.cookName || 'Your name')}</h1>
        ${pf.headline ? `<p><b>${esc(pf.headline)}</b></p>` : ''}${pf.contact ? `<p class="muted">${esc(pf.contact)}</p>` : ''}</div></div>
      ${pf.bio ? `<p class="bio">${esc(pf.bio)}</p>` : ''}
      <div class="stats">
        <div><b>${logs.length}</b><small>service periods</small></div><div><b>${attempts.length}</b><small>practice cooks logged</small></div>
        <div><b>${fmtQty(hours)}</b><small>hours logged</small></div><div><b>${recipes.length}</b><small>recipes in my book</small></div></div>
      ${exp.length ? `<h2>Training kitchen experience</h2><ul class="exp">${exp.map(v => `<li><b>${esc(v.venue)}</b><br>
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
    page('home', 'Reset password', `<div class="card"><p class="warn">⚠ ${esc(recovery.error)}</p>
      <p>Reset links work once and expire after a while. Request a new one from <a href="#/settings">Settings → Forgot password?</a></p></div>`, { back: '#/settings' });
    return;
  }
  page('home', 'Reset password', `<form class="card" id="rp">
    <label>New password <small>(8+ characters)</small><input name="p1" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Repeat new password<input name="p2" type="password" autocomplete="new-password" minlength="8" required></label>
    <button type="submit">Set new password</button> <p id="rpMsg" class="muted"></p></form>`, { back: '#/settings' });
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
    <div class="card"><h2>Language</h2>
      <div class="seg" role="tablist" aria-label="Language" translate="no" style="margin:0">${[['en', 'English'], ['ko', '한국어']].map(([k, l]) =>
        `<button type="button" role="tab" data-lang="${k}" aria-selected="${k === LANG}">${l}</button>`).join('')}</div></div>
    <div class="card" id="acct"></div>
    <form id="f" class="card">
      <h2>You <small id="saved" class="ok-text"></small></h2>
      <label>Your name <small>(shown on recipe cards)</small><input name="cookName" autocomplete="name" value="${esc(s.cookName)}"></label>
      <label>Default target food cost %<input name="targetCostPct" type="number" min="1" max="100" step="any" inputmode="decimal" required value="${esc(s.targetCostPct)}"></label>
      <label>School service periods required<input name="logTarget" type="number" min="1" step="1" inputmode="numeric" required value="${esc(s.logTarget)}"></label>
    </form>
    <div class="card"><h2>Backup</h2>
      <p class="muted">Last backup: <b>${s.lastBackup ? esc(new Date(s.lastBackup).toLocaleString(locale)) : 'never'}</b>${est ? ` · Using ${(est.usage / 1e6).toFixed(1)} MB` : ''}</p>
      <div class="actions"><button class="ghost" id="export">Export backup</button><label class="btn ghost">Import<input type="file" id="import" accept="application/json,.json" hidden></label></div>
    </div>
    <form class="card" id="fb">
      <h2>Feedback</h2>
      <label>What's missing, confusing or broken?<textarea name="message" maxlength="2000" required placeholder="e.g. I'd like to…"></textarea></label>
      <button type="submit" class="ghost">Send feedback</button> <span id="fbMsg" class="muted"></span>
    </form>
    <div class="actions"><button type="button" class="ghost" id="invite">Invite classmates</button></div><p id="inviteMsg" class="muted center"></p>
    <p class="muted center"><small>Pinch v${VERSION}</small></p>`, { back: '#/home' });

  document.querySelector('[data-lang]').parentElement.onclick = e => { const l = e.target.closest('[data-lang]')?.dataset.lang; if (l && l !== LANG) setLang(l); };
  const acct = document.getElementById('acct');
  drawAccount = () => {
    if (!acct.isConnected) return;
    if (db.DEMO) { acct.innerHTML = '<h2>Account &amp; sync</h2><p class="muted">Turned off in the demo. <a href="./">Open Pinch</a> to use your own data.</p>'; return; }
    const st = sync.status();
    const err = st.error ? `<p class="warn">⚠ ${esc(st.error)}</p>` : '';
    acct.innerHTML = st.email ? `<h2>Account &amp; sync</h2>
      <p>Signed in as <b>${esc(st.email)}</b></p>
      <p class="muted">${st.syncing ? 'Syncing…' : st.lastSync ? `Last synced ${esc(new Date(st.lastSync).toLocaleString(locale))}` : 'Not synced yet'}</p>${err}
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
  // Saves as you go: no Save button to forget
  form.onsubmit = e => e.preventDefault();
  form.addEventListener('change', async () => {
    if (!form.checkValidity()) return form.reportValidity();
    const fd = new FormData(form);
    await db.put('settings', { ...(await settings()), id: 'settings', targetCostPct: num(fd.get('targetCostPct')), logTarget: num(fd.get('logTarget')), cookName: fd.get('cookName').trim() });
    document.getElementById('saved').textContent = 'Saved';
  });

  document.getElementById('export').onclick = async () => {
    if (!await saveFile(new File([JSON.stringify(await db.exportAll())], `pinch-backup-${today()}.json`, { type: 'application/json' }))) return;
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
  await db.put('recipes', { id: 's-pomo', name: 'Tomato sauce', italian: 'Salsa di pomodoro', category: 'Sauce', source: 'school', portions: 10, targetCostPct: null, menuPrice: null, yieldQty: 2.2, yieldUnit: 'L',
    items: [{ ingredientId: 's-tom', qty: 2500, unit: 'g' }, { ingredientId: 's-oil', qty: 150, unit: 'ml' }, { ingredientId: 's-gar', qty: 40, unit: 'g' },
      { ingredientId: 's-oni', qty: 300, unit: 'g' }, { ingredientId: 's-bas', qty: 1, unit: 'each' }],
    method: '1. Sweat onion and garlic in olive oil, no colour.\n2. Add crushed tomatoes, simmer 45 min.\n3. Finish with torn basil. Season.', createdAt: t, updatedAt: t });
  await db.put('recipes', { id: 's-pasta', name: 'Fresh egg pasta', italian: "Pasta fresca all'uovo", category: 'Pasta', source: 'school', portions: 6, targetCostPct: null, menuPrice: null, yieldQty: 0.9, yieldUnit: 'kg',
    items: [{ ingredientId: 's-flo', qty: 600, unit: 'g' }, { ingredientId: 's-egg', qty: 6, unit: 'each' }, { ingredientId: 's-par', qty: 60, unit: 'g' }],
    method: '1. Well the flour, add eggs, bring together.\n2. Knead 10 min until smooth. Rest 30 min wrapped.\n3. Roll to setting 6, cut.', createdAt: t, updatedAt: t });
  await db.put('recipes', { id: 's-tag', name: 'Tagliatelle with tomato sauce', italian: 'Tagliatelle al pomodoro', category: 'Main', source: 'school', portions: 1, targetCostPct: null, menuPrice: 26,
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
    await db.put('recipes', { ...(await db.get('recipes', id)), photo: art, fav: id !== 's-pasta' });
  }
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('en-CA'); };
  const at = hoursAgo => { const d = new Date(Date.now() - hoursAgo * 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const t = Date.now();
  const L = async (n, type, venue, period, station, hours, dishes, feedback, cooked = []) => {
    const log = { id: `d-log-${n}`, date: day(n), type, venue, period, station, hours, dishes: cooked.length ? '' : dishes, feedback, cooked, createdAt: t - n };
    await db.put('logs', log);
    await syncLogPractice(log);
  };
  await L(40, 'school', 'AMCA training kitchen', 'Lunch', 'Pasta', 4, '', 'Good pasta texture. Season the water more.', [{ recipeId: 's-tag', portions: 18, rating: 3 }, { recipeId: 's-pasta', portions: null, rating: 4 }]);
  await L(33, 'school', 'AMCA training kitchen', 'Dinner', 'Sauce', 4, '', 'Reduce the sauce further before service.', [{ recipeId: 's-pomo', portions: 30, rating: 3 }]);
  await L(26, 'school', 'AMCA training kitchen', 'Lunch', 'Larder / Garde manger', 4, 'Caprese, bruschetta ×24', 'Clean station, good speed.');
  await L(19, 'school', 'AMCA training kitchen', 'Dinner', 'Pasta', 4, 'Gnocchi al burro e salvia ×30', 'Keep the pass wiped between plates.');
  await L(12, 'school', 'AMCA training kitchen', 'Dinner', 'Pastry', 4, 'Tiramisu ×20', 'Mascarpone mix was perfect.');
  await L(9, 'school', 'AMCA training kitchen', 'Function', 'Larder / Garde manger', 5, 'Antipasti boards ×35', 'Faster plating this week.');
  await L(5, 'school', 'AMCA training kitchen', 'Lunch', 'Pass', 4, 'Expo for 40 covers', 'Called tickets clearly.');
  await L(2, 'school', 'AMCA training kitchen', 'Dinner', 'Pasta', 4, '', 'Sauce consistency spot on.', [{ recipeId: 's-tag', portions: 42, rating: 4 }, { recipeId: 's-pomo', portions: null, rating: 4 }]);
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
  const card = (id, n, front, back, photo) => db.put('cards', { id: `u-d${id}`, deck: 'Week 3 theory', front, back, photo, createdAt: t - n });
  await card(1, 3, 'HACCP', 'Hazard Analysis and Critical Control Points: a food safety system that finds the steps where a hazard must be controlled.');
  await card(2, 2, 'CCP (Critical Control Point)', 'A step where control stops a hazard, e.g. cooking chicken to 75 °C in the centre, or cooling within 2 h + 4 h.');
  await card(3, 1, 'Tagliatelle al pomodoro: what does chef check at the pass?', 'Pasta in a neat nest, sauce coating every strand (no pool), parmigiano on top, clean rim.', DEMO_ART.tag);
  await db.put('exams', { id: 'd-exam', title: 'Practical: fresh pasta and sauce', date: day(-9), type: 'practical', recipeIds: ['s-tag', 's-pasta'], target: 3, createdAt: t });
  const [opening, closing] = await checklists();
  await db.put('checkdays', { id: checkRecordId(opening), listId: opening.id, period: today(), done: opening.items.slice(0, 4), updatedAt: t });
  await db.put('checkdays', { id: checkRecordId(closing, day(1)), listId: closing.id, period: day(1), done: closing.items, updatedAt: t });
  await db.put('checkdays', { id: checkRecordId(opening, day(1)), listId: opening.id, period: day(1), done: opening.items, updatedAt: t });
  await db.put('settings', { ...(await settings()), id: 'settings', cookName: 'Demo Cook' });
  await db.put('settings', { id: 'portfolio', headline: 'Commis chef · Cert IV Kitchen Management', contact: 'demo@example.com',
    bio: 'Cert IV Kitchen Management student focused on Italian: fresh pasta and sauces. I log every practice and service.',
    recipeIds: ['s-pasta', 's-pomo', 's-tag'], showCosting: true });
}

// ---------- Router ----------

const routes = [
  [/^#\/home$/, homeView],
  [/^#\/r\/([\w-]+)$/, sharedRecipe],
  [/^#\/checks$/, checklistsView],
  [/^#\/check\/([^/]+)$/, checklistDay],
  [/^#\/check\/([^/]+)\/edit$/, checklistEdit],
  [/^#\/recipes$/, recipeList],
  [/^#\/recipes\/names$/, recipeNames],
  [/^#\/allergens$/, allergenChart],
  [/^#\/recipe\/([^/]+)$/, recipeView],
  [/^#\/recipe\/([^/]+)\/edit$/, recipeEdit],
  [/^#\/recipe\/([^/]+)\/card$/, recipeCard],
  [/^#\/recipe\/([^/]+)\/share$/, shareView],
  [/^#\/recipe\/([^/]+)\/instagram$/, instagramView],
  [/^#\/recipe\/([^/]+)\/cook$/, cookView],
  [/^#\/recipe\/([^/]+)\/scale$/, scaleView],
  [/^#\/recipe\/([^/]+)\/attempt$/, id => attemptEdit(id, null)],
  [/^#\/attempt\/([^/]+)\/edit$/, id => attemptEdit(null, id)],
  [/^#\/calc$/, calcView],
  [/^#\/timers$/, timersView],
  [/^#\/exam\/([^/]+)\/edit$/, examEdit],
  [/^#\/prep$/, prepView],
  [/^#\/workflow\/cook$/, dayCookView],
  [/^#\/workflow(?:\/([^/]+))?$/, workflowView],
  [/^#\/menus$/, menusView],
  [/^#\/menu\/([^/]+)$/, menuView],
  [/^#\/menu\/([^/]+)\/allergens$/, allergenMenuView],
  [/^#\/study$/, studyHome],
  [/^#\/study\/deck\/([^/]+)$/, deckView],
  [/^#\/card\/([^/]+)\/edit(?:\/([^/]+))?$/, cardEdit],
  [/^#\/study\/go(?:\/([^/]+))?$/, studySession],
  [/^#\/yield(?:\/([^/]+))?$/, yieldView],
  [/^#\/(?:ingredients|pantry)$/, ingredientsList],
  [/^#\/ingredient\/([^/]+)\/edit$/, ingredientEdit],
  [/^#\/log$/, logList],
  [/^#\/log\/([^/]+)\/edit$/, logEdit],
  [/^#\/portfolio$/, portfolioView],
  [/^#\/temps$/, tempList],
  [/^#\/temp\/([^/]+)\/edit$/, tempEdit],
  [/^#\/settings$/, settingsView],
  [/^#\/reset$/, resetView],
];

let prevHash = '', curHash = '';
async function render() {
  const h = location.hash;
  if (h !== curHash) [prevHash, curHash] = [curHash, h];
  if (!h.endsWith('/cook')) keepAwake(false);
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) return fn(...m.slice(1).map(x => (x == null ? x : decodeURIComponent(x)))); // an absent optional part stays undefined
  }
  go('#/home');
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
// Every launch starts on Home, whatever address the installed app was saved with. A reload in the same
// session (sessionStorage survives it) keeps you where you were; the password-reset link keeps its page.
let launched = false;
try { launched = !!sessionStorage.getItem('pinch-launched'); sessionStorage.setItem('pinch-launched', '1'); } catch {}
if (!launched && !recovery && !location.hash.startsWith('#/r/')) history.replaceState(null, '', location.pathname + location.search + '#/home');
// Re-seed the demo when its sample data changes, so returning visitors see new features filled in
const DEMO_DATA = 34;
if (db.DEMO && (await db.get('settings', 'demo'))?.v !== DEMO_DATA) { await loadDemo(); await db.put('settings', { id: 'demo', v: DEMO_DATA }); }
render();
sync.sync();
