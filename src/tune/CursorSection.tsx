import { useEffect, useState } from "react";
import { api } from "../api";
import { Select } from "../controls";
import { Icon } from "../ui";

type Status = {
  schemes: { id: string; name: string }[];
  current: string;
  size: number;
  saved: boolean;
};

/**
 * Tune › Mouse pointer: Windows' own pointer schemes and pointer size. A
 * change shows at once; Put back restores what was there before Yami.
 */
export function CursorSection({ report }: { report: (m: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api("tune.cursors")
      .then(setStatus)
      .catch((e) => report(e.message));
  }, []);
  const run = (method: string, args?: object) => {
    setBusy(true);
    void api(method, args)
      .then(setStatus)
      .catch((e) => report(e.message))
      .finally(() => setBusy(false));
  };
  if (!status) return null;
  const current = status.schemes.find((s) => s.name === status.current);
  return (
    <section>
      <h3 className="group-title">Mouse pointer</h3>
      <p className="setting-note">
        The same pointer schemes and size as Windows' Mouse and Accessibility
        settings. Changes show straight away.
      </p>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Pointer scheme</strong>
            <p>
              {current
                ? "Arrow, text, busy and link pointers change together."
                : `Now ${status.current}, which Windows does not list.`}
            </p>
          </div>
          <Select
            label="Pointer scheme"
            value={current?.id || ""}
            disabled={busy}
            onChange={(scheme) => run("tune.cursors.set", { scheme })}
            options={[
              ...(current ? [] : [{ value: "", label: status.current }]),
              ...status.schemes.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Pointer size</strong>
            <p>1 is Windows' normal size; each step is 16 pixels larger.</p>
          </div>
          <Select
            label="Pointer size"
            value={String(status.size)}
            disabled={busy}
            onChange={(size) => run("tune.cursors.set", { size: Number(size) })}
            options={Array.from({ length: 15 }, (_, i) => ({
              value: String(i + 1),
              label: i ? String(i + 1) : "1 (normal)",
            }))}
          />
        </div>
        {status.saved && (
          <div className="setting-row">
            <div>
              <strong>Put the pointer back</strong>
              <p>Restores the scheme and size from before Yami changed them.</p>
            </div>
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => run("tune.cursors.restore")}
            >
              <Icon name="arrow-counter-clockwise" size={16} />
              Put back
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
