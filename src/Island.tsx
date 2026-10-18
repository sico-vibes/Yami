import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { State, UtilityTab, YamiEvent } from "./shared";
import { Icon, Spirit, useYami } from "./ui";
import { AudioEngine } from "./audio";
import { Utilities } from "./Utilities";
import { MediaPeek } from "./MediaPeek";
import type { AgentSession } from "./workbench-types";
export function Island() {
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<UtilityTab>("Controls"),
    [status, setStatus] = useState("idle"),
    [level, setLevel] = useState(0),
    [toast, setToast] = useState(""),
    [mode, setMode] = useState(""),
    [media, setMedia] = useState<any>(null),
    [armed, setArmed] = useState(false),
    [peek, setPeek] = useState(false),
    [notchHover, setNotchHover] = useState(false),
    [asleep, setAsleep] = useState(false),
    [closing, setClosing] = useState(false),
    [activity, setActivity] = useState<{
      id: number;
      label: string;
      icon: string;
    } | null>(null),
    [effect, setEffect] = useState<{
      x: number;
      y: number;
      kind: string;
    } | null>(null);
  const prefs = useRef<State["settings"] | null>(null),
    audio = useRef<AudioEngine | null>(null),
    toastTimer = useRef<any>(null),
    clickTimer = useRef<any>(null),
    openRef = useRef(false);
  const keyReady = useRef(false);
  // The collapsed island is too small for messages, so they go to the
  // caption pill at the bottom of the screen; the open drawer shows its own.
  function report(message: string) {
    if (!openRef.current) {
      void api("caption.notice", { message });
      return;
    }
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }
  const start = (kind: "voice" | "dictation", target = 0, oneShot = false) => {
    if (!prefs.current) return;
    if (
      !keyReady.current &&
      !(kind === "dictation" && prefs.current.dictationEngine === "windows")
    ) {
      // The main process shows the missing-key notice in the caption pill.
      if (openRef.current) report("Connect your Gemini API key in Settings.");
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
    if (e.type === "agent-activity") setAgent(e.session);
    else if (e.type === "panel") {
      openRef.current = e.open;
      setOpen(e.open);
      setClosing(false);
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
    else if (e.type === "dictation-result") {
      // The caption pill already shows the dictated text.
      if (openRef.current) report(e.text);
    } else if (e.type === "ability-disarmed") setArmed(false);
    else if (e.type === "activity")
      setActivity((current) =>
        e.done ? (current?.id === e.id ? null : current) : (e as any),
      );
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
  // Media is read on demand: at start, when the foreground app changes, on
  // hover and when the panel closes. It only polls while something plays.
  const refreshMedia = useRef(() => {});
  useEffect(() => {
    let live = true;
    refreshMedia.current = () =>
      void api("media")
        .then((value) => {
          if (live) setMedia(value);
        })
        .catch(() => {});
    refreshMedia.current();
    const off = window.yami.on((e) => {
      if (e.type === "foreground") refreshMedia.current();
    });
    return () => {
      live = false;
      off();
    };
  }, []);
  useEffect(() => {
    if (!media?.active) return;
    const timer = setInterval(() => refreshMedia.current(), 15000);
    return () => clearInterval(timer);
  }, [media?.active]);
  useEffect(() => {
    if (!open) refreshMedia.current();
  }, [open]);
  // Opening grows the drawer out of the notch; closing plays the reverse
  // before the window shrinks back.
  const expand = (value: boolean, next = tab) => {
    if (value || !openRef.current) {
      void api("panel", { open: value, tab: next });
      return;
    }
    if (closing) return;
    setClosing(true);
    setTimeout(() => void api("panel", { open: false, tab: next }), 190);
  };
  // After a quiet spell the notch slims down to a bar; any activity or a
  // hover brings Yami back. One timeout per change, no polling.
  const quiet =
    !open &&
    !mode &&
    status === "idle" &&
    !activity &&
    !agent &&
    !toast &&
    !peek &&
    !notchHover &&
    !armed;
  useEffect(() => {
    if (!quiet) {
      setAsleep(false);
      return;
    }
    const id = setTimeout(() => setAsleep(true), 8000);
    return () => clearTimeout(id);
  }, [quiet]);
  const arm = () => {
    if (!state?.settings.ability || status !== "idle" || mode) return;
    const next = !armed;
    setArmed(next);
    void api("ability.arm", { armed: next });
    if (next)
      void api("caption.notice", {
        message: `${state.settings.ability === "collapse" ? "Collapse" : "Sidearm"} ready · ${state.settings.abilityButton}`,
      });
  };
  if (!state) return null;
  const currentActivity =
    activity ||
    (agent
      ? {
          icon: agent.phase === "waiting" ? "hand" : "robot",
          label: `${agent.agent} · ${agent.detail}`,
        }
      : null);
  return (
    <div
      className={`island-window ${open ? "expanded" : ""} ${closing ? "closing" : ""} ${asleep ? "asleep" : ""} ${armed ? "armed" : ""}`}
    >
      <div
        className="island-notch"
        role="button"
        tabIndex={0}
        aria-label="Yami. Click to open the drawer, double-click to open the app."
        onMouseEnter={() => {
          void api("island.mouse", { ignore: false });
          setNotchHover(true);
          refreshMedia.current();
        }}
        onMouseLeave={() => {
          setNotchHover(false);
          if (!open) void api("island.mouse", { ignore: true });
        }}
        onWheel={(e) => {
          if (e.deltaY > 0) expand(true);
          else if (open) expand(false);
        }}
        onClick={(e) => {
          clearTimeout(clickTimer.current);
          if (e.detail >= 2) {
            void api("show");
            return;
          }
          clickTimer.current = setTimeout(() => expand(!open), 220);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            expand(!open);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          arm();
        }}
      >
        <span className="island-spirit">
          <Spirit
            size={mode || status === "speaking" ? 36 : 49}
            soul={state.settings.soul}
            state={
              mode === "dictation"
                ? "listening"
                : status === "idle" &&
                    agent &&
                    ["thinking", "working"].includes(agent.phase)
                  ? "thinking"
                  : status
            }
          />
        </span>
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
      </div>
      {!open && currentActivity && !toast && (
        <div className="island-activity" role="status">
          <Icon name={currentActivity.icon} size={12} />
          <span>{currentActivity.label}</span>
        </div>
      )}
      {!open && peek && media?.active && (
        <MediaPeek
          media={media}
          onMedia={setMedia}
          onOpen={() => {
            setPeek(false);
            expand(true, "Controls");
          }}
          onLeave={() => {
            setPeek(false);
            void api("island.peek", { open: false });
          }}
        />
      )}
      {!open &&
        notchHover &&
        !peek &&
        !currentActivity &&
        !toast &&
        !media?.active && (
          <div className="island-scroll-hint" aria-hidden="true">
            <Icon name="caret-double-down" size={11} /> Scroll for more
          </div>
        )}
      {!open &&
        !asleep &&
        !peek &&
        media?.active &&
        !toast &&
        !currentActivity && (
          <button
            className="mini-media"
            onClick={() => expand(true, "Controls")}
            onMouseEnter={() => {
              setPeek(true);
              void api("island.peek", { open: true });
            }}
          >
            <Icon name={media.playing ? "music-notes" : "pause"} size={12} />
            <span>{media.title}</span>
          </button>
        )}
      {open && (
        <Utilities
          state={state}
          tab={tab}
          setTab={(t) => expand(true, t)}
          onClose={() => expand(false)}
          report={report}
        />
      )}
      {toast && open && <div className="island-toast">{toast}</div>}
      {effect && (
        <div className={"ability-effect " + effect.kind}>
          <span />
        </div>
      )}
    </div>
  );
}
