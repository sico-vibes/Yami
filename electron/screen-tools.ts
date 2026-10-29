import fs from "node:fs";
import path from "node:path";
import { clipboard, screen, type BrowserWindow } from "electron";
import type { Native } from "./native";
import { makeWindow } from "./windows";

// Two PowerToys ideas built into Yami's own windows:
// - Color picker: one lossless screenshot of the display under the pointer,
//   shown full screen with a magnifier; the clicked pixel's colour is copied
//   and kept in a short history. Nothing runs before or after a pick.
// - Always on top: pins the last window you used that is not Yami's, with
//   a lavender border on Windows 11.

type Capture = { data: string; width: number; height: number };
let lastWindow: { handle: number; process: string } | undefined;

/** Called for every foreground change; Yami's own windows are skipped. */
export function noteForeground(e: {
  pid?: number;
  handle?: number;
  process?: string;
}) {
  if (e.pid && e.handle && e.pid !== process.pid)
    lastWindow = { handle: Number(e.handle), process: String(e.process || "") };
}

export function createScreenTools(deps: {
  native: Native;
  dataDir: string;
  /** Closes the island drawer so it is not in the screenshot. */
  closePanel: () => void;
  broadcast: (event: any) => void;
}) {
  const file = path.join(deps.dataDir, "colors.json");
  let picker: BrowserWindow | undefined;
  let capture: Capture | undefined;
  const history = (): string[] => {
    try {
      const list = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(list)
        ? list.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12)
        : [];
    } catch {
      return [];
    }
  };
  const close = () => {
    capture = undefined;
    if (picker && !picker.isDestroyed()) picker.close();
    picker = undefined;
  };
  return {
    history,
    async pick() {
      if (picker && !picker.isDestroyed()) return true;
      deps.closePanel();
      await new Promise((r) => setTimeout(r, 220));
      const display = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
      );
      const shot = await deps.native.call("capture", {
        ...screen.dipToScreenRect(null, display.bounds),
        format: "png",
      });
      capture = { data: shot.data, width: shot.width, height: shot.height };
      picker = makeWindow("picker", {
        ...display.bounds,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
      });
      picker.setAlwaysOnTop(true, "screen-saver");
      picker.once("ready-to-show", () => {
        picker?.show();
        picker?.focus();
      });
      picker.on("closed", () => {
        picker = undefined;
        capture = undefined;
      });
      return true;
    },
    capture: () => capture,
    done(hex: unknown) {
      const color = String(hex || "").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(color))
        throw new Error("That is not a colour.");
      clipboard.writeText(color);
      const next = [color, ...history().filter((c) => c !== color)].slice(
        0,
        12,
      );
      fs.mkdirSync(deps.dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(next));
      close();
      deps.broadcast({ type: "colors", colors: next, picked: color });
      return next;
    },
    cancel() {
      close();
      return true;
    },
    clear() {
      fs.rmSync(file, { force: true });
      deps.broadcast({ type: "colors", colors: [] });
      return [];
    },
    /** Pins or unpins the last window you used that is not Yami's. */
    async pin() {
      if (!lastWindow)
        throw new Error(
          "Click the window you want on top first, then try again.",
        );
      const result = await deps.native.call("topmost", {
        handle: lastWindow.handle,
      });
      return { ...result, process: lastWindow.process };
    },
    async pinned() {
      if (!lastWindow) return { window: "", pinned: false };
      return {
        window: lastWindow.process,
        pinned: !!(await deps.native
          .call("topmostState", { handle: lastWindow.handle })
          .catch(() => false)),
      };
    },
  };
}
