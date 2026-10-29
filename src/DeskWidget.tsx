import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon, IconButton } from "./ui";
import { mediaControl } from "./media";
import { activeAgents } from "./agent-rank";
import { weatherLook } from "./weather-look";
import type { State as AppState } from "./shared";
import type { AgentSession, WorkbenchState } from "./workbench-types";

const phaseWords: Partial<Record<AgentSession["phase"], string>> = {
  waiting: "needs you",
  error: "hit an error",
  working: "working",
  thinking: "thinking",
};

/**
 * The desk widget card. The clock wakes once a minute, weather once every
 * half hour, and media only on the same events as the island (and every
 * 15 seconds while something plays). Nothing animates.
 */
export function DeskWidget() {
  const [state, setState] = useState<AppState>(),
    [now, setNow] = useState(() => new Date()),
    [weather, setWeather] = useState<any>(),
    [media, setMedia] = useState<any>(),
    [agents, setAgents] = useState<AgentSession[]>([]);
  const card = useRef<HTMLElement>(null);
  // The window follows the card's height as rows come and go.
  useEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(([entry]) => {
      void api("widget.fit", {
        height: entry.target.getBoundingClientRect().height,
      }).catch(() => {});
    });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const at = new Date();
      setNow(at);
      timer = setTimeout(tick, 60_000 - (at.getTime() % 60_000) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    void api("state")
      .then(setState)
      .catch(() => {});
    const readMedia = () =>
      void api("media")
        .then(setMedia)
        .catch(() => {});
    readMedia();
    const off = window.yami.on((e) => {
      if (e.type === "state") setState(e.state);
      if (e.type === "foreground") readMedia();
      if (e.type === "agent-activity") setAgents(e.sessions || []);
    });
    return off;
  }, []);
  const weatherOn = !!state?.settings.weatherEnabled,
    agentsOn = !!state?.settings.workbenchEnabled;
  useEffect(() => {
    if (!weatherOn) return setWeather(undefined);
    const read = () =>
      void api("weather")
        .then(setWeather)
        .catch(() => {});
    read();
    const timer = setInterval(read, 30 * 60_000);
    return () => clearInterval(timer);
  }, [weatherOn]);
  useEffect(() => {
    if (!agentsOn) return setAgents([]);
    void api("workbench.state")
      .then((w: WorkbenchState) => setAgents(activeAgents(w.sessions)))
      .catch(() => {});
  }, [agentsOn]);
  useEffect(() => {
    if (!media?.playing) return;
    const timer = setInterval(
      () =>
        void api("media")
          .then(setMedia)
          .catch(() => {}),
      15_000,
    );
    return () => clearInterval(timer);
  }, [media?.playing]);
  const look = weatherLook(weather?.condition);
  const act = (action: "toggle" | "next") =>
    void mediaControl(action)
      .then(setMedia)
      .catch(() => {});
  const style = state?.settings.deskWidgetStyle || "card";
  if (style === "clock" || style === "analog")
    return (
      <main
        ref={card}
        className={`desk-widget desk-${style}`}
        aria-label="Yami desk clock"
      >
        {style === "analog" ? (
          <ClockFace at={now} />
        ) : (
          <time className="desk-big-clock" dateTime={now.toISOString()}>
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </time>
        )}
        <small>
          {now.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {weather ? ` · ${Math.round(weather.temperature)}°` : ""}
        </small>
      </main>
    );
  return (
    <main ref={card} className="desk-widget" aria-label="Yami desk widget">
      <header>
        <div>
          <time className="desk-clock" dateTime={now.toISOString()}>
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </time>
          <small>
            {now.toLocaleDateString([], {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </small>
        </div>
        {weather && (
          <div className="desk-weather">
            <Icon name={look.icon} size={22} />
            <b>{Math.round(weather.temperature)}°</b>
            <small>{look.label || weather.place}</small>
          </div>
        )}
      </header>
      {media?.active && (
        <section className="desk-media">
          <Icon name="music-notes" size={16} />
          <div>
            <strong>{media.title}</strong>
            <small>{media.artist}</small>
          </div>
          <IconButton
            icon={media.playing ? "pause" : "play"}
            label={media.playing ? "Pause" : "Play"}
            onClick={() => act("toggle")}
          />
          <IconButton
            icon="skip-forward"
            label="Next track"
            onClick={() => act("next")}
          />
        </section>
      )}
      {agents.length > 0 && (
        <section className="desk-agents" aria-label="Active agents">
          {agents.slice(0, 2).map((a) => (
            <p key={a.id} data-phase={a.phase}>
              <span className="desk-dot" />
              <b>{a.agent}</b> {phaseWords[a.phase] || a.phase}
              {a.project ? ` · ${a.project}` : ""}
            </p>
          ))}
        </section>
      )}
      {!media?.active && !agents.length && (
        <p className="desk-quiet">All quiet.</p>
      )}
    </main>
  );
}

/** A clock face with hour and minute hands; it moves once a minute. */
function ClockFace({ at }: { at: Date }) {
  const minutes = at.getMinutes(),
    hours = (at.getHours() % 12) + minutes / 60;
  const hand = (deg: number, length: number, className: string) => (
    <line
      className={className}
      x1="50"
      y1="50"
      x2={50 + length * Math.sin((deg * Math.PI) / 180)}
      y2={50 - length * Math.cos((deg * Math.PI) / 180)}
    />
  );
  return (
    <svg
      className="desk-face"
      viewBox="0 0 100 100"
      role="img"
      aria-label={at.toLocaleTimeString()}
    >
      <circle className="face" cx="50" cy="50" r="46" />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          className={i % 3 ? "tick" : "tick major"}
          x1="50"
          y1="8"
          x2="50"
          y2={i % 3 ? 12 : 15}
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      {hand(hours * 30, 24, "hour")}
      {hand(minutes * 6, 34, "minute")}
      <circle className="pin" cx="50" cy="50" r="2.6" />
    </svg>
  );
}
