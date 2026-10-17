import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { State, UtilityTab, YamiEvent } from "./shared";
import { Icon, IconButton, Spirit, useYami } from "./ui";
import { AudioEngine } from "./audio";
import { Utilities } from "./Utilities";
export function Island() {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<UtilityTab>("Controls"),
    [status, setStatus] = useState("idle"),
    [level, setLevel] = useState(0),
    [toast, setToast] = useState(""),
    [mode, setMode] = useState(""),
    [media, setMedia] = useState<any>(null),
    [armed, setArmed] = useState(false),
    [effect, setEffect] = useState<{
      x: number;
      y: number;
      kind: string;
    } | null>(null);
  const prefs = useRef<State["settings"] | null>(null),
    audio = useRef<AudioEngine | null>(null),
    toastTimer = useRef<any>(null);
  const keyReady = useRef(false);
  function report(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }
  const start = (kind: "voice" | "dictation", target = 0, oneShot = false) => {
    if (!prefs.current) return;
    if (!keyReady.current) {
      report("Connect your Gemini API key in Settings.");
      void api("show", { tab: "settings" });
      return;
    }
    setMode(kind);
    void audio.current?.start(kind, prefs.current, target, oneShot);
  };
  const stop = (cancel = false) => {
    audio.current?.stop(cancel);
    setMode("");
  };
  const event = (e: YamiEvent) => {
    if (e.type === "panel") {
      setOpen(e.open);
      setTab(e.tab);
    } else if (e.type === "status") setStatus(e.status);
    else if (e.type === "toast" || e.type === "error") report(e.message);
    else if (e.type === "voice-start") start("voice");
    else if (e.type === "voice-stop") stop();
    else if (e.type === "dictation-start") start("dictation", e.target);
    else if (e.type === "dictation-stop") stop();
    else if (e.type === "recording-ended") stop();
    else if (e.type === "record") {
      if (audio.current?.mode) {
        if (e.oneShot) {
          audio.current.enableAutoEnd();
          void api("voice.start");
        } else stop();
      } else start(e.kind || "voice", 0, !!e.oneShot);
    } else if (e.type === "cancel-recording") {
      stop(true);
      setArmed(false);
      void api("ability.arm", { armed: false });
    } else if (e.type === "audio") audio.current?.play(e.data);
    else if (e.type === "audio-clear") audio.current?.clear();
    else if (e.type === "dictation-result") report(e.text);
    else if (e.type === "ability-disarmed") setArmed(false);
    else if (e.type === "ability-click") {
      const kind = prefs.current?.ability || "";
      setEffect({ x: e.x, y: e.y, kind });
      setTimeout(() => setEffect(null), 1200);
      setArmed(false);
      void api("ability.arm", { armed: false });
    }
  };
  const { state } = useYami(event);
  useEffect(() => {
    if (state) {
      prefs.current = state.settings;
      keyReady.current = state.keys.gemini;
      document.documentElement.dataset.reduced = String(
        state.settings.reducedMotion,
      );
    }
  }, [state]);
  useEffect(() => {
    audio.current = new AudioEngine(setLevel, (message) => {
      setMode("");
      report(message);
      void api("audio.error", { message });
    });
    return () => {
      audio.current?.stop(true);
      audio.current?.clear();
    };
  }, []);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      api("media")
        .then((value) => {
          if (live) setMedia(value);
        })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  const expand = (value: boolean, next = tab) =>
    void api("panel", { open: value, tab: next });
  if (!state) return null;
  return (
    <div className={`island-window ${open ? "expanded" : ""}`}>
      <div
        className="island-notch"
        onMouseEnter={() => void api("island.mouse", { ignore: false })}
        onMouseLeave={() => {
          if (!open) void api("island.mouse", { ignore: true });
        }}
        onWheel={(e) => {
          if (e.deltaY > 0) expand(true);
          else if (open) expand(false);
        }}
        onDoubleClick={() => void api("show")}
      >
        <button
          className="island-spirit"
          aria-label="Open Yami"
          onClick={() => {
            if (state.settings.ability && status === "idle" && !mode) {
              const next = !armed;
              setArmed(next);
              void api("ability.arm", { armed: next });
            } else expand(!open);
          }}
        >
          <Spirit
            size={mode || status === "speaking" ? 36 : 49}
            soul={state.settings.soul}
            state={mode === "dictation" ? "listening" : status}
          />
        </button>
        {(mode || status !== "idle") && (
          <div className="island-wave" aria-label={mode || status}>
            {Array.from({ length: 9 }, (_, i) => (
              <i
                key={i}
                style={{
                  transform: `scaleY(${0.15 + Math.abs(Math.sin(i * 1.6 + level * 20)) * Math.min(1, Math.max(0.15, level * 8))})`,
                }}
              />
            ))}
          </div>
        )}
        <div className="island-hover-actions">
          <IconButton
            icon="house"
            label="Open Yami"
            onClick={() => void api("show")}
          />
          <IconButton
            icon={open ? "caret-up" : "caret-down"}
            label={open ? "Collapse panel" : "Expand panel"}
            onClick={() => expand(!open)}
          />
        </div>
      </div>
      {!open && media?.active && !toast && (
        <button className="mini-media" onClick={() => expand(true, "Controls")}>
          <Icon name={media.playing ? "music-notes" : "pause"} size={12} />
          <span>{media.title}</span>
        </button>
      )}
      {open && (
        <Utilities
          state={state}
          tab={tab}
          setTab={(t) => expand(true, t)}
          report={report}
        />
      )}{" "}
      {armed && (
        <div className="island-toast">
          {state.settings.ability === "collapse" ? "Collapse" : "Sidearm"} ready
          · {state.settings.abilityButton}
        </div>
      )}
      {toast && <div className="island-toast">{toast}</div>}
      {effect && (
        <div className={"ability-effect " + effect.kind}>
          <span />
        </div>
      )}
    </div>
  );
}
