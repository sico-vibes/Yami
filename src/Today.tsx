import { useEffect, useMemo, useState } from "react";
import type { State, Task } from "./shared";
import { api, time } from "./api";
import { Icon, IconButton } from "./ui";

const PRESETS = [1, 5, 10, 15, 30];
const DAY = 86_400_000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
// MET Norway symbol codes, e.g. "partlycloudy_day" or "lightrainshowers_night".
function weatherLook(code = "") {
  const night = code.endsWith("_night"),
    base = code.replace(/_(day|night|polartwilight)$/, "");
  const icon = /thunder/.test(base)
    ? "cloud-lightning"
    : /snow|sleet/.test(base)
      ? "snowflake"
      : /rain|drizzle/.test(base)
        ? "cloud-rain"
        : /fog/.test(base)
          ? "cloud-fog"
          : base === "cloudy"
            ? "cloud"
            : base === "clearsky"
              ? night
                ? "moon-stars"
                : "sun"
              : night
                ? "cloud-moon"
                : "cloud-sun";
  const label = base
    .replace(/heavy|light/, (m) => m + " ")
    .replace(/partly|clear/, (m) => m + " ")
    .replace(/showers|and/, (m) => " " + m + " ")
    .replace(/\s+/g, " ")
    .trim();
  return { icon, label: label ? label[0].toUpperCase() + label.slice(1) : "" };
}
function occursOn(task: Task, day: Date) {
  const at = new Date(task.at);
  if (task.repeat === "daily") return at.getTime() < day.getTime() + DAY;
  if (task.repeat === "weekly")
    return at.getDay() === day.getDay() && at.getTime() < day.getTime() + DAY;
  return sameDay(at, day);
}
const pad = (n: number) => String(n).padStart(2, "0");

export function Today({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [now, setNow] = useState(() => new Date()),
    [text, setText] = useState(""),
    [weather, setWeather] = useState<any>(),
    [picked, setPicked] = useState(() => new Date()),
    [minutes, setMinutes] = useState(5),
    [timer, setTimer] = useState({ endsAt: 0, duration: 0 });
  // The panel is only mounted while it is open, so this tick stops with it.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    void api("timer.state")
      .then(setTimer)
      .catch(() => {});
    return window.yami.on((e) => {
      if (e.type === "timer")
        setTimer({ endsAt: e.endsAt, duration: e.duration });
    });
  }, []);
  useEffect(() => {
    if (state.settings.weatherEnabled)
      api("weather")
        .then(setWeather)
        .catch((e) => report(e.message));
  }, [state.settings.weatherEnabled]);
  const week = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from(
      { length: 7 },
      (_, i) => new Date(start.getTime() + i * DAY),
    );
  }, [now.toDateString()]);
  const dayStart = new Date(picked);
  dayStart.setHours(0, 0, 0, 0);
  const agenda = state.tasks.filter((t) => t.enabled && occursOn(t, dayStart));
  const left = timer.endsAt ? Math.max(0, timer.endsAt - now.getTime()) : 0,
    shown = timer.endsAt ? left : minutes * 60_000,
    progress = timer.endsAt && timer.duration ? left / timer.duration : 1;
  const look = weatherLook(weather?.condition);
  const add = () => {
    if (text.trim())
      void api("todo.add", { title: text.trim() }).then(() => setText(""));
  };
  return (
    <div className="today-grid">
      <div className="today-column">
        <section className="today-clock">
          <b>{pad(now.getHours())}</b>
          <b>{pad(now.getMinutes())}</b>
          <small>
            {now.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </small>
        </section>
        <section className="today-weather">
          {weather ? (
            <>
              <Icon name={look.icon} size={26} />
              <b>{Math.round(weather.temperature)}°C</b>
              <small>{look.label || weather.place}</small>
            </>
          ) : (
            <button
              className="text-button"
              onClick={() => void api("show", { tab: "settings" })}
            >
              <Icon name="cloud-sun" size={22} />
              <small>
                {state.settings.weatherEnabled
                  ? "Weather unavailable"
                  : "Turn on weather"}
              </small>
            </button>
          )}
        </section>
      </div>
      <div className="today-column">
        <section>
          <h3>
            This week
            <small>
              {week[0].toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {week[6].toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </small>
          </h3>
          <div className="week-strip">
            {week.map((d) => (
              <button
                key={d.toDateString()}
                className={`${sameDay(d, now) ? "today" : ""} ${sameDay(d, picked) ? "picked" : ""}`}
                aria-pressed={sameDay(d, picked)}
                onClick={() => setPicked(d)}
              >
                <small>{d.toLocaleDateString([], { weekday: "narrow" })}</small>
                <b>{d.getDate()}</b>
                {state.tasks.some((t) => t.enabled && occursOn(t, d)) && <i />}
              </button>
            ))}
          </div>
          <div className="week-agenda">
            {agenda.slice(0, 3).map((t) => (
              <div className="agenda-row" key={t.id}>
                <Icon name={t.repeat === "none" ? "calendar" : "repeat"} />
                <div>
                  <b>{t.title}</b>
                  <small>{time(t.at)}</small>
                </div>
              </div>
            ))}
            {!agenda.length && <p className="muted">Nothing planned.</p>}
          </div>
        </section>
        <section className="focus-timer">
          <div
            className="focus-dial"
            style={{ "--progress": progress } as React.CSSProperties}
            role="timer"
            aria-label="Focus timer"
          >
            <b>
              {pad(Math.floor(shown / 60_000))}:
              {pad(Math.floor((shown % 60_000) / 1000))}
            </b>
          </div>
          <div className="focus-controls">
            <div className="focus-presets">
              {PRESETS.map((m) => (
                <button
                  key={m}
                  className={!timer.endsAt && minutes === m ? "selected" : ""}
                  disabled={!!timer.endsAt}
                  onClick={() => setMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="focus-actions">
              <button
                className="gold-button"
                onClick={() =>
                  void api(timer.endsAt ? "timer.stop" : "timer.start", {
                    minutes,
                  })
                    .then(setTimer)
                    .catch((e) => report(e.message))
                }
              >
                {timer.endsAt ? "Stop" : "Start"}
              </button>
              <button
                onClick={() => {
                  setMinutes(5);
                  if (timer.endsAt) void api("timer.stop").then(setTimer);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="today-todos">
        <h3>
          Today
          <small>
            {state.todos.filter((t) => t.done).length}/{state.todos.length}
          </small>
        </h3>
        <div className="todo-list">
          {state.todos.map((t) => (
            <div className="todo-row" key={t.id}>
              <button
                className={`check-circle ${t.done ? "checked" : ""}`}
                aria-label={t.done ? "Mark incomplete" : "Complete to-do"}
                onClick={() => void api("todo.toggle", { id: t.id })}
              >
                {t.done && <Icon name="check" size={12} />}
              </button>
              <span className={t.done ? "done" : ""}>{t.title}</span>
              <IconButton
                icon="x"
                label="Delete to-do"
                onClick={() => void api("todo.delete", { id: t.id })}
              />
            </div>
          ))}
          {!state.todos.length && <p className="muted">All clear.</p>}
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            placeholder="Add a to-do"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <IconButton icon="plus" label="Add to-do" onClick={add} />
        </form>
      </section>
    </div>
  );
}
