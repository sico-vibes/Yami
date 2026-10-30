import { useEffect, useState } from "react";
import { api } from "./api";
import { Select } from "./controls";
import { Icon, IconButton } from "./ui";

type Status = { clientId: string; connected: boolean };
type Now = {
  active: boolean;
  playing?: boolean;
  title?: string;
  artist?: string;
  device?: string;
  volume?: number | null;
  shuffle?: boolean;
  repeat?: string;
};
type Device = { id: string; name: string; type: string; active: boolean };

/** Settings › Music: the optional Spotify connection. */
export function SpotifyPanel({ report }: { report: (m: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [clientId, setClientId] = useState(""),
    [now, setNow] = useState<Now | null>(null),
    [devices, setDevices] = useState<Device[]>([]),
    [busy, setBusy] = useState(false);
  const fail = (e: Error) => report(e.message);
  const read = () => {
    void api("spotify.now").then(setNow).catch(fail);
    void api("spotify.devices")
      .then(setDevices)
      .catch(() => setDevices([]));
  };
  useEffect(() => {
    void api("spotify.status")
      .then((s: Status) => {
        setStatus(s);
        setClientId(s.clientId);
        if (s.connected) read();
      })
      .catch(fail);
  }, []);
  const act = (action: string, value?: unknown) =>
    void api("spotify.act", { action, value }).then(setNow).catch(fail);
  if (!status) return null;
  if (!status.connected)
    return (
      <div className="setting-group">
        <div className="setting-row stacked">
          <div>
            <strong>Spotify (optional)</strong>
            <p>
              Yami already controls the Spotify app through Windows. Connect
              Spotify to also pick a device (your phone or a speaker) and set
              its volume. It needs Spotify Premium and your own free Spotify
              developer app:
            </p>
            <ol className="spotify-steps">
              <li>
                Create an app at developer.spotify.com/dashboard (Web API).
              </li>
              <li>
                Add the redirect URI{" "}
                <code>http://127.0.0.1:47823/callback</code>.
              </li>
              <li>
                In User Management, add your Spotify account (apps in
                development mode allow five users).
              </li>
              <li>Paste its Client ID here. No secret is needed.</li>
            </ol>
          </div>
          <div className="spotify-connect">
            <input
              aria-label="Spotify Client ID"
              placeholder="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <button
              type="button"
              className="primary-button"
              disabled={busy || !/^[0-9a-f]{32}$/i.test(clientId.trim())}
              onClick={() => {
                setBusy(true);
                report("Finish signing in to Spotify in your browser.");
                void api("spotify.connect", { clientId })
                  .then((s: Status) => {
                    setStatus(s);
                    read();
                  })
                  .catch(fail)
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Waiting for Spotify…" : "Connect Spotify"}
            </button>
          </div>
        </div>
      </div>
    );
  return (
    <div className="setting-group">
      <div className="setting-row">
        <div>
          <strong>{now?.active ? now.title : "Spotify is connected"}</strong>
          <p>
            {now?.active
              ? `${now.artist} · on ${now.device}`
              : "Nothing is playing on your Spotify devices."}
          </p>
        </div>
        <div className="setting-control">
          <IconButton
            icon="shuffle"
            label={now?.shuffle ? "Shuffle is on" : "Shuffle is off"}
            active={!!now?.shuffle}
            onClick={() => act("shuffle")}
          />
          <IconButton
            icon={now?.repeat === "track" ? "repeat-once" : "repeat"}
            label={
              now?.repeat === "track"
                ? "Repeating this track"
                : now?.repeat === "context"
                  ? "Repeating the playlist"
                  : "Repeat is off"
            }
            active={!!now?.repeat && now.repeat !== "off"}
            onClick={() => act("repeat")}
          />
          <button
            type="button"
            className="soft-button"
            onClick={() => act(now?.playing ? "pause" : "play")}
          >
            <Icon name={now?.playing ? "pause" : "play"} size={16} />
            {now?.playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <strong>Play on</strong>
          <p>Move playback to another Spotify device.</p>
        </div>
        <Select
          label="Spotify device"
          value={devices.find((d) => d.active)?.id || ""}
          onChange={(id) => act("transfer", id)}
          options={[
            ...(devices.some((d) => d.active)
              ? []
              : [
                  { value: "", label: "Choose a device", icon: "speaker-high" },
                ]),
            ...devices.map((d) => ({
              value: d.id,
              label: d.name,
              icon:
                d.type === "Smartphone"
                  ? "device-mobile"
                  : d.type === "Computer"
                    ? "desktop"
                    : "speaker-high",
            })),
          ]}
        />
      </div>
      {typeof now?.volume === "number" && (
        <div className="setting-row">
          <div>
            <strong>Volume</strong>
            <p>{now.device}</p>
          </div>
          <input
            type="range"
            aria-label="Spotify volume"
            min="0"
            max="100"
            defaultValue={now.volume}
            onPointerUp={(e) => act("volume", Number(e.currentTarget.value))}
            onKeyUp={(e) => act("volume", Number(e.currentTarget.value))}
          />
        </div>
      )}
      <div className="setting-row">
        <div>
          <strong>Disconnect Spotify</strong>
          <p>Yami forgets its Spotify sign-in.</p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            void api("spotify.disconnect")
              .then((s: Status) => {
                setStatus(s);
                setNow(null);
              })
              .catch(fail)
          }
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
