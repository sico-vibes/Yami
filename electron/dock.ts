import fs from "node:fs";
import path from "node:path";
import { app, Menu, screen, shell, type BrowserWindow } from "electron";
import type { Native } from "./native";
import type { Store } from "./store";
import { makeWindow } from "./windows";

// Yami's dock: pinned apps and the apps that are open, along the bottom of
// the main screen, in one small window that never takes focus. It reads the
// open windows when the foreground window changes or the pointer comes in,
// never on a timer. "Hide the Windows taskbar" flips the same switch as
// Settings › Taskbar › Automatically hide, and puts it back when turned off.

export type DockPin = { path: string; name: string };
type Running = { exe: string; title: string; handle: number };
export type DockItem = {
  key: string;
  name: string;
  icon: string;
  /** A pinned shortcut or program, to start it. */
  path?: string;
  /** Open windows of this program, newest first. */
  handles: number[];
  pinned: boolean;
};

const ITEM = 58,
  PAD = 28,
  HEIGHT = 112;

let instance: ReturnType<typeof createDock> | undefined;
/** Main's foreground events refresh the dock, if it is open. */
export const dockForeground = () => instance?.refreshSoon();

export function createDock(deps: {
  native: Native;
  store: Store;
  changed: () => void;
  launch: (path: string) => Promise<unknown>;
}) {
  let win: BrowserWindow | undefined;
  let items: DockItem[] = [];
  let timer: NodeJS.Timeout | undefined;
  const icons = new Map<string, string>();
  const targets = new Map<string, string>();
  const settings = () => deps.store.state.settings;

  const icon = async (file: string) => {
    if (icons.has(file)) return icons.get(file)!;
    let url = "";
    try {
      if (!file.startsWith("shell:"))
        url = (await app.getFileIcon(file, { size: "large" })).toDataURL();
    } catch {}
    icons.set(file, url);
    return url;
  };
  /** A shortcut's program, so a pinned app shows when it is running. */
  const target = (file: string) => {
    if (!targets.has(file)) {
      let exe = file;
      try {
        if (file.toLowerCase().endsWith(".lnk"))
          exe = shell.readShortcutLink(file).target || file;
      } catch {}
      targets.set(file, exe.toLowerCase());
    }
    return targets.get(file)!;
  };

  const read = async () => {
    const running: Running[] = await deps.native
      .call("appWindows", { skip: process.pid })
      .catch(() => []);
    const pins: DockPin[] = settings().dockPinned || [];
    const out: DockItem[] = [];
    const used = new Set<number>();
    for (const p of pins) {
      const exe = target(p.path);
      const open = running.filter((r) => r.exe.toLowerCase() === exe);
      open.forEach((r) => used.add(r.handle));
      out.push({
        key: "pin:" + p.path,
        name: p.name,
        icon: await icon(p.path),
        path: p.path,
        handles: open.map((r) => r.handle),
        pinned: true,
      });
    }
    const groups = new Map<string, Running[]>();
    for (const r of running)
      if (!used.has(r.handle)) {
        const k = r.exe.toLowerCase();
        groups.set(k, [...(groups.get(k) || []), r]);
      }
    for (const [k, list] of groups)
      out.push({
        key: "run:" + k,
        name: path.basename(list[0].exe, ".exe"),
        icon: await icon(list[0].exe),
        path: list[0].exe,
        handles: list.map((r) => r.handle),
        pinned: false,
      });
    items = out.slice(0, 24);
    place();
    win?.webContents.send("yami:event", { type: "dock", items });
    return items;
  };

  const place = () => {
    if (!win || win.isDestroyed()) return;
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(
      area.width - 40,
      PAD * 2 + Math.max(1, items.length) * ITEM,
    );
    win.setBounds({
      x: Math.round(area.x + (area.width - width) / 2),
      y: area.y + area.height - HEIGHT,
      width,
      height: HEIGHT,
    });
  };

  const open = () => {
    if (win && !win.isDestroyed()) return;
    win = makeWindow("dock", {
      width: 400,
      height: HEIGHT,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      hasShadow: false,
    });
    win.setAlwaysOnTop(true, "floating");
    win.once("ready-to-show", () => win?.showInactive());
    win.on("closed", () => (win = undefined));
    void read();
  };

  const api = {
    /** Opens or closes the dock and the taskbar choice to match settings. */
    async sync() {
      if (settings().dockEnabled) open();
      else if (win && !win.isDestroyed()) win.close();
      const want = !!(settings().dockEnabled && settings().dockHideTaskbar);
      const now = await deps.native
        .call("taskbarAutoHide")
        .catch(() => undefined);
      if (now === undefined) return;
      const s = settings();
      if (want && !now) {
        s.taskbarAutoHideBefore = false;
        await deps.native.call("taskbarAutoHide", { on: true });
        deps.changed();
      } else if (!want && s.taskbarAutoHideBefore === false && now) {
        // Put back what Windows had before Yami hid it.
        delete s.taskbarAutoHideBefore;
        await deps.native.call("taskbarAutoHide", { on: false });
        deps.changed();
      }
    },
    items: () => read(),
    refreshSoon() {
      if (!win) return;
      clearTimeout(timer);
      timer = setTimeout(() => void read(), 400);
    },
    async activate(key: unknown) {
      const item = items.find((i) => i.key === key);
      if (!item) throw new Error("That app left the dock.");
      if (item.handles.length)
        await deps.native.call("focusHandle", { handle: item.handles[0] });
      else if (item.path && /\.exe$/i.test(item.path)) {
        // A program pinned from its window starts directly.
        const error = await shell.openPath(item.path);
        if (error) throw new Error(error);
      } else if (item.path) await deps.launch(item.path);
      api.refreshSoon();
      return true;
    },
    menu(key: unknown) {
      const item = items.find((i) => i.key === key);
      if (!item || !win) return false;
      const pins = () => settings().dockPinned || [];
      const save = (next: DockPin[]) => {
        settings().dockPinned = next.slice(0, 24);
        deps.changed();
        void read();
      };
      Menu.buildFromTemplate([
        item.pinned
          ? {
              label: `Remove ${item.name} from the dock`,
              click: () =>
                save(pins().filter((p) => "pin:" + p.path !== item.key)),
            }
          : {
              label: `Keep ${item.name} in the dock`,
              click: () =>
                item.path &&
                save([...pins(), { path: item.path, name: item.name }]),
            },
        ...(item.handles.length
          ? [
              {
                label: "Bring to front",
                click: () => void api.activate(item.key),
              },
            ]
          : [{ label: "Open", click: () => void api.activate(item.key) }]),
      ]).popup({ window: win });
      return true;
    },
    /** Pins an app from the launcher list. */
    pin(file: unknown, name: unknown) {
      const p = String(file || "");
      if (!p || !(p.startsWith("shell:") || fs.existsSync(p)))
        throw new Error("That app is not on this PC.");
      const list = settings().dockPinned || [];
      if (!list.some((x) => x.path === p))
        settings().dockPinned = [
          ...list,
          { path: p, name: String(name || path.basename(p)) },
        ];
      deps.changed();
      void read();
      return true;
    },
    dispose() {
      clearTimeout(timer);
      if (win && !win.isDestroyed()) win.close();
    },
  };
  instance = api;
  return api;
}
