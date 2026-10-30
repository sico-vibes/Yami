import { useState } from "react";
import { api } from "../api";
import { Icon, Modal, Toggle } from "../ui";

type Area = {
  id: string;
  name: string;
  detail: string;
  bytes: number;
  files: number;
};
type Result = { freed: number; removed: number; skipped: number };

export const bytesText = (n: number) =>
  n >= 1024 ** 4
    ? `${(n / 1024 ** 4).toFixed(1)} TB`
    : n >= 1024 ** 3
      ? `${(n / 1024 ** 3).toFixed(1)} GB`
      : n >= 1024 ** 2
        ? `${Math.round(n / 1024 ** 2)} MB`
        : n >= 1024
          ? `${Math.round(n / 1024)} KB`
          : `${n} bytes`;

/**
 * Tune › Cleanup: measure first, pick the areas, confirm, then remove. The
 * Recycle Bin is never picked for you.
 */
export function CleanupSection({ report }: { report: (m: string) => void }) {
  const [areas, setAreas] = useState<Area[] | null>(null),
    [picked, setPicked] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState<"" | "scan" | "clean">(""),
    [asking, setAsking] = useState(false);
  const scan = (keepPicks = false) => {
    setBusy("scan");
    return api("tune.cleanup")
      .then((next: Area[]) => {
        setAreas(next);
        if (!keepPicks)
          setPicked(
            new Set(
              next
                .filter((a) => a.bytes && a.id !== "recycle")
                .map((a) => a.id),
            ),
          );
      })
      .catch((e) => report(e.message))
      .finally(() => setBusy(""));
  };
  const chosen = (areas || []).filter((a) => picked.has(a.id) && a.files);
  const total = chosen.reduce((n, a) => n + a.bytes, 0);
  const clean = () => {
    setAsking(false);
    setBusy("clean");
    void api("tune.cleanup.run", { ids: chosen.map((a) => a.id) })
      .then((r: Result) => {
        report(
          `Freed ${bytesText(r.freed)}.${
            r.skipped
              ? ` ${r.skipped.toLocaleString()} files were in use and stayed.`
              : ""
          }`,
        );
        setPicked(new Set());
        return scan(true);
      })
      .catch((e) => {
        report(e.message);
        setBusy("");
      });
  };
  return (
    <section>
      <h3 className="group-title">Cleanup</h3>
      <p className="setting-note">
        Folders Windows and your apps fill and rebuild by themselves. Yami
        measures them first and removes only what you pick. Files in use are
        skipped, and nothing needs administrator rights.
      </p>
      <div className="setting-group">
        {areas === null ? (
          <div className="setting-row">
            <div>
              <strong>See what can go</strong>
              <p>Measures the folders below; nothing is removed.</p>
            </div>
            <button
              type="button"
              className="soft-button"
              disabled={!!busy}
              onClick={() => void scan()}
            >
              <Icon name="broom" size={16} />
              {busy === "scan" ? "Measuring…" : "Measure"}
            </button>
          </div>
        ) : (
          <>
            {areas.map((a) => (
              <div className="setting-row" key={a.id}>
                <div>
                  <strong>{a.name}</strong>
                  <p>
                    {a.detail}.{" "}
                    {a.files
                      ? `${bytesText(a.bytes)} in ${a.files.toLocaleString()} ${a.files === 1 ? "file" : "files"}.`
                      : "Nothing to remove."}
                  </p>
                </div>
                <Toggle
                  label={`Clean ${a.name}`}
                  value={picked.has(a.id) && !!a.files}
                  disabled={!a.files || !!busy}
                  onChange={(on) =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (on) next.add(a.id);
                      else next.delete(a.id);
                      return next;
                    })
                  }
                />
              </div>
            ))}
            <div className="setting-row">
              <div>
                <strong>
                  {chosen.length
                    ? `Clean ${bytesText(total)}`
                    : "Nothing picked"}
                </strong>
                <p>
                  {busy === "clean"
                    ? "Removing…"
                    : busy === "scan"
                      ? "Measuring…"
                      : "Measure again after apps run for a while."}
                </p>
              </div>
              <div className="setting-control">
                <button
                  type="button"
                  className="soft-button"
                  disabled={!!busy}
                  onClick={() => void scan(true)}
                >
                  <Icon name="arrows-clockwise" size={16} />
                  Measure again
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!chosen.length || !!busy}
                  onClick={() => setAsking(true)}
                >
                  Clean
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {asking && (
        <Modal
          title={`Clean ${bytesText(total)}?`}
          onClose={() => setAsking(false)}
        >
          <p>
            Yami removes the files in {chosen.map((a) => a.name).join(", ")}.
            {picked.has("recycle")
              ? " Files in the Recycle Bin cannot be restored afterwards."
              : " Windows and your apps make these again when they need them."}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setAsking(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={
                picked.has("recycle") ? "soft-button danger" : "primary-button"
              }
              onClick={clean}
            >
              Clean
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
