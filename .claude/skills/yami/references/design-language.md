# Yami design language (Nightglow)

The full system lives in `docs/internal/reference/design-system.md`; every
value lives in `src/styles/tokens.css`. This page is the short version an agent
needs before touching UI. When you change the look, update all three.

## Mood

A still night sky, soft glass and a lavender light that belongs to the spirit.
Calm, nocturnal, gently cheeky. Nothing shouts; motion answers the user and
then stops.

## Rules an agent must follow

1. **Tokens only.** Use `var(--…)` for colour, spacing, radius, type and motion.
   No raw hex, no off-scale gaps. Missing value → add a token and document it.
2. **One accent.** `--glow` (lavender) means selected, on, focus and primary.
   Filled primaries use `--grad-glow` with `--on-glow` text. `--moon` is for
   attention and purchases, `--mint` for good, `--rose` for warm highlights and
   high usage, `--danger` for problems. `--gold`/`--accent` are legacy aliases.
3. **Cards never touch.** Sibling cards are `--stack-gap` (12px) apart; a titled
   section starts `--section-gap` (32px) below. Card recipe: `--surface-1`,
   1px `--line`, `--highlight`, `--r-lg`, `--card-pad`.
4. **Reuse components.** Never ship a native `<select>` or a `title` tooltip in
   a shipped screen:
   - choices → `Select` from `src/controls.tsx` (human option labels, stored
     values unchanged; its open menu follows its button when the page scrolls
     or shifts, and closes only once the button leaves the screen);
   - hints → `data-tip` (the per-window `TooltipLayer` renders it);
   - states → `StatusChip` (tone from `src/status-tone.ts`, tested);
   - shares → `Meter`; read-only values → `.value-pill`;
   - times → `shortTime` / `relativeTime`;
   - icon actions → `IconButton` with a `label`;
   - lists → entry cards (`.entry-head` = icon tile + two-line heading + chip +
     one action), form cards (`.form-card`) or tiles.
5. **Every page opens with `.page-head`**: 32px light title, one muted line, at
   most one action on the right.
6. **Function first.** Restyling never removes behaviour, state, errors or
   accessible names. Follow `docs/internal/adaptation.md`.
7. **Check two sizes.** Preview at 1160×790 and 850×610, reduced motion on and
   off; drawer tabs must fit their height in `src/island-bounds.ts`.
8. **Run `npm run check:ui`.** No native `<select>`, HTML `title` tooltip or
   `window.confirm` in shipped screens; raw colours may only fall (ratchet in
   `scripts/ui-baseline.json`). Canvas and xterm read `--paint-*`/`--term-*`
   through `src/css-token.ts`. Rails use `--track` with a `--lit-shadow` pill.

## Key values

| Group | Values |
| --- | --- |
| Inks | `--ink-0` `#06051a` (notch) · `--ink-1` `#0b0a22` (base) · `--ink-2` · `--ink-3` |
| Text | `--text` `#f3f1ff` · `--text-soft` · `--muted` `#a49fc6` · `--faint` |
| Accent | `--glow` `#bcaaff` · `--grad-glow` `#cdbcff→#a2b3ff` · `--on-glow` `#17123a` |
| Space | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (`--space-1…9`) |
| Type | 38 display · 32 h1 (300) · 20 h2 · 16 h3 · 14 body · 13 · 12 · 11 labels · 10 micro |
| Radius | 8 · 12 fields · 16 tiles/menus · 22 cards · 28 sidebar/composer · pill |
| Layout | `--gutter` 24 · `--page-max` 1040 · `--read-max` 860 · `--sidebar-w` 256 · `--dock-safe` 112 · `--drawer-gap` 10 |
| Motion | `--ease-fluid` for entrances/presses · `--ease-island` for notch/drawer · 0.16 / 0.26 / 0.42s |

Rubik Variable everywhere; Cascadia Mono only for shell, code and JSON.
Phosphor icons via `<Icon>`; icon tiles in cards are 38px lavender-tinted
squares with 12px radius.

## Surfaces

- **Main window:** static `--stars` over `--aurora` over an ink gradient, with
  the wallpaper blurred and blended at 32%. Scroll areas use the
  `--fade-edges` mask so content dissolves above the dock.
- **Sidebar pages** (Settings, AI): glass sidebar + one reading column, both to
  the bottom gutter; the column scrolls under the dock.
- **Card pages** (Bond, Desk): one column up to `--page-max`.
- **Floating glass** (dock, menus, modals, toasts): `--line-strong`,
  `--shadow-float`, `--blur`. Backdrop blur does not work over the real desktop,
  so the island and overlays stay opaque ink.

## The island

- Collapsed: 180×66 notch, 20px lower corners, concave shoulders (15px awake,
  2px asleep, never below the bar), solid `--ink-0` with the skin colour
  (`--soul`) pooling at the bottom edge and a matching rim light. After ~8 quiet
  seconds it slims to a 190×12 bar and Yami tucks away. Size changes ease 0.32s.
- Click or scroll down opens the drawer; double-click opens the app;
  right-click arms an ability (moon rim). No buttons inside the notch.
- Drawer: grows from the notch footprint (0.34s clip-path), closes in 0.19s.
  Ink with aurora and stars, 26px lower corners, 16px padding, `--drawer-gap`
  grids. Tabs sit in a recessed track; the selected tab is a lit lavender pill.
- Pills under the notch (activity, mini media, hints) are 200×26 ink pills
  with a hairline. Long messages go to the caption pill via
  `api("caption.notice", { message })`.
- Window sizes per tab live in `src/island-bounds.ts` (main process and
  preview share it).

## Overlays

Caption pill: 24px radius; the user's words on pale lavender-white with ink
text, Yami's reply on ink glass with a skin-tinted corner. Roaming bubble:
14px-radius ink glass with a tail. Lasso stroke `#bcaaff`.

## The Yami character

- A front-facing, armless spirit: round head (radius 27) with two cat ears,
  oval eyes, a small cat mouth, whiskers and blush; the lower half burns
  downward as three flame layers (outer, middle, core) with one long centre
  tongue. No hands, paws or tail. Never draw her side-on.
- Geometry and motion live in `src/yami/motion.ts` (pure, tested), features in
  `features.ts`, colours in `skins.ts`, rendering in `YamiSpirit.tsx`.
- Skins: Yami (white core, periwinkle flame), Ember, Wisp, Amethyst, Gilded,
  Void (dark core, pale features). A new skin needs `flame[3]`, `line`, `eye`,
  `glow`, a catalogue card and a price in `electron/requests.ts`. The glow
  becomes `--soul` for the notch, Home orb, drawer and caption tint.
- Motion budget: one `requestAnimationFrame` loop per visible Yami, running only
  while hovered (+2.5s), in a non-idle state, roaming or dragged, or with Living
  flame on (paced to ~30 fps). It eases to rest and cancels the loop. Embers are
  pooled (max 10). Do not animate blurred elements per frame; the glow stays
  static. Reduced motion shows a still pose.
- After changing her shape, regenerate the icon:
  `node --experimental-transform-types scripts/export-spirit.mjs` then
  `node scripts/create-icon.mjs`, and copy `public/yami-icon.png` to
  `docs/internal/assets/brand/yami-icon.png`.

## Motion rules

Animate for interaction and active work only, 0.15–0.42s, finite. Entrances
fade and rise 8px; menus scale from 0.98; the dock pill slides over 0.42s;
spinners turn only while work runs. Every keyframe needs a reduced-motion
override (`html[data-reduced="true"]` and `prefers-reduced-motion`). Skies,
stars and glows are static images: no idle animation.

## Voice and copy

Short, warm, lightly witty, second person. Say what happened and what to do
next ("Connect your Gemini API key in Settings > API keys to talk to Yami.").
Option labels are human ("PowerShell 7", "Claude Code"); status words stay the
real state. Never imitate Hitodama's wording.
