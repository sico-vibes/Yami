import { useEffect, useRef, useState } from "react";
import type { Note, WorkbenchState } from "../workbench-types";
import { api } from "../api";
import { Icon, Toggle } from "../ui";
import { PcmCapture, encodeBytes } from "../pcm-capture";
export function Notes({
  data,
  report,
}: {
  data: WorkbenchState;
  report: (text: string) => void;
}) {
  const [note, setNote] = useState<Partial<Note>>({ title: "", text: "" }),
    [query, setQuery] = useState(""),
    [consent, setConsent] = useState(false),
    [mic, setMic] = useState(true),
    [system, setSystem] = useState(false),
    [recording, setRecording] = useState(""),
    [busy, setBusy] = useState(false);
  const capture = useRef<PcmCapture | null>(null),
    id = useRef("");
  const [results, setResults] = useState<Note[]>([]);
  const [pendingTranscript, setPendingTranscript] = useState(false);
  useEffect(() => {
    const guard = (e: Event) => {
      if (
        id.current &&
        !window.confirm(
          "Leave this view and discard the active recording or pending transcription?",
        )
      )
        e.preventDefault();
    };
    window.addEventListener("yami-before-navigate", guard);
    return () => window.removeEventListener("yami-before-navigate", guard);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void api("notes.search", { query })
        .then(setResults)
        .catch((e) => report(e.message));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, data.notes]);
  useEffect(
    () => () => {
      void capture.current?.stop();
      if (id.current) void api("meeting.cancel", { id: id.current });
    },
    [],
  );
  async function start() {
    setBusy(true);
    try {
      await api("meeting.prepare", { consent });
      const r = await api("meeting.start", { consent });
      id.current = r.id;
      const recorder = (capture.current = new PcmCapture(
        (bytes) => api("meeting.chunk", { id: r.id, data: encodeBytes(bytes) }),
        (e) => {
          report(e.message);
          void stop(false);
        },
      ));
      await recorder.start(mic, system);
      setRecording(r.id);
    } catch (e) {
      if (id.current)
        await api("meeting.cancel", { id: id.current }).catch(() => {});
      id.current = "";
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function stop(transcribe = true) {
    setBusy(true);
    setRecording("");
    try {
      await capture.current?.stop();
      capture.current = null;
      if (transcribe) {
        setPendingTranscript(true);
        const saved = await api("meeting.finish", { id: id.current });
        setNote(saved);
        setPendingTranscript(false);
      } else {
        await api("meeting.cancel", { id: id.current });
        setPendingTranscript(false);
      }
      id.current = "";
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Notes</h1>
          <p className="page-description">
            A few words of your own, or a meeting you choose to record.
          </p>
        </div>
        <button
          type="button"
          className="soft-button"
          onClick={() => setNote({ title: "", text: "" })}
        >
          New note
        </button>
      </div>
      <details className="workbench-recording record-card">
        <summary>
          <span className="entry-icon">
            <Icon name={recording ? "record" : "microphone"} />
          </span>
          <span className="entry-heading">
            <strong>
              {recording ? "Recording a meeting" : "Record a meeting"}
            </strong>
            <small>
              Transcribe a call into a note, only when you start it.
            </small>
          </span>
        </summary>
        <p className="setting-note">
          Tell everyone before recording. Audio stays in temporary storage until
          transcription, then is deleted. Gemini transcription sends audio to
          Google; Windows transcription stays on this PC. Choose the engine in
          Dictation.
        </p>
        <label className="workbench-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Participants know I am recording.
        </label>
        <div className="record-sources">
          <span>
            <Icon name="microphone" size={16} />
            Microphone
            <Toggle label="Record microphone" value={mic} onChange={setMic} />
          </span>
          <span>
            <Icon name="speaker-high" size={16} />
            System audio
            <Toggle
              label="Record system audio"
              value={system}
              onChange={setSystem}
            />
          </span>
        </div>
        <div className="workbench-actions">
          {recording ? (
            <>
              <strong role="status">Recording audio</strong>
              <button
                type="button"
                className="soft-button"
                disabled={busy}
                onClick={() => void stop()}
              >
                Stop and transcribe
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void stop(false)}
              >
                Discard recording
              </button>
            </>
          ) : pendingTranscript ? (
            <>
              <span role="status">
                Audio is retained until transcription succeeds or you discard
                it.
              </span>
              <button
                type="button"
                className="soft-button"
                disabled={busy}
                onClick={() => void stop(true)}
              >
                Retry transcription
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void stop(false)}
              >
                Discard recording
              </button>
            </>
          ) : (
            <button
              type="button"
              className="soft-button"
              disabled={busy || !consent || (!mic && !system)}
              onClick={() => void start()}
            >
              <Icon name="microphone" />
              {busy ? "Working…" : "Start recording"}
            </button>
          )}
        </div>
      </details>
      <div className="workbench-notes">
        <aside className="notes-list">
          <label className="search-field">
            <Icon name="magnifying-glass" />
            <input
              placeholder="Search notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {results
            .slice()
            .reverse()
            .map((n) => (
              <button
                type="button"
                className="workbench-note-link"
                key={n.id}
                onClick={() =>
                  void api("notes.get", { id: n.id })
                    .then(setNote)
                    .catch((e) => report(e.message))
                }
              >
                <span>{n.title || "Untitled note"}</span>
                <small>{new Date(n.at).toLocaleDateString()}</small>
              </button>
            ))}
          {!results.length && (
            <p className="notes-empty">
              {data.notes.length
                ? "No notes match."
                : "Notes stay on this PC. Recording and AI summaries only run when you start them."}
            </p>
          )}
        </aside>
        <section className="note-editor">
          <input
            className="note-title"
            aria-label="Title"
            placeholder="Untitled note"
            value={note.title || ""}
            onChange={(e) => setNote({ ...note, title: e.target.value })}
          />
          <textarea
            className="workbench-note-editor"
            aria-label="Note"
            placeholder="Write something worth returning to…"
            value={note.text || ""}
            onChange={(e) => setNote({ ...note, text: e.target.value })}
          />
          <div className="note-toolbar">
            {note.id && (
              <button
                type="button"
                className="text-button danger"
                onClick={() =>
                  void api("notes.remove", { id: note.id })
                    .then(() => setNote({ title: "", text: "" }))
                    .catch((e) => report(e.message))
                }
              >
                <Icon name="trash" size={15} />
                Delete note
              </button>
            )}
            <button
              type="button"
              className="soft-button"
              disabled={busy || !note.text?.trim()}
              onClick={() => {
                setBusy(true);
                void api("notes.summarize", { text: note.text })
                  .then((summary) => setNote({ ...note, summary }))
                  .catch((e) => report(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              <Icon name="sparkle" size={16} />
              Summarize with Gemini
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy || !note.text?.trim()}
              onClick={() =>
                void api("notes.save", note)
                  .then(setNote)
                  .catch((e) => report(e.message))
              }
            >
              Save note
            </button>
          </div>
        </section>
      </div>
      {note.summary && (
        <div className="workbench-prose note-summary">
          <h2>Summary and proposed actions</h2>
          <pre>{note.summary}</pre>
          {note.summary
            .split("\n")
            .filter((line) => /^\s*[-*]\s+\[ \]\s+/.test(line))
            .map((line, i) => {
              const title = line.replace(/^\s*[-*]\s+\[ \]\s+/, "");
              return (
                <button
                  type="button"
                  key={i}
                  className="summary-task"
                  data-tip="Add to Desk"
                  aria-label={`Add to Desk: ${title}`}
                  onClick={() =>
                    void api("todo.add", { title })
                      .then(() => report("Added to Desk."))
                      .catch((e) => report(e.message))
                  }
                >
                  <Icon name="plus-circle" size={16} />
                  <span>{title}</span>
                </button>
              );
            })}
          <button
            type="button"
            className="soft-button summary-attach"
            onClick={() =>
              void api("context.use", {
                title: note.title || "Meeting summary",
                text: note.summary,
              }).catch((e) => report(e.message))
            }
          >
            Attach summary to chat
          </button>
        </div>
      )}
    </>
  );
}
