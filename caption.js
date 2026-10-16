// Instagram captions for a recipe, built from what the student already recorded: chef's feedback,
// "next time" notes, numbers in the method and how often they've practised it. Pure and tested.
// Captions are in English for a Melbourne audience. The rules follow how the feed works now: only
// the first ~125 characters show before "more", hashtags are capped at 5, links aren't clickable.

export const VISIBLE = 125;
export const ASKS = { save: 'Save this for later.', recipe: "Comment RECIPE and I'll send you the recipe.", none: '' };

const clip = (s, n = VISIBLE) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1), at = cut.lastIndexOf(' ');
  return (at > n * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, '') + '…';
};
const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1);
const sentence = s => { s = String(s ?? '').trim(); return s && !/[.!?…"]$/.test(s) ? s + '.' : s; };
const hasNumber = s => /\d/.test(s);

// attempts: this recipe's practice records, newest first ({ notes, next, rating, logId })
// steps: the method split into steps; items: [{ qty, unit, name }] in recipe order
// -> [{ kind, text }]: kind says what the line is made of, so the body can leave that out
export function captionHooks(recipe, { attempts = [], steps = [], items = [] } = {}) {
  const name = recipe.name, lname = lower1(name), hooks = [];
  const add = (kind, text) => hooks.some(h => h.text === clip(text)) || hooks.push({ kind, text: clip(text) });
  const chef = attempts.find(a => a.logId && a.notes);
  if (chef) add('chef', `Chef's note on my ${lname}: "${chef.notes.replace(/[.\s]+$/, '')}."`);
  const next = attempts.find(a => a.next);
  if (next) add('next', `What I'm changing next time I make ${lname}: ${lower1(sentence(next.next))}`);
  const step = steps.find(hasNumber);
  if (step) add('step', `The step that matters in ${lname}: ${lower1(sentence(step))}`);
  const weighed = items.filter(it => it.qty > 0).slice(0, 2);
  if (weighed.length === 2 && items.length <= 5) add('base', `${weighed.map(it => `${it.amount} ${it.name.toLowerCase()}`).join(' and ')}. That's the base of ${lname}.`);
  if (attempts.length >= 2) {
    const best = attempts[0].rating && attempts.every(a => !a.rating || a.rating <= attempts[0].rating);
    add('count', `Practice cook number ${attempts.length} of ${lname}${best ? ', and the best one yet' : ''}.`);
  }
  add('plain', `${name}, cooked in class this week.`);
  return hooks;
}

const GENERIC = new Set(['main', 'mains', 'side', 'sides', 'starter', 'starters', 'entree', 'entrée', 'other', 'misc', 'uncategorised']);
const category = r => (r.category && !GENERIC.has(r.category.trim().toLowerCase()) ? r.category.trim() : '');

// skip: the kind of first line chosen, so the body doesn't say it twice
export function captionBody(recipe, { attempts = [], steps = [], where = 'culinary school in Melbourne', skip = '' } = {}) {
  const paras = [`${recipe.name}${category(recipe) ? ` (${category(recipe).toLowerCase()})` : ''}, from this week's class at ${where}.`];
  const numbered = steps.filter(hasNumber).slice(skip === 'step' ? 1 : 0, skip === 'step' ? 3 : 2).map(sentence);
  if (numbered.length) paras.push(numbered.join(' '));
  const next = attempts.find(a => a.next);
  if (next && skip !== 'next') paras.push(`Next time: ${lower1(sentence(next.next))}`);
  return paras;
}

// Up to 5 specific tags: the dish, its category, school, city. Never #fyp-style filler.
export function captionTags(recipe, where = 'culinary school in Melbourne') {
  const compact = s => '#' + s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const name = compact(recipe.name);
  const first = compact(recipe.name.split(/\s+/)[0]);
  const city = where.match(/\bin ([A-Z][a-z]+)\b/)?.[1];
  const tags = [name.length <= 22 ? name : first, first.length > 4 && first, category(recipe) && compact(category(recipe)), '#culinaryschool', city && compact(city + 'food')];
  return [...new Set(tags.filter(t => t && t.length > 2))].slice(0, 5);
}

export const buildCaption = ({ hook, body, ask, tags }) =>
  [hook, body, ASKS[ask] ?? '', tags].map(s => String(s ?? '').trim()).filter(Boolean).join('\n\n');

// The checks that matter on the feed.
export function lintCaption(text) {
  const first = text.split('\n')[0].trim();
  const tags = text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? [];
  const asks = (text.match(/\b(comment [A-Z]{2,}|save this|dm me|link in bio|tag a)\b/gi) ?? []).length;
  return {
    total: text.length,
    firstLine: first.length,
    firstFits: first.length <= VISIBLE,
    tags: tags.length,
    tagsOk: tags.length <= 5,
    links: /https?:\/\/|www\./i.test(text),
    asks,
    asksOk: asks <= 1,
    lengthOk: text.length <= 2200,
  };
}
