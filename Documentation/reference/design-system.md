# Design system: Nightglow

Nightglow is Yami's visual language: a still night sky, soft glass, and a
lavender light that belongs to the spirit. It is calm, nocturnal and a little
playful. Nothing shouts, nothing moves without a reason, and every screen is
built from the same small set of tokens and components.

**Status:** shipped in the renderer and verified in the browser preview
(`npm run preview:web`) at the 1160×790 default and 850×610 minimum window
sizes. It has not yet been verified in the packaged Windows app. Values below
describe Yami's implementation; they are not recovered values from any
reference application.

**Source of truth:** [`src/styles/tokens.css`](../../src/styles/tokens.css)
holds every token. [`src/controls.tsx`](../../src/controls.tsx) holds the
shared Select, tooltip layer, status chip and meter.
[`src/ui.tsx`](../../src/ui.tsx) holds Icon, IconButton, Toggle, Empty and
Modal. When this page and the code disagree, the code wins and this page is
corrected.

## Principles

1. **Night, not black.** Surfaces are deep indigo inks with aurora washes and a
   sparse star dust, never flat `#000`. The notch is the darkest ink so it still
   reads as hardware.
2. **The spirit is the light.** Lavender (`--glow`) is the only accent that
   means "selected", "on" or "primary". Yami's current skin colour (`--soul`)
   may tint glows around her. Other colours carry meaning only (status, usage).
3. **Glass, quietly.** Content sits on translucent cards with a hairline border
   and a one-pixel top highlight. Cards never touch: siblings stack with
   `--stack-gap`.
4. **One way to do each thing.** Pages open with the same header. Lists are
   cards. Choices use Select. Hints use the tooltip layer. A new feature reuses
   these pieces instead of inventing look-alikes.
5. **Motion answers the user.** Animate for interaction and active work only,
   keep it short and finite, and switch it off for reduced motion. Idle costs
   nothing: all skies, glows and stars are static images.
6. **Function first.** A visual change never removes a behaviour, a state, an
   error message or an accessible name. See the [adaptation rules](../adaptation.md).

## Colour

### Inks and text

| Token | Value | Use |
| --- | --- | --- |
| `--ink-0` | `#06051a` | Island notch, small pills under the notch, drawer top |
| `--ink-1` | `#0b0a22` | Window and drawer base, terminal background |
| `--ink-2` | `#12102c` | Modal base, menu option fallback |
| `--ink-3` | `#1a1738` | Modal gradient start, raised panels |
| `--text` | `#f3f1ff` | Primary text |
| `--text-soft` | `#d6d2f0` | Secondary copy inside cards, values |
| `--muted` | `#a49fc6` | Descriptions, metadata, inactive navigation |
| `--faint` | `#77729c` | Placeholders, timestamps, disabled hints |

### Spirit palette

| Token | Value | Meaning |
| --- | --- | --- |
| `--glow` | `#bcaaff` | Accent: selected, on, focus ring, links, icons in tiles |
| `--glow-2` | `#93a9ff` | Cool partner in gradients |
| `--rose` | `#f1a7d6` | Warm highlight: calendar dots, media, high usage |
| `--moon` | `#f1d69c` | Attention and purchases (embers, buy buttons, armed ability, weather) |
| `--mint` | `#93e2c6` | Good: finished, ready, connected, fresh |
| `--danger` | `#ff9e9e` | Problems and destructive text |
| `--on-glow` | `#17123a` | Text and icons on a lavender fill |
| `--grad-glow` | `#cdbcff → #a2b3ff`, 135° | Every filled primary surface |
| `--grad-glow-hover` | `#dbcdff → #b3c1ff` | Hover for filled primaries |
| `--grad-aurora` | `#93a9ff → #bcaaff → #f1a7d6` | Progress, clock seconds, focus dial |

Never introduce a second accent. Gold from earlier versions is gone except as
`--moon` for warmth and attention. `--gold` and `--accent` remain as aliases
of `--glow` so older rules keep resolving; do not use them in new code.

### Glass

| Token | Value | Use |
| --- | --- | --- |
| `--surface-1` | white 4% | Cards, setting groups, fields |
| `--surface-2` | white 6.5% | Soft buttons, chips, focused fields |
| `--surface-3` | white 9% | Hovered soft buttons, active menu option |
| `--surface-hover` | white 7.5% | Generic button hover wash |
| `--line` | white 7% | Card borders and row separators |
| `--line-strong` | white 12% | Hovered borders, dock, menus, modals |
| `--selected` | lavender 16% | Selected rows and chips |
| `--selected-line` | lavender 32% | Border of selected rows, focused fields |
| `--highlight` | inset 1px white 7% | Top edge light on every card |
| `--shadow-soft` | `0 10px 30px` ink 35% | Small floating items |
| `--shadow-float` | `0 24px 70px` ink 55% | Dock, menus, modals, toasts |
| `--blur` | `blur(22px) saturate(1.35)` | Backdrop of floating glass in the main window |

Backdrop blur only works inside a window. The island and overlays are
transparent windows over the real desktop, where Windows does not blur, so they
stay opaque (`--ink-0`/`--ink-1`) instead of pretending to be frosted.

### Sky

`--aurora` is three large radial washes (violet top-left, blue right, plum
bottom). `--stars` is five dots of 1–1.4px tiled at five different
`--stars-size` values so the dust never reads as a grid. Both are static. The
main window paints stars over aurora over a 165° ink gradient; the current
wallpaper, blurred and dimmed, is blended on top at 32% with `screen`.

## Typography

Rubik Variable everywhere; Cascadia Mono only for shell, code and JSON output.

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `--fs-display` | 38px | 300 | Home greeting |
| `--fs-h1` | 32px | 300, tracking −0.035em | Page titles |
| `--fs-h2` | 20px | 500 | Sidebar titles, note titles |
| `--fs-h3` | 16px | 500 | Card titles |
| `--fs-body` | 14px | 400–500 | Body, row titles, buttons |
| `--fs-sm` | 13px | 400 | Secondary body, list rows |
| `--fs-xs` | 12px | 400 | Descriptions, notes |
| `--fs-2xs` | 11px | 500 | Section labels, chips, tooltips |
| `--fs-micro` | 10px | 400 | Island and drawer micro text (9px allowed in dense island tiles) |

Section labels (`.group-title`) are 11px, weight 500, uppercase with 0.09em
tracking, in `--glow`. Numbers in meters, timers and stats use
`font-variant-numeric: tabular-nums`.

## Space and shape

Spacing uses a 4px base: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 ·
`--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-7` 32 ·
`--space-8` 40 · `--space-9` 48. Do not use other values for gaps or padding.

Radii: `--r-xs` 8 (small chips), `--r-sm` 12 (fields, list rows), `--r-md` 16
(tiles, menus, sidebar rows), `--r-lg` 22 (cards and groups), `--r-xl` 28
(sidebar panel, composer), `--r-pill` (buttons, chips, search, tabs, dock).
Island tiles use 18px and the drawer's lower corners 26px. Images are clipped
with `clip-path: inset(0 round R)` so transformed images keep their corners.

## Layout

| Token | Value | Meaning |
| --- | --- | --- |
| `--gutter` | 24px | Window edge to content, title bar included |
| `--page-max` | 1040px | Content width of Bond and Desk |
| `--read-max` | 860px | Reading column of Settings and the AI workspace |
| `--sidebar-w` | 256px (220px ≤ 950px wide; 190px in the AI workspace ≤ 950px) | Sidebar panel |
| `--dock-safe` | 112px | Bottom scroll padding so the last item clears the dock |
| `--section-gap` | 32px | Space above a titled section |
| `--stack-gap` | 12px | Space between sibling cards |
| `--card-pad` | 20px | Inner padding of cards |
| `--row-min` | 68px | Minimum settings row height |
| `--drawer-pad` / `--drawer-gap` | 16px / 10px | Island drawer padding and every grid gap inside it |
| `--fade-edges` | mask | 20px fade at the top, dissolve 128→44px above the bottom |

### Window frame

The main window is a 14px-radius shell: a 66px draggable title bar, then the
page. Scrolling areas use `--fade-edges` as a mask, so content dissolves before
it reaches the title bar or the floating dock instead of being cut by a hard
edge. Pages that scroll the whole window (Home, Bond, Soul, Desk) put
`--dock-safe` at the bottom of `.main-content`.

### Page types

- **Sidebar pages** (Settings, AI workspace): a glass sidebar panel and one
  reading column, both running to the bottom gutter. The column scrolls on its
  own, under the dock, with `--dock-safe` padding. Below 950px wide the dock
  would cover the sidebar, so both columns stop above it instead.
- **Card pages** (Bond, Desk): one centred column up to `--page-max`, padded
  by 32px. Desk is a card column plus a 290px calendar column.
- **Stage pages** (Home, Soul): Yami in the centre on the sky, with the
  composer or the loadout hub around her.
- **Island drawer:** sized per tab by [`src/island-bounds.ts`](../../src/island-bounds.ts),
  shared by the main process and the preview so the preview shows true scale.
  Content must fit the tab's height without scrolling at its default content.

### Page header

Every page opens with `.page-head`: a 32px light title, one 14px muted line of
description, and at most one action on the right (a soft button with an icon).
The first section follows 24px below; in sidebar pages the first section label
supplies its own 32px gap.

## Components

### Buttons

| Kind | Class | Look | When |
| --- | --- | --- | --- |
| Primary | `.primary-button` | `--grad-glow` fill, `--on-glow` text, glow shadow | The one main action of a card, dialog or form |
| Soft | `.soft-button` | `--surface-2` pill, hairline, top highlight | Secondary actions, page-header actions |
| Text | `.text-button` | Lavender text only | Quiet, reversible actions beside a pill (12px gap) |
| Icon | `IconButton` | 34px circle; lavender fill when `active` | Toolbar actions; always has a `label` (tooltip and accessible name) |
| Compact filled | `.gold-button` | Same fill as primary, 11px | Dense island actions (speed test, focus start) |

All buttons: pill radius, 14px text, 8px icon gap, Phosphor icon on the left.
Hover lightens; press scales to 0.97 with `--ease-fluid`; disabled dims to
45%. Keyboard focus is a 2px `--accent` outline with 3px offset. Filled
buttons define their own hover so they never turn grey. Destructive text uses
`.danger`.

### Fields

Inputs and text areas use `--surface-1`, a `--line` border and `--r-sm`.
Focus raises the fill to `--surface-2`, turns the border `--selected-line` and
adds a 4px lavender halo. Search fields are pills with a leading magnifier.
Sliders, checkboxes and radios never get the field glass: sliders keep their
native track tinted lavender; checkboxes are 18px rounded squares filled with
`--grad-glow` and an ink tick when checked. The native date picker stays, with
its icon tinted lavender.

### Select

`<Select value options onChange label />` from `src/controls.tsx` replaces
every native `<select>` in shipped screens. The trigger is a soft pill with an
optional leading icon and a caret that turns when open. The menu floats in a
portal (so masks, drawers and dialogs never clip it), flips upward when there
is no room below, and shows icons, an optional second line (`hint`) and a check
on the current value. It is a WAI-ARIA combobox/listbox: focus stays on the
trigger, arrows and Home/End move, Enter or Space chooses, letters type ahead,
Escape closes without closing a surrounding dialog, Tab closes. Listeners
exist only while the menu is open. Give options human labels ("PowerShell 7",
"Claude Code", "1 day"); keep the stored values unchanged.

### Tooltip

`TooltipLayer` is mounted once per window (main, island drawer, terminal).
Any element with `data-tip` (preferred) or `title` gets a Yami tooltip after
420ms of hover or 250ms of keyboard focus; `title` is moved to `data-tip` so
the native Windows tooltip never appears. The bubble is 11px on an ink glass
bubble with a 10px radius, sits above the element (below it near the top edge) and is clamped
inside the window. It hides on press, scroll, key press or blur. Tooltips add
detail; they never carry the only label of a control.

### Toggle

`<Toggle>` is a 46×26 pill. Off: white 12% track, lilac knob. On:
`--grad-glow` track with a soft glow and a white knob that slides 20px.

### Status chip

`<StatusChip status>` shows the word with a dot. The colour family comes from
[`src/status-tone.ts`](../../src/status-tone.ts) (unit-tested):

| Tone | Words (examples) | Colour |
| --- | --- | --- |
| Active | working, thinking, running, reading, recording, connecting | `--glow` |
| Attention | waiting, needs-auth, backoff, stale, pending | `--moon` |
| Good | finished, fresh, ready, connected, enabled | `--mint` |
| Problem | error, failed, unavailable, denied | `--danger` |
| Quiet | idle, not connected, anything unknown | `--faint` |

The chip shows the real status word; colour only reinforces it.

### Meter

`<Meter value label>` is a 6px pill bar for a 0–1 share: `--grad-glow` below
75%, lavender-to-moon from 75%, rose from 90%. It exposes `role="meter"`.

### Value pill

`.value-pill` shows a read-only setting value (a personality, "On request")
with a small lavender icon. Use a status chip instead when the value is a
state.

### Cards

All cards share the glass recipe: `--surface-1`, `--line` border,
`--highlight`, `--r-lg`, `--card-pad`. Kinds:

- **Setting group** (`.setting-group` of `.setting-row`s): title and 12px
  description on the left, the control on the right (at most half the width,
  wrapping). Rows are separated by hairlines. `row(..., stacked)` puts a wide
  control, such as the engine grid, under its description.
- **Entry card** (`.workbench-entry`, `.workbench-usage`): an `.entry-head`
  of a 38px lavender icon tile, a two-line `.entry-heading` (14px name, 12px
  muted metadata), a status chip and one action or dismiss button. Details
  indent to the heading (50px); a hairline `.entry-foot` holds disclosure and
  the main action on the right.
- **Form card** (`.form-card`): an input row on top with a primary "Add"
  button, then saved rows separated by hairlines.
- **Tiles** (`.usage-tile`, `.engine-tile`, `.stat-tile`, island
  `.control-tile`): compact cards in an auto-fill grid.

Sibling cards are 12px apart, a titled section starts 32px below the last
card, and notes under a card sit 12px below it.

### Lists and data

- **Usage windows** are grouped once per account inside a darker inset panel;
  each row is label · meter · percentage · short reset time.
- **Timelines** (Recap) are a left rule with tone-coloured dots, the agent, a
  status chip and a tabular time.
- **File chips** are 28px pills with a file icon; the full path is the tooltip.
- **Rule rows** read "kind chip · “heard” → replacement".
- Times use `shortTime` ("Oct 19, 12:30 AM") or `relativeTime` ("12 min ago")
  from `src/controls.tsx`, never raw `toLocaleString()`.

### Disclosure

`<details>` uses a turning chevron drawn in CSS; summaries are 13px, weight
500. The meeting recorder (`.record-card`) is a disclosure inside a card with
an icon tile and a one-line description.

### Navigation

- **Dock:** a floating glass pill 22px above the bottom. The selected item is a
  `--grad-glow` pill that slides and resizes over 0.42s; only the selected item
  shows its label, the others show a tooltip.
- **Sidebar:** 44px rows, 18px icons; the selected row has `--selected` fill,
  `--selected-line` border and a lavender icon.
- **Island tabs:** a recessed glass track; the selected tab is a lit
  `--grad-glow` pill with ink text.

### Dialogs, menus and toasts

Modals are 26px-radius ink glass with a lavender corner wash, over a scrim of
ink 66% with an 8px blur; they rise 10px and scale from 0.98 on open. Toasts
and the island toast are ink glass with `--line-strong`. Menus and tooltips
float above dialogs (z-index 80 and 90).

### Empty states

`<Empty icon title>` is a centred 34px icon, a 16px title and one short
sentence that says what to do next. Inside a card, use the card's own empty
text (`.notes-empty`, `.form-card-empty`, `.drawer-ai-empty`) instead.

## The island

- **Notch:** keeps its 180×66 hardware silhouette, 20px lower corners and
  concave shoulders (15px awake, 2px asleep; never below the bar). It is solid
  `--ink-0` with Yami's skin colour pooling as a soft glow at the bottom edge
  and a matching one-pixel rim light, which brightens on hover. After 8 quiet
  seconds it slims to a 190×12 bar. Armed abilities add a moon rim. No buttons
  inside the notch.
- **Drawer:** grows from the notch footprint with a 0.34s clip-path reveal and
  closes with a 0.19s reverse. It is ink with aurora washes and star dust, 26px
  lower corners, a hairline edge, and 16px padding. Every inner grid uses
  `--drawer-gap`.
- **Small pills** under the notch (activity, mini media, scroll hint) are
  26px-high ink pills with a hairline and a lavender (or rose for media) icon.
- **AI tab:** activity rows on the left; Open Yami Terminal (primary), Open AI
  workspace and up to three usage meters on the right.

## Soul: loadout and catalogue

- **Hub:** a blurred wallpaper veil tinted by the skin glow, a 170px halo with
  two faint lavender rings around a 118px Yami, a dotted orbit, rising wisps,
  gradient tethers from Yami's glow to each slot colour, and frosted slot cards
  (18px radius, `--blur`) with a tinted round icon chip. The page title follows
  the page-header style.
- **Catalogue:** covers the window with an aurora-tinted ink scrim and a 30px
  backdrop blur; the title bar and dock hide. Cards are `clamp(250px, 31.1vw,
  360px)` × `clamp(335px, 62vh, 485px)`, 28px radius, the item tint blended
  over a `#191536` violet base. The front card is upright; neighbours shift
  36–60px and rotate 4–8° around a 20%/100% origin, and the nearest three on
  each side stay visible. The active card has a 1.5px lavender ring and glow.
  Buy buttons use a moon gradient (`#f6e2b4 → #e9c27f`) with dark text; embers
  are a moon chip. Catalogue item colours (voice `#5ac7e3`, personality
  `#ff994f`, ability `#e6c07a`) and skin glows (Yami `#b8c6ff`, Ember
  `#ff8a55`, Wisp `#6fd79a`, Amethyst `#a97bff`, Gilded `#ffc24a`, Void
  `#7b5cd6`) are content colours, not interface accents.

## The Yami character

A front-facing, armless SVG spirit: a round head (radius 27) with two cat ears,
oval eyes, a small cat mouth, whiskers and blush, whose lower half burns
downward as three flame layers (outer, middle, core) with one long centre
tongue. Each skin defines three flame colours plus a line, eye and glow colour
in `src/yami/skins.ts`. One `requestAnimationFrame` loop per visible Yami runs
only while she is active (hover plus 2.5s, a non-idle state, roaming or
dragging, or Living flame at about 30 fps), then eases to rest and stops.
Reduced motion shows a still pose. Her glow is the source of `--soul`, which
tints the notch, the Home orb, the drawer top and Yami's caption pill.

## Overlays

- **Caption pill:** 24px radius. The user's words are a pale lavender-white
  pill with ink text and a violet label; Yami's reply is ink glass with a
  skin-tinted corner and a lavender label. Key chips above it are 11px-radius
  ink chips.
- **Roaming bubble:** 14px-radius ink glass with a tail; entrance 0.26s.
- **Lasso:** the stroke and its glow are `#bcaaff`.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(.22,1,.36,1)` | General transitions |
| `--ease-fluid` | `cubic-bezier(.32,.72,0,1)` | Page entrances, dock pill, menus, presses |
| `--ease-island` | `cubic-bezier(.2,.8,.2,1)` | Notch and drawer geometry |
| `--dur-fast` / `--dur` / `--dur-slow` | 0.16s / 0.26s / 0.42s | Colour / small movement / page and dock |

Entrances fade and rise 8px. Menus scale from 0.98. Spinners (`circle-notch`)
turn only while work is running. Every keyframe has a reduced-motion override
through `html[data-reduced="true"]` and `prefers-reduced-motion`. No
continuous animation at idle; Yami's own motion budget is described in the
[Yami skill's design language](../../.claude/skills/yami/references/design-language.md).

## Accessibility

- Every icon-only control has a label; tooltips repeat it, never replace it.
- Focus is always visible (2px lavender outline). Select keeps focus on its
  trigger and announces the active option.
- Colour is never the only signal: chips show words, meters show percentages.
- Text on glass stays at or above `--muted` for descriptions; `--faint` is for
  timestamps and placeholders only.

## Adding to the system

1. Use tokens, never raw hex, spacing or durations. If a value is missing, add
   a token in `tokens.css` and record it here.
2. Reach for an existing component: page head, setting group, entry card, form
   card, tile, Select, StatusChip, Meter, IconButton. Extend a component with a
   modifier class rather than restyling it in place.
3. Keep stylesheet files under 1,000 lines by responsibility: `tokens`,
   `base`, `controls`, `home`, `sidebar-pages`, `loadout` (Soul, Bond, Desk),
   `island`, `drawer-tabs`, `overlays`, `today`, `responsive`, `workbench`,
   `cards`, `wheel`.
4. Check the screen in the preview at 1160×790 and 850×610, with reduced
   motion on and off, then on Windows.

## File map

| File | Holds |
| --- | --- |
| `src/styles/tokens.css` | All tokens |
| `src/styles/base.css` | Reset, type, buttons, fields, window frame, dock, modals |
| `src/styles/controls.css` | Select, tooltip, chips, meter, checkbox, disclosure, value pill |
| `src/styles/sidebar-pages.css` | Settings and AI workspace layout, setting rows, toggles |
| `src/styles/cards.css` | Entry, usage, recap, notes, form, engine cards |
| `src/styles/home.css` | Home welcome, composer, conversation |
| `src/styles/loadout.css` | Soul hub and catalogue, Bond, Desk |
| `src/styles/island.css` | Notch, drawer shell, tabs, Controls |
| `src/styles/drawer-tabs.css` | Stats, Apps, Wallpaper, Clipboard, Power, AI tab |
| `src/styles/today.css` | Today tab |
| `src/styles/overlays.css` | Caption, roaming bubble, activity and media pills |
| `src/styles/workbench.css` | Workspace basics and Yami Terminal |
| `src/controls.tsx` | Select, TooltipLayer, StatusChip, Meter, time helpers |
| `src/status-tone.ts` | Status word → colour family |
| `src/island-bounds.ts` | Island window size per tab |
