import { useEffect, useState } from "react";
import { api } from "../api";
import { StatusChip } from "../controls";
import { Icon, Toggle } from "../ui";

type Info = {
  enabled: boolean;
  url: string;
  token: string;
  error: string;
  tools: { name: string; allowed: boolean }[];
};

const toolText: Record<string, [string, string]> = {
  notify: ["Notify me", "Show an agent's short message in Yami's caption."],
  ask_user: [
    "Ask me yes or no",
    "An approval card in Yami; no answer counts as no.",
  ],
  list_projects: ["See my projects", "Names and folders from Projects."],
  open_terminal: [
    "Open a terminal",
    "Open a Yami Terminal tab in a project. Runs no command.",
  ],
};

/** The other direction of MCP: coding agents calling Yami. */
export function AgentLinkPanel({ report }: { report: (text: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null),
    [shown, setShown] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("agentlink.info").then(setInfo).catch(fail);
  }, []);
  const copy = (text: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => report("Copied."))
      .catch(fail);
  if (!info) return null;
  const header = `Authorization: Bearer ${info.token}`;
  const claude = `claude mcp add --transport http yami ${info.url} --header "${header}"`;
  return (
    <section className="workbench-usage form-card agent-link">
      <header className="entry-head">
        <span className="entry-icon">
          <Icon name="plugs-connected" />
        </span>
        <div className="entry-heading">
          <strong>Yami for your agents</strong>
          <small>Coding agents call Yami through a local MCP endpoint</small>
        </div>
        <StatusChip
          status={info.error ? "error" : info.enabled ? "ready" : "off"}
        />
        <Toggle
          label="Yami for your agents"
          value={info.enabled}
          onChange={(enabled) =>
            void api("modules.set", { id: "agentLink", enabled })
              .then(() => api("agentlink.info"))
              .then(setInfo)
              .catch(fail)
          }
        />
      </header>
      {info.error && <p className="error-text">{info.error}</p>}
      {info.enabled && (
        <>
          <p className="setting-note">
            Listens on this PC only, at {info.url}, and answers only requests
            carrying this token. Web pages are refused.
          </p>
          <div className="agent-link-token">
            <code>{shown ? info.token : "•".repeat(24)}</code>
            <button className="text-button" onClick={() => setShown(!shown)}>
              {shown ? "Hide" : "Show"}
            </button>
            <button className="text-button" onClick={() => copy(header)}>
              Copy header
            </button>
            <button
              className="text-button"
              onClick={() =>
                void api("agentlink.rotate").then(setInfo).catch(fail)
              }
            >
              New token
            </button>
          </div>
          <div className="agent-link-command">
            <span className="setting-note">Claude Code</span>
            <code>{shown ? claude : claude.replace(info.token, "…")}</code>
            <button className="soft-button" onClick={() => copy(claude)}>
              <Icon name="copy" size={16} />
              Copy
            </button>
          </div>
          <p className="setting-note">
            Other agents (Codex, Cursor, OpenCode, Gemini CLI) take the same
            address and header in their MCP settings as a streamable HTTP
            server.
          </p>
          <div className="setting-group">
            {info.tools.map((t) => (
              <div className="setting-row" key={t.name}>
                <div>
                  <strong>{toolText[t.name]?.[0] || t.name}</strong>
                  <p>
                    {toolText[t.name]?.[1]} <code>{t.name}</code>
                  </p>
                </div>
                <Toggle
                  label={toolText[t.name]?.[0] || t.name}
                  value={t.allowed}
                  onChange={(allowed) =>
                    void api("agentlink.tools", { name: t.name, allowed })
                      .then(setInfo)
                      .catch(fail)
                  }
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
