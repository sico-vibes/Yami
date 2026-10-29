import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  dialog,
  Tray,
  Menu,
  nativeImage,
  protocol,
  net,
  safeStorage,
  session as electronSession,
} from "electron";
import { dockForeground } from "./dock";
import { peekSelection } from "./peek";
import { onAccent } from "./accent-overlay";
import { handleRadio, radioScheme } from "./radio";
import { noteForeground } from "./screen-tools";
import { spawn } from "node:child_process";
import { runPowerShell, nativeScript } from "./platform";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequestHandler } from "./requests";
import { createMetrics } from "./metrics";
import { readWeather } from "./weather";
import { Store } from "./store";
import { Native } from "./native";
import { Assistant } from "./assistant";
import { assetRoot, makeWindow, windows } from "./windows";
import { createOverlays } from "./overlays";
import { createFocusTimer } from "./focus-timer";
import { createModuleHost } from "./modules/host";
import { createMainWindow } from "./main-window";
import { windowsBrightness, windowsControls } from "./controls";
import {
  assertFile,
  checkToolPermission,
  nextOccurrence,
  safeWebUrl,
  sensitiveTools,
  requiredTarget,
  validateScheduled,
} from "./policy";
import type { AppItem, State, Task } from "../src/shared";
import { islandSize, peekSize } from "../src/island-bounds";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "yami-asset",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
  radioScheme,
]);
if (process.env.YAMI_DATA_DIR)
  app.setPath("userData", process.env.YAMI_DATA_DIR);
let store: Store, native: Native, assistant: Assistant;
let overlays: ReturnType<typeof createOverlays> | undefined;
let modules: ReturnType<typeof createModuleHost> | undefined;
let trayMenu: Electron.Menu | undefined,
  trayWheel = false;
const focusTimer = createFocusTimer({
  notify: (message) => notify(message),
  broadcast: (event) => broadcast(event),
});
let island: BrowserWindow, lasso: BrowserWindow | undefined, tray: Tray;
let launcherFiles: { name: string; path: string }[] = [];
let quitting = false,
  panelOpen = false,
  currentUtility = "Controls",
  apps: AppItem[] = [],
  lastClipboard = "",
  clipboardPause = 0,
  busy = false;
let capture: any,
  pendingSelection: any,
  effectData: any,
  taskTimer: NodeJS.Timeout,
  clipboardTimer: NodeJS.Timeout;
const approvals = new Map<
  string,
  { resolve: (v: boolean) => void; timer: NodeJS.Timeout }
>();
const mainWindow = createMainWindow({
  create: () =>
    makeWindow("main", {
      width: 1160,
      height: 790,
      minWidth: 850,
      minHeight: 610,
      transparent: false,
      alwaysOnTop: store.state.settings.alwaysOnTop,
    }),
  quitting: () => quitting,
  busy: () => approvals.size > 0 || !!modules?.busy(),
});
function broadcast(event: any) {
  for (const w of windows)
    if (mainWindow.owns(w)) mainWindow.send(event);
    else if (!w.isDestroyed()) w.webContents.send("yami:event", event);
  overlays?.observe(event);
}
function changed() {
  store.save();
  broadcast({ type: "state", state: store.publicState() });
  const next = store.state.tasks
    .filter((t) => t.enabled)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
  void native.call("wake", next ? { at: next.at } : {}).catch(() => {});
  // Keep the tray checkbox in step with the Settings toggle.
  const roam = trayMenu?.getMenuItemById("roam");
  if (trayMenu && trayWheel !== store.state.settings.fileWheelEnabled)
    buildTray();
  else if (roam && roam.checked !== store.state.settings.roam) {
    roam.checked = store.state.settings.roam;
    tray.setContextMenu(trayMenu!);
  }
}
function buildTray() {
  trayWheel = store.state.settings.fileWheelEnabled;
  trayMenu = Menu.buildFromTemplate([
    { label: "Open Yami", click: () => showMain() },
    { label: "Settings", click: () => showMain("settings") },
    { label: "Choose features…", click: () => showMain("setup") },
    {
      id: "roam",
      label: "Let Yami roam",
      type: "checkbox",
      checked: store.state.settings.roam,
      click: (item) => {
        store.state.settings.roam = item.checked;
        changed();
      },
    },
    ...(modules?.trayItems() || []),
    { type: "separator" },
    {
      label: "Quit Yami",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(trayMenu);
}
function notify(message: string) {
  broadcast({ type: "toast", message });
}
function showMain(tab?: string) {
  mainWindow.show(tab);
}
function islandBounds(width: number, height: number) {
  const d = screen.getPrimaryDisplay();
  return {
    x: Math.round(d.bounds.x + (d.bounds.width - width) / 2),
    y: d.bounds.y,
    width,
    height,
  };
}
function setPanel(open: boolean, tab = currentUtility) {
  panelOpen = open;
  // Start the slow hardware queries so Stats has data the moment it opens.
  if (open) metrics.warm();
  currentUtility = tab;
  const display = screen.getPrimaryDisplay().workAreaSize;
  const size = islandSize(open, tab);
  island.setBounds(
    islandBounds(
      open ? Math.min(size.width, display.width - 30) : size.width,
      open ? Math.min(size.height, display.height - 20) : size.height,
    ),
  );
  island.setFocusable(open);
  island.setIgnoreMouseEvents(!open, { forward: true });
  if (open) island.focus();
  island.webContents.send("yami:event", { type: "panel", open, tab });
}
// Grow the collapsed island to fit the media card without opening the drawer.
function peekIsland(open: boolean) {
  if (panelOpen) return;
  const size = open ? peekSize : islandSize(false, currentUtility);
  island.setBounds(islandBounds(size.width, size.height));
  island.setIgnoreMouseEvents(!open, { forward: true });
}
async function confirm(title: string, detail: string) {
  showMain();
  return new Promise<boolean>((resolve) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      approvals.delete(id);
      resolve(false);
      broadcast({ type: "confirm-expired", id });
    }, 120000);
    approvals.set(id, { resolve, timer });
    broadcast({ type: "confirm", id, title, detail });
  });
}
async function discoverApps() {
  const all: AppItem[] = [];
  async function walk(folder: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const f of entries) {
      const full = path.join(folder, f.name);
      if (f.isDirectory()) await walk(full);
      else if (/\.(lnk|url)$/i.test(f.name))
        all.push({
          name: f.name.replace(/\.(lnk|url)$/i, ""),
          path: full,
          kind: "Application",
        });
    }
  }
  await Promise.all([
    walk(
      path.join(
        process.env.APPDATA || "",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
      ),
    ),
    walk(
      path.join(
        process.env.ProgramData || "C:\ProgramData",
        "Microsoft",
        "Windows",
        "Start Menu",
        "Programs",
      ),
    ),
  ]);
  try {
    const r = await runPowerShell(
      "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
    );
    for (const a of JSON.parse(r.stdout || "[]"))
      if (!all.some((x) => x.name.toLowerCase() === a.Name.toLowerCase()))
        all.push({
          name: a.Name,
          path: "shell:AppsFolder\\" + a.AppID,
          kind: "Application",
        });
  } catch {}
  apps = all
    .filter((a, i) => all.findIndex((b) => b.path === a.path) === i)
    .sort((a, b) => a.name.localeCompare(b.name));
  return apps;
}
async function indexFiles() {
  const found: { name: string; path: string }[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > 5 || found.length > 20000) return;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const f of entries) {
      if (f.name.startsWith(".") || f.isSymbolicLink()) continue;
      const full = path.join(dir, f.name);
      if (f.isDirectory()) await walk(full, depth + 1);
      else found.push({ name: f.name, path: full });
      if (found.length > 20000) break;
    }
  }
  await Promise.all(
    ["desktop", "documents", "downloads"].map((folder) =>
      walk(app.getPath(folder as "desktop"), 0),
    ),
  );
  launcherFiles = found;
}
async function launchApp(name: string) {
  name = requiredTarget(name);
  if (!apps.length) await discoverApps();
  const query = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  let match =
    apps.find((a) => a.path === name) ||
    apps.find(
      (a) => a.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === query,
    ) ||
    apps.find((a) => a.name.toLowerCase().includes(name.toLowerCase()));
  if (!match && /^(gmail|youtube|amazon)$/i.test(name)) {
    await shell.openExternal(
      {
        gmail: "https://mail.google.com",
        youtube: "https://youtube.com",
        amazon: "https://amazon.in",
      }[name.toLowerCase()]!,
    );
    return { opened: name };
  }
  if (!match) throw new Error(`No installed application matches “${name}”.`);
  if (match.path.startsWith("shell:"))
    spawn("explorer.exe", [match.path], {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }).unref();
  else {
    const error = await shell.openPath(match.path);
    if (error) throw new Error(error);
  }
  store.state.recentApps = [
    match.path,
    ...store.state.recentApps.filter((p) => p !== match!.path),
  ].slice(0, 30);
  changed();
  return { opened: match.name };
}
async function action(
  name: string,
  args: any = {},
  unattended = false,
): Promise<any> {
  checkToolPermission(name, store.state.settings);
  if (["focus_app", "close_app", "move_window", "click_control"].includes(name))
    args = { ...args, name: requiredTarget(args.name) };
  const returnFocus = [
    "click_control",
    "click_desktop",
    "insert_text",
  ].includes(name)
    ? await native.call("context")
    : null;
  if (sensitiveTools.has(name) && name !== "dictation_insert") {
    if (unattended) throw new Error("This action needs you at the keyboard.");
    if (
      !(await confirm(name.replaceAll("_", " "), JSON.stringify(args, null, 2)))
    )
      throw new Error("Action cancelled.");
    if (returnFocus?.handle) {
      const restored = await native.call("focusHandle", {
        handle: returnFocus.handle,
      });
      if (!restored)
        throw new Error(
          "The original application could not be focused. No input was sent.",
        );
      if (name === "insert_text")
        args = { ...args, target: returnFocus.handle };
    }
  }
  switch (name) {
    case "open_app":
      return launchApp(String(args.name));
    case "open_url":
      await shell.openExternal(safeWebUrl(String(args.url)));
      return { opened: args.url };
    case "search_site": {
      const query = encodeURIComponent(String(args.query));
      const sites: Record<string, string> = {
        youtube: "https://www.youtube.com/results?search_query=",
        google: "https://www.google.com/search?q=",
        amazon: "https://www.amazon.in/s?k=",
        bing: "https://www.bing.com/search?q=",
        duckduckgo: "https://duckduckgo.com/?q=",
      };
      const base = sites[String(args.site).toLowerCase()];
      if (!base)
        throw new Error(
          "Supported sites: YouTube, Google, Amazon, Bing, DuckDuckGo.",
        );
      await shell.openExternal(base + query);
      return {
        opened: "Search results",
        site: args.site,
        query: args.query,
        playing: false,
      };
    }
    case "search_web":
      return assistant.research(String(args.query), !!args.deep);
    case "list_windows":
      return native.call("windows");
    case "focus_app":
      return native.call("focus", args);
    case "close_app":
      return native.call("close", args);
    case "move_window":
      return native.call("move", args);
    case "read_screen":
      return native.call("uiaRead");
    case "click_control":
      return native.call("uiaClick", args);
    case "click_desktop":
      return native.call("click", args);
    case "dictation_insert":
    case "insert_text":
      clipboardPause = Date.now() + 2000;
      return native.call("insertText", args);
    case "set_volume":
      return native.call("volume", args);
    case "set_brightness":
      return setBrightness(args);
    case "set_theme":
      return native.call("theme", args);
    case "media_control":
      return native.call("mediaKey", args);
    case "add_todo":
      store.state.todos.push({
        id: randomUUID(),
        title: String(args.title),
        done: false,
      });
      changed();
      return { added: args.title };
    case "complete_todo": {
      const t = store.state.todos.find((t) =>
        t.title.toLowerCase().includes(String(args.title).toLowerCase()),
      );
      if (!t) throw new Error("To-do not found.");
      t.done = true;
      changed();
      return { completed: t.title };
    }
    case "schedule_task": {
      const parsed =
        typeof args.args_json === "string"
          ? JSON.parse(args.args_json)
          : args.args || {};
      validateScheduled(args.tool, parsed);
      const time = new Date(args.at);
      if (
        !Number.isFinite(time.getTime()) ||
        time.getTime() < Date.now() - 60000
      )
        throw new Error("Choose a future time with a timezone.");
      const task: Task = {
        id: randomUUID(),
        title: String(args.title),
        at: time.toISOString(),
        repeat: ["daily", "weekly"].includes(args.repeat)
          ? args.repeat
          : "none",
        tool: args.tool,
        args: parsed,
        enabled: true,
        status: "scheduled",
      };
      store.state.tasks.push(task);
      changed();
      return { scheduled: task };
    }
    case "remember":
      if (!store.state.settings.memoryEnabled)
        throw new Error("Memory is disabled.");
      store.state.memories.push({
        id: randomUUID(),
        text: String(args.text),
        at: new Date().toISOString(),
      });
      changed();
      return { remembered: args.text };
    case "list_files":
      return fs
        .readdirSync(assertFile(String(args.path)), { withFileTypes: true })
        .slice(0, 150)
        .map((f) => ({ name: f.name, folder: f.isDirectory() }));
    case "read_file": {
      const p = assertFile(String(args.path));
      if (fs.statSync(p).size > 1024 * 1024)
        throw new Error("This file is too large to read.");
      return { path: p, text: fs.readFileSync(p, "utf8") };
    }
    case "write_file":
      fs.writeFileSync(
        assertFile(String(args.path)),
        String(args.text),
        "utf8",
      );
      return { written: args.path };
    case "move_file":
      fs.renameSync(
        assertFile(String(args.path)),
        assertFile(String(args.destination)),
      );
      return { moved: args.destination };
    case "delete_file":
      await shell.trashItem(assertFile(String(args.path)));
      return { recycled: args.path };
    case "run_terminal": {
      const r = await runPowerShell(String(args.command), [], 30000);
      return { stdout: r.stdout.slice(-15000), stderr: r.stderr.slice(-5000) };
    }
    case "remind":
      notify(String(args.text || args.title || "Reminder"));
      showMain("desk");
      return { reminded: true };
    case "routine": {
      const results = [];
      for (const step of args.steps)
        results.push(await action(step.tool, step.args, true));
      return { results };
    }
    default:
      throw new Error("Unknown action: " + name);
  }
}
async function tickTasks() {
  for (const t of store.state.tasks) {
    if (
      !t.enabled ||
      t.status === "running" ||
      new Date(t.at).getTime() > Date.now()
    )
      continue;
    t.status = "running";
    changed();
    try {
      const result = await action(t.tool, t.args, true);
      t.status = "done";
      t.lastResult = JSON.stringify(result);
      notify(`Completed: ${t.title}`);
    } catch (e) {
      t.status = "failed";
      t.lastResult = (e as Error).message;
      notify(`${t.title}: ${t.lastResult}`);
    }
    t.lastRun = new Date().toISOString();
    const next = nextOccurrence(t);
    if (next) t.at = next;
    else t.enabled = false;
    changed();
  }
}
async function pollClipboard() {
  if (!store.state.settings.clipboardEnabled || Date.now() < clipboardPause)
    return;
  try {
    const context = await native.call("context");
    if (
      context.password ||
      context.privateWindow ||
      (await native.call("clipboardPrivate")) ||
      /bitwarden|1password|keepass|lastpass|bank/i.test(context.process)
    )
      return;
    const value: string = await native.call("clipboardRead");
    if (
      !value ||
      value === lastClipboard ||
      value.length > 100000 ||
      /(AIza[\w-]{30,}|tvly-[\w-]{12,}|BEGIN .*PRIVATE KEY)/.test(value)
    )
      return;
    lastClipboard = value;
    const cutoff = Date.now() - store.state.settings.clipboardDays * 86400000;
    store.state.clipboard = store.state.clipboard.filter(
      (i) => i.pinned || new Date(i.at).getTime() > cutoff,
    );
    store.state.clipboard.unshift({
      id: randomUUID(),
      text: value,
      at: new Date().toISOString(),
      pinned: false,
    });
    store.state.clipboard = store.state.clipboard.slice(0, 500);
    changed();
  } catch {}
}
async function displayCapture() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  return {
    bounds: display.bounds,
    image: await native.call(
      "capture",
      screen.dipToScreenRect(null, display.bounds),
    ),
  };
}
async function beginLasso() {
  if (lasso && !lasso.isDestroyed()) return;
  const target = await displayCapture();
  capture = target.image;
  lasso = makeWindow("lasso", {
    ...target.bounds,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
  });
  lasso.setAlwaysOnTop(true, "screen-saver");
  lasso.once("ready-to-show", () => {
    lasso?.show();
    lasso?.focus();
  });
  lasso.on("closed", () => {
    lasso = undefined;
  });
}
async function effect(kind: string, before?: any, after?: any) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const cursor = screen.getCursorScreenPoint();
  effectData = {
    kind,
    before,
    after,
    x: cursor.x - display.bounds.x,
    y: cursor.y - display.bounds.y,
  };
  const w = makeWindow("effect", {
    ...display.bounds,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
  });
  w.setIgnoreMouseEvents(true);
  w.once("ready-to-show", () => {
    w.showInactive();
    setTimeout(() => {
      if (!w.isDestroyed()) w.close();
    }, 1500);
  });
}
async function nativeEvent(e: any) {
  if (modules?.onNative(e)) return;
  if (e.eventName === "accent") return onAccent(e, broadcast);
  if (e.eventName === "peek") return void peekSelection(notify).catch(() => {});
  if (e.eventName === "foreground") {
    noteForeground(e);
    dockForeground();
    const aliases: Record<string, string> = {
      chrome: "Google Chrome",
      msedge: "Microsoft Edge",
      code: "Visual Studio Code",
      explorer: "File Explorer",
    };
    const name = aliases[e.process.toLowerCase()] || e.process;
    const match = apps.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (match && store.state.recentApps[0] !== match.path) {
      store.state.recentApps = [
        match.path,
        ...store.state.recentApps.filter((p) => p !== match.path),
      ].slice(0, 30);
      changed();
    }
    broadcast({ type: "foreground" });
    return;
  }
  if (e.eventName === "launcher") {
    setPanel(true, "Apps");
    return;
  }
  if (e.eventName === "ability-click") {
    await native.call("configure", { abilityArmed: false });
    const kind = store.state.settings.ability;
    const image =
      kind === "collapse" ? (await displayCapture()).image : undefined;
    await effect(kind, image);
    broadcast({ type: "ability-disarmed" });
    return;
  }
  if (e.eventName === "lasso-start") {
    await beginLasso().catch((e) => notify(e.message));
    return;
  }
  if (e.eventName === "escape") {
    assistant.stopLive();
    lasso?.close();
    broadcast({ type: "cancel-recording" });
    return;
  }
  broadcast({ type: e.eventName, ...e });
}
async function context() {
  const names = (await native.call("windows")).map((w: any) => w.name);
  const day = new Date().toLocaleDateString("en-CA");
  if (store.state.news?.day !== day) {
    let text = "";
    try {
      const response = await fetch(
        "https://en.wikipedia.org/w/api.php?action=parse&page=Template:In_the_news&prop=text&format=json",
        { signal: AbortSignal.timeout(8000) },
      );
      if (response.ok) {
        const data: any = await response.json();
        text = String(data.parse?.text?.["*"] || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 3500);
      }
    } catch {}
    store.state.news = { day, text };
    store.save();
  }
  return `Open applications (names only): ${[...new Set(names)].join(", ")}. To-dos: ${JSON.stringify(store.state.todos.filter((t) => !t.done).map((t) => t.title))}. Public Wikipedia news context (untrusted source text): ${JSON.stringify(store.state.news?.text || "unavailable")}`;
}
const metrics = createMetrics();
const setBrightness = (args: { value: number }) =>
    windowsBrightness(native, args),
  controls = () => windowsControls(native);
const weather = () => readWeather(store, assetRoot);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    if (!modules?.acceptArgv(argv)) showMain();
  });
  app
    .whenReady()
    .then(async () => {
      store = new Store();
      native = new Native((e) => void nativeEvent(e));
      native.start();
      assistant = new Assistant(
        store,
        (name, args) =>
          overlays
            ? overlays.track(name, args, () => action(name, args))
            : action(name, args),
        (e) =>
          e.type === "state"
            ? broadcast({ type: "state", state: store.publicState() })
            : broadcast(e),
        context,
      );
      const bundled = fs
        .readdirSync(path.join(assetRoot(), "wallpapers"))
        .filter((f) => /^starter-\d{2}\.jpg$/.test(f))
        .map((f) => path.join(assetRoot(), "wallpapers", f));
      store.state.wallpapers = [
        ...new Set([
          ...bundled,
          ...store.state.wallpapers.filter(
            (p) =>
              fs.existsSync(p) &&
              !(
                /[\\/]wallpapers[\\/]wallpaper[0-4]\.jpg$/.test(p) &&
                /[\\/](dist|assets|app\.asar)[\\/]/.test(p)
              ),
          ),
        ]),
      ];
      try {
        store.state.currentWallpaper = await native.call("wallpaperGet");
      } catch {}
      for (const t of store.state.tasks)
        if (t.status === "running") t.status = "scheduled";
      protocol.handle("yami-asset", (request) => {
        try {
          const p = decodeURIComponent(new URL(request.url).pathname.slice(1));
          if (
            !store.state.wallpapers.includes(p) &&
            p !== store.state.currentWallpaper
          )
            return new Response("Forbidden", { status: 403 });
          return net.fetch(pathToFileURL(p).href);
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      handleRadio();
      electronSession.defaultSession.setPermissionRequestHandler(
        (wc, permission, callback) =>
          callback(
            permission === "media" ||
              // Copy and paste buttons in Yami's own windows, which never
              // navigate away from Yami's pages.
              ((permission === "clipboard-sanitized-write" ||
                permission === "clipboard-read") &&
                [...windows].some((w) => w.webContents === wc)),
          ),
      );
      // The main window is created only when shown. First run shows
      // "Choose your Yami" even when starting hidden.
      if (
        !store.state.settings.setupDone ||
        (!store.state.settings.startHidden &&
          !process.argv.includes("--hidden"))
      )
        showMain();
      island = makeWindow("island", {
        ...islandBounds(220, 96),
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: false,
      });
      island.setAlwaysOnTop(true, "floating");
      island.setIgnoreMouseEvents(true, { forward: true });
      island.once("ready-to-show", () => island.showInactive());
      overlays = createOverlays({
        store,
        showMain,
        broadcast,
        fullscreen: () => native.call("fullscreen").catch(() => false),
      });
      overlays.syncStray();
      modules = createModuleHost({
        store,
        native,
        assistant,
        broadcast,
        changed,
        notify,
        showMain,
        setPanel,
        confirm,
        makeWindow,
      });
      const icon = nativeImage
        .createFromPath(path.join(assetRoot(), "yami-icon.png"))
        .resize({ width: 20, height: 20 });
      tray = new Tray(icon);
      tray.setToolTip("Yami");
      buildTray();
      tray.on("double-click", () => showMain());
      const invoke = createRequestHandler({
        workbench: modules.data,
        store,
        native,
        assistant,
        main: mainWindow.current,
        island,
        changed,
        broadcast,
        showMain,
        setPanel,
        peekIsland,
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
        get busy() {
          return busy;
        },
        set busy(value) {
          busy = value;
        },
        get pendingSelection() {
          return pendingSelection;
        },
        set pendingSelection(value) {
          pendingSelection = value;
        },
        get capture() {
          return capture;
        },
        set capture(value) {
          capture = value;
        },
        get lasso() {
          return lasso;
        },
        set lasso(value) {
          lasso = value;
        },
        get effectData() {
          return effectData;
        },
        set effectData(value) {
          effectData = value;
        },
        get clipboardPause() {
          return clipboardPause;
        },
        set clipboardPause(value) {
          clipboardPause = value;
        },
        get quitting() {
          return quitting;
        },
        set quitting(value) {
          quitting = value;
        },
        get apps() {
          return apps;
        },
        set apps(value) {
          apps = value;
        },
        get launcherFiles() {
          return launcherFiles;
        },
        set launcherFiles(value) {
          launcherFiles = value;
        },
        get panelOpen() {
          return panelOpen;
        },
        set panelOpen(value) {
          panelOpen = value;
        },
        wheel: modules.wheel,
      });
      ipcMain.handle("yami:invoke", async (event, method, args) => {
        if (
          ![...windows].some(
            (w) => !w.isDestroyed() && w.webContents.id === event.sender.id,
          )
        )
          throw new Error("Untrusted renderer.");
        if (method === "window.ready") return mainWindow.ready(event.sender);
        const host = modules!;
        if (host.handles(method))
          return host.invoke(method, args, event.sender);
        if (method === "shortcuts.capture")
          host.captureShortcuts(!!args?.active);
        if (method === "chat") args = host.prepareChat(args);
        if (
          method === "dictation" &&
          store.state.settings.dictationEngine !== "gemini"
        )
          return host.offlineDictation(args);
        if (overlays?.handles(method)) return overlays.invoke(method, args);
        if (focusTimer.handles(method)) return focusTimer.invoke(method, args);
        const result = await invoke(method, args, event.sender);
        if (method === "settings") host.afterSettings();
        return result;
      });
      await native.call("configure", {
        ...store.state.settings,
        abilityArmed: false,
      });
      taskTimer = setInterval(() => void tickTasks(), 5000);
      clipboardTimer = setInterval(() => void pollClipboard(), 1800);
      void discoverApps();
      void indexFiles();
      changed();
      modules.start();
      screen.on("display-metrics-changed", () => setPanel(panelOpen));
    })
    .catch((e) => {
      dialog.showErrorBox("Yami could not start", e.message);
      quitting = true;
      app.quit();
    });
}
app.on("before-quit", (event) => {
  if (modules && !modules.confirmQuit()) {
    event.preventDefault();
    quitting = false;
    return;
  }
  quitting = true;
  clearInterval(taskTimer);
  clearInterval(clipboardTimer);
  assistant?.stopLive();
  overlays?.dispose();
  focusTimer.dispose();
  mainWindow.dispose();
  modules?.dispose();
  native?.close();
});
