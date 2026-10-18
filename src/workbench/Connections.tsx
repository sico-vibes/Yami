import { useEffect, useState } from "react";
import { randomId } from "./view-utils";
import type { ConnectionConfig, WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Empty, Icon, IconButton, Modal, Toggle } from "../ui";
import { Select } from "../controls";
export function Connections({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [edit, setEdit] = useState<Partial<ConnectionConfig> | null>(null),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Connections</h1>
          <p className="page-description">
            Only the services you choose. Status and links, with no remote
            mutations.
          </p>
        </div>
        <button
          className="soft-button"
          onClick={() => {
            setEdit({
              kind: "github",
              name: "GitHub",
              enabled: true,
              background: false,
              interval: 300,
              url: "",
            });
            setKey("");
          }}
        >
          <Icon name="plus" />
          Add connection
        </button>
      </div>
      {!data.connections.length && (
        <Empty icon="plugs-connected" title="A little less checking elsewhere">
          Connect GitHub, deployments or workflows and bring useful updates
          here.
        </Empty>
      )}
      {data.connections.map((c) => {
        const r = data.readings.find((r) => r.id === c.id);
        return (
          <section className="workbench-usage" key={c.id}>
            <div className="workbench-entry-title">
              <Icon name="plugs" />
              <h2>{c.name}</h2>
              <span className="workbench-state">
                {c.enabled ? r?.status || "Ready to refresh" : "Disabled"}
              </span>
              <button
                className="soft-button"
                disabled={!c.enabled || busy}
                onClick={() => {
                  setBusy(true);
                  void api("connections.refresh", { id: c.id })
                    .catch((e) => report(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Refresh
              </button>
              <IconButton
                icon="gear"
                label={`Configure ${c.name}`}
                onClick={() => {
                  setEdit(c);
                  setKey("");
                }}
              />
            </div>
            {r?.error && (
              <p role="status" className="setting-note">
                {r.error} Previous items below may be stale.
              </p>
            )}
            {r?.items.map((item) => (
              <div className="workbench-quota" key={item.id}>
                <span>
                  {item.title}
                  <small>{item.detail}</small>
                </span>
                <span className="workbench-state">{item.status}</span>
                {item.url && (
                  <IconButton
                    icon="arrow-up-right"
                    label={`Open ${item.title}`}
                    onClick={() =>
                      void api("open.external", { url: item.url }).catch((e) =>
                        report(e.message),
                      )
                    }
                  />
                )}
              </div>
            ))}
            {r && <small>Last refresh {new Date(r.at).toLocaleString()}</small>}
          </section>
        );
      })}
      {edit && (
        <Modal
          title={edit.id ? "Edit connection" : "Add connection"}
          onClose={() => setEdit(null)}
        >
          <label className="form-label">
            Service
            <Select
              label="Service"
              value={edit.kind || "github"}
              onChange={(kind) => setEdit({ ...edit, kind: kind as any })}
              options={[
                { value: "github", label: "GitHub", icon: "github-logo" },
                { value: "vercel", label: "Vercel", icon: "triangle" },
                { value: "n8n", label: "n8n", icon: "flow-arrow" },
                { value: "notion", label: "Notion", icon: "notion-logo" },
                { value: "calcom", label: "Cal.com", icon: "calendar-dots" },
                { value: "resend", label: "Resend", icon: "envelope-simple" },
                { value: "stripe", label: "Stripe", icon: "stripe-logo" },
              ]}
            />
          </label>
          <label className="form-label">
            Name
            <input
              value={edit.name || ""}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </label>
          {edit.kind === "n8n" && (
            <label className="form-label">
              Server URL
              <input
                type="url"
                value={edit.url || ""}
                onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                placeholder="https://your-n8n.example"
              />
            </label>
          )}
          <label className="form-label">
            {edit.hasKey
              ? "Replace credential (leave blank to keep it)"
              : "Credential"}
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <div className="setting-row">
            <strong>Enabled</strong>
            <Toggle
              label="Enable connection"
              value={!!edit.enabled}
              onChange={(v) => setEdit({ ...edit, enabled: v })}
            />
          </div>
          <div className="setting-row">
            <div>
              <strong>Background notifications</strong>
              <p>Off by default. Checks while Yami is running.</p>
            </div>
            <Toggle
              label="Background connection notifications"
              value={!!edit.background}
              onChange={(v) => setEdit({ ...edit, background: v })}
            />
          </div>
          <label className="form-label">
            Refresh interval (seconds)
            <input
              type="number"
              min={60}
              max={3600}
              value={edit.interval || 300}
              onChange={(e) =>
                setEdit({ ...edit, interval: Number(e.target.value) })
              }
            />
          </label>
          <div className="dialog-actions">
            {edit.id && (
              <button
                className="text-button"
                onClick={() =>
                  void api("connections.remove", { id: edit.id })
                    .then(() => setEdit(null))
                    .catch((e) => report(e.message))
                }
              >
                Disconnect
              </button>
            )}
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void api("connections.save", { ...edit, key })
                  .then(() => setEdit(null))
                  .catch((e) => report(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Save connection
            </button>
          </div>
        </Modal>
      )}
      <LocalServer data={data} report={report} />
    </>
  );
}
export function LocalServer({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [url, setUrl] = useState(data.settings.localUrl),
    [key, setKey] = useState(""),
    [models, setModels] = useState<string[]>([]),
    [text, setText] = useState(""),
    [answer, setAnswer] = useState(""),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(
    () =>
      window.yami.on((e) => {
        if (e.type === "local-model-delta" && e.id === id) setAnswer(e.text);
      }),
    [id],
  );
  return (
    <section className="workbench-usage">
      <h2>Local model server</h2>
      <p className="setting-note">
        Ollama, LM Studio or a compatible chat server. Yami does not start a
        model. Requests go only to the configured server.
      </p>
      <div className="workbench-form">
        <label className="form-label">
          Server API address
          <input value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="form-label">
          {data.settings.localHasKey
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
      <button
        className="soft-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void api("workbench.settings", {
            localUrl: url,
            ...(key ? { localKey: key } : {}),
          })
            .then(() => api("local.models"))
            .then(setModels)
            .catch((e) => report(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Connect and discover models
      </button>
      <button
        className="text-button"
        disabled={busy}
        onClick={() =>
          void api("local.disconnect")
            .then(() => {
              setModels([]);
              setKey("");
              setAnswer("");
            })
            .catch((e) => report(e.message))
        }
      >
        Disconnect local server
      </button>
      {!!models.length && (
        <label className="form-label">
          Chat model
          <Select
            label="Local chat model"
            value={data.settings.localModel}
            onChange={(localModel) =>
              void api("workbench.settings", { localModel }).catch((e) =>
                report(e.message),
              )
            }
            options={[
              { value: "", label: "Choose a model" },
              ...models.map((model) => ({ value: model, label: model, icon: "cpu" })),
            ]}
          />
        </label>
      )}
      {data.settings.localModel && (
        <>
          <label className="form-label">
            Message local model
            <textarea value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="workbench-actions">
            <button
              className="soft-button"
              disabled={busy || !text.trim()}
              onClick={() => {
                const next = randomId();
                setId(next);
                setAnswer("");
                setBusy(true);
                void api("local.chat", { id: next, text })
                  .then(setAnswer)
                  .catch((e) => report(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Send
            </button>
            {busy && (
              <button
                className="text-button"
                onClick={() => void api("local.cancel", { id })}
              >
                Cancel
              </button>
            )}
          </div>
          {answer && <pre className="workbench-prose">{answer}</pre>}
        </>
      )}
    </section>
  );
}
