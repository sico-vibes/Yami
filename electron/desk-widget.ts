import { BrowserWindow, screen } from "electron";
import type { Store } from "./store";
import { makeSmallWindow } from "./windows";
import { SIZE, widgetSpot } from "./desk-spot";

// The optional desk widget: one small card on the desktop with the time,
// weather, what is playing and active agents. It exists only while the
// setting is on, stays below other windows and is never focused on its own.
export function createDeskWidget(
  store: Store,
  host: () => BrowserWindow | undefined,
) {
  let win: BrowserWindow | undefined,
    saveTimer: NodeJS.Timeout | undefined,
    opening = false;
  const alive = (w?: BrowserWindow): w is BrowserWindow =>
    !!w && !w.isDestroyed();
  function sync() {
    const on = store.state.settings.deskWidget;
    if (on && !alive(win) && !opening) {
      const primary = screen.getPrimaryDisplay();
      const areas = [
        primary,
        ...screen.getAllDisplays().filter((d) => d.id !== primary.id),
      ].map((d) => d.workArea);
      opening = true;
      void makeSmallWindow(host(), "widget", {
        ...widgetSpot(store.state.settings.deskWidgetAt, areas),
        ...SIZE,
        transparent: true,
        skipTaskbar: true,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        hasShadow: false,
      }).then((w) => {
        opening = false;
        win = w;
        watch(w);
        // Turned off while it was opening.
        if (!store.state.settings.deskWidget) w.close();
      });
    } else if (!on && alive(win)) win.close();
  }
  function watch(w: BrowserWindow) {
    w.once("ready-to-show", () => w.showInactive());
    // Saved once the drag settles, not on every pixel.
    w.on("move", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!alive(w)) return;
        const [x, y] = w.getPosition();
        store.state.settings.deskWidgetAt = `${x},${y}`;
        store.save();
      }, 500);
    });
    w.on("closed", () => {
      clearTimeout(saveTimer);
      if (win === w) win = undefined;
    });
  }
  /** The card asks for its content height so no empty strip catches clicks. */
  function fit(height: number) {
    if (!alive(win) || !Number.isFinite(height)) return false;
    const h = Math.round(Math.min(SIZE.height + 120, Math.max(96, height)));
    if (win.getSize()[1] === h) return true;
    // Windows ignores setSize on a window that cannot be resized.
    win.setResizable(true);
    win.setSize(SIZE.width, h);
    win.setResizable(false);
    return true;
  }
  return { sync, fit };
}
