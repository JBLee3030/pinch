// Supabase Edge Function: a photo of a recipe (printed, handwritten, a screen or a whiteboard) -> the
// recipe's English and Italian names, servings, ingredient lines and steps, read by Claude. The app fills the New recipe form
// with the result; nothing is saved here and the photo is not stored.
// Also { names: [...] } -> each recipe name in English and Italian, for the app's Recipe names screen.
//
// Signed-in Pinch users only, DAILY photos each per 24 hours (table photo_reads, see supabase.sql),
// so the public app can't be used to run up the API bill.
// Setup: Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY. SUPABASE_URL and SUPABASE_ANON_KEY
// are provided by Supabase.

const MODEL = 'claude-opus-5-5';
const DAILY = 30;
const MAX_BASE64 = 6_000_000; // ~4.5 MB image; the app sends ~0.5 MB
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'name', 'italian', 'servings', 'ingredients', 'steps'],
  properties: {
    found: { type: 'boolean', description: 'false when the photo does not show a recipe' },
    name: { type: 'string', description: 'the dish name in English' },
    italian: { type: 'string', description: 'the dish name in Italian; empty when it has none' },
    servings: { type: 'integer', description: 'portions the recipe makes; 0 when not stated' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
  },
};

export const PROMPT = `This photo shows a recipe: printed, handwritten, on a screen or on a whiteboard. Transcribe it for a cook's recipe app.

- name: the dish's name in English. If the title is in another language, translate it the way an English menu would ("Tagliatelle al pomodoro" → "Tagliatelle with tomato sauce"). If there is no title, a short plain English name for the dish.
- italian: the dish's Italian name: the title as written if it is Italian, otherwise the usual Italian name for an Italian dish ("Fresh egg pasta" → "Pasta fresca all'uovo"). Empty when the dish isn't Italian and has no Italian name.
- servings: how many portions it makes, if the recipe says; otherwise 0.
- ingredients: one line per ingredient, in this form: quantity, unit, name. For example "500 g tipo 00 flour", "2 tbsp olive oil", "3 eggs", "1/2 cup milk". Use these units where they apply: g, kg, ml, L, tsp, tbsp, cup; write counted items as just the number. Copy amounts exactly as written (keep fractions and ranges); never invent an amount. If no amount is written, give just the ingredient. Keep the recipe's own language for names. If the recipe has parts (for example a sauce and a dough), list every ingredient from every part.
- steps: the method, one step per entry, in order, without step numbers. Keep times and temperatures exactly as written.
- found: false if the photo doesn't contain a recipe; then leave the other fields empty.

Leave out anything that isn't part of the recipe (page numbers, headers, adverts, nutrition tables).`;

export const NAMES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dishes'],
  properties: {
    dishes: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['name', 'italian'],
      properties: { name: { type: 'string' }, italian: { type: 'string' } },
    } },
  },
};

export const NAMES_PROMPT = `These are recipe names from a cook's recipe app (an Italian-focused cookery course). For each one, in the same order, give:

- name: the dish's name in English. If it is in another language, translate it the way an English menu would ("Tagliatelle al pomodoro" → "Tagliatelle with tomato sauce"). If it is already English, keep it as written.
- italian: the dish's Italian name: the name as written if it is Italian, otherwise the usual Italian name for an Italian dish ("Fresh egg pasta" → "Pasta fresca all'uovo"). Empty when the dish isn't Italian and has no Italian name.

Return exactly one entry per name.

Names:
`;

const MAX_NAMES = 200;
const tidy = s => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

// One entry per name sent, whatever came back; a missing English name keeps the original.
export function toNames(o, names) {
  const d = Array.isArray(o?.dishes) ? o.dishes : [];
  return names.map((n, i) => ({ name: tidy(d[i]?.name) || n, italian: tidy(d[i]?.italian) }));
}

// What the model returned -> what the app fills in, tidied and bounded.
export function toRecipe(o) {
  const lines = a => (Array.isArray(a) ? a : []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 80);
  return {
    name: String(o?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Recipe from a photo',
    italian: String(o?.italian ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    servings: Number.isInteger(o?.servings) && o.servings > 0 && o.servings < 1000 ? o.servings : null,
    ingredients: lines(o?.ingredients),
    steps: lines(o?.steps).map(s => s.replace(/^(step\s*)?\d+\s*[.):-]\s*/i, '')),
  };
}

// The caller must be a signed-in user with photos left today. Their own token is used, so row-level
// security keeps each person to their own rows.
async function allow(auth) {
  const base = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
  const h = { Authorization: auth, apikey: key };
  const user = await fetch(`${base}/auth/v1/user`, { headers: h });
  if (!user.ok) return reply({ error: 'Sign in (Settings → Account) to read recipe photos.' }, 401);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const used = await fetch(`${base}/rest/v1/photo_reads?select=id&created_at=gte.${since}`, { headers: { ...h, Prefer: 'count=exact', Range: '0-0' } });
  if (!used.ok) return reply({ error: 'Photo reading isn’t set up yet.' }, 500);
  if (Number(used.headers.get('content-range')?.split('/')[1] ?? 0) >= DAILY) {
    return reply({ error: `That's ${DAILY} photos today. Try again tomorrow, or paste the text instead.` }, 429);
  }
  const log = await fetch(`${base}/rest/v1/photo_reads`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: '{}' });
  return log.ok ? null : reply({ error: 'Photo reading isn’t set up yet.' }, 500);
}

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST' }, 405);
  const { image, type, names } = await req.json().catch(() => ({}));
  if (names !== undefined) {
    if (!Array.isArray(names) || !names.length || names.length > MAX_NAMES || names.some(n => typeof n !== 'string' || !n.trim() || n.length > 120)) {
      return reply({ error: `Send 1 to ${MAX_NAMES} recipe names.` }, 400);
    }
    const denied = await allow(req.headers.get('Authorization') ?? '');
    if (denied) return denied;
    const list = names.map(tidy);
    return ask([{ type: 'text', text: NAMES_PROMPT + list.map((n, i) => `${i + 1}. ${n}`).join('\n') }], NAMES_SCHEMA, 'low', out => reply({ dishes: toNames(out, list) }));
  }
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64 || !TYPES.includes(type)) {
    return reply({ error: 'Send a JPEG, PNG or WebP photo under 4 MB.' }, 400);
  }
  const denied = await allow(req.headers.get('Authorization') ?? '');
  if (denied) return denied;
  return ask([
    { type: 'image', source: { type: 'base64', media_type: type, data: image } },
    { type: 'text', text: PROMPT },
  ], SCHEMA, 'medium', out => out?.found
    ? reply(toRecipe(out))
    : reply({ error: 'No recipe found in that photo. Get the whole recipe in frame, in good light.' }, 422));
}

async function ask(content, schema, effort, done) {
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk');
  const client = new Anthropic(); // ANTHROPIC_API_KEY from the function's secrets
  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if a safety check ever declines, Anthropic retries on its recommended model
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    });
    if (msg.stop_reason === 'refusal') return reply({ error: 'This couldn’t be read. Try again, or type it in.' }, 422);
    const text = msg.content.find(b => b.type === 'text')?.text;
    return done(text ? JSON.parse(text) : null);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return reply({ error: 'Photo reading isn’t set up yet.' }, 500);
    if (e instanceof Anthropic.RateLimitError) return reply({ error: 'Busy right now. Try again in a minute.' }, 503);
    if (e instanceof Anthropic.APIError) return reply({ error: `Couldn’t read that (${e.status ?? 'error'}). Try again.` }, 502);
    return reply({ error: 'Couldn’t read that. Try again.' }, 502);
  }
}

if (typeof Deno !== 'undefined') Deno.serve(handle);
