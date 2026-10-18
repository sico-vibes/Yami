import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { IconButton } from "../ui";
export function Dictation({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [heard, setHeard] = useState(""),
    [replacement, setReplacement] = useState(""),
    [kind, setKind] = useState("word"),
    [recognizers, setRecognizers] = useState<any[] | null>(null),
    [appName, setAppName] = useState(""),
    [mode, setMode] = useState("natural");
  const patch = (a: any) =>
    void api("workbench.settings", a).catch((e) => report(e.message));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your words</h1>
          <p className="page-description">
            Names, spoken snippets and the way you like to write.
          </p>
        </div>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Transcription engine</strong>
            <p>
              Gemini uses your key. Windows uses an installed offline speech
              recognizer.
            </p>
          </div>
          <select
            aria-label="Dictation engine"
            value={data.settings.dictationEngine}
            onChange={(e) => patch({ dictationEngine: e.target.value })}
          >
            <option value="gemini">Gemini</option>
            <option value="windows">Windows offline</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <strong>Installed offline languages</strong>
            <p>
              {recognizers === null
                ? "Check language availability before switching."
                : recognizers.length
                  ? recognizers
                      .map((r) => `${r.name} (${r.language})`)
                      .join(", ")
                  : "No Windows speech recognizer is installed. Add a speech language in Windows Settings."}
            </p>
          </div>
          <button
            className="soft-button"
            onClick={() =>
              void api("speech.recognizers")
                .then(setRecognizers)
                .catch((e) => report(e.message))
            }
          >
            Check languages
          </button>
        </div>
      </div>
      <h3 className="group-title">Dictionary and spoken snippets</h3>
      <form
        className="workbench-rule-form"
        onSubmit={(e) => {
          e.preventDefault();
          void api("speech.rules.save", { heard, replacement, kind })
            .then(() => {
              setHeard("");
              setReplacement("");
            })
            .catch((e) => report(e.message));
        }}
      >
        <select
          aria-label="Dictation rule type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="word">Word replacement</option>
          <option value="snippet">Spoken snippet</option>
        </select>
        <input
          aria-label="Spoken phrase"
          placeholder="When I say…"
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
        />
        <input
          aria-label="Replacement text"
          placeholder="Write this…"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button className="soft-button" disabled={!heard.trim()}>
          Add
        </button>
      </form>
      <div className="workbench-list">
        {data.rules.map((r) => (
          <div className="workbench-quota" key={r.id}>
            <span>
              {r.heard}
              <small>{r.kind}</small>
            </span>
            <span>{r.replacement}</span>
            <IconButton
              icon="trash"
              label={`Remove ${r.heard}`}
              onClick={() =>
                void api("speech.rules.remove", { id: r.id }).catch((e) =>
                  report(e.message),
                )
              }
            />
          </div>
        ))}
      </div>
      <h3 className="group-title">Per-app cleanup</h3>
      <p className="setting-note">
        Optional Gemini rewriting after transcription. Verbatim keeps the
        transcript with your dictionary rules. Nothing is rewritten unless you
        add an app rule.
      </p>
      <form
        className="workbench-rule-form"
        onSubmit={(e) => {
          e.preventDefault();
          patch({
            cleanup: {
              ...data.settings.cleanup,
              [appName
                .trim()
                .toLowerCase()
                .replace(/\.exe$/, "")]: mode,
            },
          });
          setAppName("");
        }}
      >
        <input
          aria-label="App process name"
          placeholder="Process name, e.g. Code"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
        />
        <select
          aria-label="Dictation cleanup style"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="verbatim">Verbatim</option>
          <option value="natural">Natural</option>
          <option value="polished">Polished</option>
        </select>
        <button className="soft-button" disabled={!appName.trim()}>
          Add app rule
        </button>
      </form>
      {Object.entries(data.settings.cleanup).map(([name, style]) => (
        <div className="workbench-quota" key={name}>
          <span>{name}</span>
          <span>{style}</span>
          <IconButton
            icon="trash"
            label={`Remove cleanup for ${name}`}
            onClick={() => {
              const next = { ...data.settings.cleanup };
              delete next[name];
              patch({ cleanup: next });
            }}
          />
        </div>
      ))}
      <h3 className="group-title">Last dictation</h3>
      <p className="workbench-prose">
        {data.settings.lastDictation ||
          "Your next completed dictation will appear here."}
      </p>
      <button
        className="soft-button"
        disabled={!data.settings.lastDictation}
        onClick={() =>
          void api("speech.copyLast")
            .then(() => report("Last dictation copied."))
            .catch((e) => report(e.message))
        }
      >
        Copy last dictation
      </button>
    </>
  );
}
