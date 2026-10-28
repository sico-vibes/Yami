import { useState } from "react";
import { api } from "./api";
import { Icon, IconButton } from "./ui";

type App = {
  pid: number;
  name: string;
  volume: number;
  muted: boolean;
  active: boolean;
};

/** Per-app volume for apps with sound; read only when opened. */
export function AppVolumes({ report }: { report: (m: string) => void }) {
  const [open, setOpen] = useState(false),
    [apps, setApps] = useState<App[] | null>(null);
  const fail = (e: Error) => report(e.message);
  const load = () => void api("audio.apps").then(setApps).catch(fail);
  const set = (pid: number, change: { volume?: number; muted?: boolean }) =>
    void api("audio.app", { pid, ...change })
      .then(setApps)
      .catch(fail);
  return (
    <div className="app-volumes">
      <button
        type="button"
        className="text-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
      >
        <Icon name={open ? "caret-up" : "caret-down"} size={12} />
        App volume
      </button>
      {open &&
        (apps === null ? (
          <small className="setting-note">Reading apps…</small>
        ) : !apps.length ? (
          <small className="setting-note">No app is making sound.</small>
        ) : (
          apps.map((a) => (
            <div className="app-volume" key={a.pid}>
              <span className={a.active ? "playing" : ""}>{a.name}</span>
              <input
                type="range"
                min="0"
                max="100"
                aria-label={`${a.name} volume`}
                defaultValue={a.volume}
                style={{ "--value": `${a.volume}%` } as React.CSSProperties}
                onChange={(e) =>
                  e.currentTarget.style.setProperty(
                    "--value",
                    `${e.currentTarget.value}%`,
                  )
                }
                onPointerUp={(e) =>
                  set(a.pid, { volume: Number(e.currentTarget.value) })
                }
                onKeyUp={(e) =>
                  set(a.pid, { volume: Number(e.currentTarget.value) })
                }
              />
              <IconButton
                icon={a.muted ? "speaker-slash" : "speaker-high"}
                label={a.muted ? `Unmute ${a.name}` : `Mute ${a.name}`}
                active={a.muted}
                onClick={() => set(a.pid, { muted: !a.muted })}
              />
            </div>
          ))
        ))}
    </div>
  );
}
