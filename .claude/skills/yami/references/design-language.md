# Yami design language

The full, current values live in `Documentation/reference/design-system.md` and
the CSS in `src/styles/`. This page is the short version an agent needs before
touching UI. When you change the look, update both files.

## Mood

Calm, nocturnal and spiritual: dark translucent surfaces, soft glows, blurred
wallpapers, a little gold for actions and a cool blue for focus. Yami is a
gentle, slightly cheeky companion. Nothing shouts; motion is soft and short.

## Tokens (`src/styles/base.css` `:root`)

| Token      | Value                       | Use                                                                       |
| ---------- | --------------------------- | ------------------------------------------------------------------------- |
| `--text`   | `#f4f4f4`                   | main text                                                                 |
| `--muted`  | `#9ca7b0`                   | secondary text                                                            |
| `--accent` | `#8dccff`                   | focus rings, links, primary outline buttons                               |
| `--gold`   | `#c9ad5c`                   | selected tabs, active states; filled action `#bba057` with `#17140b` text |
| `--panel`  | `rgba(255,255,255,.035)`    | card surfaces                                                             |
| `--line`   | `rgba(255,255,255,.075)`    | hairlines                                                                 |
| `--ease`   | `cubic-bezier(.22,1,.36,1)` | default easing                                                            |

Main window: dark blue-green gradients over a heavily blurred, dimmed wallpaper
(`--wallpaper`). Island and drawer: near-black (`#050505`–`#0d0d10`). Skin glow
colours come from `src/yami/skins.ts`; use `color-mix(in srgb, var(--soul) N%,
transparent)` to tint surfaces by the current skin.

## Type and shape

- Rubik Variable everywhere. Headline 36px/400, title 21px/600, body 14px,
  labels 12px, island micro text 9–11px.
- Radii: fields 10px, cards 12–16px, island utility tiles 14px, drawer bottom
  corners 22px, pills 22–24px, dock 40px, glass loadout cards 16px. Never leave
  sharp corners on images; clip transformed images with
  `clip-path: inset(0 round Rpx)`.
- Spacing: 8px base gap; cards ~14px padding; island drawer 16px padding.

## Surfaces and controls

- Glass: `background: #ffffff0f; backdrop-filter: blur(14px) saturate(1.3);
border: 1px solid #ffffff1f;` plus an inset top highlight and a soft dark
  shadow. Hover tints the border/glow with the item's colour.
- Buttons: generic `button:hover` adds a faint white wash. Filled buttons
  (`.play-button`, `.gold-button`, primary) must define their own `:hover`
  colour or they turn grey. Active state scales to 0.975. Keyboard focus shows a
  2px `--accent` outline.
- Toggles use `<Toggle>`; settings rows use the `row(title, help, control)`
  helper in `Settings.tsx` inside a `.setting-group` under a `.group-title`.
- Icons: Phosphor via `<Icon name size fill?>`; icon-only buttons need
  `IconButton` with an accessible `label`.

## The island

- Collapsed: 180x66 black notch with concave shoulders, Yami centred. After ~8
  quiet seconds it slims to a 190x12 bar and Yami tucks away; hover or activity
  restores it. Size changes ease over 0.32s.
- Click or scroll down opens the drawer; double-click opens the app;
  right-click arms an equipped ability. No buttons inside the notch.
- Open: the notch disappears and the drawer grows out of its footprint with a
  clip-path reveal (0.3s), content fading in; closing reverses (0.19s) before
  the window shrinks. Tabs: Controls, Today, Stats, Clipboard, Apps, Wallpaper,
  Power, gold pill for the selected tab.
- Small cards under the notch (activity, mini media, hints) are 200x26 black
  pills; the media card grows to 380px. Messages too big for the collapsed
  island go to the caption pill via `api("caption.notice", { message })`.

## Overlays

- Caption pill (bottom centre, only during voice/dictation or a notice): light
  pill `#fbfbfdf2` labelled `You`/`Dictating`/`Typed`, dark pill `#0b0c10f2`
  labelled `Yami`, 9px-radius key chips above.
- Roaming Yami: 240x180 click-through window, 12px-radius dark speech bubbles
  with Yami's own quips.

## The Yami character

- A front-facing, armless spirit: round head (radius 27) with two cat ears, oval
  eyes, a small cat mouth, whiskers and blush; the lower half burns downward as
  three flame layers (outer, middle, core) with one long centre tongue. No
  hands, paws or tail. Never draw her side-on.
- Geometry and motion live in `src/yami/motion.ts` (pure, tested), features in
  `features.ts`, colours in `skins.ts`, rendering in `YamiSpirit.tsx`.
- Skins: Yami (white core, periwinkle flame), Ember, Wisp, Amethyst, Gilded,
  Void (dark core, pale features). A new skin needs `flame[3]`, `line`, `eye`,
  `glow`, a catalogue card and a price in `electron/requests.ts`.
- Motion budget: one `requestAnimationFrame` loop per visible Yami, running only
  while hovered (+2.5s), in a non-idle state, roaming or dragged, or with Living
  flame on (paced to ~30 fps). It eases to rest and cancels the loop. Embers are
  pooled (max 10). Do not animate blurred elements per frame; the glow stays
  static. Reduced motion shows a still pose.
- After changing her shape, regenerate the icon:
  `node --experimental-transform-types scripts/export-spirit.mjs` then
  `node scripts/create-icon.mjs`, and copy `public/yami-icon.png` to
  `Documentation/assets/brand/yami-icon.png`.

## Motion rules

Animate for interaction and active work only. Use `--ease` or the
`cubic-bezier(.2,.8,.2,1)` used by the island; keep UI transitions 0.15–0.35s.
Every keyframe or continuous loop needs a reduced-motion override
(`html[data-reduced="true"]` and `prefers-reduced-motion`).

## Voice and copy

Short, warm, lightly witty, second person. Say what happened and what to do
next ("Connect your Gemini API key in Settings > API keys to talk to Yami.").
Never imitate Hitodama's wording.
