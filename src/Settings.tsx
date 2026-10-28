import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { AsciiSkeleton } from "./AsciiSkeleton";
import type { State, Settings as Preferences } from "./shared";
import { api, todayUsage } from "./api";
import { EngineStatus } from "./wheel/Engines";
import { ModulesSettings } from "./setup/ModulesSettings";
import { RemotePanel } from "./RemotePanel";
import { SpotifyPanel } from "./SpotifyPanel";
import { Icon, IconButton, Modal, Toggle } from "./ui";
import { Select, StatusChip } from "./controls";
const WorkbenchPage = lazy(() => import("./workbench/WorkbenchPage"));
const groups = [
  ["user", "Yami"],
  ["keyboard", "Shortcuts"],
  ["sliders-horizontal", "Behavior"],
  ["cpu", "System"],
  ["key", "API keys"],
  ["database", "Your data"],
  ["shield-check", "Privacy"],
  ["terminal-window", "Workspace"],
  ["circles-four", "File wheel"],
  ["puzzle-piece", "Modules"],
  ["device-mobile", "Phone"],
  ["music-notes", "Music"],
];
export function Settings({
  state,
  report,
}: {
  state: State;
  report: (message: string) => void;
}) {
  const [section, setSection] = useState("API keys"),
    [search, setSearch] = useState(""),
    [keyModal, setKeyModal] = useState(""),
    [key, setKey] = useState(""),
    [saving, setSaving] = useState(false),
    [capturing, setCapturing] = useState<keyof Preferences | null>(null),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [models, setModels] = useState<any[]>([]),
    [usage, setUsage] = useState<any>(null),
    [diagnostics, setDiagnostics] = useState<any>(null);
  const s = state.settings;
  const patch = (patch: Partial<Preferences>) =>
    api("settings", patch).catch((e) => report(e.message));
  useEffect(() => {
    if (!capturing) return;
    void api("shortcuts.capture", { active: true });
    let candidate: string[] = [];
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setCapturing(null);
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") {
        setCapturing(null);
        return;
      }
      const parts = [
        e.ctrlKey ? "Ctrl" : "",
        e.metaKey ? "Win" : "",
        e.altKey ? "Alt" : "",
        e.shiftKey ? "Shift" : "",
        !["Control", "Meta", "Alt", "Shift"].includes(e.key)
          ? e.key.replace(/^Arrow/, "").toUpperCase()
          : "",
      ].filter(Boolean);
      if (parts.length >= 2) {
        candidate = parts;
      }
    };
    const release = () => {
      if (candidate.length >= 2) {
        void patch({ [capturing]: candidate.join("+") });
        setCapturing(null);
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", release);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", release);
      void api("shortcuts.capture", { active: false });
    };
  }, [capturing]);
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then(setDevices)
      .catch(() => {});
    api("diagnostics")
      .then(setDiagnostics)
      .catch(() => {});
    if (state.keys.tavily)
      api("keys.usage")
        .then(setUsage)
        .catch(() => {});
  }, [state.keys.tavily]);
  const show = (label: string) =>
    !search || label.toLowerCase().includes(search.toLowerCase());
  const row = (
    title: string,
    detail: string,
    control: ReactNode,
    stacked = false,
  ) =>
    show(title + " " + detail) ? (
      <div className={`setting-row ${stacked ? "stacked" : ""}`} key={title}>
        <div>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        <div className="setting-control">{control}</div>
      </div>
    ) : null;
  const toggle = (key: keyof Preferences, label: string) => (
    <Toggle
      label={label}
      value={!!s[key]}
      onChange={(value) => void patch({ [key]: value })}
    />
  );
  const input = (key: keyof Preferences, placeholder = "") => (
    <input
      className="compact-input"
      aria-label={String(key)}
      placeholder={placeholder}
      defaultValue={String(s[key])}
      onBlur={(e) => {
        if (e.target.value !== s[key]) void patch({ [key]: e.target.value });
      }}
    />
  );
  const button = (label: string, onClick: () => void) => (
    <button className="soft-button" onClick={onClick}>
      {label}
    </button>
  );
  const askRemove = (provider: string) =>
    api("keys.remove", { provider }).catch((e) => report(e.message));
  const shortcut = (key: keyof Preferences) => (
    <button
      className="key-binding"
      onClick={() => setCapturing(key)}
      aria-label={"Change " + String(key)}
      data-tip="Click, then press a shortcut. Esc cancels."
    >
      {capturing === key
        ? "Press shortcut…"
        : String(s[key])
            .split("+")
            .map((k, i) => (
              <span key={i}>
                {i > 0 && <small>+</small>}
                <kbd>{k}</kbd>
              </span>
            ))}
    </button>
  );
  const titles: Record<string, string> = {
    Yami: "Make your companion yours.",
    Shortcuts: "A few keys. Everything within reach.",
    Behavior: "How Yami works with you.",
    System: "Windows, audio and startup.",
    "API keys": "Your Gemini key, and a free Tavily key for web search.",
    "Your data": "Everything you keep here stays on this PC.",
    Privacy: "Choose what Yami can see and do.",
    "File wheel": "Drag a file, tap a modifier, and drop it on a petal.",
    Modules: "Wake the features you use. The rest stay asleep.",
    Phone: "Approve agents and control music from your phone.",
    Music: "Spotify devices and volume, if you connect it.",
  };
  const all = !!search;
  return (
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <h2>Settings</h2>
        <label className="search-field">
          <Icon name="magnifying-glass" size={18} />
          <input
            placeholder="Search settings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav>
          {groups.map(([icon, title]) => (
            <button
              key={title}
              className={section === title && !all ? "selected" : ""}
              onClick={() => {
                setSection(title);
                setSearch("");
              }}
            >
              <Icon name={icon} />
              {title}
            </button>
          ))}
        </nav>
      </aside>
      <section className="settings-content">
        {section === "Workspace" && (
          <Suspense
            fallback={<AsciiSkeleton label="Opening workspace settings…" />}
          >
            <WorkbenchPage embedded initial="Workspace" report={report} />
          </Suspense>
        )}
        {section !== "Workspace" && (
          <>
            <h1>{all ? "Search settings" : section}</h1>
            <p className="page-description">
              {all ? `Results for “${search}”` : titles[section]}
            </p>
          </>
        )}
        {(section === "Yami" || all) && (
          <>
            <h3 className="group-title">Your companion</h3>
            <div className="setting-group">
              {row(
                "Your name",
                "What should Yami call you?",
                input("name", "Your name"),
              )}
              {row(
                "Your location",
                "City name or latitude,longitude for local weather.",
                input("location", "e.g. London"),
              )}
              {row(
                "Personality",
                "Choose a personality in your loadout.",
                <span className="value-pill">
                  <Icon name="flame" size={14} />
                  {s.personality === "chad" ? "Alley Cat" : "Custom"}
                </span>,
              )}
              {s.personality === "custom" &&
                row(
                  "Custom personality",
                  "How your companion should speak.",
                  <textarea
                    aria-label="Custom personality"
                    defaultValue={s.customPersonality}
                    onBlur={(e) =>
                      void patch({ customPersonality: e.target.value })
                    }
                  />,
                )}
            </div>
          </>
        )}
        {(section === "Shortcuts" || all) && (
          <>
            <h3 className="group-title">Global shortcuts</h3>
            <div className="setting-group">
              {row(
                "Enable shortcuts",
                "Hold a shortcut to begin. Release it when you finish.",
                toggle("hotkeys", "Enable shortcuts"),
              )}
              {row(
                "Talk to Yami",
                "Hold to talk to your companion.",
                shortcut("voiceShortcut"),
              )}
              {row(
                "Dictation",
                "Hold and speak into any text field.",
                shortcut("dictationShortcut"),
              )}
              {row(
                "Circle to ask",
                "Draw around anything on your screen.",
                shortcut("circleShortcut"),
              )}
            </div>
            <p className="setting-note">
              Focus a shortcut and press your preferred combination. Esc cancels
              an active recording or screen selection.
            </p>
          </>
        )}
        {(section === "Behavior" || all) && (
          <>
            <h3 className="group-title">Conversation</h3>
            <div className="setting-group">
              {row(
                "Memory",
                "Remember facts you ask Yami to keep.",
                toggle("memoryEnabled", "Memory"),
              )}
              {row(
                "Noise suppression",
                "Reduce background noise while you speak.",
                toggle("noiseSuppression", "Noise suppression"),
              )}
              {row(
                "Reduced motion",
                "Keep transitions and the spirit still.",
                toggle("reducedMotion", "Reduced motion"),
              )}
              {row(
                "Let Yami roam",
                "Yami floats on your desktop, dodges the cursor and naps when left alone.",
                toggle("roam", "Let Yami roam"),
              )}
              {row(
                "Living flame",
                "Keep Yami's flame flickering even when nothing is happening. Uses a little more power.",
                toggle("livingFlame", "Living flame"),
              )}
            </div>
            <h3 className="group-title">Advanced tools</h3>
            <div className="setting-group">
              {row(
                "Terminal commands",
                "Off by default. Every command asks you to confirm.",
                toggle("terminalEnabled", "Terminal commands"),
              )}
              {row(
                "Raw desktop automation",
                "Allow coordinate clicks. Every action asks you to confirm.",
                toggle("desktopEnabled", "Raw desktop automation"),
              )}
            </div>
          </>
        )}
        {(section === "System" || all) && (
          <>
            <h3 className="group-title">Startup & windows</h3>
            <div className="setting-group">
              {row(
                "Start with Windows",
                "Keep your island and routines ready when you sign in.",
                toggle("launchAtLogin", "Start with Windows"),
              )}
              {row(
                "Start quietly",
                "Show the island without opening the main window.",
                toggle("startHidden", "Start quietly"),
              )}
              {row(
                "Keep window on top",
                "Keep the main Yami window above your other apps.",
                toggle("alwaysOnTop", "Keep window on top"),
              )}
              {row(
                "Light and dark on a schedule",
                "Windows switches to dark mode in the evening and back to light in the morning. One timer waits for the next switch.",
                toggle("themeScheduleEnabled", "Light and dark on a schedule"),
              )}
              {s.themeScheduleEnabled &&
                row(
                  "Switch times",
                  "Light from the first time, dark from the second.",
                  <span className="theme-times">
                    <input
                      type="time"
                      aria-label="Light from"
                      value={s.themeLightAt}
                      onChange={(e) =>
                        e.target.value &&
                        void patch({ themeLightAt: e.target.value })
                      }
                    />
                    <input
                      type="time"
                      aria-label="Dark from"
                      value={s.themeDarkAt}
                      onChange={(e) =>
                        e.target.value &&
                        void patch({ themeDarkAt: e.target.value })
                      }
                    />
                  </span>,
                )}
            </div>
            <h3 className="group-title">Audio</h3>
            <div className="setting-group">
              {row(
                "Microphone",
                "Choose your voice and dictation input.",
                <Select
                  label="Microphone"
                  value={s.microphone}
                  onChange={(microphone) => void patch({ microphone })}
                  options={[
                    { value: "", label: "Windows default", icon: "microphone" },
                    ...devices
                      .filter((d) => d.kind === "audioinput")
                      .map((d) => ({
                        value: d.deviceId,
                        label: d.label || "Microphone",
                        icon: "microphone",
                      })),
                  ]}
                />,
              )}
              {row(
                "Microphone permissions",
                "Manage microphone access in Windows.",
                button(
                  "Open",
                  () =>
                    void api("control", {
                      method: "settings",
                      args: { page: "privacy-microphone" },
                    }),
                ),
              )}
              {row(
                "Yami version",
                `Version ${diagnostics?.app || "0.1.0"} · Windows ${diagnostics?.windows || ""}`,
                <StatusChip
                  status={
                    diagnostics?.native?.ok
                      ? "Windows connected"
                      : "Connecting…"
                  }
                />,
              )}
            </div>
          </>
        )}
        {(section === "API keys" || all) && (
          <>
            <h3 className="group-title">Gemini</h3>
            <div className="setting-group">
              {row(
                "Gemini API key",
                state.keys.gemini
                  ? "Stored encrypted on this PC, never shown again once saved"
                  : "Connect your own key to talk, dictate and ask.",
                button(state.keys.gemini ? "Change" : "Connect", () => {
                  setKey("");
                  setKeyModal("gemini");
                }),
              )}
              {state.keys.gemini &&
                row(
                  "Forget my API key",
                  "Erases your Gemini key from this PC; Yami asks for one again",
                  button("Forget…", () => void askRemove("gemini")),
                )}
            </div>
            <h3 className="group-title">Web search</h3>
            <div className="setting-group">
              {row(
                "Tavily API key",
                state.keys.tavily
                  ? `Connected · ${usage?.key?.usage ?? usage?.account?.current_plan_usage ?? "—"} of ${usage?.account?.plan_usage_limit ?? "1,000"} credits used this month · a quick search is 1`
                  : "Optional. Connect Tavily for current information and deeper research.",
                <>
                  {state.keys.tavily && (
                    <span className="key-hint">{state.keys.tavilyHint}</span>
                  )}
                  {button(state.keys.tavily ? "Remove" : "Connect", () =>
                    state.keys.tavily
                      ? void askRemove("tavily")
                      : (setKey(""), setKeyModal("tavily")),
                  )}
                </>,
              )}
              {row(
                "Get a free Tavily key",
                "1,000 free credits a month, no card. Sign up, copy the key, paste it above",
                button(
                  "Get one",
                  () =>
                    void api("open.external", {
                      url: "https://app.tavily.com",
                    }),
                ),
              )}
              {row(
                "What it sends",
                "Only your research question goes to Tavily, from this PC under your account. Results go to Gemini to write your answer. Deep research runs only when you ask for it (about 7 credits).",
                null,
              )}
            </div>
          </>
        )}
        {(section === "Your data" || all) && (
          <>
            <h3 className="group-title">Stored on this PC</h3>
            <div className="setting-group">
              {row(
                "Clipboard history",
                "Keep copied text locally, encrypted with Windows DPAPI.",
                toggle("clipboardEnabled", "Clipboard history"),
              )}
              {row(
                "Keep clipboard history",
                "Pinned items remain until you remove them.",
                <Select
                  label="Clipboard retention"
                  value={String(s.clipboardDays)}
                  onChange={(days) =>
                    void patch({ clipboardDays: Number(days) })
                  }
                  options={[1, 7, 14, 30].map((n) => ({
                    value: String(n),
                    label: n === 1 ? "1 day" : `${n} days`,
                  }))}
                />,
              )}
              {row(
                "Clear clipboard history",
                `${state.clipboard.length} saved items`,
                button("Clear", () => void api("clipboard.clear")),
              )}
              {row(
                "Clear conversation history",
                `${state.messages.length} messages`,
                button("Clear", () => void api("history.clear")),
              )}
              {row(
                "Export my data",
                "Save memories, conversations, plans and settings. Keys and clipboard are excluded.",
                button("Export", () => void api("data.export")),
              )}
              {row(
                "Delete all my data",
                "Erase your local data and API keys. This cannot be undone.",
                <button
                  className="soft-button danger"
                  onClick={() => void api("data.clear")}
                >
                  Delete…
                </button>,
              )}
            </div>
            <h3 className="group-title">Your activity</h3>
            <div className="usage-strip">
              {Object.entries(todayUsage(state))
                .filter(([k]) => k !== "credits")
                .map(([k, v]) => (
                  <div key={k}>
                    <b>{v.toLocaleString()}</b>
                    <span>{k}</span>
                  </div>
                ))}
            </div>
          </>
        )}
        {(section === "Privacy" || all) && (
          <>
            <h3 className="group-title">Context & permissions</h3>
            <div className="setting-group">
              {row(
                "Let it see what’s going on",
                "At conversation start, share open app names and your to-do list. Never window titles.",
                toggle("contextEnabled", "Let it see what’s going on"),
              )}
              {row(
                "Location & weather",
                "Use your approximate IP location for MET Norway weather. If you enter a city, use that instead.",
                toggle("weatherEnabled", "Location & weather"),
              )}
              {row(
                "Hide secrets before sending",
                "API keys, tokens, private keys, passwords and card numbers in a message or attached context are replaced before Gemini sees them.",
                toggle("maskSecrets", "Hide secrets before sending"),
              )}
              {row(
                "Lyrics",
                "Show the current line of a playing song. Sends only its artist, title and length to LRCLIB (lrclib.net), a free lyrics database.",
                toggle("lyricsEnabled", "Lyrics"),
              )}
              {row(
                "Screen access",
                "Only a screenshot you explicitly select is sent to Gemini.",
                <span className="value-pill">
                  <Icon name="selection" size={14} />
                  On request
                </span>,
              )}
              {row(
                "Local encryption",
                "API keys and unpinned clipboard entries use Windows DPAPI.",
                <StatusChip
                  status={diagnostics?.encryption ? "Enabled" : "Unavailable"}
                />,
              )}
            </div>
            <div className="privacy-copy">
              <h3>Your PC. Your keys.</h3>
              <p>
                Voice, dictated audio, selected screenshots, conversation
                context and enabled memories are sent directly to Google using
                your key. Free-tier data may be used to improve Google’s
                products, subject to your region and Google’s terms.
              </p>
              <p>
                Yami has no telemetry. Local utilities work without an API key.
                Purchases, messages, terminal commands and destructive actions
                need your instruction and confirmation.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  void api("open.external", {
                    url: "https://ai.google.dev/gemini-api/terms",
                  })
                }
              >
                Read Google’s API terms <Icon name="arrow-up-right" size={14} />
              </button>
            </div>
          </>
        )}
        {(section === "File wheel" || all) && (
          <>
            <h3 className="group-title">Drag a file onto a petal</h3>
            <div className="setting-group">
              {row(
                "Drag wheel",
                "While dragging, tap Shift, Ctrl, or Alt. Holding a modifier still changes the Windows drag.",
                toggle("fileWheelEnabled", "Drag wheel"),
              )}
              {row(
                "Convert, Tools, Actions",
                "Each wheel needs its own modifier.",
                <span className="modifier-grid">
                  {(
                    [
                      ["fileWheelConvert", "Convert"],
                      ["fileWheelTools", "Tools"],
                      ["fileWheelActions", "Actions"],
                    ] as const
                  ).map(([key, label]) => (
                    <span key={key}>
                      <small>{label}</small>
                      <Select
                        label={`${label} wheel modifier`}
                        value={String(s[key])}
                        onChange={(modifier) => void patch({ [key]: modifier })}
                        options={["Shift", "Ctrl", "Alt"]}
                      />
                    </span>
                  ))}
                </span>,
              )}
              {row(
                "Explorer shortcut",
                "Opens the wheel for the files selected in File Explorer.",
                shortcut("fileWheelHotkey"),
              )}
              {row(
                "Reveal saved files",
                "After a conversion, show the new file in File Explorer.",
                toggle("fileWheelReveal", "Reveal saved files"),
              )}
              {row(
                "Petal sound",
                "A quiet tick when the highlighted petal changes.",
                toggle("fileWheelSound", "Petal sound"),
              )}
              {row(
                "Engines",
                "Downloaded into local app data only when a conversion needs them.",
                <EngineStatus />,
                true,
              )}
              {row(
                "Send to menu",
                "Adds Yami to the Windows Send to menu.",
                button(
                  "Install Send to",
                  () =>
                    void api("wheel.sendTo")
                      .then(() => report("Send to shortcut installed."))
                      .catch((error) => report(error.message)),
                ),
              )}
            </div>
            <p className="setting-note">
              Tapping a modifier during a drag is still being proven on Windows.
              If the drag cancels, use the shortcut, Send to, or the tray drop
              shelf. Desktop icons are not always visible to the Explorer
              shortcut.
            </p>
          </>
        )}
        {section === "Modules" && !all && <ModulesSettings report={report} />}
        {section === "Phone" && !all && <RemotePanel report={report} />}
        {section === "Music" && !all && <SpotifyPanel report={report} />}
      </section>
      {keyModal && (
        <Modal
          title={keyModal === "gemini" ? "Connect Yami" : "Connect web search"}
          onClose={() => setKeyModal("")}
          className="key-modal"
        >
          <p>
            {keyModal === "gemini"
              ? "Paste your Gemini API key to start talking to Yami."
              : "Add your Tavily key for current web research."}
          </p>
          <p className="setting-note">
            The key belongs to your own account and is encrypted on this PC.
            Your provider’s terms and usage limits apply.
          </p>
          <input
            autoFocus
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              keyModal === "gemini"
                ? "Paste Gemini API key"
                : "Paste Tavily API key"
            }
            aria-label="API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button
            className="primary-button"
            disabled={!key.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api("keys.save", { provider: keyModal, key });
                setKey("");
                setKeyModal("");
                report("Connected. Your key is encrypted on this PC.");
              } catch (e) {
                report((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Checking key…" : "Save and start"}
          </button>
          <button
            className="text-button"
            onClick={() =>
              void api("open.external", {
                url:
                  keyModal === "gemini"
                    ? "https://aistudio.google.com/api-keys"
                    : "https://app.tavily.com",
              })
            }
          >
            Get an API key <Icon name="arrow-up-right" size={14} />
          </button>
        </Modal>
      )}
    </div>
  );
}
