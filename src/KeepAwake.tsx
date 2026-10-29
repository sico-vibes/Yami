import { useEffect, useState } from "react";
import { api } from "./api";
import { Select } from "./controls";
import { Toggle } from "./ui";

type State = { on: boolean; screen: boolean; until: number };

const lengths = [
  { value: "0", label: "Until I switch it off" },
  { value: "30", label: "For 30 minutes" },
  { value: "60", label: "For 1 hour" },
  { value: "120", label: "For 2 hours" },
  { value: "240", label: "For 4 hours" },
];

/** Controls card: stop Windows sleeping, and the screen turning off. */
export function KeepAwake({ report }: { report: (m: string) => void }) {
  const [state, setState] = useState<State | null>(null),
    [minutes, setMinutes] = useState("0"),
    [screen, setScreen] = useState(false);
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("awake")
      .then(setState)
      .catch(() => {});
    return window.yami.on((e) => {
      if (e.type === "keep-awake") setState(e.state);
    });
  }, []);
  if (!state) return null;
  const start = (m: string, s: boolean) =>
    void api("awake.set", { minutes: Number(m), screen: s })
      .then(setState)
      .catch(fail);
  return (
    <div className="keep-awake">
      <div className="keep-awake-row">
        <div>
          <strong>Keep awake</strong>
          <small>
            {state.on
              ? `${state.screen ? "PC and screen stay on" : "PC stays awake"}${
                  state.until
                    ? ` until ${new Date(state.until).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : ""
                }`
              : "Windows sleeps as usual"}
          </small>
        </div>
        <Toggle
          label="Keep awake"
          value={state.on}
          onChange={(on) =>
            on
              ? start(minutes, screen)
              : void api("awake.stop").then(setState).catch(fail)
          }
        />
      </div>
      <div className="keep-awake-row">
        <Select
          label="How long to keep awake"
          value={minutes}
          onChange={(m) => {
            setMinutes(m);
            if (state.on) start(m, screen);
          }}
          options={lengths}
        />
        <span className="keep-awake-screen">
          Screen too
          <Toggle
            label="Keep the screen on too"
            value={screen}
            onChange={(next) => {
              setScreen(next);
              if (state.on) start(minutes, next);
            }}
          />
        </span>
      </div>
    </div>
  );
}
