import { app, BrowserWindow, screen } from "electron";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { filesFromArgv } from "../../src/wheel/argv";
import type { WheelMode, WheelSession, WheelSource } from "../../src/wheel/types";
import { describeWheelFiles } from "./paths";

const exec = promisify(execFile);
const WHEEL = 640;
type Deps = {
  makeWindow: (
    mode: string,
    options: Electron.BrowserWindowConstructorOptions,
  ) => BrowserWindow;
  broadcast: (event: unknown) => void;
  notify: (message: string) => void;
  native: { call: (method: string, args?: unknown) => Promise<unknown> };
  getSettings: () => {
    fileWheelSound?: boolean;
    fileWheelReveal?: boolean;
    reducedMotion?: boolean;
    fileWheelEnabled?: boolean;
  };
};

export function createWheel(deps: Deps) {
  let session: WheelSession | null = null;
  let wheel: BrowserWindow | undefined;
  let shelf: BrowserWindow | undefined;
  let chosen = false;
  let releaseTimer: NodeJS.Timeout | undefined;

  const publish = () => {
    if (session) deps.broadcast({ type: "wheel-session", session });
  };
  const clearRelease = () => {
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = undefined;
  };
  const closeWheel = () => {
    clearRelease();
    session = null;
    chosen = false;
    if (wheel && !wheel.isDestroyed()) wheel.close();
    wheel = undefined;
  };
  const place = (x: number, y: number, physical: boolean) => {
    const convert = screen.screenToDipPoint;
    const point =
      physical && typeof convert === "function" ? convert({ x, y }) : { x, y };
    return {
      x: Math.round(point.x - WHEEL / 2),
      y: Math.round(point.y - WHEEL / 2),
    };
  };
  const showWheel = (
    source: WheelSource,
    x: number,
    y: number,
    mode: WheelMode,
    files: WheelSession["files"],
    hint: string,
    physical: boolean,
  ) => {
    closeWheel();
    const settings = deps.getSettings();
    session = {
      id: randomUUID(),
      mode,
      source,
      files,
      hint,
      sound: !!settings.fileWheelSound,
      reducedMotion: !!settings.reducedMotion,
      x,
      y,
    };
    chosen = false;
    wheel = deps.makeWindow("wheel", {
      ...place(x, y, physical),
      width: WHEEL,
      height: WHEEL,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: source !== "drag",
      hasShadow: false,
      thickFrame: false,
    });
    const current = wheel;
    current.setAlwaysOnTop(true, "screen-saver");
    current.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    current.on("closed", () => {
      if (wheel === current) {
        wheel = undefined;
        session = null;
      }
    });
    current.once("ready-to-show", () => {
      if (current.isDestroyed()) return;
      publish();
      if (source === "drag") current.showInactive();
      else {
        current.show();
        current.focus();
      }
    });
  };
  const selection = async () => {
    if (process.platform !== "win32") return [] as string[];
    const script = app.isPackaged
      ? path.join(process.resourcesPath, "native", "ExplorerSelection.ps1")
      : path.join(app.getAppPath(), "native", "ExplorerSelection.ps1");
    try {
      const result = await exec(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script],
        { windowsHide: true, timeout: 8000 },
      );
      const parsed = JSON.parse(result.stdout.trim() || "{}");
      return Array.isArray(parsed.paths) ? parsed.paths.map(String) : [];
    } catch {
      return [];
    }
  };
  const openWithPaths = async (
    paths: string[],
    source: WheelSource,
    x: number,
    y: number,
    mode: WheelMode = "convert",
    hint = "Choose a petal.",
    physical = false,
  ) => {
    const files = paths.length ? await describeWheelFiles(paths) : [];
    showWheel(
      source,
      x,
      y,
      mode,
      files,
      files.length ? hint : "Drop a file, or select files in Explorer.",
      physical,
    );
  };

  const api = {
    onNative(event: { eventName?: string; action?: string; mode?: WheelMode; x?: number; y?: number }) {
      if (event.eventName !== "file-wheel") return false;
      const x = Number(event.x) || 0;
      const y = Number(event.y) || 0;
      if (event.action === "open" || event.action === "swap") {
        const mode = event.mode || "convert";
        if (event.action === "swap" && session && wheel && !wheel.isDestroyed()) {
          session = { ...session, mode, x, y };
          publish();
          return true;
        }
        showWheel("drag", x, y, mode, [], "Release on a petal.", true);
        void selection().then(async (paths) => {
          try {
            if (!session || session.source !== "drag" || chosen || !paths.length) return;
            session = { ...session, files: await describeWheelFiles(paths) };
            publish();
          } catch (error) {
            deps.notify(error instanceof Error ? error.message : "Those files are blocked.");
          }
        });
        return true;
      }
      if (event.action === "release") {
        clearRelease();
        releaseTimer = setTimeout(() => {
          if (!chosen) {
            deps.notify(
              "The drag did not reach the wheel. Use the shortcut, Send to, or the drop shelf.",
            );
            closeWheel();
          }
        }, 700);
        return true;
      }
      if (event.action === "close") {
        closeWheel();
        return true;
      }
      if (event.action === "hotkey") {
        void selection().then((paths) => {
          if (!paths.length)
            deps.notify(
              "Select files in File Explorer, then try the shortcut again. Desktop icons can use Send to or the drop shelf.",
            );
          return openWithPaths(paths, "hotkey", x, y, "convert", "Choose a petal.", true);
        });
        return true;
      }
      if (event.action === "hotkey-unavailable") {
        deps.notify("Windows did not register the file wheel shortcut.");
        return true;
      }
      return true;
    },
    acceptArgv(argv: string[]) {
      if (!argv.includes("--file-wheel")) return false;
      const files = filesFromArgv(argv, (value) => {
        try {
          return fs.existsSync(value) && fs.statSync(value).isFile();
        } catch {
          return false;
        }
      }, process.execPath);
      const point = screen.getCursorScreenPoint();
      void openWithPaths(files, "sendto", point.x, point.y, "convert", "Choose a petal.", false);
      return true;
    },
    trayItems(): Electron.MenuItemConstructorOptions[] {
      return [
        {
          label: "File wheel",
          click: () => {
            const point = screen.getCursorScreenPoint();
            void selection().then((paths) =>
              openWithPaths(paths, "hotkey", point.x, point.y, "convert", "Choose a petal.", false),
            );
          },
        },
        { label: "Drop shelf", click: () => api.openShelf() },
      ];
    },
    openShelf() {
      if (shelf && !shelf.isDestroyed()) {
        shelf.show();
        return;
      }
      const point = screen.getCursorScreenPoint();
      const area = screen.getDisplayNearestPoint(point).workArea;
      shelf = deps.makeWindow("shelf", {
        width: 320,
        height: 180,
        x: Math.round(area.x + area.width - 344),
        y: Math.round(area.y + area.height - 220),
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
      });
      const current = shelf;
      current.setAlwaysOnTop(true, "floating");
      current.on("closed", () => {
        if (shelf === current) shelf = undefined;
      });
      current.once("ready-to-show", () => current.show());
    },
    async handle(method: string, args: any = {}, _sender?: Electron.WebContents) {
      switch (method) {
        case "wheel.session":
          return session;
        case "wheel.caps":
          return { heicEncode: false };
        case "wheel.swap":
          if (!session) return null;
          session = { ...session, mode: args.mode };
          publish();
          return session;
        case "wheel.close":
          closeWheel();
          return true;
        case "wheel.fail":
          deps.notify(String(args.message || "The wheel could not finish."));
          return true;
        case "wheel.choose": {
          chosen = true;
          clearRelease();
          const files = Array.isArray(args.paths) && args.paths.length
            ? await describeWheelFiles(args.paths.map(String))
            : session?.files || [];
          const label = String(args.petalId || "a petal");
          deps.notify(
            files.length
              ? `Received ${label} for ${files.map((file) => file.name).join(", ")}. Conversion engines are not connected yet.`
              : "Drop a file on a petal.",
          );
          closeWheel();
          return { accepted: true, petalId: label, files: files.map((file) => file.name) };
        }
        case "wheel.shelf":
          api.openShelf();
          return true;
        case "wheel.shelf.drop": {
          const point = screen.getCursorScreenPoint();
          if (shelf && !shelf.isDestroyed()) shelf.close();
          await openWithPaths(
            Array.isArray(args.paths) ? args.paths.map(String) : [],
            "shelf",
            point.x,
            point.y,
            "convert",
            "Choose a petal.",
            false,
          );
          return true;
        }
        case "wheel.sendTo":
          return installSendTo();
        case "wheel.configure":
          return deps.native.call("configure", {
            ...deps.getSettings(),
            abilityArmed: false,
          });
        default:
          throw new Error("Unknown wheel request: " + method);
      }
    },
  };

  if (process.argv.includes("--file-wheel")) api.acceptArgv(process.argv);
  return api;
}

async function installSendTo() {
  if (process.platform !== "win32")
    throw new Error("Send to is available on Windows.");
  const folder = path.join(
    process.env.APPDATA || "",
    "Microsoft",
    "Windows",
    "SendTo",
  );
  const shortcut = path.join(folder, "Yami file wheel.lnk");
  const script = app.isPackaged
    ? path.join(process.resourcesPath, "native", "SendToLink.ps1")
    : path.join(app.getAppPath(), "native", "SendToLink.ps1");
  const packaged = app.isPackaged;
  await exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Shortcut",
      shortcut,
      "-Target",
      process.execPath,
      "-Arguments",
      packaged ? "--file-wheel" : `"${app.getAppPath()}" --file-wheel`,
      "-WorkDir",
      app.getAppPath(),
    ],
    { windowsHide: true, timeout: 8000 },
  );
  return { shortcut };
}
