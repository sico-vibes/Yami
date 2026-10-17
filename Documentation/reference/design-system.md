# Design system

**Mode:** operate. **Visual reference:** the supplied Hitodama reference images. This document records Yami’s implemented styling and layout. It does not certify pixel matching or recover undocumented original behavior.

Yami is the app name and the name used for its small spirit companion. The product remains a Windows desktop app with a transparent island above the desktop. Keep the supplied reference geometry, Rubik typography, dark translucent surfaces, bottom dock, fanned catalogue, and top-center island. Do not add a marketing site or unrelated features.

The implementation lives in [`src/style.css`](../../src/style.css), which imports styles from [`src/styles/`](../../src/styles/). Loadout card geometry is in [`src/Loadout.tsx`](../../src/Loadout.tsx); the cat-ghost artwork, motion and skins are in [`src/yami/`](../../src/yami/); Phosphor icon wrappers are in [`src/ui.tsx`](../../src/ui.tsx). Product limits are in [the product brief](product-brief.md); reconstruction and verification limits are in [the verification history](verification-history.md) and [README](../../README.md).

## Core tokens

| Role | Value |
| --- | --- |
| Main text | `#f4f4f4` |
| Muted text | `#9ca7b0` |
| Focus/settings accent | `#8dccff` |
| Warm gold | `#c9ad5c` |
| Gold action | `#bba057` with `#17140b` text |
| Panel surface | `rgba(255, 255, 255, 0.035)` |
| Hairline | `rgba(255, 255, 255, 0.075)` |
| Field fill | `rgba(255, 255, 255, 0.045)` |
| Focus field fill | `rgba(255, 255, 255, 0.065)` |
| Skin glows | Yami `#b8c6ff`, Ember `#ff8a55`, Wisp `#6fd79a`, Amethyst `#a97bff`, Gilded `#ffc24a`, Void `#7b5cd6` |
| Catalogue voice/personality/ability | `#5ac7e3` / `#ff994f` / `#e6c07a` |

Neutral surfaces layer translucent white over dark gradients. The main shell uses blue-green and blue radial washes over a dark linear gradient; a blurred, dimmed wallpaper sits behind it. The island notch is near-black and the utility drawer fades from charcoal to black. Catalogue cards blend item tints with translucent layers over a warm base. Skin colours are defined in `src/yami/skins.ts`; the default Yami skin is white with near-black features and a pale moon-blue glow, while Void inverts to a dark body with pale eyes and lines.

## Type and shape

Rubik Variable is used throughout. Phosphor regular and fill web fonts supply interface icons. Common role sizes are:

| Role | Size and treatment |
| --- | --- |
| Headline | 36px, weight 400, 1.15 line height, tight tracking |
| Title | 21px, weight 600 |
| Body | 14px, 1.5 line height |
| Label | 12px |
| Catalogue title | `clamp(23px, 2.9vw, 30px)`, weight 700 |

Recurring radii are 10px fields, 12px shell, 20px utility surfaces, 22px modal, 24px action pills, 25px settings groups, 26px catalogue cards, and a 40px dock. Soft/primary buttons use 10px vertical and 19px horizontal padding. Controls have an 8px common gap; cards use 28px 22px 20px padding.

## Layout

The main shell fills the viewport and clips at the shell radius. Its draggable title bar is 66px high; the scroll area reserves 104px for the dock. The dock is centered 24px above the bottom, with 7px padding and 2px gaps. Buttons have 49px minimum height and 57px minimum width.

Settings uses a 278px sidebar, flexible content column, 29px gap, 30px horizontal outer padding, and 1360px maximum width. Rows are at least 79px high. At a maximum viewport width of 950px, the sidebar becomes 235px, the gap 20px, and outer padding 22px. This is an implemented desktop adjustment, not a separate mobile surface.

Catalogue mode covers the viewport with a warm translucent scrim and 30px backdrop blur; the title bar and dock are hidden. Cards are `clamp(250px, 31.1vw, 360px)` wide and `clamp(335px, 62vh, 485px)` high. The front card is upright; neighbours shift 36–60px and rotate 4–8 degrees around a 20%/100% origin. The nearest three cards on each side remain visible.

The island notch is centered at the top: 180×66px collapsed and 150×40px expanded, with 18px lower corners and concave shoulder shapes. The utility shell has 8px side margins and height `calc(100vh - 60px)`. Overlay document backgrounds remain transparent so the real Windows desktop shows through.

## Depth and controls

Depth combines dark tonal layering, backdrop blur, inset highlights, and restrained black shadows. The dock uses an inset top highlight and a soft 12px/40px shadow with 24px blur. Catalogue cards use layered small shadows; the selected card adds a 1.5px inset gold outline. Modal depth uses a 30px/100px shadow over a 4px-blurred scrim.

- **Buttons:** soft and primary pills use 14px text with 8px icon gaps. Primary controls have a translucent blue border and 43px minimum height. Gold utility actions use compact 11px semibold text. Hover lightens surfaces; active state scales to 0.975. Keyboard focus uses a 2px accent outline with 3px offset. Disabled buttons dim.
- **Fields:** translucent fill and a transparent 1px border; focus uses `#8dccff88` and the focused fill. Search fields use a 44px minimum-height pill.
- **Navigation:** the dock uses an inset translucent selected pill. Settings uses rounded rows with blue selected fill and lighter text. Keep accessible labels for icon-only actions.
- **Settings groups:** shallow translucent fill, 19px horizontal inset, and hairline row separators. Controls stay beside row copy within a 46% maximum-width area.
- **Catalogue:** tinted layered cards center the art, name, rarity, copy, and bottom action. Active and locked labels follow the owned state; wheel and arrow controls move the front card.
- **Yami (cat-ghost):** an SVG cat with a bean-shaped body, two pointed ears, oval eyes, whiskers, a raised paw and a tapered wavy tail. One `requestAnimationFrame` loop per instance runs only while active (hover plus a 2.5s linger, a non-idle state, or roaming/dragging): a travelling wave runs down the tail, the body bobs and squashes, the far ear twitches, eyes blink every 4.6s, listening pulses the glow and speaking opens the mouth. When activity ends the pose eases to rest and the loop is cancelled. Connecting and sleeping dim the character; sleeping closes the eyes. Reduced-motion settings and the operating-system preference show a static pose.
- **Overlays:** the caption pill is 22px-radius, light for the user transcript and near-black for Yami's reply, with 9px-radius key chips above it. The roaming speech bubble is 12px-radius near-black with a small tail. The island activity card reuses the 200x26px mini-media pill geometry.

These timings and color values describe Yami’s implementation. They are not recovered original Hitodama source values and do not establish exact behavior parity.
