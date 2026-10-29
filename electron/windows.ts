import { app, BrowserWindow } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
export const windows = new Set<BrowserWindow>();
export const assetRoot = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(app.getAppPath(), process.env.YAMI_DEV_URL ? "public" : "dist");
const appUrl = () =>
  process.env.YAMI_DEV_URL ||
  pathToFileURL(path.join(app.getAppPath(), "dist", "index.html")).href;
const frameOptions = (
  mode: string,
  options: Electron.BrowserWindowConstructorOptions,
): Electron.BrowserWindowConstructorOptions => ({
  ...options,
  icon: path.join(assetRoot(), "yami-icon.png"),
  show: false,
  frame: false,
  backgroundColor: mode === "main" ? "#11191e" : "#00000000",
  webPreferences: {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    backgroundThrottling: true,
  },
});
/** The rules every Yami window shares: no pop-ups, no leaving the app. */
const guard = (w: BrowserWindow) => {
  windows.add(w);
  w.on("closed", () => windows.delete(w));
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl())) event.preventDefault();
  });
};
export function makeWindow(
  mode: string,
  options: Electron.BrowserWindowConstructorOptions,
) {
  const w = new BrowserWindow(frameOptions(mode, options));
  guard(w);
  if (process.env.YAMI_DEV_URL)
    void w.loadURL(`${process.env.YAMI_DEV_URL}/?window=${mode}`);
  else
    void w.loadFile(path.join(app.getAppPath(), "dist", "index.html"), {
      query: { window: mode },
    });
  return w;
}
/**
 * A small window opened from `host`'s page, so it runs in the host's
 * renderer process instead of starting its own (about 25 MB less at idle).
 * If the host's renderer goes, this window goes with it.
 */
export function makeChildWindow(
  host: BrowserWindow,
  mode: string,
  options: Electron.BrowserWindowConstructorOptions,
): Promise<BrowserWindow> {
  const url = new URL(appUrl());
  url.searchParams.set("window", mode);
  const target = url.href;
  // Chromium may spell the path differently; the app's own page and mode decide.
  const ours = (u: string) => {
    try {
      const p = new URL(u);
      return (
        p.origin === url.origin &&
        decodeURIComponent(p.pathname) === decodeURIComponent(url.pathname) &&
        p.searchParams.get("window") === mode
      );
    } catch {
      return false;
    }
  };
  const contents = host.webContents;
  return new Promise<BrowserWindow>((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timer);
      contents.off("did-create-window", created);
      contents.setWindowOpenHandler(() => ({ action: "deny" }));
      if (error) reject(error);
    };
    const timer = setTimeout(
      () => done(new Error(`The ${mode} window did not open.`)),
      5000,
    );
    // Allow exactly this one window, then deny again.
    contents.setWindowOpenHandler((d) =>
      ours(d.url)
        ? {
            action: "allow",
            overrideBrowserWindowOptions: frameOptions(mode, options),
          }
        : { action: "deny" },
    );
    const created = (w: BrowserWindow, d: { url: string }) => {
      if (!ours(d.url)) return;
      done();
      guard(w);
      resolve(w);
    };
    contents.on("did-create-window", created);
    const open = () =>
      contents
        .executeJavaScript(
          `void window.open(${JSON.stringify(target)}, "_blank")`,
          true,
        )
        .catch((e) => done(e));
    if (contents.isLoading()) contents.once("did-finish-load", open);
    else void open();
  });
}
// One child window opens at a time: each one sets the host's open handler.
let opening: Promise<unknown> = Promise.resolve();
/** A small overlay in `host`'s renderer when it can, else in its own. */
export function makeSmallWindow(
  host: BrowserWindow | undefined,
  mode: string,
  options: Electron.BrowserWindowConstructorOptions,
): Promise<BrowserWindow> {
  const next = opening.then(async () => {
    if (host && !host.isDestroyed())
      try {
        return await makeChildWindow(host, mode, options);
      } catch {}
    return makeWindow(mode, options);
  });
  opening = next.catch(() => {});
  return next;
}
