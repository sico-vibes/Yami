import { useEffect, useState } from "react";
import type { AppItem, State, UtilityTab } from "./shared";
import { api, asset, bytes, time } from "./api";
import { Empty, Icon, IconButton } from "./ui";
import { Launcher } from "./Launcher";
export const utilityTabs: UtilityTab[] = [
  "Controls",
  "Today",
  "Stats",
  "Clipboard",
  "Apps",
  "Wallpaper",
  "Power",
];
export function Utilities({
  state,
  tab,
  setTab,
  report,
}: {
  state: State;
  tab: UtilityTab;
  setTab: (t: UtilityTab) => void;
  report: (m: string) => void;
}) {
  return (
    <div className="utility-shell">
      <nav className="utility-tabs">
        {utilityTabs.map((t) => (
          <button
            className={tab === t ? "selected" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className={"utility-content utility-" + tab.toLowerCase()}>
        {tab === "Controls" ? (
          <Controls report={report} />
        ) : tab === "Stats" ? (
          <Stats report={report} />
        ) : tab === "Apps" ? (
          <Launcher state={state} report={report} />
        ) : tab === "Wallpaper" ? (
          <Wallpapers state={state} report={report} />
        ) : tab === "Clipboard" ? (
          <Clipboard state={state} report={report} />
        ) : tab === "Power" ? (
          <Power report={report} />
        ) : (
          <Today state={state} report={report} />
        )}
      </div>
    </div>
  );
}
function Controls({ report }: { report: (m: string) => void }) {
  const [controls, setControls] = useState<any>(null),
    [media, setMedia] = useState<any>(null),
    [pending, setPending] = useState("");
  const refresh = () => {
    api("controls")
      .then(setControls)
      .catch((e) => report(e.message));
    api("media")
      .then(setMedia)
      .catch(() => {});
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, []);
  async function change(method: string, args: any) {
    setPending(method);
    try {
      await api("control", { method, args });
      refresh();
    } catch (e) {
      report((e as Error).message);
    } finally {
      setPending("");
    }
  }
  const tile = (
    icon: string,
    title: string,
    sub: string,
    on: boolean,
    click: () => void,
    wide = false,
  ) => (
    <button
      className={`control-tile ${wide ? "wide" : ""}`}
      data-on={on}
      disabled={!!pending || !controls}
      onClick={click}
    >
      <span>
        <Icon name={icon} size={19} />
      </span>
      <div>
        <b>{title}</b>
        <small>{controls ? sub : "Reading…"}</small>
      </div>
      <Icon name="caret-down" size={13} />
    </button>
  );
  return (
    <>
      <div className="controls-grid">
        {tile(
          "wifi-high",
          "Wi-Fi",
          controls?.wifi || "Not connected",
          !!controls?.wifiConnected,
          () => void change("toggleSetting", { setting: "wifi" }),
        )}
        {tile(
          "bluetooth",
          "Bluetooth",
          controls?.bluetooth === undefined
            ? "Settings"
            : controls.bluetooth
              ? "On"
              : "Off",
          !!controls?.bluetooth,
          () => void change("toggleSetting", { setting: "bluetooth" }),
        )}
        {tile(
          "speaker-high",
          "Audio",
          controls?.muted ? "Muted" : "Speakers",
          !!controls && !controls.muted,
          () => void change("settings", { page: "sound" }),
        )}
        {tile(
          "moon",
          "Night Light",
          "Settings",
          false,
          () => void change("toggleSetting", { setting: "nightlight" }),
          true,
        )}
        {tile(
          "circle-half",
          "Dark mode",
          controls?.dark ? "On" : "Off",
          !!controls?.dark,
          () => void change("theme", { dark: !controls?.dark }),
        )}
      </div>
      <div className="volume-slider">
        <Icon
          name={controls?.muted ? "speaker-slash" : "speaker-high"}
          size={17}
        />
        <input
          aria-label="Volume"
          disabled={!controls || !!pending}
          type="range"
          min="0"
          max="100"
          value={controls?.volume || 0}
          style={
            { "--value": `${controls?.volume || 0}%` } as React.CSSProperties
          }
          onChange={(e) =>
            setControls({ ...controls, volume: Number(e.target.value) })
          }
          onPointerUp={(e) =>
            void change("volume", { value: Number(e.currentTarget.value) })
          }
          onKeyUp={(e) =>
            void change("volume", { value: Number(e.currentTarget.value) })
          }
        />
        <b>{controls ? controls.volume + "%" : "—"}</b>
      </div>
      {controls?.brightness >= 0 && (
        <div className="brightness-slider">
          <Icon name="sun" size={17} />
          <input
            aria-label="Brightness"
            type="range"
            min="0"
            max="100"
            defaultValue={controls.brightness}
            onPointerUp={(e) =>
              void change("brightness", {
                value: Number(e.currentTarget.value),
              })
            }
            onKeyUp={(e) =>
              void change("brightness", {
                value: Number(e.currentTarget.value),
              })
            }
          />
        </div>
      )}
      <div className="media-player">
        <small>
          <Icon name="speaker-high" size={11} /> Speakers
        </small>
        <div className="media-row">
          <div className="album-art">
            <Icon name="music-notes" size={27} />
          </div>
          <div className="media-track">
            <b>{media?.active ? media.title : "Nothing playing"}</b>
            <span>
              {media?.active ? media.artist : "Your Windows media appears here"}
            </span>
          </div>
          <IconButton
            icon="skip-back"
            label="Previous track"
            onClick={() => void change("mediaKey", { action: "previous" })}
          />
          <button
            className="play-button"
            aria-label={media?.playing ? "Pause" : "Play"}
            onClick={() => void change("mediaKey", { action: "play_pause" })}
          >
            <Icon name={media?.playing ? "pause" : "play"} fill />
          </button>
          <IconButton
            icon="skip-forward"
            label="Next track"
            onClick={() => void change("mediaKey", { action: "next" })}
          />
        </div>
        <div className="track-progress">
          <span>{formatTime(media?.position || 0)}</span>
          <progress
            max={Math.max(1, media?.duration || 1)}
            value={media?.position || 0}
          />
          <span>{formatTime(media?.duration || 0)}</span>
        </div>
      </div>
    </>
  );
}
function formatTime(t: number) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}
function Stats({ report }: { report: (m: string) => void }) {
  const [data, setData] = useState<any>(null),
    [speed, setSpeed] = useState<any>(null),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    const refresh = () =>
      api("metrics")
        .then(setData)
        .catch((e) => report(e.message));
    refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, []);
  function gauge(
    label: string,
    value: number | null,
    name: string,
    sub: string,
    color: string,
  ) {
    return (
      <div className="stat-gauge">
        <div
          className="gauge"
          style={
            {
              "--percent": `${value ?? 0}%`,
              "--gauge-color": color,
            } as React.CSSProperties
          }
        >
          <b>{value === null ? "—" : Math.round(value) + "%"}</b>
        </div>
        <strong>{label}</strong>
        <small>{name}</small>
        <span className="stat-chip">{sub}</span>
      </div>
    );
  }
  return data ? (
    <div className="stats-layout">
      <div className="stats-primary">
        {gauge(
          "CPU",
          data.cpu.load,
          data.cpu.name,
          data.cpu.speed + " GHz",
          "#c7ad5b",
        )}
        {gauge(
          "GPU",
          data.gpu[0]?.load ?? null,
          data.gpu[0]?.name || "Not reported",
          data.gpu[0]?.used != null
            ? `${data.gpu[0].used} / ${data.gpu[0].total} MB`
            : "Usage not reported",
          "#b696d3",
        )}
        {gauge(
          "RAM",
          (data.memory.used / data.memory.total) * 100,
          `${bytes(data.memory.used)} / ${bytes(data.memory.total)}`,
          bytes(data.memory.available) + " free",
          "#b3ce85",
        )}
      </div>
      <div className="process-list">
        <div>
          <span>Top apps · RAM</span>
          <small>CPU ⇄</small>
        </div>
        {data.processes.map((p: any) => (
          <div key={p.name}>
            <span className="app-letter">{p.name[0]?.toUpperCase()}</span>
            <b>{p.name}</b>
            <span>{bytes(p.memory)}</span>
          </div>
        ))}
      </div>
      <div className="stats-bottom">
        <div>
          <small>DISK {data.disks[0]?.name}</small>
          <b>
            {bytes(data.disks[0]?.used)} / {bytes(data.disks[0]?.total)}
          </b>
        </div>
        <div>
          <small>NETWORK</small>
          <b>
            ↓ {bytes(data.network.rx)}/s ↑ {bytes(data.network.tx)}/s
          </b>
        </div>
        <div>
          <small>UP FOR</small>
          <b>
            {Math.floor(data.uptime / 3600)} h{" "}
            {Math.floor((data.uptime % 3600) / 60)} m
          </b>
        </div>
      </div>
      <div className="speed-card">
        <small>Internet speed</small>
        <div>
          <b>{speed?.download?.toFixed(0) || "—"}</b>
          <span>Mbps ↓</span>
          <b>{speed?.upload?.toFixed(0) || "—"}</b>
          <span>Mbps ↑</span>
        </div>
        <button
          className="gold-button"
          disabled={testing}
          onClick={async () => {
            if (import.meta.env.VITE_YAMI_PREVIEW === "true") {
              report("Speed tests run only in the Windows app. No network test was started.");
              return;
            }
            if (
              !window.confirm(
                "M-Lab publishes speed-test results, including your IP address, in an open dataset. The test transfers real data. Agree and run?",
              )
            )
              return;
            setTesting(true);
            try {
              const module: any = await import("@m-lab/ndt7");
              const ndt7 = module.default || module;
              await ndt7.test(
                {
                  userAcceptedDataPolicy: true,
                  downloadworkerfile: new URL(
                    "ndt7-download-worker.js",
                    location.href,
                  ).href,
                  uploadworkerfile: new URL(
                    "ndt7-upload-worker.js",
                    location.href,
                  ).href,
                },
                {
                  downloadMeasurement: (r: any) => {
                    if (r.Source === "client")
                      setSpeed((s: any) => ({
                        ...s,
                        download: r.Data?.MeanClientMbps,
                      }));
                  },
                  uploadMeasurement: (r: any) => {
                    if (r.Source === "client")
                      setSpeed((s: any) => ({
                        ...s,
                        upload: r.Data?.MeanClientMbps,
                      }));
                  },
                },
              );
            } catch (e) {
              report((e as Error).message);
            } finally {
              setTesting(false);
            }
          }}
        >
          <Icon name={testing ? "circle-notch" : "play"} size={12} />
          {testing ? "Testing…" : "Run speed test"}
        </button>
      </div>
    </div>
  ) : (
    <div className="loading">Reading your PC…</div>
  );
}
function Wallpapers({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [folder, setFolder] = useState(false),
    [selected, setSelected] = useState(state.currentWallpaper),
    [applying, setApplying] = useState(false);
  const files =
    folder && state.wallpaperFolder
      ? state.wallpapers.filter((p) => p.startsWith(state.wallpaperFolder))
      : state.wallpapers;
  return (
    <>
      <div className="wallpaper-toolbar">
        <button
          className={!folder ? "selected" : ""}
          onClick={() => setFolder(false)}
        >
          Recent
        </button>
        <button
          className={folder ? "selected" : ""}
          onClick={() => setFolder(true)}
        >
          My folder
        </button>
        <small>{files.length} pictures</small>
        <IconButton
          icon="folder-open"
          label="Choose wallpaper folder"
          onClick={() =>
            void api("wallpapers.folder").catch((e) => report(e.message))
          }
        />
      </div>
      <div className="wallpaper-fan">
        {files.slice(0, 30).map((p, i) => (
          <button
            key={p}
            className={selected === p ? "selected" : ""}
            style={{ "--order": i } as React.CSSProperties}
            title={"Apply " + p.split(/[\\/]/).pop()}
            disabled={applying}
            onClick={async () => {
              setApplying(true);
              try {
                await api("wallpapers.apply", { path: p });
                setSelected(p);
              } catch (e) {
                report((e as Error).message);
              } finally {
                setApplying(false);
              }
            }}
          >
            <img src={asset(p)} alt={p.split(/[\\/]/).pop()} />
            {selected === p && (
              <span>
                <Icon name="check" size={16} />
              </span>
            )}
          </button>
        ))}
      </div>
      {!files.length && (
        <Empty icon="image" title="Choose a wallpaper folder">
          Your pictures stay on your PC.
        </Empty>
      )}
    </>
  );
}
function Clipboard({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const items = state.clipboard
    .filter((c) => c.text.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <>
      <div className="clipboard-toolbar">
        <label className="search-field">
          <Icon name="magnifying-glass" size={17} />
          <input
            placeholder="Search clipboard"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          onClick={() => void api("clipboard.clear")}
        >
          Clear all
        </button>
      </div>
      <div className="clipboard-scroll">
        {items.map((c) => (
          <div className="clipboard-item" key={c.id}>
            <button
              className="clipboard-text"
              onClick={() =>
                void api("clipboard.copy", { id: c.id }).then(() =>
                  report("Copied."),
                )
              }
            >
              {c.text}
              <small>{new Date(c.at).toLocaleString()}</small>
            </button>
            <IconButton
              icon="push-pin"
              label={c.pinned ? "Unpin" : "Pin"}
              active={c.pinned}
              onClick={() => void api("clipboard.pin", { id: c.id })}
            />
            <IconButton
              icon="trash"
              label="Delete clipboard item"
              onClick={() => void api("clipboard.delete", { id: c.id })}
            />
          </div>
        ))}
        {!items.length && (
          <Empty
            icon="clipboard-text"
            title={
              state.settings.clipboardEnabled
                ? "Nothing copied yet"
                : "Clipboard history is off"
            }
          >
            Copied text appears here while Yami is running.
          </Empty>
        )}
      </div>
    </>
  );
}
function Power({ report }: { report: (m: string) => void }) {
  return (
    <div className="power-grid">
      {[
        ["lock-key", "Lock", "lock"],
        ["moon", "Sleep", "sleep"],
        ["arrow-clockwise", "Restart", "restart"],
        ["power", "Shut down", "shutdown"],
      ].map(([icon, title, action]) => (
        <button
          key={action}
          onClick={() =>
            void api("power", { action }).catch((e) => report(e.message))
          }
        >
          <Icon name={icon} size={27} />
          <b>{title}</b>
        </button>
      ))}
    </div>
  );
}
function Today({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [text, setText] = useState(""),
    [weather, setWeather] = useState<any>();
  useEffect(() => {
    if (state.settings.weatherEnabled)
      api("weather")
        .then(setWeather)
        .catch((e) => report(e.message));
  }, [state.settings.weatherEnabled]);
  return (
    <div className="today-grid">
      <div className="today-heading">
        <span>
          {new Date().toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
        {weather && (
          <b>
            {Math.round(weather.temperature)}° · {weather.place}
          </b>
        )}
      </div>
      <section>
        <h3>
          To-do list{" "}
          <small>
            {state.todos.filter((t) => t.done).length}/{state.todos.length}
          </small>
        </h3>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim())
              void api("todo.add", { title: text.trim() }).then(() =>
                setText(""),
              );
          }}
        >
          <input
            placeholder="Add a to-do"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <IconButton
            icon="plus"
            label="Add to-do"
            onClick={() => {
              if (text.trim())
                void api("todo.add", { title: text.trim() }).then(() =>
                  setText(""),
                );
            }}
          />
        </form>
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
      </section>
      <section>
        <h3>Coming up</h3>
        {state.tasks
          .filter((t) => t.enabled)
          .slice(0, 5)
          .map((t) => (
            <div className="agenda-row" key={t.id}>
              <Icon name={t.repeat === "none" ? "calendar" : "repeat"} />
              <div>
                <b>{t.title}</b>
                <small>
                  {new Date(t.at).toLocaleDateString()} · {time(t.at)}
                </small>
              </div>
            </div>
          ))}
        {!state.tasks.some((t) => t.enabled) && (
          <p className="muted">Nothing scheduled.</p>
        )}
        <button
          className="text-button"
          onClick={() => void api("show", { tab: "desk" })}
        >
          Open plans <Icon name="arrow-up-right" size={14} />
        </button>
      </section>
    </div>
  );
}
