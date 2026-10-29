import { useEffect, useState } from "react";
import { api } from "./api";
import { Select } from "./controls";
import { defaultSites, type FocusChoice } from "./focus";
import { Toggle } from "./ui";

type Station = { id: string; name: string; country: string; tags: string };
const KEY = "yami-focus-choice";

/** The focus options, remembered on this PC between sessions. */
export function useFocusChoice() {
  const [choice, setChoice] = useState<FocusChoice>(() => {
    try {
      return {
        awake: false,
        block: false,
        sites: defaultSites,
        ...JSON.parse(localStorage.getItem(KEY) || "{}"),
      };
    } catch {
      return { awake: false, block: false, sites: defaultSites };
    }
  });
  const update = (next: Partial<FocusChoice>) =>
    setChoice((c) => {
      const merged = { ...c, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  return { choice, update };
}

/**
 * What a focus session does besides counting down: keep the PC awake, play
 * a kept radio station, block distracting sites through the network shield.
 */
export function FocusOptions({
  focus,
  running,
}: {
  focus: ReturnType<typeof useFocusChoice>;
  running: boolean;
}) {
  const { choice, update } = focus;
  const [stations, setStations] = useState<Station[]>([]),
    [shield, setShield] = useState(false);
  useEffect(() => {
    void api("radio.favourites")
      .then(setStations)
      .catch(() => {});
    void api("tune.shield")
      .then((s) => setShield(!!s.running))
      .catch(() => setShield(false));
  }, []);
  return (
    <div className="focus-options">
      <label className="focus-option">
        Keep awake
        <Toggle
          label="Keep the PC awake during focus"
          value={choice.awake}
          disabled={running}
          onChange={(awake) => update({ awake })}
        />
      </label>
      {!!stations.length && (
        <Select
          label="Radio during focus"
          value={choice.station?.id || ""}
          disabled={running}
          onChange={(id) =>
            update({ station: stations.find((s) => s.id === id) })
          }
          options={[
            { value: "", label: "No radio", icon: "speaker-slash" },
            ...stations.map((s) => ({
              value: s.id,
              label: s.name,
              icon: "radio",
            })),
          ]}
        />
      )}
      <label
        className="focus-option"
        data-tip={
          shield ? undefined : "Turn on Tune › Network shield to block sites"
        }
      >
        Block sites
        <Toggle
          label="Block distracting sites during focus"
          value={choice.block && shield}
          disabled={running || !shield}
          onChange={(block) => update({ block })}
        />
      </label>
      {choice.block && shield && !running && (
        <input
          className="focus-sites"
          aria-label="Sites to block during focus"
          value={choice.sites}
          onChange={(e) => update({ sites: e.target.value })}
        />
      )}
    </div>
  );
}
