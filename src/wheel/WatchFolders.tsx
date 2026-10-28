import { useEffect, useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import { IconButton, Toggle } from "../ui";

type Watch = { id: string; folder: string; target: string; enabled: boolean };

const targets = [
  ["to:pdf", "PDF"],
  ["to:png", "PNG"],
  ["to:jpg", "JPG"],
  ["to:webp", "WebP"],
  ["to:mp3", "MP3"],
  ["to:mp4", "MP4"],
  ["to:gif", "GIF"],
  ["to:html", "HTML"],
  ["to:txt", "Text"],
  ["to:md", "Markdown"],
] as const;

/** Settings › File wheel: folders whose new files convert automatically. */
export function WatchFolders({ report }: { report: (m: string) => void }) {
  const [list, setList] = useState<Watch[]>([]),
    [target, setTarget] = useState("to:pdf");
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("watch.list").then(setList).catch(fail);
  }, []);
  const label = (t: string) => targets.find(([id]) => id === t)?.[1] || t;
  return (
    <>
      <h3 className="group-title">Watch folders</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Convert new files automatically</strong>
            <p>
              A file that arrives in a watched folder is converted once, next to
              it. Files already there are left alone. Yami listens for changes;
              it does not scan.
            </p>
          </div>
          <div className="setting-control">
            <Select
              label="Convert new files to"
              value={target}
              onChange={setTarget}
              options={targets.map(([value, text]) => ({
                value,
                label: text,
                icon: "arrows-clockwise",
              }))}
            />
            <button
              className="soft-button"
              onClick={() =>
                void api("watch.add", { target }).then(setList).catch(fail)
              }
            >
              Add folder
            </button>
          </div>
        </div>
        {list.map((w) => (
          <div className="setting-row" key={w.id}>
            <div className="startup-app">
              <strong>To {label(w.target)}</strong>
              <p data-tip={w.folder}>{w.folder}</p>
            </div>
            <div className="setting-control">
              <Toggle
                label={`Watch ${w.folder}`}
                value={w.enabled}
                onChange={(enabled) =>
                  void api("watch.toggle", { id: w.id, enabled })
                    .then(setList)
                    .catch(fail)
                }
              />
              <IconButton
                icon="x"
                label={`Stop watching ${w.folder}`}
                onClick={() =>
                  void api("watch.remove", { id: w.id })
                    .then(setList)
                    .catch(fail)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
