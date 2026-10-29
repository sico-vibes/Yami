import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon, IconButton } from "./ui";
import {
  onRadio,
  playStation,
  radioState,
  setRadioVolume,
  stopRadio,
  type RadioState,
} from "./radio-player";

type Station = {
  id: string;
  name: string;
  country: string;
  tags: string;
  codec: string;
  bitrate: number;
};

/**
 * Drawer › Radio: search Radio Browser's community directory, play a
 * station in Yami, and keep favourites. Playback keeps going when the
 * drawer closes; Stop ends the stream.
 */
export function RadioPanel({ report }: { report: (m: string) => void }) {
  const [query, setQuery] = useState(""),
    [stations, setStations] = useState<Station[] | null>(null),
    [favourites, setFavourites] = useState<Station[]>([]),
    [busy, setBusy] = useState(false),
    // The words the shown list was searched for; empty for popular.
    [shownFor, setShownFor] = useState(""),
    [player, setPlayer] = useState<RadioState>(radioState());
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("radio.favourites")
      .then(setFavourites)
      .catch(() => {});
    return onRadio(setPlayer);
  }, []);
  const search = (term = query) => {
    setBusy(true);
    void api("radio.search", { term })
      .then((list) => {
        setStations(list);
        setShownFor(term.trim());
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const starred = (id: string) => favourites.some((f) => f.id === id);
  const row = (s: Station) => (
    <div
      className={"radio-station" + (player.station?.id === s.id ? " on" : "")}
      key={s.id}
    >
      <button
        className="radio-play"
        aria-label={`Play ${s.name}`}
        onClick={() =>
          player.station?.id === s.id && player.status !== "stopped"
            ? stopRadio()
            : playStation(s)
        }
      >
        <Icon
          name={
            player.station?.id === s.id && player.status !== "stopped"
              ? "stop"
              : "play"
          }
          size={14}
        />
      </button>
      <div>
        <b>{s.name}</b>
        <small>
          {[s.country, s.tags, s.bitrate ? `${s.bitrate} kbps` : ""]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </div>
      <IconButton
        icon="star"
        label={starred(s.id) ? `Forget ${s.name}` : `Keep ${s.name}`}
        active={starred(s.id)}
        onClick={() =>
          void api("radio.favourite", { station: s, on: !starred(s.id) })
            .then(setFavourites)
            .catch(fail)
        }
      />
    </div>
  );
  return (
    <div className="radio-panel">
      {player.station && player.status !== "stopped" && (
        <div className="radio-now" role="status">
          <Icon
            name={player.status === "error" ? "warning" : "radio"}
            size={18}
          />
          <div>
            <b>{player.station.name}</b>
            <small>
              {player.status === "loading"
                ? "Connecting…"
                : player.status === "error"
                  ? "This station did not play. Try another."
                  : "Playing"}
            </small>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={player.volume}
            aria-label="Radio volume"
            onChange={(e) => setRadioVolume(Number(e.target.value))}
          />
          <IconButton icon="stop" label="Stop the radio" onClick={stopRadio} />
        </div>
      )}
      <label className="search-field">
        <Icon name="magnifying-glass" size={18} />
        <input
          placeholder="Search stations: jazz, BBC, Cairo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
      </label>
      {!!favourites.length && (
        <>
          <h4 className="radio-heading">Kept</h4>
          {favourites.map(row)}
        </>
      )}
      <h4 className="radio-heading">
        {shownFor ? `Results for “${shownFor}”` : "Popular"}
      </h4>
      {stations === null ? (
        <button
          className="soft-button"
          disabled={busy}
          onClick={() => search("")}
        >
          <Icon name="radio" size={16} />
          {busy ? "Loading…" : "Show popular stations"}
        </button>
      ) : !stations.length ? (
        <p className="muted">No stations found.</p>
      ) : (
        stations.map(row)
      )}
      <p className="setting-note">
        Stations come from Radio Browser, a free community directory. Yami
        streams only stations it listed here.
      </p>
    </div>
  );
}
