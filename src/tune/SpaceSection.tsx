import { useState } from "react";
import { api } from "../api";
import { Meter } from "../controls";
import { Icon, IconButton } from "../ui";
import { bytesText } from "./CleanupSection";

type Drive = { path: string; total: number; free: number };
type Item = {
  name: string;
  dir: boolean;
  bytes: number;
  files: number;
  capped: boolean;
};
type View = {
  folder: string;
  parent?: string;
  total: number;
  items: Item[];
  rest: { count: number; bytes: number };
};

/**
 * Tune › Disk space: used and free space per drive, then what takes the room
 * inside a folder. Measured only when you open a drive or folder.
 */
export function SpaceSection({ report }: { report: (m: string) => void }) {
  const [drives, setDrives] = useState<Drive[] | null>(null),
    [view, setView] = useState<View | null>(null),
    [busy, setBusy] = useState("");
  const open = (folder: string) => {
    setBusy(folder);
    void api("tune.space", { folder })
      .then(setView)
      .catch((e) => {
        if (!/another folder/.test(e.message)) report(e.message);
      })
      .finally(() => setBusy((b) => (b === folder ? "" : b)));
  };
  const reveal = (name?: string) =>
    void api("tune.space.reveal", { folder: view?.folder, name }).catch((e) =>
      report(e.message),
    );
  return (
    <section>
      <h3 className="group-title">Disk space</h3>
      <p className="setting-note">
        See what fills a drive. Yami reads sizes from the folder listings and
        changes nothing; Show in Explorer is where you decide what to move or
        delete.
      </p>
      <div className="setting-group">
        {drives === null ? (
          <div className="setting-row">
            <div>
              <strong>Your drives</strong>
              <p>Used and free space for each drive.</p>
            </div>
            <button
              type="button"
              className="soft-button"
              onClick={() =>
                void api("tune.space.drives")
                  .then(setDrives)
                  .catch((e) => report(e.message))
              }
            >
              <Icon name="hard-drives" size={16} />
              Show drives
            </button>
          </div>
        ) : (
          drives.map((d) => (
            <div className="setting-row" key={d.path}>
              <div className="space-row">
                <strong>{d.path}</strong>
                <Meter
                  value={(d.total - d.free) / d.total}
                  label={`${d.path} used`}
                />
                <p>
                  {bytesText(d.free)} free of {bytesText(d.total)}
                </p>
              </div>
              <button
                type="button"
                className="soft-button"
                disabled={!!busy}
                onClick={() => open(d.path)}
              >
                {busy === d.path ? "Measuring…" : "Look inside"}
              </button>
            </div>
          ))
        )}
      </div>
      {(view || busy) && (
        <>
          <div className="space-path">
            {view?.parent && (
              <IconButton
                icon="arrow-up"
                label="Up one folder"
                onClick={() => open(view.parent!)}
              />
            )}
            <strong data-tip={view?.folder || busy}>
              {busy ? `Measuring ${busy}…` : view?.folder}
            </strong>
            {view && !busy && (
              <>
                <span>{bytesText(view.total)}</span>
                <IconButton
                  icon="folder-open"
                  label="Show in Explorer"
                  onClick={() => reveal()}
                />
              </>
            )}
          </div>
          {view && !busy && (
            <div className="setting-group">
              {!view.items.length && (
                <div className="setting-row">
                  <p>This folder is empty.</p>
                </div>
              )}
              {view.items.map((i) => (
                <div className="setting-row" key={i.name}>
                  <div className="space-row">
                    <strong>
                      <Icon name={i.dir ? "folder" : "file"} size={16} />{" "}
                      {i.name}
                    </strong>
                    <Meter
                      value={view.total ? i.bytes / view.total : 0}
                      label={`${i.name} share of this folder`}
                    />
                    <p>
                      {i.capped ? "At least " : ""}
                      {bytesText(i.bytes)}
                      {i.dir
                        ? ` · ${i.files.toLocaleString()} ${i.files === 1 ? "file" : "files"}`
                        : ""}
                    </p>
                  </div>
                  <div className="setting-control">
                    <IconButton
                      icon="arrow-square-out"
                      label={`Show ${i.name} in Explorer`}
                      onClick={() => reveal(i.name)}
                    />
                    {i.dir && (
                      <button
                        type="button"
                        className="soft-button"
                        onClick={() =>
                          open(
                            view.folder.replace(/[\\/]$/, "") + "\\" + i.name,
                          )
                        }
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {view.rest.count > 0 && (
                <div className="setting-row">
                  <p>
                    {view.rest.count.toLocaleString()} smaller entries,{" "}
                    {bytesText(view.rest.bytes)} together.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
