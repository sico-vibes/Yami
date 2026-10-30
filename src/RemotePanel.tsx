import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "./api";
import { StatusChip } from "./controls";
import { Toggle } from "./ui";

type Info = {
  enabled: boolean;
  url: string;
  pairing: string;
  error: string;
  abilities: { name: string; allowed: boolean }[];
};

const abilityText: Record<string, [string, string]> = {
  approvals: [
    "Approve agents",
    "Allow or deny a coding agent's permission request.",
  ],
  media: ["Control music", "Play, pause and skip what is playing on the PC."],
  clipboard: [
    "Send to the clipboard",
    "Text you send lands on the PC's clipboard.",
  ],
  screen: [
    "View the screen",
    "See this PC's main screen on the phone, refreshed about once a second while you watch. Yami says so on the PC when viewing starts.",
  ],
  control: [
    "Control the PC",
    "With View the screen on: tap to click, scroll, type and press a few keys. Windows does not accept input for windows running as administrator.",
  ],
};

/** A QR code as plain SVG squares, drawn from the qrcode matrix. */
function Qr({ text }: { text: string }) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const cells: string[] = [];
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++)
      if (modules.get(x, y)) cells.push(`M${x + 4} ${y + 4}h1v1h-1z`);
  const size = modules.size + 8;
  return (
    <svg
      className="remote-qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Pairing code for your phone"
    >
      <rect width={size} height={size} className="remote-qr-paper" />
      <path d={cells.join("")} className="remote-qr-ink" />
    </svg>
  );
}

/** Settings › Phone: pair a phone with Yami Remote. */
export function RemotePanel({ report }: { report: (m: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const fail = (e: Error) => report(e.message);
  const load = () => void api("remote.info").then(setInfo).catch(fail);
  useEffect(load, []);
  if (!info) return null;
  return (
    <>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Yami Remote</strong>
            <p>
              A page for your phone on the same Wi-Fi. Windows may ask once to
              let Yami through the firewall on private networks.
            </p>
          </div>
          <div className="setting-control">
            <StatusChip
              status={info.error ? "error" : info.enabled ? "ready" : "off"}
            />
            <Toggle
              label="Yami Remote"
              value={info.enabled}
              onChange={(enabled) =>
                void api("modules.set", { id: "remote", enabled })
                  .then(() => api("remote.info"))
                  .then(setInfo)
                  .catch(fail)
              }
            />
          </div>
        </div>
        {info.error && (
          <div className="setting-row">
            <p className="error-text">{info.error}</p>
          </div>
        )}
        {info.enabled &&
          info.abilities.map((a) => (
            <div className="setting-row" key={a.name}>
              <div>
                <strong>{abilityText[a.name]?.[0] || a.name}</strong>
                <p>{abilityText[a.name]?.[1]}</p>
              </div>
              <Toggle
                label={abilityText[a.name]?.[0] || a.name}
                value={a.allowed}
                onChange={(allowed) =>
                  void api("remote.allow", { name: a.name, allowed })
                    .then(setInfo)
                    .catch(fail)
                }
              />
            </div>
          ))}
      </div>
      {info.enabled && info.pairing && (
        <div className="remote-pair">
          <Qr text={info.pairing} />
          <div>
            <strong>Scan with your phone's camera</strong>
            <p className="setting-note">
              It opens {info.url} and remembers this pairing. Anyone with the
              code can use the abilities above while Yami Remote is on, so keep
              it to yourself. A new code unpairs every phone.
            </p>
            <button
              type="button"
              className="soft-button"
              onClick={() =>
                void api("remote.rotate").then(setInfo).catch(fail)
              }
            >
              New pairing code
            </button>
          </div>
        </div>
      )}
    </>
  );
}
