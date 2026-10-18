import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Icon, IconButton } from "../ui";
import { Select } from "../controls";
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
          <Select
            label="Dictation engine"
            value={data.settings.dictationEngine}
            onChange={(dictationEngine) => patch({ dictationEngine })}
            options={[
              { value: "gemini", label: "Gemini", icon: "sparkle" },
              { value: "windows", label: "Windows offline", icon: "windows-logo" },
            ]}
          />
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
      <section className="workbench-usage form-card">
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
        <Select
          label="Dictation rule type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "word", label: "Word replacement", icon: "swap" },
            { value: "snippet", label: "Spoken snippet", icon: "text-aa" },
          ]}
        />
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
        <button className="primary-button" disabled={!heard.trim()}>
          <Icon name="plus" size={16} />
          Add
        </button>
      </form>
      {!data.rules.length && (
        <p className="form-card-empty">
          Teach Yami a name it mishears, or a phrase that expands into text.
        </p>
      )}
      <div className="rule-list">
        {data.rules.map((r) => (
          <div className="rule-row" key={r.id}>
            <span className="rule-kind">
              {r.kind === "snippet" ? "Snippet" : "Word"}
            </span>
            <span className="rule-heard">“{r.heard}”</span>
            <Icon name="arrow-right" size={14} />
            <span className="rule-out">{r.replacement}</span>
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
      </section>
      <h3 className="group-title">Per-app cleanup</h3>
      <section className="workbench-usage form-card">
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
        <Select
          label="Dictation cleanup style"
          value={mode}
          onChange={setMode}
          options={[
            { value: "verbatim", label: "Verbatim" },
            { value: "natural", label: "Natural" },
            { value: "polished", label: "Polished" },
          ]}
        />
        <button className="primary-button" disabled={!appName.trim()}>
          <Icon name="plus" size={16} />
          Add app rule
        </button>
      </form>
      <div className="rule-list">
      {Object.entries(data.settings.cleanup).map(([name, style]) => (
        <div className="rule-row" key={name}>
          <span className="entry-icon">
            <Icon name="app-window" size={15} />
          </span>
          <span className="rule-heard">{name}</span>
          <span className="rule-kind">{style}</span>
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
      </div>
      </section>
      <h3 className="group-title">Last dictation</h3>
      <section className="workbench-usage last-dictation">
        <Icon name="quotes" size={20} />
        <p className={data.settings.lastDictation ? "" : "muted"}>
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
          <Icon name="copy" size={16} />
          Copy
        </button>
      </section>
    </>
  );
}
