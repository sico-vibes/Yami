import { useState } from "react";
import type { WorkbenchState } from "../workbench-types";
import { api, bytes } from "../api";
import { Icon, IconButton } from "../ui";
import { Meter, Select } from "../controls";
import { useModules } from "../setup/use-modules";
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
  const modules = useModules(report);
  const whistle = modules?.find((m) => m.id === "whistle");
  const packs = whistle?.packs || [];
  const ready = packs.length > 0 && packs.every((p) => p.state === "installed");
  const busy = packs.some(
    (p) => p.state === "downloading" || p.state === "queued",
  );
  const failed = packs.find((p) => p.state === "failed");
  const total = packs.reduce((n, p) => n + (p.bytes || 0), 0);
  const received = packs.reduce(
    (n, p) => n + (p.state === "installed" ? p.bytes || 0 : p.received || 0),
    0,
  );
  // Choosing Whistle is consent to turn it on and fetch its two pinned files.
  const enableWhistle = () =>
    void api("modules.set", { id: "whistle", enabled: true })
      .then(() => api("packs.install", { id: "needle" }))
      .then(() => api("packs.install", { id: "whistle" }))
      .catch((e) => report(e.message));
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
              recognizer. Whistle runs Cactus's 17 MB speech model on this PC,
              with nothing sent anywhere.
            </p>
          </div>
          <Select
            label="Dictation engine"
            value={data.settings.dictationEngine}
            onChange={(dictationEngine) => {
              patch({ dictationEngine });
              if (dictationEngine === "whistle") enableWhistle();
            }}
            options={[
              { value: "gemini", label: "Gemini", icon: "sparkle" },
              {
                value: "windows",
                label: "Windows offline",
                icon: "windows-logo",
              },
              { value: "whistle", label: "Whistle offline", icon: "waveform" },
            ]}
          />
        </div>
        {data.settings.dictationEngine === "whistle" && (
          <div className="setting-row">
            <div>
              <strong>Whistle download</strong>
              <p>
                {ready
                  ? "Ready. Dictation runs on this PC; your recording is deleted after each transcript."
                  : busy
                    ? `Downloading the Needle engine and Whistle model${total ? ` · ${bytes(received)} of ${bytes(total)}` : ""}.`
                    : failed
                      ? failed.error || "The download failed."
                      : "Two pinned files, about 18.5 MB, checked against their SHA-256 before use."}
              </p>
              {busy && total > 0 && (
                <Meter value={received / total} label="Whistle downloaded" />
              )}
            </div>
            {!ready && !busy && (
              <button
                type="button"
                className="soft-button"
                onClick={enableWhistle}
              >
                <Icon name="download-simple" size={16} />
                {failed ? "Try again" : "Download"}
              </button>
            )}
            {ready && (
              <Icon name="check-circle" size={20} className="pack-ready" />
            )}
          </div>
        )}
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
            type="button"
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
          <button
            type="submit"
            className="primary-button"
            disabled={!heard.trim()}
          >
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
          <button
            type="submit"
            className="primary-button"
            disabled={!appName.trim()}
          >
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
          type="button"
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
