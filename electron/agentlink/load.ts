import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BrowserWindow } from "electron";
import { startAgentLink } from "./server";
import { agentTools } from "./tools";
import { yamiTools, yamiToolNames } from "./yami-tools";
import { collectReport, log, logStatus } from "../log/index";
import type { Store } from "../store";
import type { Project } from "../../src/dev-types";
import type { createBrowser } from "../browser/browser";
import type { createLinked } from "../browser/linked";

// Builds the "Yami for your agents" module: the local MCP server and the
// tools it offers, each of which the user switches on separately.

export type AgentLink = ReturnType<typeof startAgentLink> & { error: string };
export const agentToolNames = [
  "notify",
  "ask_user",
  "list_projects",
  "open_terminal",
  "browser_open",
  "browser_read",
  "browser_click",
  "browser_type",
  "browser_select",
  "browser_upload",
  ...yamiToolNames,
];

export function loadAgentLink(deps: {
  store: Store;
  notify: (text: string) => void;
  broadcast: (event: object) => void;
  confirm: (title: string, detail: string) => Promise<boolean>;
  projects: () => Project[];
  openTerminal: (project: string) => void;
  showMain: (tab?: string) => void;
  setPanel: (open: boolean, tab?: string) => void;
  /** Yami's own request handler, so changes go through the same checks. */
  request: (method: string, args: object) => Promise<unknown>;
  /** The browser module, loaded the first time a browser tool runs. */
  browser: () => {
    browser: ReturnType<typeof createBrowser>;
    linked: ReturnType<typeof createLinked>;
  };
}): AgentLink {
  const { store } = deps;
  if (!store.key("provider:agentlink"))
    store.setKeys({ "provider:agentlink": randomBytes(24).toString("hex") });
  const ask = (title: string, detail: string) => deps.confirm(title, detail);
  const link: AgentLink = {
    ...startAgentLink({
      token: () => store.key("provider:agentlink"),
      allowed: (name) => {
        const list = store.state.settings.agentLinkTools;
        return Array.isArray(list) && list.includes(name);
      },
      tools: [
        ...agentTools({
          notify: (message) =>
            deps.broadcast({ type: "caption-notice", message }),
          ask: (title, detail) =>
            deps.confirm(
              "A coding agent asks: " + title,
              detail || "Answer in Yami; no answer counts as no.",
            ),
          projects: deps.projects,
          openTerminal: deps.openTerminal,
          browserOpen: (url) => {
            const { browser } = deps.browser();
            browser.show();
            browser.open(url);
          },
          browserUpload: (target, file) =>
            deps.browser().browser.upload(target, file, ask),
          browserAct: (kind, target, value) =>
            deps.browser().browser.act(kind, target, value, ask),
          // A signed-in linked browser, when open, is what agents read.
          browserRead: () => {
            const { browser, linked } = deps.browser();
            return linked.running() ? linked.read() : browser.read();
          },
        }),
        ...yamiTools({
          status: logStatus,
          logs: async (channel, limit, since) => {
            await log().flush();
            return log().read(channel as "ERR", limit, since);
          },
          report: async (note) => {
            const file = await collectReport(note, store.state.settings);
            return { file, text: fs.readFileSync(file, "utf8") };
          },
          open: (page) => deps.showMain(page),
          drawer: (tab) => deps.setPanel(!!tab, tab || undefined),
          screenshot: (mode) => screenshot(mode, deps.showMain),
          settings: () => store.state.settings as Record<string, unknown>,
          setSetting: async (key, value) => {
            await deps.request("settings", { [key]: value });
          },
          ask,
        }),
      ],
    }),
    error: "",
  };
  link.ready.catch((e: Error) => {
    link.error = e.message;
    deps.notify(e.message);
  });
  return link;
}

/** A picture of one of Yami's own windows, saved next to the logs. */
async function screenshot(mode: string, showMain: (tab?: string) => void) {
  const find = () =>
    BrowserWindow.getAllWindows().find(
      (w) =>
        !w.isDestroyed() &&
        new URL(w.webContents.getURL() || "about:blank").searchParams.get(
          "window",
        ) === mode,
    );
  let win = find();
  if (!win && mode === "main") {
    showMain();
    for (let i = 0; i < 50 && !(win = find()); i++)
      await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!win) throw new Error(`The ${mode} window is not open.`);
  const image = await win.webContents.capturePage();
  const dir = path.join(log().dir, "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
  );
  fs.writeFileSync(file, image.toPNG());
  // Keep the twenty newest.
  for (const old of fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".png"))
    .sort()
    .reverse()
    .slice(20))
    fs.rmSync(path.join(dir, old), { force: true });
  return file;
}
