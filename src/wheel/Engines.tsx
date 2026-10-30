import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";
import { StatusChip } from "../controls";

type EngineRow = {
  id: string;
  version: string;
  installed: boolean;
  license: string;
};
const names: Record<string, [string, string]> = {
  ffmpeg: ["FFmpeg", "film-strip"],
  magick: ["ImageMagick", "image"],
  sevenZip: ["7-Zip", "file-zip"],
  sevenExtra: ["7-Zip Extra", "archive"],
  exiftool: ["ExifTool", "info"],
};

export function EngineStatus() {
  const [rows, setRows] = useState<EngineRow[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const load = () => {
    void api("wheel.engines")
      .then(setRows)
      .catch((error: Error) => setNote(error.message));
  };
  useEffect(load, []);
  return (
    <div className="engine-grid">
      {rows.map((row) => {
        const [name, icon] = names[row.id] || [row.id, "puzzle-piece"];
        return (
          <div className="engine-tile" key={row.id} data-ready={row.installed}>
            <span className="entry-icon">
              <Icon name={icon} size={18} />
            </span>
            <div className="entry-heading">
              <strong>{name}</strong>
              <small data-tip={row.license || undefined}>
                {row.version ? `Version ${row.version}` : row.license}
              </small>
            </div>
            {row.installed ? (
              <StatusChip status="Ready" />
            ) : (
              <button
                type="button"
                className="soft-button"
                aria-label={`Get ${name}`}
                disabled={busy === row.id}
                onClick={() => {
                  setBusy(row.id);
                  void api("wheel.engines.install", { id: row.id })
                    .then(load)
                    .catch((error: Error) => setNote(error.message))
                    .finally(() => setBusy(""));
                }}
              >
                <Icon
                  name={busy === row.id ? "circle-notch" : "download-simple"}
                  size={15}
                />
                {busy === row.id ? "Getting…" : "Get"}
              </button>
            )}
          </div>
        );
      })}
      {note && <p className="tool-note">{note}</p>}
    </div>
  );
}
