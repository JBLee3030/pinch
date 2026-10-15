// Drawn diagrams for the built-in study cards: knife cuts to scale on a ruler, steak cross-sections,
// food safety temperatures on a thermometer, what goes into each mother sauce, and ratio bars.
// Plain SVG strings: no images to download, works offline. cardArt(cardId) -> '' when a card has none.

const W = 320, H = 150;
const svg = (body, h = H, top = 0) => `<svg class="card-art" viewBox="0 ${top} ${W} ${h}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
  font-family="-apple-system, system-ui, sans-serif" font-size="11" fill="#4E5968">${body}</svg>`;
const text = (x, y, s, o = '') => `<text x="${x}" y="${y}" ${o}>${s}</text>`;
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');

// ---- Knife cuts: 1 mm = 4 px, so every cut sits on the same 0 to 6 cm ruler
const MM = 4, X0 = 20, BASE = 118;
const ruler = (cm = 6) => `<g stroke="#8B95A1" stroke-width="1">
  <line x1="${X0}" y1="${BASE + 8}" x2="${X0 + cm * 10 * MM}" y2="${BASE + 8}"/>
  ${Array.from({ length: cm * 5 + 1 }, (_, i) => `<line x1="${X0 + i * 2 * MM}" y1="${BASE + 8}" x2="${X0 + i * 2 * MM}" y2="${BASE + (i % 5 ? 11 : 14)}"/>`).join('')}</g>
  ${Array.from({ length: cm + 1 }, (_, i) => text(X0 + i * 10 * MM, BASE + 26, `${i}`, 'text-anchor="middle"')).join('')}${text(X0 + cm * 10 * MM + 12, BASE + 26, 'cm')}`;
// A cuboid: w long, h high, d deep (mm), front-bottom-left corner at (x, y) px; depth drawn up and to the right.
function block(x, y, w, h, d, c) {
  const a = w * MM, b = h * MM, k = d * MM * 0.5;
  return `<g stroke="${shade(c, 0.7)}" stroke-width="0.6" stroke-linejoin="round">
    <polygon points="${x},${y - b} ${x + k},${y - b - k} ${x + a + k},${y - b - k} ${x + a},${y - b}" fill="${shade(c, 1.12)}"/>
    <polygon points="${x + a},${y} ${x + a + k},${y - k} ${x + a + k},${y - b - k} ${x + a},${y - b}" fill="${shade(c, 0.8)}"/>
    <rect x="${x}" y="${y - b}" width="${a}" height="${b}" fill="${c}"/></g>`;
}
const CARROT = '#F28C28', POTATO = '#EBD9A0', ONION = '#F1EAD8', CELERY = '#9CC46B', TOMATO = '#D9412B', HERB = '#4C8F45';
const cubes = (n, size, color, perRow = 6, gap = 3) => Array.from({ length: n }, (_, i) =>
  block(X0 + (i % perRow) * (size + gap) * MM + (Math.floor(i / perRow) % 2) * 6, BASE - Math.floor(i / perRow) * (size + gap) * MM * 0.9, size, size, size, color)).join('');
const sticks = (n, len, side, color, gap = 4) => Array.from({ length: n }, (_, i) => block(X0 + i * 6, BASE - i * (side + gap) * MM, len, side, side, color)).join('');

const CUTS = {
  julienne: () => sticks(4, 45, 2, CARROT, 5),
  brunoise: () => cubes(18, 2, CARROT, 9, 3),
  jardiniere: () => [0, 1, 2].map(r => [0, 1].map(c => block(X0 + c * 26 * MM + r * 6, BASE - r * 9 * MM, 20, 4, 4, CARROT)).join('')).join(''),
  batonnet: () => sticks(3, 55, 5, CARROT, 4),
  macedoine: () => cubes(12, 5, CARROT, 6, 4),
  parmentier: () => cubes(8, 10, POTATO, 4, 4),
  paysanne: () => `${block(X0, BASE, 10, 2, 10, CARROT)}
    <polygon points="${X0 + 70},${BASE} ${X0 + 110},${BASE} ${X0 + 90},${BASE - 36}" fill="${CARROT}" stroke="${shade(CARROT, 0.7)}"/>
    <circle cx="${X0 + 150}" cy="${BASE - 20}" r="20" fill="${CARROT}" stroke="${shade(CARROT, 0.7)}"/>
    ${text(X0 + 190, BASE - 26, '1 to 2 mm thick')}<rect x="${X0 + 190}" y="${BASE - 18}" width="40" height="${2 * MM}" fill="${CARROT}"/>`,
  chiffonade: () => Array.from({ length: 6 }, (_, i) => `<path d="M${X0 + i * 4} ${BASE - 10 - i * 12} q 60 -10 120 0 t 110 ${i % 2 ? 6 : -6}" fill="none" stroke="${HERB}" stroke-width="${1.5 * MM}" stroke-linecap="round"/>`).join(''),
  concasse: () => Array.from({ length: 9 }, (_, i) => {
    const x = X0 + (i % 5) * 44 + (i > 4 ? 22 : 0), y = BASE - (i > 4 ? 44 : 6);
    return `<polygon points="${x},${y} ${x + 26},${y - 4} ${x + 32},${y - 22} ${x + 12},${y - 30} ${x - 2},${y - 16}" fill="${TOMATO}" stroke="${shade(TOMATO, 0.7)}"/>`;
  }).join(''),
  mirepoix: () => [[ONION, 0], [CARROT, 1], [CELERY, 2], [ONION, 3], [CARROT, 4]].map(([c, i]) => block(X0 + i * 19 * MM * 0.62, BASE - (i % 2) * 14, 15, 12, 12, c)).join(''),
  tourne: () => {
    const x = X0, y = BASE - 42, L = 50 * MM, r = 10 * MM;
    return `<g stroke="${shade(POTATO, 0.6)}" stroke-width="1" fill="${POTATO}">
      <path d="M${x} ${y} Q ${x + L / 2} ${y - r * 1.3} ${x + L} ${y} Q ${x + L / 2} ${y + r * 1.3} ${x} ${y} Z"/>
      <path d="M${x} ${y} Q ${x + L / 2} ${y - r * 0.55} ${x + L} ${y}" fill="none"/><path d="M${x} ${y} Q ${x + L / 2} ${y + r * 0.45} ${x + L} ${y}" fill="none"/></g>
      ${text(x + L + 14, y + 4, '7 sides')}`;
  },
};

// ---- Steak doneness: cross-section, colour bands from crust to centre
const DONENESS = { rare: [4, 8, '50 to 52 °C'], mrare: [8, 14, '55 to 57 °C'], medium: [14, 40, '60 to 63 °C'], mwell: [24, 40, '65 to 68 °C'], well: [60, 0, '70 °C +'] };
function steak(id) {
  const [grey, pink, temp] = DONENESS[id], x = 18, y = 22, w = 172, h = 80;
  const band = (inset, fill) => (2 * inset < h ? `<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${Math.max(4, 26 - inset)}" fill="${fill}"/>` : '');
  return `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="30" fill="#5B3420"/>
    ${band(0, '#9A7464')}${band(grey, id === 'medium' || id === 'mwell' ? '#E79C96' : '#D97A79')}${pink ? band(grey + pink, id === 'medium' || id === 'mwell' ? '#E9A6A0' : '#B3222E') : ''}
    <g transform="translate(212 18)"><rect x="0" y="0" width="14" height="84" rx="7" fill="#EEF0F3" stroke="#8B95A1"/><circle cx="7" cy="92" r="11" fill="#D9412B"/>
    <rect x="4" y="${84 - (['rare', 'mrare', 'medium', 'mwell', 'well'].indexOf(id) + 1) * 15}" width="6" height="${(['rare', 'mrare', 'medium', 'mwell', 'well'].indexOf(id) + 1) * 15 + 4}" fill="#D9412B"/></g>
    ${text(236, 62, temp, 'font-size="12.5" font-weight="700" fill="#191F28"')}`;
}

// ---- Food safety: one thermometer, -20 to 80 °C, with the bit that matters marked
const T = t => 20 + (t + 20) * 2.8;
function thermo(marks = [], band = null) {
  const zone = (a, b, fill, label) => `<rect x="${T(a)}" y="40" width="${T(b) - T(a)}" height="22" fill="${fill}"/>${label ? text((T(a) + T(b)) / 2, 54, label, 'text-anchor="middle" font-size="10" fill="#191F28"') : ''}`;
  return `${zone(-20, 5, '#CFE6F8', 'cold')}${zone(5, 60, '#F6C9C9', 'danger zone')}${zone(60, 80, '#F8D7A8', 'hot')}
    ${band ? `<rect x="${T(band[0])}" y="36" width="${T(band[1]) - T(band[0])}" height="30" fill="none" stroke="#C62A38" stroke-width="2.5" rx="4"/>` : ''}
    <rect x="${T(-20)}" y="40" width="${T(80) - T(-20)}" height="22" fill="none" stroke="#8B95A1" rx="3"/>
    ${[-15, 0, 5, 21, 60, 75].map(t => `<line x1="${T(t)}" y1="62" x2="${T(t)}" y2="68" stroke="#8B95A1"/>${text(T(t), 80, `${String(t).replace('-', '−')}°`, 'text-anchor="middle" font-size="10"')}`).join('')}
    ${marks.map(([t, label]) => `<path d="M${T(t) - 6} 22 L${T(t) + 6} 22 L${T(t)} 34 Z" fill="#191F28"/>${text(T(t) < 70 ? T(t) - 8 : T(t) > 250 ? T(t) + 8 : T(t), 16, label,
      `text-anchor="${T(t) < 70 ? 'start' : T(t) > 250 ? 'end' : 'middle'}" font-weight="700" fill="#191F28"`)}`).join('')}`;
}
const timeline = (steps, top = 98) => {
  const total = steps.reduce((n, s) => n + s[0], 0), w = 260;
  let x = 30;
  return steps.map(([len, label, fill, label2 = '']) => { const seg = len / total * w, out = `<rect x="${x}" y="${top}" width="${seg}" height="18" fill="${fill}"/>
    ${text(x + seg / 2, top + 32, label, 'text-anchor="middle" font-size="10"')}${label2 ? text(x + seg / 2, top + 45, label2, 'text-anchor="middle" font-size="10"') : ''}`; x += seg; return out; }).join('');
};
const SAFETY = {
  cold: () => [thermo([[5, '5 °C or below']], [-20, 5]), 92],
  hot: () => [thermo([[60, '60 °C or above']], [60, 80]), 92],
  danger: () => [thermo([], [5, 60]), 92],
  cooling: () => [thermo([[60, '60'], [21, '21'], [5, '5']]) + timeline([[2, '60 → 21 °C', '#F6C9C9', 'within 2 h'], [4, '21 → 5 °C', '#CFE6F8', 'within the next 4 h']]), 150],
  frozen: () => [thermo([[-15, '−15 °C or colder']], [-20, -15]), 92],
  twofour: () => [timeline([[2, 'under 2 h', '#BFE3C9', 'use or refrigerate'], [2, '2 to 4 h', '#F8D7A8', 'use it'], [2, 'over 4 h', '#F6C9C9', 'throw it out']], 20), 72],
  poultry: () => [thermo([[75, '75 °C centre']]), 92],
  reheat: () => [thermo([[75, '75'], [60, '60']], [60, 80]) + text(160, 108, 'reheat to 75 °C, then hold at 60 °C or above', 'text-anchor="middle"'), 118],
};

// ---- Mother sauces: what goes in, and what comes out
const blob = (x, color, label, label2 = '') => `<circle cx="${x}" cy="62" r="26" fill="${color}" stroke="${shade(color, 0.75)}"/>
  ${text(x, 108, label, 'text-anchor="middle" font-size="10.5"')}${label2 ? text(x, 121, label2, 'text-anchor="middle" font-size="10.5"') : ''}`;
const recipe = (a, b, out) => `${blob(46, ...a)}${text(91, 67, '+', 'text-anchor="middle" font-size="18"')}${blob(136, ...b)}
  ${text(184, 67, '→', 'text-anchor="middle" font-size="18"')}${blob(236, ...out)}`;
const SAUCES = {
  bechamel: () => recipe(['#FBF7EE', 'milk'], ['#F1E3B8', 'white roux'], ['#F4ECDA', 'béchamel']),
  veloute: () => recipe(['#EFE3C8', 'white stock'], ['#E2C98E', 'blond roux'], ['#EADBB1', 'velouté']),
  espagnole: () => recipe(['#7A4A2A', 'brown stock', '+ mirepoix, tomato'], ['#8B5A2B', 'brown roux'], ['#5C3317', 'espagnole']),
  hollandaise: () => recipe(['#F2C14E', 'egg yolks'], ['#F6D77A', 'clarified butter', '+ lemon'], ['#F2D068', 'hollandaise']),
  tomate: () => recipe(['#D9412B', 'tomatoes'], ['#E9D9A6', 'aromatics, stock'], ['#C8381F', 'sauce tomate']),
  mornay: () => recipe(['#F4ECDA', 'béchamel'], ['#F2D06B', 'cheese'], ['#F0DFA8', 'mornay']),
  bearnaise: () => recipe(['#F2D068', 'hollandaise'], ['#8DB062', 'tarragon, shallot', 'and vinegar reduction'], ['#E5CE6A', 'béarnaise']),
  demiglace: () => recipe(['#5C3317', 'espagnole'], ['#7A4A2A', 'brown stock', 'reduce by half'], ['#3E2010', 'demi-glace']),
  supreme: () => recipe(['#EADBB1', 'chicken velouté'], ['#FBF7EE', 'cream'], ['#F3E9CC', 'suprême']),
};

// ---- Ratios: a bar split by parts, or amounts side by side
const bar = parts => {
  const total = parts.reduce((n, p) => n + p[0], 0), w = 270;
  let x = 25;
  return parts.map(([n, label, fill, shown = n]) => { const seg = n / total * w, out = `<rect x="${x}" y="22" width="${seg - 2}" height="40" rx="6" fill="${fill}"/>
    ${text(x + seg / 2 - 1, 47, shown, 'text-anchor="middle" font-size="15" font-weight="700" fill="#191F28"')}${text(x + seg / 2 - 1, 82, label, 'text-anchor="middle"')}`; x += seg; return out; }).join('');
};
const amounts = items => items.map(([amount, label, fill], i) => blob(W / (items.length + 1) * (i + 1), fill, amount, label)).join('');
const RATIOS = {
  vinaigrette: () => bar([[3, 'oil', '#F2C94C'], [1, 'acid', '#B5D96B']]),
  roux: () => bar([[1, 'flour', '#F3EBD3'], [1, 'fat', '#F6D77A']]) + text(160, 104, 'by weight', 'text-anchor="middle"'),
  pasta: () => amounts([['100 g', 'tipo 00 flour', '#F3EBD3'], ['1', 'egg', '#F2C14E']]),
  piedough: () => bar([[3, 'flour', '#F3EBD3'], [2, 'fat', '#F6D77A'], [1, 'water', '#CFE6F8']]),
  pastawater: () => amounts([['1 L', 'water', '#CFE6F8'], ['10 g', 'salt', '#FBFBFB'], ['100 g', 'dried pasta', '#EBD9A0']]),
  risotto: () => bar([[3.5, 'hot stock', '#E9D9A6', '3 to 4'], [1, 'rice', '#FBF7EE']]) + text(160, 104, 'by volume, added gradually', 'text-anchor="middle"'),
  mayonnaise: () => amounts([['1', 'egg yolk', '#F2C14E'], ['150 to 200 ml', 'oil', '#F2C94C']]),
};

export function cardArt(id) {
  const [deck, key] = [id.slice(0, id.indexOf('-')), id.slice(id.indexOf('-') + 1)];
  const draw = { cuts: CUTS, doneness: { [key]: DONENESS[key] && (() => steak(key)) }, safety: SAFETY, sauces: SAUCES, ratios: RATIOS }[deck]?.[key];
  if (!draw) return '';
  if (deck === 'cuts') { const h = CUT_H[key] ?? H; return svg(draw() + ruler(), h, H - h); } // cut off empty sky above small cuts
  if (deck === 'safety') { const [body, h] = draw(); return svg(body, h); }
  if (deck === 'ratios') return svg(draw(), RATIOS_TALL.has(key) ? 132 : 112);
  return svg(draw(), { doneness: 126, sauces: 130 }[deck]);
}
const RATIOS_TALL = new Set(['pasta', 'pastawater', 'mayonnaise']);
const CUT_H = { brunoise: 74, macedoine: 98, paysanne: 92, concasse: 116, tourne: 126, mirepoix: 120 };
