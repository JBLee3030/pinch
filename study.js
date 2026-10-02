// Kitchen reference decks and a small spaced-repetition scheduler. Pure; tested in calc.test.js.
// Content is commonly taught Australian commercial cookery practice. Cut sizes and doneness
// temperatures vary between colleges and kitchens, so each deck says what to check.

export const DECKS = [
  {
    id: 'cuts', title: 'Knife cuts', note: 'Common teaching sizes. Colleges and chefs vary, so check the standard your assessor uses.',
    cards: [
      ['julienne', 'Julienne', 'Fine strips, about 2 × 2 mm and 4 to 5 cm long'],
      ['brunoise', 'Brunoise', 'Fine dice, about 2 mm cubes, cut from julienne'],
      ['jardiniere', 'Jardinière', 'Batons, about 4 × 4 mm and 2 cm long'],
      ['batonnet', 'Bâtonnet', 'Sticks, about 5 × 5 mm and 5 to 6 cm long'],
      ['macedoine', 'Macédoine', 'Dice, about 5 mm cubes'],
      ['parmentier', 'Parmentier', 'Dice, about 1 cm cubes (classically potato)'],
      ['paysanne', 'Paysanne', 'Thin pieces, 1 to 2 mm thick, about 1 cm across, cut in squares, triangles or rounds'],
      ['chiffonade', 'Chiffonade', 'Fine ribbons of leafy herbs or greens: stack, roll and slice thinly'],
      ['concasse', 'Concassé', 'Tomato flesh peeled, deseeded and roughly chopped'],
      ['mirepoix', 'Mirepoix', 'Rough-cut onion, carrot and celery for flavour; size to suit the cooking time'],
      ['tourne', 'Tourné', 'Seven-sided barrel shape, about 5 cm long'],
    ],
  },
  {
    id: 'safety', title: 'Food safety temperatures', note: 'Australia: FSANZ Standard 3.2.2 and state food authority guidance.',
    cards: [
      ['cold', 'Cold storage', '5 °C or below'],
      ['hot', 'Hot holding', '60 °C or above'],
      ['danger', 'Temperature danger zone', 'Between 5 °C and 60 °C'],
      ['cooling', 'Cooling cooked food', 'From 60 °C to 21 °C within 2 hours, then to 5 °C within a further 4 hours'],
      ['frozen', 'Frozen food', 'Kept hard frozen; freezers commonly run at −15 °C or colder'],
      ['twofour', '2-hour / 4-hour rule', 'Ready-to-eat food out of temperature control: under 2 hours, use or refrigerate; 2 to 4 hours, use it; over 4 hours, throw it out'],
      ['poultry', 'Poultry, mince and sausages', 'Cook to 75 °C in the centre (common guidance)'],
      ['reheat', 'Reheating for hot holding', 'Reheat rapidly to 75 °C in the centre (common guidance), then hold at 60 °C or above'],
    ],
  },
  {
    id: 'doneness', title: 'Steak doneness', note: 'Core temperatures for beef and lamb, a common chef guide. Allow for 2 to 5 °C carry-over while resting.',
    cards: [
      ['rare', 'Rare', 'About 50 to 52 °C'],
      ['mrare', 'Medium rare', 'About 55 to 57 °C'],
      ['medium', 'Medium', 'About 60 to 63 °C'],
      ['mwell', 'Medium well', 'About 65 to 68 °C'],
      ['well', 'Well done', '70 °C and above'],
    ],
  },
  {
    id: 'sauces', title: 'Mother sauces', note: 'The five classical (Escoffier) mother sauces and common derivatives.',
    cards: [
      ['bechamel', 'Béchamel', 'Milk thickened with a white roux'],
      ['veloute', 'Velouté', 'White stock (chicken, veal or fish) thickened with a blond roux'],
      ['espagnole', 'Espagnole', 'Brown stock thickened with a brown roux, with mirepoix and tomato'],
      ['hollandaise', 'Hollandaise', 'Warm emulsion of egg yolks and clarified butter, seasoned with lemon'],
      ['tomate', 'Sauce tomate', 'Tomatoes cooked with aromatics and stock (classically thickened with roux)'],
      ['mornay', 'Mornay', 'Béchamel finished with cheese'],
      ['bearnaise', 'Béarnaise', 'Hollandaise made with a tarragon, shallot and vinegar reduction'],
      ['demiglace', 'Demi-glace', 'Espagnole and brown stock reduced by about half'],
      ['supreme', 'Suprême', 'Chicken velouté finished with cream'],
    ],
  },
  {
    id: 'ratios', title: 'Ratios and basics', note: 'Starting points by weight unless noted. Adjust to taste and recipe.',
    cards: [
      ['vinaigrette', 'Vinaigrette', '3 parts oil to 1 part acid'],
      ['roux', 'Roux', 'Equal weights of flour and fat'],
      ['pasta', 'Fresh egg pasta', '100 g flour (tipo 00) to 1 egg'],
      ['piedough', 'Short pastry (3-2-1)', '3 parts flour, 2 parts fat, 1 part water'],
      ['pastawater', 'Cooking dried pasta', 'About 1 litre of water and 10 g salt per 100 g pasta'],
      ['risotto', 'Risotto', 'About 3 to 4 parts hot stock to 1 part rice by volume, added gradually'],
      ['mayonnaise', 'Mayonnaise', 'About 150 to 200 ml oil per egg yolk'],
    ],
  },
  {
    id: 'terms', title: 'Kitchen terms', note: 'Italian and French terms you hear on the pass.',
    cards: [
      ['miseenplace', 'Mise en place', 'Everything in its place: all prep done and set up before service'],
      ['aldente', 'Al dente', 'Cooked until just firm to the bite'],
      ['soffritto', 'Soffritto', 'Onion, carrot and celery cooked gently in fat as a flavour base'],
      ['mantecare', 'Mantecatura', 'Beating in butter and cheese off the heat to make risotto creamy'],
      ['qb', 'q.b. (quanto basta)', 'As much as needed'],
      ['ragu', 'Ragù', 'Meat sauce cooked slowly'],
      ['brodo', 'Brodo', 'Broth'],
      ['monter', 'Monter au beurre', 'Whisking cold butter into a sauce at the end to thicken and gloss it'],
      ['nappe', 'Nappe', 'A sauce thick enough to coat the back of a spoon'],
      ['minute', 'À la minute', 'Cooked to order'],
      ['liaison', 'Liaison', 'Egg yolks and cream used to thicken and enrich a sauce or soup'],
      ['noisette', 'Beurre noisette', 'Butter cooked until nutty and light brown'],
      ['blanch', 'Blanch', 'Cook briefly in boiling water, then refresh in iced water'],
    ],
  },
].map(d => ({ ...d, cards: d.cards.map(([id, front, back]) => ({ id: `${d.id}-${id}`, deck: d.id, front, back })) }));

export const ALL_CARDS = DECKS.flatMap(d => d.cards);

// ---- Spaced repetition (Leitner boxes). state: { cardId: { box 1-5, due ms, seen } }
const DAY = 86400000;
const WAIT_DAYS = [1, 3, 7, 14, 30]; // after a correct answer, by the new box

export function review(state, id, gotIt, now = Date.now()) {
  const prev = state[id] ?? { box: 0, seen: 0 };
  const box = gotIt ? Math.min(5, prev.box + 1) : 1;
  return { ...state, [id]: { box, due: gotIt ? now + WAIT_DAYS[box - 1] * DAY : now, seen: prev.seen + 1 } };
}

export const isDue = (state, id, now = Date.now()) => !!state[id] && state[id].due <= now;
export const isLearned = (state, id) => (state[id]?.box ?? 0) >= 3;

// Due cards first (weakest first), then new ones, up to n.
export function pickSession(cards, state, now = Date.now(), n = 10) {
  const due = cards.filter(c => isDue(state, c.id, now)).sort((a, b) => state[a.id].box - state[b.id].box || state[a.id].due - state[b.id].due);
  const fresh = cards.filter(c => !state[c.id]);
  return [...due, ...fresh].slice(0, n);
}
