import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Select } from "../controls";
import { Icon } from "../ui";
export function Mcp({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [url, setUrl] = useState(data.settings.mcpUrl),
    [key, setKey] = useState(""),
    [tools, setTools] = useState<any[]>([]),
    [name, setName] = useState(""),
    [args, setArgs] = useState("{}"),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>MCP server</h1>
          <p className="page-description">
            Connect an HTTP MCP endpoint. Every tool call is reviewed before it
            runs.
          </p>
        </div>
      </div>
      <section className="workbench-usage form-card">
      <header className="entry-head">
        <span className="entry-icon">
          <Icon name="plug" />
        </span>
        <div className="entry-heading">
          <strong>Server</strong>
          <small>
            {tools.length
              ? `${tools.length} ${tools.length === 1 ? "tool" : "tools"} available`
              : "Not connected"}
          </small>
        </div>
      </header>
      <div className="workbench-form">
        <label className="form-label">
          Server address
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.example/mcp"
          />
        </label>
        <label className="form-label">
          {data.settings.mcpHasKey
            ? "Replace server key"
            : "Optional server key"}
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
      </div>
      <div className="workbench-actions">
        <button
          className="soft-button"
          disabled={busy || !url}
          onClick={() => {
            setBusy(true);
            void api("workbench.settings", {
              mcpUrl: url,
              ...(key ? { mcpKey: key } : {}),
            })
              .then(() => api("mcp.connect"))
              .then(setTools)
              .catch((e) => report(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <Icon name="plugs-connected" size={16} />
          Connect and list tools
        </button>
        <button
          className="text-button"
          onClick={() =>
            void api("mcp.disconnect").then(() => {
              setTools([]);
              setName("");
            })
          }
        >
          Disconnect
        </button>
      </div>
      </section>
      {!!tools.length && (
        <section className="workbench-usage form-card">
          <label className="form-label">
            Tool
            <Select
              className="select-wide"
              label="Tool"
              value={name}
              onChange={setName}
              options={[
                { value: "", label: "Choose a tool" },
                ...tools.map((t) => ({ value: t.name, label: t.name, icon: "wrench" })),
              ]}
            />
          </label>
          {name && (
            <>
              <p className="setting-note">
                {tools.find((t) => t.name === name)?.description}
              </p>
              <details>
                <summary>Input schema</summary>
                <pre className="confirmation-detail">
                  {JSON.stringify(
                    tools.find((t) => t.name === name)?.inputSchema,
                    null,
                    2,
                  )}
                </pre>
              </details>
              <label className="form-label">
                Arguments (JSON)
                <textarea
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                />
              </label>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  let parsed;
                  try {
                    parsed = JSON.parse(args);
                  } catch {
                    report("Enter valid JSON arguments.");
                    return;
                  }
                  setBusy(true);
                  void api("mcp.call", { name, arguments: parsed })
                    .then((r) => setResult(JSON.stringify(r, null, 2)))
                    .catch((e) => report(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                <Icon name="play" size={16} />
                Review and run
              </button>
            </>
          )}
        </section>
      )}
      {result && <pre className="workbench-prose mcp-result">{result}</pre>}
    </>
  );
}
