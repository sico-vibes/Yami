import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AsciiSkeleton } from "./AsciiSkeleton";
import type { State, Tab, YamiEvent } from "./shared";
import { api, asset } from "./api";
import { Empty, Icon, IconButton, Modal, Spirit, useYami } from "./ui";
import { Settings } from "./Settings";
import { Loadout } from "./Loadout";
import { Desk } from "./Desk";
import { MainNavigation } from "./MainNavigation";
import { skinFor } from "./yami/skins";
import { TooltipLayer } from "./controls";
const WorkbenchPage = lazy(() => import("./workbench/WorkbenchPage"));
const TunePage = lazy(() => import("./tune/TunePage"));
const Setup = lazy(() =>
  import("./setup/Setup").then((m) => ({ default: m.Setup })),
);
export function App() {
  const [tab, setTab] = useState<Tab>("home"),
    [toast, setToast] = useState(""),
    [status, setStatus] = useState("idle"),
    [confirmation, setConfirmation] = useState<any>(null),
    [selection, setSelection] = useState<any>(null),
    [transcript, setTranscript] = useState("");
  const timer = useRef<any>(null);
  const [attachments, setAttachments] = useState<
    { id: string; title: string }[]
  >([]);
  function report(message: string) {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 7000);
  }
  function event(e: YamiEvent) {
    if (e.type === "navigate") {
      if (
        window.dispatchEvent(
          new Event("yami-before-navigate", { cancelable: true }),
        )
      )
        setTab(e.tab);
    } else if (e.type === "context-selected") {
      setAttachments((old) =>
        [...old.filter((a) => a.id !== e.item.id), e.item].slice(-5),
      );
      if (
        window.dispatchEvent(
          new Event("yami-before-navigate", { cancelable: true }),
        )
      )
        setTab("home");
    } else if (e.type === "status") setStatus(e.status);
    else if (e.type === "error" || e.type === "toast") report(e.message);
    else if (e.type === "confirm") setConfirmation(e);
    else if (e.type === "confirm-expired") setConfirmation(null);
    else if (e.type === "selection") {
      setSelection(e.image);
      if (
        window.dispatchEvent(
          new Event("yami-before-navigate", { cancelable: true }),
        )
      )
        setTab("home");
    } else if (e.type === "selection-cleared") setSelection(null);
    else if (e.type === "transcript") setTranscript(e.text);
  }
  const { state, error, setError } = useYami(event);
  // useYami is listening by now; events sent while this page loaded follow.
  useEffect(() => {
    void api("window.ready").catch(() => {});
  }, []);
  useEffect(() => {
    if (error) {
      report(error);
      setError("");
    }
  }, [error]);
  useEffect(() => {
    if (state)
      document.documentElement.dataset.reduced = String(
        state.settings.reducedMotion,
      );
  }, [state?.settings.reducedMotion]);
  const firstRun = !!state && !state.settings.setupDone;
  // Tabs of modules that are off are hidden; leave one if it was open.
  const hidden: Tab[] = !state
    ? []
    : [
        ...(state.settings.workbenchEnabled ? [] : (["ai"] as Tab[])),
        ...(state.settings.tuneEnabled ? [] : (["tune"] as Tab[])),
      ];
  useEffect(() => {
    if (hidden.includes(tab)) setTab("home");
  }, [hidden.join(), tab]);
  if (!state)
    return (
      <div className="boot">
        <Spirit />
        <span>Waking up…</span>
      </div>
    );
  return (
    <div
      className="app-shell"
      style={
        {
          "--wallpaper": state.currentWallpaper
            ? `url("${asset(state.currentWallpaper)}")`
            : "none",
          "--soul": skinFor(state.settings.soul).glow,
        } as React.CSSProperties
      }
    >
      <TooltipLayer />
      <header className="titlebar">
        <div className="brand">
          <Spirit size={25} soul={state.settings.soul} />
          <span>Yami</span>
        </div>
        <div className="window-controls">
          <IconButton
            icon="minus"
            label="Minimize"
            onClick={() => void api("minimize")}
          />
          <IconButton
            icon="x"
            label="Close to tray"
            onClick={() => void api("hide")}
          />
        </div>
      </header>
      <main
        key={firstRun ? "setup" : tab}
        className={"main-content page-" + (firstRun ? "setup" : tab)}
      >
        {firstRun || tab === "setup" ? (
          <Suspense fallback={null}>
            <Setup
              state={state}
              report={report}
              onDone={() => setTab("home")}
            />
          </Suspense>
        ) : tab === "tune" ? (
          <Suspense fallback={<AsciiSkeleton label="Opening Tune…" />}>
            <TunePage report={report} />
          </Suspense>
        ) : tab === "ai" ? (
          <Suspense fallback={<AsciiSkeleton label="Opening workspace…" />}>
            <WorkbenchPage report={report} />
          </Suspense>
        ) : tab === "settings" ? (
          <Settings state={state} report={report} />
        ) : tab === "soul" ? (
          <Loadout state={state} report={report} />
        ) : tab === "desk" ? (
          <Desk state={state} report={report} />
        ) : tab === "bond" ? (
          <Memory state={state} report={report} />
        ) : (
          <Home
            state={state}
            status={status}
            transcript={transcript}
            selection={selection}
            clearSelection={() => {
              setSelection(null);
              void api("selection.clear");
            }}
            report={report}
            openSettings={() => setTab("settings")}
            attachments={attachments}
            clearAttachments={() => setAttachments([])}
            addAttachments={(items) =>
              setAttachments((old) => [...old, ...items].slice(-5))
            }
          />
        )}
      </main>
      {!firstRun && (
        <MainNavigation tab={tab} onNavigate={setTab} hidden={hidden} />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            void api("confirm", { id: confirmation.id, approved: false });
            setConfirmation(null);
          }}
        >
          <pre className="confirmation-detail">{confirmation.detail}</pre>
          <div className="dialog-actions">
            <button
              className="soft-button"
              onClick={() => {
                void api("confirm", { id: confirmation.id, approved: false });
                setConfirmation(null);
              }}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                void api("confirm", { id: confirmation.id, approved: true });
                setConfirmation(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Home({
  state,
  status,
  transcript,
  selection,
  clearSelection,
  report,
  openSettings,
  attachments,
  clearAttachments,
  addAttachments,
}: {
  state: State;
  status: string;
  transcript: string;
  selection: any;
  clearSelection: () => void;
  report: (m: string) => void;
  openSettings: () => void;
  attachments: { id: string; title: string }[];
  clearAttachments: () => void;
  addAttachments: (items: { id: string; title: string }[]) => void;
}) {
  const [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [recording, setRecording] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      window.yami.on((e) => {
        if (
          [
            "error",
            "cancel-recording",
            "voice-stop",
            "recording-ended",
          ].includes(e.type)
        )
          setRecording(false);
      }),
    [],
  );
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, status]);
  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const value = text;
    setText("");
    try {
      await api("chat", {
        text: value,
        image: selection,
        attachments: attachments.map((a) => a.id),
      });
      clearSelection();
      clearAttachments();
    } catch (e) {
      setText(value);
      report((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="home-page">
      {state.messages.length ? (
        <div className="conversation">
          {state.messages.map((m) => (
            <article className={"message " + m.role} key={m.id}>
              <small>{m.role === "user" ? "YOU" : "YAMI"}</small>
              <div className="message-text">{m.text}</div>
              {!!m.sources?.length && (
                <div className="sources">
                  {m.sources.map((s, i) => (
                    <button
                      key={s.url + i}
                      onClick={() => void api("open.external", { url: s.url })}
                    >
                      <Icon name="globe" size={13} />
                      {s.title || new URL(s.url).hostname}
                      <Icon name="arrow-up-right" size={11} />
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {status !== "idle" && (
            <div className="conversation-status">
              <Spirit state={status} soul={state.settings.soul} size={35} />
              <span>{transcript || status + "…"}</span>
            </div>
          )}
          <div ref={bottom} />
        </div>
      ) : (
        <div className="welcome">
          <Spirit state={status} soul={state.settings.soul} size={145} />
          <h1>
            {state.settings.name
              ? `Hey, ${state.settings.name}.`
              : "Hey. I live here now."}
          </h1>
          <p>
            {state.keys.gemini
              ? "What are we doing today?"
              : "Connect your Gemini key. Then just talk."}
          </p>
          {!state.keys.gemini ? (
            <button className="soft-button" onClick={openSettings}>
              <Icon name="key" size={17} /> Connect Yami
            </button>
          ) : (
            <div className="shortcut-hint">
              <kbd>Win</kbd>
              <span>+</span>
              <kbd>Alt</kbd>
              <span>to talk</span>
            </div>
          )}
        </div>
      )}
      <div className="composer-wrap">
        {!!attachments.length && (
          <div className="selection-preview">
            <Icon name="paperclip" />
            <span>{attachments.map((a) => a.title).join(" · ")}</span>
            <IconButton
              icon="x"
              label="Remove selected context"
              onClick={clearAttachments}
            />
          </div>
        )}
        {selection && (
          <div className="selection-preview">
            <img
              src={"data:image/png;base64," + selection.data}
              alt="Your screen selection"
            />
            <span>Ask about your selection</span>
            <IconButton
              icon="x"
              label="Remove selection"
              onClick={clearSelection}
            />
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <IconButton
            icon="paperclip"
            label="Attach text files"
            onClick={() =>
              void api("context.pick")
                .then(addAttachments)
                .catch((e) => report(e.message))
            }
          />
          <IconButton
            icon="selection"
            label="Circle to ask"
            onClick={() =>
              void api("lasso.start").catch((e) => report(e.message))
            }
          />
          <textarea
            aria-label="Message Yami"
            placeholder={
              selection ? "Ask about what you circled…" : "Ask Yami anything…"
            }
            value={text}
            rows={1}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <IconButton
            icon={recording ? "stop" : "microphone"}
            label={recording ? "Stop recording" : "Talk to Yami"}
            active={recording}
            onClick={() => {
              void api("record", { kind: "voice" })
                .then(() => setRecording((v) => !v))
                .catch((e) => report(e.message));
            }}
          />
          <button
            className="send-button"
            aria-label="Send message"
            disabled={!text.trim() || sending || !state.keys.gemini}
          >
            <Icon name={sending ? "circle-notch" : "arrow-up"} />
          </button>
        </form>
        <div className="composer-hint">
          <span>
            <kbd>Ctrl</kbd> + <kbd>Win</kbd> Dictate
          </span>
          <span>
            <kbd>Ctrl</kbd> + <kbd>Shift</kbd> Circle to ask
          </span>
        </div>
      </div>
    </section>
  );
}
function Memory({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [text, setText] = useState(""),
    [edit, setEdit] = useState(""),
    [query, setQuery] = useState("");
  return (
    <section className="memory-page">
      <div className="page-head">
        <div>
          <h1>Your bond</h1>
          <p className="page-description">
            What your companion remembers about you.
          </p>
        </div>
        <span className="count-badge">{state.memories.length} memories</span>
      </div>
      <label className="search-field">
        <Icon name="magnifying-glass" size={18} />
        <input
          placeholder="Search memories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <form
        className="memory-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim())
            void api("memory.save", {
              id: edit || undefined,
              text: text.trim(),
            })
              .then(() => {
                setText("");
                setEdit("");
              })
              .catch((e) => report(e.message));
        }}
      >
        <input
          aria-label="Memory"
          placeholder="Something you’d like Yami to remember…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="soft-button" disabled={!text.trim()}>
          {edit ? "Save" : "Remember"}
        </button>
        {edit && (
          <IconButton
            icon="x"
            label="Cancel edit"
            onClick={() => {
              setEdit("");
              setText("");
            }}
          />
        )}
      </form>
      <div className="memory-list">
        {state.memories
          .filter((m) => m.text.toLowerCase().includes(query.toLowerCase()))
          .map((m) => (
            <div className="memory-row" key={m.id}>
              <Icon name="sparkle" size={20} />
              <p>{m.text}</p>
              <IconButton
                icon="pencil-simple"
                label="Edit memory"
                onClick={() => {
                  setEdit(m.id);
                  setText(m.text);
                }}
              />
              <IconButton
                icon="trash"
                label="Delete memory"
                onClick={() => void api("memory.delete", { id: m.id })}
              />
            </div>
          ))}
        {!state.memories.length && (
          <Empty icon="link" title="A bond starts with a little memory">
            Tell Yami what matters to you. You can edit or erase every memory
            here.
          </Empty>
        )}
      </div>
      <p className="setting-note">
        Stored on this PC. When memory is enabled, these facts are included in
        your Gemini conversation.
      </p>
    </section>
  );
}
