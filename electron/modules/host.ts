import fs from "node:fs";
import path from "node:path";
import { dialog, screen, type BrowserWindow, type WebContents } from "electron";
import type { Store } from "../store";
import type { Native } from "../native";
import type { Assistant } from "../assistant";
import { Workbench } from "../workbench";
import { WorkbenchStorage } from "../workbench/storage";
import { SpeechController } from "../workbench/speech";
import { createWheel, engineRoot } from "../wheel/service";
import { EngineStore } from "../wheel/engines.ts";
import { modules } from "../../src/modules.ts";
import { ModuleRegistry, validPacks, workbenchDuties } from "./registry";
import { PackManager } from "./packs";

type Wheel = ReturnType<typeof createWheel>;
type Deps = {
  store: Store;
  native: Native;
  assistant: Assistant;
  broadcast: (event: any) => void;
  changed: () => void;
  notify: (message: string) => void;
  showMain: (tab?: string) => void;
  setPanel: (open: boolean, tab?: string) => void;
  confirm: (title: string, detail: string) => Promise<boolean>;
  makeWindow: (
    mode: string,
    options: Electron.BrowserWindowConstructorOptions,
  ) => BrowserWindow;
};

/**
 * Owns the optional modules: builds the AI workspace and the file wheel on
 * first use, tears them down when switched off, and answers `modules.*`.
 */
export function createModuleHost(deps: Deps) {
  const { store, native } = deps;
  // Dictation rules live with the workspace data, but dictation is core, so
  // the storage and speech engine exist apart from the workbench module.
  let shared: { data: WorkbenchStorage; speech: SpeechController } | undefined;
  const speechCore = () =>
    (shared ??= (() => {
      const data = new WorkbenchStorage(store);
      const speech = new SpeechController(data, deps.assistant, native, () =>
        registry.peek<Workbench>("workbench")?.changed(),
      );
      return { data, speech };
    })());
  deps.assistant.dictationTransform = (text, target) =>
    speechCore().speech.transform(text, target);
  const engines = new EngineStore(engineRoot());
  const packs = new PackManager(engines, () =>
    deps.broadcast({ type: "modules", modules: registry.list() }),
  );

  const registry = new ModuleRegistry({
    settings: () => store.state.settings as unknown as Record<string, unknown>,
    save: () => {
      deps.changed();
      return native.call("configure", {
        ...store.state.settings,
        abilityArmed: false,
      });
    },
    broadcast: deps.broadcast,
    packs: () => packs.list(),
    loaders: {
      workbench: {
        load: () => new Workbench({ ...deps, ...speechCore() }),
        dispose: (w: Workbench) => w.dispose(),
        busy: (w: Workbench) =>
          w.meetings.active
            ? "Finish or discard the recording before turning off the AI workspace."
            : undefined,
      },
      fileWheel: {
        load: () =>
          createWheel({
            makeWindow: deps.makeWindow,
            broadcast: deps.broadcast,
            notify: deps.notify,
            native,
            getSettings: () => store.state.settings,
            getWallpapers: () => store.state.wallpapers,
            engines,
          }),
        dispose: (w: Wheel) => w.dispose(),
      },
    },
  });
  const workbench = () => registry.get<Workbench>("workbench");
  const wheel = () => registry.get<Wheel>("fileWheel");
  // Background duties need the workspace running before any page opens.
  const wake = () => {
    if (!registry.enabled("workbench") || registry.loaded("workbench")) return;
    const { settings, connections } = speechCore().data.state;
    if (workbenchDuties(settings, connections, store.state.settings.hotkeys))
      workbench();
  };
  const offFileWheel = () =>
    deps.notify(
      "The file wheel is turned off. Turn it on in Settings › Modules.",
    );

  const host = {
    registry,
    start() {
      wake();
      if (process.argv.includes("--file-wheel")) host.acceptArgv(process.argv);
    },
    handles(method: string) {
      return (
        Workbench.handles(method) || /^(modules|setup|packs)\./.test(method)
      );
    },
    async invoke(method: string, a: any = {}, sender?: WebContents) {
      if (method === "modules.list") return registry.list();
      if (method === "modules.set") {
        const list = await registry.set(a.id, a.enabled);
        wake();
        return list;
      }
      if (method === "setup.complete") {
        const wanted = validPacks(a.packs);
        await registry.apply(a.enabled, () => {
          store.state.settings.setupDone = true;
        });
        wake();
        // Only packs of modules that ended up on are downloaded.
        packs.install(
          wanted.filter((p) =>
            modules.some((m) => registry.enabled(m.id) && m.packs.includes(p)),
          ),
        );
        return registry.list();
      }
      if (method.startsWith("packs.")) {
        const [id] = validPacks([a.id]);
        if (method === "packs.install") packs.install([id]);
        else if (method === "packs.cancel") packs.cancel(id);
        else if (method === "packs.remove") await packs.remove(id);
        else if (method === "packs.installFile") {
          const choice = await dialog.showOpenDialog({
            title: "Choose the downloaded file",
            properties: ["openFile"],
            filters: [{ name: "Download", extensions: ["zip", "7z", "exe"] }],
          });
          if (!choice.filePaths[0]) return registry.list();
          await packs.installFile(id, choice.filePaths[0]);
        } else throw new Error("Unknown download request.");
        return registry.list();
      }
      if (method.startsWith("setup."))
        throw new Error("Unknown setup request.");
      if (method.startsWith("modules."))
        throw new Error("Unknown module request.");
      return workbench().invoke(method, a, sender);
    },
    /** Runs after the general settings request saved new values. */
    afterSettings() {
      registry.sync();
      wake();
      registry.peek<Workbench>("workbench")?.captureShortcuts(false);
    },
    captureShortcuts(active: boolean) {
      registry.peek<Workbench>("workbench")?.captureShortcuts(active);
    },
    prepareChat(a: any) {
      return Array.isArray(a?.attachments) && a.attachments.length
        ? workbench().prepareChat(a)
        : a;
    },
    async offlineDictation(a: any) {
      const { speech } = speechCore();
      const text = await speech.transform(
        await speech.transcribe(String(a.data), String(a.mimeType), "windows"),
        Number(a.target) || 0,
      );
      await native.call("insertText", { text, target: a.target || 0 });
      store.usage("dictations");
      store.usage("words", text.split(/\s+/).length);
      store.message("user", text);
      deps.broadcast({ type: "dictation-result", text });
      deps.broadcast({ type: "state", state: store.publicState() });
      return text;
    },
    wheel: (method: string, a: any, sender?: WebContents) =>
      wheel().handle(method, a, sender),
    onNative(e: { eventName?: string }) {
      if (e.eventName !== "file-wheel") return false;
      if (registry.enabled("fileWheel")) wheel().onNative(e);
      return true;
    },
    acceptArgv(argv: string[]) {
      if (!argv.includes("--file-wheel")) return false;
      if (!registry.enabled("fileWheel")) {
        offFileWheel();
        return false;
      }
      return wheel().acceptArgv(argv);
    },
    trayItems(): Electron.MenuItemConstructorOptions[] {
      if (!registry.enabled("fileWheel")) return [];
      return [
        {
          label: "File wheel",
          click: () => {
            const point = screen.getCursorScreenPoint();
            void wheel().openAt(point.x, point.y);
          },
        },
        { label: "Drop shelf", click: () => wheel().openShelf() },
      ];
    },
    /** Export and erase reach workspace data even while it sleeps. */
    data: {
      exportData() {
        const live = registry.peek<Workbench>("workbench");
        if (live) return live.exportData();
        const { settings, notes, rules, history, connections, usage } = (
          shared?.data || new WorkbenchStorage(store)
        ).state;
        return { settings, notes, rules, history, connections, usage };
      },
      clearData() {
        const live = registry.peek<Workbench>("workbench");
        if (live) return live.clearData();
        if (shared) shared.data.deleted = true;
        const dir = path.dirname(store.file);
        for (const file of ["workbench.json", "agent-relay.json"])
          fs.rmSync(path.join(dir, file), { force: true });
      },
    },
    /** True while a module needs the main window kept, such as a recording. */
    busy() {
      return !!registry.peek<Workbench>("workbench")?.meetings.active;
    },
    confirmQuit() {
      return registry.peek<Workbench>("workbench")?.confirmQuit() ?? true;
    },
    dispose() {
      packs.dispose();
      registry.dispose();
      shared?.data.dispose();
    },
  };
  return host;
}
