import os from "node:os";
import { randomBytes } from "node:crypto";
import { clipboard } from "electron";
import { startRemote, type RemoteAbility } from "./server";
import { createScreenShare } from "./screen";
import { activeAgents } from "../../src/agent-rank";
import { agentClis } from "../../src/dev-types";
import { mediaAction, nativeScript } from "../platform";
import type { Store } from "../store";
import type { Native } from "../native";
import type { Workbench } from "../workbench";

// Builds the Yami Remote module: the paired phone's view of agents,
// approvals, media, the clipboard and (when allowed) the screen.

export type Remote = ReturnType<typeof startRemote> & { error: string };
export const remoteAbilities: RemoteAbility[] = [
  "approvals",
  "media",
  "clipboard",
  "screen",
  "control",
];
const agentName = (id: string) =>
  agentClis.find((c) => c.id === id)?.name || id;

export function loadRemote(deps: {
  store: Store;
  native: Native;
  notify: (text: string) => void;
  workbench: () => Workbench | undefined;
}): Remote {
  const { store } = deps;
  if (!store.key("provider:remote"))
    store.setKeys({ "provider:remote": randomBytes(24).toString("hex") });
  const allowed = (name: string) =>
    Array.isArray(store.state.settings.remoteAllow) &&
    store.state.settings.remoteAllow.includes(name);
  const link: Remote = {
    ...startRemote({
      token: () => store.key("provider:remote"),
      allowed,
      state: async () => {
        const wb = deps.workbench();
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
                    (r) => r.kind === "permission" && r.expiresAt > Date.now(),
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
        const wb = deps.workbench();
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
      ...createScreenShare({ native: deps.native, notify: deps.notify }),
    }),
    error: "",
  };
  link.ready.catch((e: Error) => {
    link.error = e.message;
  });
  return link;
}
