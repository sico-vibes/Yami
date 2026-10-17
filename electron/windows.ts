import { app, BrowserWindow } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
export const windows = new Set<BrowserWindow>();
export const assetRoot = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(app.getAppPath(), process.env.YAMI_DEV_URL ? "public" : "dist");
export function makeWindow(
  mode: string,
  options: Electron.BrowserWindowConstructorOptions,
) {
  const w = new BrowserWindow({
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
  windows.add(w);
  w.on("closed", () => windows.delete(w));
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith(
        process.env.YAMI_DEV_URL ||
          pathToFileURL(path.join(app.getAppPath(), "dist", "index.html")).href,
      )
    )
      event.preventDefault();
  });
  if (process.env.YAMI_DEV_URL)
    void w.loadURL(`${process.env.YAMI_DEV_URL}/?window=${mode}`);
  else
    void w.loadFile(path.join(app.getAppPath(), "dist", "index.html"), {
      query: { window: mode },
    });
  return w;
}
