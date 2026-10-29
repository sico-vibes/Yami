import { findLyrics } from "./lyrics";
import { KeepAwake } from "./keep-awake";
import { createScreenTools } from "./screen-tools";
import { Rates } from "./currency";
import { mediaAction, windowsSearch } from "./platform";
import {
  app,
  BrowserWindow,
  dialog,
  shell,
  nativeImage,
  powerSaveBlocker,
  safeStorage,
} from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppItem } from "../src/shared";
import type { Store } from "./store";
import type { Native } from "./native";
import type { Assistant } from "./assistant";
import { safeWebUrl } from "./policy";

/** Files Windows Search offered, which the launcher may open. */
const searchHits = new Set<string>();

export type RequestContext = {
  workbench?: { exportData: () => any; clearData: () => void };
  store: Store;
  native: Native;
  assistant: Assistant;
  /** The main window, or undefined while it is released to save memory. */
  main: () => BrowserWindow | undefined;
  island: BrowserWindow;
  changed: () => void;
  broadcast: (event: any) => void;
  showMain: (tab?: string) => void;
  setPanel: (open: boolean, tab?: string) => void;
  peekIsland: (open: boolean) => void;
  confirm: (title: string, detail: string) => Promise<boolean>;
  discoverApps: () => Promise<any>;
  launchApp: (name: string) => Promise<any>;
  action: (tool: string, args: any, background?: boolean) => Promise<any>;
  displayCapture: () => Promise<any>;
  effect: (kind: string, before?: any, after?: any) => Promise<any>;
  metrics: () => Promise<any>;
  controls: () => Promise<any>;
  setBrightness: (args: { value: number }) => Promise<any>;
  nativeScript: (name: string) => Promise<any>;
  weather: () => Promise<any>;
  assetRoot: () => string;
  beginLasso: () => Promise<any>;
  approvals: Map<
    string,
    { resolve: (value: boolean) => void; timer: NodeJS.Timeout }
  >;
  busy: any;
  pendingSelection: any;
  capture: any;
  lasso: any;
  effectData: any;
  clipboardPause: any;
  quitting: any;
  apps: AppItem[];
  launcherFiles: { name: string; path: string }[];
  panelOpen: any;
  wheel?: (
    method: string,
    args: any,
    sender?: Electron.WebContents,
  ) => Promise<any>;
};
export function createRequestHandler(ctx: RequestContext) {
  const {
    store,
    native,
    assistant,
    main: mainWindow,
    island,
    changed,
    broadcast,
    showMain,
    setPanel,
    confirm,
    discoverApps,
    launchApp,
    action,
    displayCapture,
    effect,
    metrics,
    controls,
    setBrightness,
    nativeScript,
    weather,
    assetRoot,
    beginLasso,
    approvals,
  } = ctx;
  // Every window sees the same keep-awake state, including the island.
  const tools = createScreenTools({
    native,
    dataDir: path.dirname(store.file),
    closePanel: () => setPanel(false),
    broadcast,
  });
  const rates = new Rates();
  const awake = new KeepAwake(powerSaveBlocker, (state) =>
    broadcast({ type: "keep-awake", state }),
  );
  return async function invoke(
    method: string,
    a: any = {},
    sender?: Electron.WebContents,
  ): Promise<any> {
    switch (method) {
      case "state":
        return store.publicState();
      case "settings": {
        const keys = Object.keys(store.state.settings);
        const next = { ...store.state.settings };
        for (const [k, v] of Object.entries(a))
          if (keys.includes(k) && typeof v === typeof (next as any)[k])
            (next as any)[k] = v;
        const modifiers = [
          next.fileWheelConvert,
          next.fileWheelTools,
          next.fileWheelActions,
        ];
        if (new Set(modifiers).size < modifiers.length)
          throw new Error(
            "Give Convert, Tools, and Actions different modifier keys.",
          );
        store.state.settings = next;
        if (!process.env.YAMI_DATA_DIR)
          app.setLoginItemSettings({
            openAtLogin: store.state.settings.launchAtLogin,
            path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
            args: app.isPackaged
              ? ["--hidden"]
              : [app.getAppPath(), "--hidden"],
          });
        mainWindow()?.setAlwaysOnTop(store.state.settings.alwaysOnTop);
        await native.call("configure", {
          ...store.state.settings,
          abilityArmed: false,
        });
        assistant.stopLive();
        broadcast({ type: "cancel-recording" });
        changed();
        return store.publicState();
      }
      case "shortcuts.capture":
        return native.call("configure", {
          hotkeys: !a.active && store.state.settings.hotkeys,
          abilityArmed: false,
        });
      case "keys.save": {
        const name = String(a.provider),
          key = String(a.key || "").trim();
        if (!key) throw new Error("Paste an API key.");
        let models: any[] = [];
        if (name === "gemini") models = await assistant.validate(key);
        else if (name === "tavily") {
          const r = await fetch("https://api.tavily.com/usage", {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!r.ok) throw new Error(`Tavily rejected this key (${r.status}).`);
        } else throw new Error("Unknown provider.");
        assistant.stopLive();
        broadcast({ type: "cancel-recording" });
        store.key(name, key);
        if (models.length) {
          const texts = models.filter(
            (m) =>
              m.actions.includes("generateContent") &&
              !/image|tts|live|audio|embedding/i.test(m.name),
          );
          if (
            texts.length &&
            !texts.some((m) => m.name === store.state.settings.textModel)
          )
            store.state.settings.textModel = (
              texts.find((m) => /flash/.test(m.name)) || texts[0]
            ).name;
          const lives = models.filter(
            (m) =>
              m.actions.includes("bidiGenerateContent") ||
              /live|native-audio/i.test(m.name),
          );
          if (
            lives.length &&
            !lives.some((m) => m.name === store.state.settings.voiceModel)
          )
            store.state.settings.voiceModel = lives[0].name;
        }
        changed();
        return { ok: true, models };
      }
      case "keys.remove":
        assistant.stopLive();
        broadcast({ type: "cancel-recording" });
        store.key(a.provider, "");
        changed();
        return true;
      case "keys.models":
        return assistant.validate(store.key("gemini") || "");
      case "keys.usage": {
        if (!store.key("tavily")) return null;
        const r = await fetch("https://api.tavily.com/usage", {
          headers: { Authorization: `Bearer ${store.key("tavily")}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error("Tavily usage is unavailable.");
        return r.json();
      }
      case "chat":
        if (ctx.busy)
          throw new Error("Wait for the current request to finish.");
        ctx.busy = true;
        try {
          const result = await assistant.chat(
            String(a.text).slice(0, 20000),
            a.image || ctx.pendingSelection,
          );
          ctx.pendingSelection = undefined;
          broadcast({ type: "selection-cleared" });
          return result;
        } finally {
          ctx.busy = false;
        }
      case "voice.start":
        await assistant.startLive();
        if (ctx.pendingSelection) {
          assistant.singleTurn = true;
          const jpeg = nativeImage
            .createFromBuffer(Buffer.from(ctx.pendingSelection.data, "base64"))
            .toJPEG(85);
          assistant.session?.sendRealtimeInput({
            video: { data: jpeg.toString("base64"), mimeType: "image/jpeg" },
          });
          ctx.pendingSelection = undefined;
          broadcast({ type: "selection-cleared" });
        }
        return true;
      case "record":
        if (!store.key("gemini"))
          throw new Error(
            "Connect your Gemini API key in Settings > API keys.",
          );
        broadcast({ type: "record", kind: a.kind });
        return true;
      case "audio.error":
        assistant.stopLive();
        broadcast({ type: "error", message: String(a.message) });
        return true;
      case "voice.audio":
        assistant.audio(String(a.data));
        return true;
      case "voice.endAudio":
        assistant.endAudio();
        return true;
      case "voice.stop":
        assistant.stopLive();
        broadcast({ type: "cancel-recording" });
        return true;
      case "dictation":
        return assistant.dictation(a.data, a.mimeType, a.target);
      case "show":
        showMain(a.tab);
        return true;
      case "minimize":
        mainWindow()?.minimize();
        return true;
      case "hide":
        mainWindow()?.hide();
        return true;
      case "panel":
        setPanel(!!a.open, a.tab);
        return true;
      case "island.peek":
        ctx.peekIsland(!!a.open);
        return true;
      case "island.mouse":
        if (!ctx.panelOpen)
          island.setIgnoreMouseEvents(!!a.ignore, { forward: true });
        return true;
      case "confirm": {
        const p = approvals.get(a.id);
        if (p) {
          clearTimeout(p.timer);
          approvals.delete(a.id);
          p.resolve(!!a.approved);
        }
        return true;
      }
      case "apps":
        if (!ctx.apps.length) await discoverApps();
        return ctx.apps;
      case "launcher.files": {
        const query = String(a.query || "").toLowerCase();
        if (query.length < 2) return [];
        const local = ctx.launcherFiles
          .filter((f) => f.name.toLowerCase().includes(query))
          .slice(0, 30);
        if (local.length >= 10) return local;
        // Few hits in Yami's own index: ask Windows Search too.
        const known = new Set(local.map((f) => f.path.toLowerCase()));
        const more = (await windowsSearch(query)).filter(
          (f) => !known.has(f.path.toLowerCase()),
        );
        for (const f of more) searchHits.add(f.path);
        return [...local, ...more].slice(0, 30);
      }
      case "files.open": {
        const file =
          ctx.launcherFiles.find((f) => f.path === a.path) ||
          (searchHits.has(String(a.path)) && fs.existsSync(String(a.path))
            ? { path: String(a.path) }
            : undefined);
        if (!file) throw new Error("File not found in your launcher index.");
        const error = await shell.openPath(file.path);
        if (error) throw new Error(error);
        return true;
      }
      case "apps.icon": {
        const match = ctx.apps.find((x) => x.path === a.path);
        if (!match || match.path.startsWith("shell:")) return "";
        return (
          await app.getFileIcon(match.path, { size: "small" })
        ).toDataURL();
      }
      case "apps.launch":
        return launchApp(a.path);
      case "apps.favorite": {
        store.state.favorites = store.state.favorites.includes(a.path)
          ? store.state.favorites.filter((p) => p !== a.path)
          : [...store.state.favorites, a.path];
        changed();
        return true;
      }
      case "todo.add":
        return action("add_todo", a);
      case "todo.toggle": {
        const t = store.state.todos.find((t) => t.id === a.id);
        if (t) t.done = !t.done;
        changed();
        return true;
      }
      case "todo.delete":
        store.state.todos = store.state.todos.filter((t) => t.id !== a.id);
        changed();
        return true;
      case "task.save": {
        if (a.id)
          store.state.tasks = store.state.tasks.filter((t) => t.id !== a.id);
        return action("schedule_task", {
          ...a,
          args_json: JSON.stringify(a.args || {}),
        });
      }
      case "task.toggle": {
        const t = store.state.tasks.find((t) => t.id === a.id);
        if (t) {
          t.enabled = !t.enabled;
          if (t.enabled && new Date(t.at).getTime() < Date.now())
            t.at = new Date(Date.now() + 60000).toISOString();
        }
        changed();
        return true;
      }
      case "task.delete":
        store.state.tasks = store.state.tasks.filter((t) => t.id !== a.id);
        changed();
        return true;
      case "memory.save": {
        const m = store.state.memories.find((m) => m.id === a.id);
        if (m) m.text = String(a.text);
        else return action("remember", a);
        changed();
        return true;
      }
      case "memory.delete":
        store.state.memories = store.state.memories.filter(
          (m) => m.id !== a.id,
        );
        changed();
        return true;
      case "memory.clear":
        store.state.memories = [];
        changed();
        return true;
      case "clipboard.pin": {
        const c = store.state.clipboard.find((c) => c.id === a.id);
        if (c) c.pinned = !c.pinned;
        changed();
        return true;
      }
      case "clipboard.copy": {
        const c = store.state.clipboard.find((c) => c.id === a.id);
        if (!c) throw new Error("Clipboard item not found.");
        ctx.clipboardPause = Date.now() + 2000;
        return native.call("clipboardWrite", { text: c.text });
      }
      case "clipboard.delete":
        store.state.clipboard = store.state.clipboard.filter(
          (c) => c.id !== a.id,
        );
        changed();
        return true;
      case "clipboard.clear":
        store.state.clipboard = [];
        changed();
        return true;
      case "snippets.save":
        store.state.snippets.push({
          id: randomUUID(),
          name: String(a.name),
          text: String(a.text),
        });
        changed();
        return true;
      case "snippets.delete":
        store.state.snippets = store.state.snippets.filter(
          (s) => s.id !== a.id,
        );
        changed();
        return true;
      case "snippets.copy": {
        const s = store.state.snippets.find((s) => s.id === a.id);
        if (s) return native.call("clipboardWrite", { text: s.text });
        throw new Error("Snippet not found.");
      }
      case "wallpapers.folder": {
        const options: Electron.OpenDialogOptions = {
          properties: ["openDirectory"],
        };
        const parent = mainWindow();
        const r = await (parent
          ? dialog.showOpenDialog(parent, options)
          : dialog.showOpenDialog(options));
        if (r.canceled) return null;
        const dir = r.filePaths[0];
        store.state.wallpaperFolder = dir;
        const files = (await fs.promises.readdir(dir))
          .filter((f) => /\.(jpg|jpeg|png|bmp|webp)$/i.test(f))
          .map((f) => path.join(dir, f));
        store.state.wallpapers = [
          ...new Set([...store.state.wallpapers, ...files]),
        ];
        changed();
        return files;
      }
      case "wallpapers.apply": {
        if (!store.state.wallpapers.includes(a.path))
          throw new Error("Choose a wallpaper from your library.");
        const before = store.state.settings.reducedMotion
          ? null
          : (await displayCapture()).image;
        await native.call("wallpaperSet", { path: a.path });
        store.state.currentWallpaper = a.path;
        changed();
        if (before) {
          await new Promise((r) => setTimeout(r, 150));
          const after = (await displayCapture()).image;
          await effect("wallpaper", before, after);
        }
        return true;
      }
      case "asset.url":
        return "yami-asset://file/" + encodeURIComponent(a.path);
      case "metrics":
        return metrics();
      case "controls":
        return controls();
      case "currency.convert":
        return rates.convert(a);
      case "color.pick":
        return tools.pick();
      case "color.capture":
        return tools.capture();
      case "color.done":
        return tools.done(a.hex);
      case "color.cancel":
        return tools.cancel();
      case "color.history":
        return tools.history();
      case "color.clear":
        return tools.clear();
      case "window.pin":
        return tools.pin();
      case "window.pinned":
        return tools.pinned();
      case "awake":
        return awake.status();
      case "awake.set":
        return awake.set(a);
      case "awake.stop":
        return awake.stop();
      case "audio.outputs":
        return native.call("audioOutputs");
      case "audio.output": {
        const id = String(a.id || "");
        // Core Audio endpoint ids look like {0.0.0.00000000}.{guid}.
        if (!/^\{[0-9.]+\}\.\{[0-9a-f-]{36}\}$/i.test(id))
          throw new Error("Choose an output device.");
        return native.call("audioOutputSet", { id });
      }
      case "audio.apps":
        return native.call("audioSessions");
      case "audio.app": {
        const pid = Number(a.pid);
        if (!Number.isInteger(pid) || pid <= 0)
          throw new Error("Choose an app.");
        const args: Record<string, unknown> = { pid };
        if (a.volume !== undefined)
          args.volume = Math.max(
            0,
            Math.min(100, Math.round(Number(a.volume) || 0)),
          );
        if (typeof a.muted === "boolean") args.muted = a.muted;
        return native.call("audioSessionSet", args);
      }
      case "control": {
        if (
          ![
            "volume",
            "brightness",
            "mute",
            "theme",
            "settings",
            "toggleSetting",
            "mediaKey",
          ].includes(a.method)
        )
          throw new Error("Unknown Windows control.");
        if (a.method === "brightness") return setBrightness(a.args);
        return native.call(a.method, a.args);
      }
      case "media":
        return nativeScript("Media");
      case "lyrics":
        if (!store.state.settings.lyricsEnabled)
          throw new Error(
            "Lyrics are off. Turn them on in Settings › Privacy.",
          );
        return findLyrics(
          String(a.artist || ""),
          String(a.title || ""),
          Number(a.duration) || 0,
        );
      case "media.action":
        return mediaAction(String(a.action), Number(a.seconds) || 0);
      case "effect.data":
        return ctx.effectData;
      case "power":
        if (!["lock", "sleep", "restart", "shutdown"].includes(a.action))
          throw new Error("Unknown power action.");
        if (
          !(await confirm(
            a.action === "lock"
              ? "Lock this PC?"
              : a.action === "sleep"
                ? "Put this PC to sleep?"
                : `${a.action === "restart" ? "Restart" : "Shut down"} this PC?`,
            "Save your work before continuing.",
          ))
        )
          return false;
        return native.call("power", a);
      case "weather":
        return weather();
      case "cities": {
        const f = path.join(assetRoot(), "cities.json");
        return fs.existsSync(f)
          ? JSON.parse(fs.readFileSync(f, "utf8"))
              .filter((c: any) =>
                c.name
                  .toLowerCase()
                  .includes(String(a.query || "").toLowerCase()),
              )
              .slice(0, 15)
          : [];
      }
      case "lasso.start":
        return beginLasso();
      case "lasso.capture":
        return ctx.capture;
      case "lasso.cancel":
        ctx.lasso?.close();
        ctx.capture = undefined;
        return true;
      case "lasso.done": {
        const image = { data: a.data, mimeType: "image/png" };
        ctx.pendingSelection = image;
        ctx.lasso?.close();
        ctx.capture = undefined;
        if (!store.key("gemini")) showMain("home");
        broadcast({ type: "selection", image });
        if (store.key("gemini"))
          broadcast({ type: "record", kind: "voice", oneShot: true });
        return true;
      }
      case "selection.clear":
        ctx.pendingSelection = undefined;
        return true;
      case "loadout.equip": {
        const catalogue: Record<
          string,
          { price: number; slot: "soul" | "voice" | "personality" | "ability" }
        > = {
          yami: { price: 0, slot: "soul" },
          ember: { price: 160, slot: "soul" },
          wisp: { price: 160, slot: "soul" },
          amethyst: { price: 400, slot: "soul" },
          gilded: { price: 400, slot: "soul" },
          void: { price: 1000, slot: "soul" },
          chad: { price: 0, slot: "personality" },
          custom: { price: 100, slot: "personality" },
          collapse: { price: 0, slot: "ability" },
          sidearm: { price: 400, slot: "ability" },
        };
        for (const name of [
          "Charon",
          "Puck",
          "Leda",
          "Aoede",
          "Enceladus",
          "Algenib",
          "Laomedeia",
          "Jack",
          "Ankit",
          "Cheng",
          "Linda",
        ])
          catalogue[name] = {
            price: name === "Charon" ? 0 : 240,
            slot: "voice",
          };
        const item = catalogue[a.id];
        if (!item) throw new Error("Unknown loadout item.");
        if (a.id === "collapse" && !store.state.owned.includes("void"))
          throw new Error("Collapse comes with the Void soul.");
        if (!store.state.owned.includes(a.id)) {
          if (store.state.embers < item.price)
            throw new Error(
              `You need ${item.price - store.state.embers} more embers.`,
            );
          store.state.embers -= item.price;
          store.state.owned.push(a.id);
          if (a.id === "void") store.state.owned.push("collapse");
        }
        store.state.settings[item.slot] = a.id;
        changed();
        return true;
      }
      case "ability.arm":
        return native.call("configure", {
          hotkeys: store.state.settings.hotkeys,
          abilityArmed: !!a.armed,
          abilityButton: store.state.settings.abilityButton,
        });
      case "open.external":
        return shell.openExternal(safeWebUrl(a.url));
      case "data.export": {
        const options: Electron.SaveDialogOptions = {
          defaultPath: "yami-data.json",
          filters: [{ name: "JSON", extensions: ["json"] }],
        };
        const parent = mainWindow();
        const r = await (parent
          ? dialog.showSaveDialog(parent, options)
          : dialog.showSaveDialog(options));
        if (r.canceled || !r.filePath) return false;
        const data = {
          ...store.publicState(),
          clipboard: undefined,
          keys: undefined,
          workbench: ctx.workbench?.exportData(),
        };
        fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2));
        return true;
      }
      case "data.clear":
        if (
          !(await confirm(
            "Delete all my data?",
            "This erases conversations, memories, tasks, notes, dictation rules, activity history, connections, clipboard history, settings and API keys from Yami.",
          ))
        )
          return false;
        assistant.stopLive();
        ctx.workbench?.clearData();
        for (const f of [store.file, store.secretsFile])
          if (fs.existsSync(f)) fs.unlinkSync(f);
        app.relaunch();
        ctx.quitting = true;
        app.quit();
        return true;
      case "history.clear":
        store.state.messages = [];
        changed();
        return true;
      case "diagnostics":
        return {
          app: app.getVersion(),
          electron: process.versions.electron,
          windows: os.release(),
          encryption: safeStorage.isEncryptionAvailable(),
          native: await native.call("ping"),
          live: assistant.liveDiagnostics,
        };
      default:
        if (method.startsWith("wheel.")) {
          if (!ctx.wheel) throw new Error("The file wheel is not available.");
          return ctx.wheel(method, a, sender);
        }
        throw new Error("Unknown application request: " + method);
    }
  };
}
