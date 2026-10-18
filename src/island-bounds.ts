// Island window sizes, shared by the main process (real window bounds) and the
// browser preview (stage size), so the preview shows the drawer at true scale.
const drawerHeights: Record<string, number> = {
  Controls: 390,
  Today: 460,
  Stats: 360,
  Clipboard: 440,
  Apps: 650,
  Wallpaper: 310,
  Power: 185,
  AI: 490,
};
const drawerWidths: Record<string, number> = {
  Controls: 650,
  Today: 900,
  Stats: 900,
  Clipboard: 790,
  Apps: 730,
  Wallpaper: 1040,
  Power: 650,
  AI: 790,
};
/** Unclamped island size: the open drawer for `tab`, or the collapsed notch. */
export function islandSize(open: boolean, tab: string) {
  return open
    ? { width: drawerWidths[tab] || 730, height: (drawerHeights[tab] || 400) + 34 }
    : { width: 220, height: 96 };
}
/** The collapsed island grown to fit the media card. */
export const peekSize = { width: 400, height: 200 };
