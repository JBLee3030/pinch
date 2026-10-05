// Korean UI. Screens are written in English; in Korean mode every rendered text node and label is
// looked up in ko.js (exact phrases first, then patterns for text with numbers or names in it).
// Anything not in the dictionary stays English. Paper output (.sheet), study card text and
// anything marked translate="no" are never translated.
import { KO, KO_PATTERNS } from './ko.js';

let saved = null;
try { saved = localStorage.getItem('pinch-lang'); } catch {}
export const LANG = saved === 'ko' ? 'ko' : 'en';
export const locale = LANG === 'ko' ? 'ko-KR' : 'en-AU';

export function setLang(l) {
  try { localStorage.setItem('pinch-lang', l); } catch {}
  location.reload(); // the English text is gone from the DOM once translated; a reload is the simple way back
}

const exact = new Map(Object.entries(KO));

// '  3 of 8 items counted ' -> '  8개 중 3개 셈 ': keeps the surrounding spaces, translates the core.
// Captured parts of a pattern are translated too (a unit, a service name), up to a few levels deep.
// A translation starting with '~' joins onto the text before it (Korean particles take no space).
export function tr(s, depth = 0) {
  const [, lead, core, tail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!/[A-Za-z]/.test(core) || depth > 3) return s;
  let out = exact.get(core);
  if (out == null) {
    for (const [re, rep] of KO_PATTERNS) {
      const m = re.exec(core);
      if (!m) continue;
      const g = m.slice(1).map(x => (x == null ? '' : tr(x, depth + 1)));
      out = typeof rep === 'function' ? rep(...g) : rep.replace(/\$(\d)/g, (_, i) => g[i - 1] ?? '');
      break;
    }
  }
  if (out == null) return s;
  return out.startsWith('~') ? out.slice(1) + tail : lead + out + tail;
}

// Never translated: paper output, study card text, anything marked translate="no", and what people typed
const SKIP = 'script, style, .sheet, [translate="no"]';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

function fixText(n) {
  const p = n.parentElement;
  if (!p || p.tagName === 'TEXTAREA' || p.closest(SKIP)) return;
  const t = tr(n.data);
  if (t !== n.data) n.data = t;
}
function walk(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    { acceptNode: n => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = root; n; n = w.nextNode()) {
    if (n.nodeType === 3) { if (n.parentElement?.tagName !== 'TEXTAREA') { const t = tr(n.data); if (t !== n.data) n.data = t; } continue; }
    for (const a of ATTRS) if (n.hasAttribute(a)) { const v = n.getAttribute(a), t = tr(v); if (t !== v) n.setAttribute(a, t); }
  }
}

if (LANG === 'ko') {
  document.documentElement.lang = 'ko';
  walk(document.body);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') fixText(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  for (const f of ['confirm', 'alert']) { const orig = window[f].bind(window); window[f] = msg => orig(tr(String(msg))); }
}
