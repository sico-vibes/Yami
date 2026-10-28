import fs from "node:fs";
import path from "node:path";
import {
  clipboard,
  dialog,
  safeStorage,
  shell,
  screen,
  BrowserWindow,
  type WebContents,
} from "electron";
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
import { TuneController } from "../tune/tune";
import { FeedsController } from "../feeds/feeds";
import { MailAccounts } from "../feeds/mail-accounts";
import { readMachineKey, regExe } from "../tune/registry";
import { StartupController } from "../tune/startup";
import { DnsController } from "../tune/dns";
import { helperPath } from "../workbench/terminal";
import { agentLinkPort, startAgentLink } from "../agentlink/server";
import { agentTools } from "../agentlink/tools";
import { startRemote, type RemoteAbility } from "../remote/server";
import { createBrowser } from "../browser/browser";
import { Vault } from "../browser/vault";
import { authorizeUrl, pkce, Spotify, waitForCode } from "../spotify";
import { maskSecrets } from "../mask";
import { activeAgents } from "../../src/agent-rank";
import { agentClis } from "../../src/dev-types";
import { mediaAction, nativeScript } from "../platform";
import os from "node:os";
import { randomBytes } from "node:crypto";

type Tune = {
  tweaks: TuneController;
  startup: StartupController;
  dns: DnsController;
};
type Feeds = { feeds: FeedsController; mail: MailAccounts };
type AgentLink = ReturnType<typeof startAgentLink> & { error: string };
type Remote = ReturnType<typeof startRemote> & { error: string };
type Browser = { browser: ReturnType<typeof createBrowser>; vault: Vault };
const remoteAbilities: RemoteAbility[] = ["approvals", "media", "clipboard"];
const agentName = (id: string) =>
  agentClis.find((c) => c.id === id)?.name || id;
const agentToolNames = [
  "notify",
  "ask_user",
  "list_projects",
  "open_terminal",
  "browser_open",
  "browser_read",
];
import { execFile, spawn } from "node:child_process";

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

/** Ends Explorer and starts it again if Windows did not. Asked for first. */
function restartExplorer() {
  return new Promise<boolean>((resolve) => {
    execFile(
      "taskkill.exe",
      ["/f", "/im", "explorer.exe"],
      { windowsHide: true, timeout: 8000 },
      () =>
        setTimeout(() => {
          execFile(
            "tasklist.exe",
            ["/fi", "imagename eq explorer.exe", "/nh"],
            { windowsHide: true, timeout: 8000 },
            (_e, stdout) => {
              if (!/explorer\.exe/i.test(String(stdout)))
                spawn("explorer.exe", [], {
                  detached: true,
                  stdio: "ignore",
                }).unref();
              resolve(true);
            },
          );
        }, 2000),
    );
  });
}

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
      const speech = new SpeechController(
        data,
        deps.assistant,
        native,
        () => registry.peek<Workbench>("workbench")?.changed(),
        async () => {
          if (!registry.enabled("whistle"))
            throw new Error(
              "Offline dictation is turned off. Turn it on in Settings › Modules.",
            );
          const [exe, model] = await Promise.all([
            engines.ensure("needle"),
            engines.ensure("whistle"),
          ]);
          return { exe, model };
        },
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
      feeds: {
        load: (): Feeds => ({
          feeds: new FeedsController(
            path.join(path.dirname(store.file), "feeds.json"),
          ),
          mail: new MailAccounts(
            path.join(path.dirname(store.file), "mail.json"),
            {
              get: (id) => store.key(`connection:mail-${id}`),
              set: (id, value) =>
                store.setKeys({ [`connection:mail-${id}`]: value }),
            },
          ),
        }),
        dispose: () => {},
      },
      tune: {
        load: (): Tune => {
          // The sandbox root of the desktop check also hides machine entries
          // and uses its own Startup folder.
          const sandbox = process.env.YAMI_TUNE_ROOT;
          const io = regExe(sandbox);
          return {
            tweaks: new TuneController(
              path.join(path.dirname(store.file), "tune.json"),
              io,
            ),
            startup: new StartupController(
              io,
              process.env.YAMI_TUNE_STARTUP_DIR ||
                path.join(
                  process.env.APPDATA || "",
                  "Microsoft",
                  "Windows",
                  "Start Menu",
                  "Programs",
                  "Startup",
                ),
              sandbox ? undefined : readMachineKey,
            ),
            dns: new DnsController(helperPath("Dns.ps1")),
          };
        },
        dispose: () => {},
      },
      browser: {
        load: (): Browser => ({
          browser: createBrowser({ makeWindow: deps.makeWindow }),
          vault: new Vault(path.join(path.dirname(store.file), "vault.bin"), {
            encrypt: (text) => safeStorage.encryptString(text),
            decrypt: (data) => safeStorage.decryptString(data),
            available: () => safeStorage.isEncryptionAvailable(),
          }),
        }),
        dispose: (b: Browser) => b.browser.dispose(),
      },
      remote: {
        load: (): Remote => {
          if (!store.key("provider:remote"))
            store.setKeys({
              "provider:remote": randomBytes(24).toString("hex"),
            });
          const allowed = (name: string) =>
            Array.isArray(store.state.settings.remoteAllow) &&
            store.state.settings.remoteAllow.includes(name);
          const link: Remote = {
            ...startRemote({
              token: () => store.key("provider:remote"),
              allowed,
              state: async () => {
                const wb = registry.peek<Workbench>("workbench");
                return {
                  pc: os.hostname(),
                  allow: Object.fromEntries(
                    remoteAbilities.map((n) => [n, allowed(n)]),
                  ),
                  agents: wb
                    ? activeAgents(wb.data.state.sessions).map(
                        ({ agent, project, phase, detail }) => ({
                          agent: agentName(agent),
                          project,
                          phase,
                          detail: detail.slice(0, 300),
                        }),
                      )
                    : [],
                  requests:
                    wb && allowed("approvals")
                      ? wb.data.state.requests
                          .filter(
                            (r) =>
                              r.kind === "permission" &&
                              r.expiresAt > Date.now(),
                          )
                          .map(({ id, agent, title, detail }) => ({
                            id,
                            agent: agentName(agent),
                            title,
                            detail: detail.slice(0, 2000),
                          }))
                      : [],
                  media: allowed("media")
                    ? await nativeScript("Media").catch(() => null)
                    : null,
                };
              },
              approve: (id, decision) => {
                const wb = registry.peek<Workbench>("workbench");
                if (!wb) throw new Error("No agent is waiting.");
                // The phone showed the request, which counts as seen.
                wb.agents.acknowledge(id);
                wb.agents.finish(id, decision);
              },
              media: (action) => mediaAction(action),
              clipboard: (text) => {
                clipboard.writeText(text);
                deps.notify("Text from your phone is on the clipboard.");
              },
            }),
            error: "",
          };
          link.ready.catch((e: Error) => {
            link.error = e.message;
          });
          return link;
        },
        dispose: (link: Remote) => void link.close(),
      },
      agentLink: {
        load: (): AgentLink => {
          let token = store.key("provider:agentlink");
          if (!token) {
            token = randomBytes(24).toString("hex");
            store.setKeys({ "provider:agentlink": token });
          }
          const link: AgentLink = {
            ...startAgentLink({
              token: () => store.key("provider:agentlink"),
              allowed: (name) => {
                const list = store.state.settings.agentLinkTools;
                return Array.isArray(list) && list.includes(name);
              },
              tools: agentTools({
                notify: (message) =>
                  deps.broadcast({ type: "caption-notice", message }),
                ask: (title, detail) =>
                  deps.confirm(
                    "A coding agent asks: " + title,
                    detail || "Answer in Yami; no answer counts as no.",
                  ),
                projects: () => speechCore().data.state.projects,
                openTerminal: (project) => workbench().dev.launch({ project }),
                browserOpen: (url) => {
                  const { browser } = registry.get<Browser>("browser");
                  browser.show();
                  browser.open(url);
                },
                browserRead: () =>
                  registry.get<Browser>("browser").browser.read(),
              }),
            }),
            error: "",
          };
          link.ready.catch((e: Error) => {
            link.error = e.message;
            deps.notify(e.message);
          });
          return link;
        },
        dispose: (link: AgentLink) => void link.close(),
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
            addProject: async (folder) => {
              if (!registry.enabled("workbench"))
                throw new Error("Turn on the AI workspace to keep projects.");
              return workbench().dev.add(folder);
            },
          }),
        dispose: (w: Wheel) => w.dispose(),
      },
    },
  });
  const workbench = () => registry.get<Workbench>("workbench");
  // Built on the first Spotify request; nothing runs while unused.
  let spotify: Spotify | undefined;
  const wheel = () => registry.get<Wheel>("fileWheel");
  // Background duties need the workspace running before any page opens.
  const wake = () => {
    // The agent endpoint must listen before any agent calls it.
    if (registry.enabled("agentLink") && !registry.loaded("agentLink"))
      registry.get("agentLink");
    if (registry.enabled("remote") && !registry.loaded("remote"))
      registry.get("remote");
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
        Workbench.handles(method) ||
        /^(modules|setup|packs|tune|feeds|agentlink|palette|remote|browser|vault|spotify)\./.test(
          method,
        )
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
      // The launcher lists projects without waking the AI workspace.
      if (method === "palette.projects")
        return registry.enabled("workbench")
          ? speechCore().data.state.projects.map(({ id, name, path }) => ({
              id,
              name,
              path,
            }))
          : [];
      if (method.startsWith("palette."))
        throw new Error("Unknown launcher request.");
      if (method.startsWith("spotify.")) {
        const s = (spotify ??= new Spotify(
          () => store.state.settings.spotifyClientId,
          {
            get: () => store.key("provider:spotify"),
            set: (value) => store.setKeys({ "provider:spotify": value }),
          },
        ));
        const status = () => ({
          clientId: store.state.settings.spotifyClientId,
          connected: s.connected(),
        });
        if (method === "spotify.status") return status();
        if (method === "spotify.connect") {
          const clientId = String(a.clientId || "").trim();
          const { verifier, challenge, state } = pkce();
          const url = authorizeUrl(clientId, challenge, state);
          store.state.settings.spotifyClientId = clientId;
          deps.changed();
          const code = waitForCode(state);
          await shell.openExternal(url);
          await s.exchange(await code, verifier);
          return status();
        }
        if (method === "spotify.disconnect") {
          s.disconnect();
          return status();
        }
        if (method === "spotify.now") return s.now();
        if (method === "spotify.devices") return s.devices();
        if (method === "spotify.act") return s.act(String(a.action), a.value);
        throw new Error("Unknown Spotify request.");
      }
      if (method.startsWith("browser.") || method.startsWith("vault.")) {
        const { browser, vault } = registry.get<Browser>("browser");
        const local = process.env.LOCALAPPDATA || "";
        switch (method) {
          case "browser.show":
            browser.show();
            if (a.url) browser.open(String(a.url));
            return true;
          case "browser.state":
            return browser.state();
          case "browser.window": {
            const w = sender && BrowserWindow.fromWebContents(sender);
            if (!w || !browser.owns(sender)) return false;
            if (a.action === "minimize") w.minimize();
            else if (a.action === "close") w.close();
            return true;
          }
          case "browser.open":
            return browser.open(String(a.input ?? ""));
          case "browser.select":
            return browser.select(String(a.id));
          case "browser.navigate":
            return browser.navigate(String(a.id), String(a.input ?? ""));
          case "browser.go":
            if (!["back", "forward", "reload", "stop"].includes(a.step))
              throw new Error("Unknown browser step.");
            return browser.go(String(a.id), a.step);
          case "browser.close":
            return browser.close(String(a.id));
          case "browser.layout":
            return browser.layout(a);
          case "vault.bookmarks":
            return vault.list();
          case "vault.sources":
            return vault.sources(local);
          case "vault.import":
            return vault.import(String(a.id), local);
          case "vault.remove":
            return vault.remove(String(a.url));
          case "vault.clear":
            return vault.clear();
        }
        throw new Error("Unknown browser request.");
      }
      if (method.startsWith("remote.")) {
        const settings = store.state.settings;
        const allow = () =>
          Array.isArray(settings.remoteAllow) ? settings.remoteAllow : [];
        if (method === "remote.allow") {
          const name = String(a.name);
          if (!remoteAbilities.includes(name as RemoteAbility))
            throw new Error("Unknown phone ability.");
          if (typeof a.allowed !== "boolean")
            throw new Error("Choose on or off.");
          settings.remoteAllow = [
            ...allow().filter((n) => n !== name),
            ...(a.allowed ? [name] : []),
          ];
          deps.changed();
        } else if (method === "remote.rotate") {
          registry.get("remote");
          store.setKeys({ "provider:remote": randomBytes(24).toString("hex") });
        } else if (method !== "remote.info")
          throw new Error("Unknown remote request.");
        const link = registry.enabled("remote")
          ? registry.get<Remote>("remote")
          : undefined;
        const token = link ? store.key("provider:remote") : "";
        return {
          enabled: !!link,
          url: link?.url || "",
          pairing: link?.url && token ? `${link.url}#k=${token}` : "",
          error: link?.error || "",
          abilities: remoteAbilities.map((name) => ({
            name,
            allowed: allow().includes(name),
          })),
        };
      }
      if (method.startsWith("agentlink.")) {
        const settings = store.state.settings;
        const current = () =>
          Array.isArray(settings.agentLinkTools) ? settings.agentLinkTools : [];
        if (method === "agentlink.tools") {
          const name = String(a.name);
          if (!agentToolNames.includes(name)) throw new Error("Unknown tool.");
          if (typeof a.allowed !== "boolean")
            throw new Error("Choose on or off.");
          settings.agentLinkTools = [
            ...current().filter((t) => t !== name),
            ...(a.allowed ? [name] : []),
          ];
          deps.changed();
        } else if (method === "agentlink.rotate") {
          registry.get("agentLink");
          store.setKeys({
            "provider:agentlink": randomBytes(24).toString("hex"),
          });
        } else if (method !== "agentlink.info")
          throw new Error("Unknown agent link request.");
        const link = registry.enabled("agentLink")
          ? registry.get<AgentLink>("agentLink")
          : undefined;
        return {
          enabled: !!link,
          url: `http://127.0.0.1:${agentLinkPort}/mcp`,
          token: link ? store.key("provider:agentlink") : "",
          error: link?.error || "",
          tools: agentToolNames.map((name) => ({
            name,
            allowed: current().includes(name),
          })),
        };
      }
      if (method.startsWith("feeds.")) {
        const { feeds, mail } = registry.get<Feeds>("feeds");
        if (method === "feeds.mail") return mail.list();
        if (method === "feeds.mail.refresh") return mail.refresh();
        if (method === "feeds.mail.add") return mail.add(a);
        if (method === "feeds.mail.remove") return mail.remove(String(a.id));
        if (method === "feeds.list") return feeds.view();
        if (method === "feeds.refresh")
          return feeds.refresh(a.id ? String(a.id) : undefined);
        if (method === "feeds.add") return feeds.add(a.kind, a.value);
        if (method === "feeds.remove") return feeds.remove(String(a.id));
        throw new Error("Unknown feeds request.");
      }
      if (method.startsWith("tune.")) {
        const { tweaks: tune, startup, dns } = registry.get<Tune>("tune");
        if (method === "tune.dns") return dns.list();
        if (method === "tune.dns.set") return dns.set(a.index, a.profile);
        if (method === "tune.list") return tune.list();
        if (method === "tune.apply") return tune.apply(a.ids);
        if (method === "tune.undo") return tune.undo(a.ids);
        if (method === "tune.startup") return startup.list();
        if (method === "tune.startup.set") return startup.set(a.id, a.enabled);
        if (method === "tune.restartExplorer") return restartExplorer();
        throw new Error("Unknown tune-up request.");
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
      const prepared =
        Array.isArray(a?.attachments) && a.attachments.length
          ? workbench().prepareChat(a)
          : a;
      // Credentials in the message or its attached context never leave.
      if (
        !store.state.settings.maskSecrets ||
        typeof prepared?.text !== "string"
      )
        return prepared;
      const { text, found } = maskSecrets(prepared.text);
      if (found.length)
        deps.notify(`Hidden before sending: ${found.join(", ")}.`);
      return { ...prepared, text };
    },
    async offlineDictation(a: any) {
      const { speech } = speechCore();
      const text = await speech.transform(
        await speech.transcribe(
          String(a.data),
          String(a.mimeType),
          store.state.settings.dictationEngine === "whistle"
            ? "whistle"
            : "windows",
        ),
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
        const {
          settings,
          notes,
          rules,
          history,
          connections,
          usage,
          projects,
        } = (shared?.data || new WorkbenchStorage(store)).state;
        return {
          settings,
          notes,
          rules,
          history,
          connections,
          usage,
          projects,
        };
      },
      clearData() {
        const live = registry.peek<Workbench>("workbench");
        const dir = path.dirname(store.file);
        // Tune and feeds keep their own files whether or not they are loaded.
        for (const file of [
          "tune.json",
          "feeds.json",
          "mail.json",
          "vault.bin",
        ])
          fs.rmSync(path.join(dir, file), { force: true });
        if (live) return live.clearData();
        if (shared) shared.data.deleted = true;
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
