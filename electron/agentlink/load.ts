import { randomBytes } from "node:crypto";
import { startAgentLink } from "./server";
import { agentTools } from "./tools";
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
];

export function loadAgentLink(deps: {
  store: Store;
  notify: (text: string) => void;
  broadcast: (event: object) => void;
  confirm: (title: string, detail: string) => Promise<boolean>;
  projects: () => Project[];
  openTerminal: (project: string) => void;
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
      tools: agentTools({
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
    }),
    error: "",
  };
  link.ready.catch((e: Error) => {
    link.error = e.message;
    deps.notify(e.message);
  });
  return link;
}
