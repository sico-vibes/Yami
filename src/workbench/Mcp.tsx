import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
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
      {!!tools.length && (
        <>
          <label className="form-label">
            Tool
            <select value={name} onChange={(e) => setName(e.target.value)}>
              <option value="">Choose a tool</option>
              {tools.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
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
                className="soft-button"
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
                Review and run
              </button>
            </>
          )}
        </>
      )}
      {result && <pre className="workbench-prose">{result}</pre>}
    </>
  );
}
