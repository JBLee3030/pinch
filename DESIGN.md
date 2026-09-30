# Pinch design system

Mobile-first, Toss-inspired: a calm grey canvas, flat white cards, big numbers for the thing that matters, and one filled action per screen. Everything visual comes from the tokens at the top of [`style.css`](style.css); components never use raw colours or sizes.

## Principles

1. **One screen, one job.** Each sub screen has a single primary action, pinned to the bottom (`Save`). Destructive actions are tinted, never the filled colour.
2. **The number first.** If a screen is about a number (cost per portion, order quantity, checks failed), it is the biggest thing on the screen.
3. **Group, don't box.** Related rows live together in one white card. No border around every row.
4. **Say it plainly.** Short, friendly sentences. No jargon the kitchen doesn't use, no em dashes, at most one `·` per line.
5. **Works in the kitchen.** 44 px minimum touch targets, 16 px+ text, high contrast, works offline. Light theme only, so screens look the same on every phone.

## Tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F2F4F6` | Canvas |
| `--surface` | `#FFFFFF` | Cards, tab bar, fields on the canvas |
| `--fill` | `#EEF0F3` | Fields inside cards, secondary buttons, pressed rows |
| `--text` | `#191F28` | Primary text |
| `--text-2` | `#4E5968` | Labels, secondary text |
| `--text-3` | `#5F6A77` | Captions, placeholders |
| `--line` | `#E5E8EB` | Dividers |
| `--accent` | `#0B7A50` | The one accent: primary buttons, active tab, links |
| `--accent-weak` | `#E6F4EC` | Tinted buttons, PASS, selected chips |
| `--danger` / `-weak` | `#C62A38` / `#FDECEE` | Delete, FAIL, allergens |
| `--warn` / `-weak` | `#A5580C` / `#FEF3E2` | Missing prices, OPEN checks |

Every text/background pair used is at least **4.5:1** (WCAG AA). Lowest pairs: `--text-3` on `--fill` 4.82, `--accent` on `--fill` 4.70.

### Type

System UI font (SF Pro on iPhone, Roboto on Android): native feel, zero download, works offline. Numbers are tabular.

| Token | Size / weight | Use |
|---|---|---|
| `--t-display` | 34 / 700 | Key number (cost per portion) |
| `--t-title` | 26 / 700 | Tab page titles |
| `--t-h2` | 18 / 700 | Card titles |
| `--t-row` | 16 / 600 | List row titles |
| `--t-body` | 16 / 400 | Body, inputs (17) |
| `--t-sub` | 14 / 400 | Secondary lines |
| `--t-cap` | 12.5 / 500 | Captions, tab labels. Nothing smaller. |

### Space, shape, size

- Spacing on a 4 / 8 rhythm: `--s1` 4 … `--s8` 32. Page gutter 20.
- **Shape lock:** cards `20`, controls (buttons, fields) `14`, pills and badges fully round. Bottom CTA `16`.
- Heights: bottom CTA `56`, fields and buttons `52`, compact `44` (36 px pills get an invisible 44 px hit area).

### Motion

- Press: `110ms`, scale `.97` on buttons, background change on rows. Never moves layout.
- Screen enter: `220ms`, fade + 6 px rise.
- `prefers-reduced-motion`: all motion off.

## Components

| Component | Class | Notes |
|---|---|---|
| Tab page header | `header.top.root` + `.page-title` | Large title, optional `New` pill on the right |
| Sub page header | `header.top` + `.icon-btn` + `.bar-title` | Back button, compact title; tab bar hidden (`body.sub`) |
| Card | `.card` | Flat white, 20 radius, no border or shadow |
| Key number | `.stat-card` `.stat-label` `.stat` `.stat-sub` | One per screen, at the top |
| List | `ul.list` > `li` > `a` | Leading image (48), `.grow` title + subtitle, `.trail` value + caption |
| Buttons | `button` / `.btn` + `.ghost` `.tint` `.danger` `.sm` | Filled = primary only; one per screen |
| Bottom CTA | `form .actions` on sub pages | Sticky, safe-area aware, 56 high |
| Fields | `label` > `input` | Label above, always. Grey fill inside cards, white on the canvas. Accent border on focus. |
| Toggle chips | `.checks` | Multi-select (allergens); selected = tinted |
| Badges | `.badge.pass/.fail/.pending` | Text + colour, never colour alone |
| Chips | `.chip`, `.chip.alert` | Tags and allergens |
| Links row | `.links` | Secondary destinations as white pills |

## Sizing and alignment

These are the rules the v7 layout pass enforced across every screen:

1. **One control height.** Fields, selects and buttons are 52 px; the bottom CTA is 56 px; icon buttons inside rows (×) are 44 px. No 36 / 40 px fields.
2. **Nothing leaves the screen.** Grid and flex children can shrink (`min-width: 0`); dates, long names and numbers truncate inside their field instead of pushing a neighbour off-screen.
3. **Side-by-side fields align on the field**, not the label (`.row2` aligns to the bottom), so a wrapping label never staggers the inputs.
4. **Long values get their own line.** Names (ingredient, recipe, trim) take a full row; amount, unit and × go on the line below.
5. **A button on its own is full width.** Buttons that share a row split it. Button labels never wrap.
6. **Fields contrast with what they sit on:** grey fields inside white cards, white fields on the grey canvas.
7. **Record the value first.** Where a value and its time are captured together (temperatures), the value field comes first and the time sits below at full width.

## Icons

[Tabler Icons](https://tabler.io/icons) (MIT), outline set, 24 px, stroke 2 (1.8 in the tab bar, 2.2 when active). Copied as inline SVG with `aria-hidden="true"`; every icon sits next to a text label or inside a control with an `aria-label`. No emoji as icons.

## Copy

- Buttons: a verb, 1 to 3 words (`Save`, `Share list`, `Add to recipe`).
- Errors say what happened and what to do next (`This reset link is no longer valid. Request a new one from Settings.`).
- Australian English and kitchen terms (trim yield, food cost %, inc GST).

## Paper output

Recipe cards and the portfolio (`.sheet`) are paper: white, near-black text and the accent for the one label, printed to A4.

## Checklist for a new screen

- [ ] One primary action; destructive is tinted
- [ ] The key number (if any) is the biggest thing
- [ ] Rows grouped in one card, value on the right
- [ ] Labels above fields, right `inputmode`
- [ ] Touch targets ≥ 44 px
- [ ] Tokens only
- [ ] No em dashes; at most one `·` per line
