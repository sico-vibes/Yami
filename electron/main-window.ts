import type { BrowserWindow, WebContents } from "electron";

type Deps = {
  create: () => BrowserWindow;
  quitting: () => boolean;
  /** True while something needs the hidden window kept, such as a recording. */
  busy: () => boolean;
};

/** How long a hidden main window keeps its renderer before it is released. */
export const releaseAfter = Number(process.env.YAMI_MAIN_RELEASE_MS) || 60_000;

/**
 * The main window exists only while it is shown or recently hidden. Events
 * sent before its page is listening wait in a short queue; state snapshots are
 * skipped because the page reads state when it starts.
 */
export function createMainWindow(deps: Deps) {
  let win: BrowserWindow | undefined;
  let ready = false;
  let timer: NodeJS.Timeout | undefined;
  let queue: unknown[] = [];
  const current = () => (win && !win.isDestroyed() ? win : undefined);
  const release = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = current();
      if (w && !w.isVisible() && !deps.busy()) w.destroy();
      else if (w && !w.isVisible()) release();
    }, releaseAfter);
  };
  const open = () => {
    const existing = current();
    if (existing) return existing;
    ready = false;
    queue = [];
    const w = deps.create();
    w.on("close", (e) => {
      if (deps.quitting()) return;
      e.preventDefault();
      w.hide();
    });
    w.on("hide", release);
    w.on("show", () => clearTimeout(timer));
    w.on("closed", () => {
      if (win === w) win = undefined;
    });
    win = w;
    return w;
  };
  return {
    current,
    owns: (w: BrowserWindow) => w === current(),
    show(tab?: string) {
      const w = open();
      if (w.isMinimized()) w.restore();
      if (w.webContents.isLoading()) w.once("ready-to-show", () => w.show());
      else w.show();
      w.focus();
      if (tab) this.send({ type: "navigate", tab });
    },
    send(event: { type?: string } | unknown) {
      const w = current();
      if (!w) return;
      if (ready) w.webContents.send("yami:event", event);
      else if ((event as { type?: string })?.type !== "state")
        queue = [...queue, event].slice(-100);
    },
    /** The page calls `window.ready` once it listens for events. */
    ready(sender: WebContents) {
      const w = current();
      if (!w || w.webContents.id !== sender.id) return false;
      ready = true;
      for (const event of queue) w.webContents.send("yami:event", event);
      queue = [];
      return true;
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
