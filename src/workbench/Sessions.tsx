import { useEffect, useState } from "react";
import type { AgentRequest, WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Empty, Icon, IconButton, Modal } from "../ui";
export function Sessions({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [plan, setPlan] = useState<any>(null),
    [agent, setAgent] = useState("claude"),
    [diff, setDiff] = useState<string | null>(null);
  const call = (method: string, args?: any) =>
    api(method, args).catch((e) => {
      report(e.message);
    });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agent sessions</h1>
          <p className="page-description">
            A quiet place to see what needs you.
          </p>
        </div>
        <button
          className="soft-button"
          onClick={() => void call("terminal.open")}
        >
          <Icon name="terminal-window" />
          Open terminal
        </button>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Agent hooks</strong>
            <p>
              Preview changes before connecting a CLI. Other hooks stay intact.
            </p>
          </div>
          <div className="setting-control workbench-actions">
            <select
              aria-label="Agent to connect"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
            >
              {[
                "claude",
                "codex",
                "gemini",
                "copilot",
                "cursor",
                "opencode",
              ].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
            <button
              className="soft-button"
              onClick={() =>
                void api("agents.preview", { agent, install: true })
                  .then(setPlan)
                  .catch((e) => report(e.message))
              }
            >
              Connect
            </button>
            <button
              className="text-button"
              onClick={() =>
                void api("agents.preview", { agent, install: false })
                  .then(setPlan)
                  .catch((e) => report(e.message))
              }
            >
              Remove hooks
            </button>
          </div>
        </div>
      </div>
      {!data.settings.monitor && (
        <p className="setting-note">
          Monitoring is off. Connecting an agent enables the local relay; you
          can pause it in Workspace settings.
        </p>
      )}
      {!data.sessions.length ? (
        <Empty icon="robot" title="Your agents will appear here">
          Connect a CLI, then start a session. No activity is invented from a
          running process.
        </Empty>
      ) : (
        <div className="workbench-list">
          {[...data.sessions].reverse().map((s) => (
            <article className="workbench-entry" key={s.id}>
              <div className="workbench-entry-title">
                <Icon
                  name={s.phase === "waiting" ? "hand" : "terminal-window"}
                />
                <strong>{s.project}</strong>
                <span className="workbench-state">{s.phase}</span>
              </div>
              <p>
                {s.agent} · {s.detail}
              </p>
              <small>
                {s.source} · {new Date(s.at).toLocaleTimeString()}
              </small>
              <div className="workbench-actions">
                <button
                  className="soft-button"
                  onClick={() => void call("agents.open", { id: s.id })}
                >
                  {s.window || s.terminalId
                    ? "Return to session"
                    : "Open project folder"}
                </button>
                <IconButton
                  icon="x"
                  label={`Dismiss ${s.project}`}
                  onClick={() => void call("agents.dismiss", { id: s.id })}
                />
              </div>
              {!!s.files.length && (
                <details>
                  <summary>Changed files ({s.files.length})</summary>
                  {s.files.map((file) => (
                    <button
                      className="text-button workbench-file"
                      key={file}
                      onClick={() =>
                        void api("agents.diff", { id: s.id, file })
                          .then(setDiff)
                          .catch((e) => report(e.message))
                      }
                    >
                      {file.split(/[\\/]/).pop()}
                    </button>
                  ))}
                </details>
              )}
            </article>
          ))}
        </div>
      )}
      {plan && (
        <Modal
          title={plan.install ? "Connect agent" : "Remove Yami hooks"}
          onClose={() => setPlan(null)}
        >
          <p>{plan.file}</p>
          <pre className="confirmation-detail">{plan.after}</pre>
          <p className="setting-note">
            {plan.note} A backup is saved before changing an existing file.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setPlan(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() =>
                void api("agents.install", plan)
                  .then((r) => {
                    report(r.note);
                    setPlan(null);
                  })
                  .catch((e) => report(e.message))
              }
            >
              Apply changes
            </button>
          </div>
        </Modal>
      )}
      {diff !== null && (
        <Modal title="File changes" onClose={() => setDiff(null)}>
          <pre className="confirmation-detail">{diff}</pre>
          <button
            className="soft-button"
            onClick={() =>
              void call("context.use", {
                title: "Selected file diff",
                text: diff,
              })
            }
          >
            Attach to Yami chat
          </button>
        </Modal>
      )}
    </>
  );
}
export function AgentApproval({
  request,
  report,
}: {
  request: AgentRequest;
  report: (text: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({}),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (document.visibilityState === "visible")
      void api("agents.ack", { id: request.id }).catch((e) =>
        report(e.message),
      );
  }, [request.id]);
  const reply = async (decision: string) => {
    setBusy(true);
    try {
      await api("agents.reply", { id: request.id, decision, answers });
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={request.title} onClose={() => void reply("ask")}>
      {request.kind === "question" ? (
        request.questions?.map((q) => (
          <fieldset className="workbench-question" key={q.question}>
            <legend>{q.question}</legend>
            {q.options.map((o) => (
              <label key={o.label}>
                <input
                  type={q.multiSelect ? "checkbox" : "radio"}
                  name={q.question}
                  checked={
                    q.multiSelect
                      ? (answers[q.question] || []).includes(o.label)
                      : answers[q.question] === o.label
                  }
                  onChange={(e) =>
                    setAnswers((old) => ({
                      ...old,
                      [q.question]: q.multiSelect
                        ? e.target.checked
                          ? [
                              ...(Array.isArray(old[q.question])
                                ? old[q.question]
                                : []),
                              o.label,
                            ]
                          : (Array.isArray(old[q.question])
                              ? (old[q.question] as string[])
                              : []
                            ).filter((v: string) => v !== o.label)
                        : o.label,
                    }))
                  }
                />
                <span>
                  {o.label}
                  <small>{o.description}</small>
                </span>
              </label>
            ))}
            <input
              aria-label={`Other answer for ${q.question}`}
              placeholder="Your own answer"
              onChange={(e) =>
                setAnswers((old) => ({
                  ...old,
                  [q.question]: q.multiSelect
                    ? [e.target.value]
                    : e.target.value,
                }))
              }
            />
          </fieldset>
        ))
      ) : (
        <pre className="confirmation-detail">{request.detail}</pre>
      )}
      <p className="setting-note">
        {request.agent} · Returns to the terminal if you close this or the
        request expires.
      </p>
      <div className="dialog-actions">
        <button
          className="soft-button"
          disabled={busy}
          onClick={() => void reply("ask")}
        >
          Reply in terminal
        </button>
        {request.kind === "permission" ? (
          <>
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => void reply("deny")}
            >
              Deny
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void reply("allow")}
            >
              Allow once
            </button>
          </>
        ) : (
          <button
            className="primary-button"
            disabled={
              busy ||
              request.questions?.some((q) => !answers[q.question]?.length)
            }
            onClick={() => void reply("answer")}
          >
            Send answers
          </button>
        )}
      </div>
    </Modal>
  );
}
