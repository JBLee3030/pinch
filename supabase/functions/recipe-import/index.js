// Supabase Edge Function "recipe-import".
// POST { url } -> { name, ingredients[], steps[], servings, url, site, image? }
// Reads the schema.org Recipe (JSON-LD) that most recipe sites publish. Returns only
// that recipe data, never the raw page, so it can't be used as a general web proxy.
// Deploy: Supabase dashboard -> Edge Functions -> Create function "recipe-import" -> paste this file.

const MAX_PAGE = 3_000_000;   // bytes of HTML we are willing to read
const MAX_IMAGE = 3_000_000;  // bytes of photo we pass back
const TIMEOUT = 10_000;

// ---------- Extraction (pure, tested with node in calc.test.js) ----------

const decode = s => String(s ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/\s+/g, ' ').trim();

const isRecipe = o => o && typeof o === 'object' && [].concat(o['@type'] ?? []).some(t => /^(schema:)?Recipe$/i.test(t));

function findRecipe(node) {
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if (!node || typeof node !== 'object') return null;
  if (isRecipe(node)) return node;
  return findRecipe(node['@graph'] ?? node.mainEntity ?? null);
}

// recipeInstructions: string | string[] | HowToStep[] | HowToSection[] (nested)
function steps(x) {
  if (!x) return [];
  if (typeof x === 'string') return x.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').split(/\n+/).map(decode).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(steps);
  if (x.itemListElement) return steps(x.itemListElement);
  return steps(x.text ?? x.name ?? '');
}

const firstNumber = y => { const m = [].concat(y ?? []).map(String).join(' ').match(/\d+/); return m ? +m[0] : null; };
const imageUrl = i => (typeof i === 'string' ? i : Array.isArray(i) ? imageUrl(i[0]) : i?.url ?? null);

export function extractRecipe(html, pageUrl = '') {
  const blocks = [...String(html).matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, json] of blocks) {
    let data;
    try { data = JSON.parse(json.trim()); } catch { continue; }
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = [].concat(r.recipeIngredient ?? r.ingredients ?? []).map(decode).filter(Boolean);
    if (!ingredients.length) continue;
    let image = imageUrl(r.image);
    try { if (image) image = new URL(image, pageUrl).href; } catch { image = null; }
    return {
      name: decode(r.name) || 'Imported recipe',
      ingredients,
      steps: steps(r.recipeInstructions),
      servings: firstNumber(r.recipeYield),
      image,
      url: pageUrl,
      site: pageUrl ? new URL(pageUrl).hostname.replace(/^www\./, '') : '',
    };
  }
  return null;
}

// Public http(s) pages only: no local or private network addresses.
// ponytail: hostname check only; DNS names resolving to private IPs aren't caught.
export function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || (u.port && !['80', '443'].includes(u.port))) return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':') || /^\d+(\.\d+){3}$/.test(h)) return null;
  return u;
}

// ---------- HTTP handler (runs on Supabase) ----------

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function readCapped(res, max) {
  const reader = res.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { reader.cancel(); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const fetchCapped = (url, max) => fetch(url, {
  redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT),
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PinchRecipeImport/1.0)', Accept: 'text/html,image/*;q=0.9,*/*;q=0.8' },
}).then(async res => (res.ok ? { res, bytes: await readCapped(res, max) } : { res, bytes: null }));

function toDataUrl(bytes, type) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const { url } = await req.json().catch(() => ({}));
  const u = safeUrl(url);
  if (!u) return reply({ error: 'That doesn’t look like a web page link.' }, 400);
  try {
    const page = await fetchCapped(u.href, MAX_PAGE);
    if (!page.bytes) {
      const blocked = [401, 403, 429].includes(page.res.status);
      return reply({ error: blocked
        ? 'This site doesn’t let apps read its recipes. Copy the ingredients from the page and paste them instead.'
        : `The site answered ${page.res.status}. Check the link opens in your browser.` }, 502);
    }
    const recipe = extractRecipe(new TextDecoder().decode(page.bytes), page.res.url || u.href);
    if (!recipe) return reply({ error: 'No recipe found on that page. Try the page of a single recipe, or copy the ingredients and paste them instead.' }, 422);
    // Bring the photo along (the app can't fetch another site's image itself)
    if (recipe.image && safeUrl(recipe.image)) {
      try {
        const img = await fetchCapped(recipe.image, MAX_IMAGE);
        const type = img.res.headers.get('content-type') ?? '';
        if (img.bytes && type.startsWith('image/')) recipe.imageData = toDataUrl(img.bytes, type.split(';')[0]);
      } catch { /* no photo is fine */ }
    }
    return reply(recipe);
  } catch (e) {
    return reply({ error: e?.name === 'TimeoutError' ? 'The site took too long to answer.' : 'Couldn’t open that page.' }, 502);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handle);
