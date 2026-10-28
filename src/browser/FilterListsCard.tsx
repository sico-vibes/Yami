import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../ui";

type Status = {
  installed: boolean;
  rules: number;
  updating: boolean;
  lists: { id: string; name: string; updated: number; bytes: number }[];
  error?: string;
};

/**
 * EasyList and EasyPrivacy for the Yami Browser. Nothing is downloaded until
 * asked; then the copy refreshes when the browser opens and is a week old.
 */
export function FilterListsCard({ fail }: { fail: (e: Error) => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api("browser.filters").then(setStatus).catch(fail);
  }, []);
  const run = (method: string) => {
    setBusy(true);
    void api(method)
      .then((next: Status) => {
        setStatus(next);
        if (next.error) fail(new Error(next.error));
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  if (!status) return null;
  const updated = Math.min(...status.lists.map((l) => l.updated || 0));
  const size = status.lists.reduce((n, l) => n + l.bytes, 0);
  return (
    <section className="browser-linked browser-filters">
      <strong>
        <Icon name="shield-check" size={16} />
        {status.installed ? "Full filter lists are on" : "Block more ads"}
      </strong>
      <p className="setting-note">
        {status.installed
          ? `EasyList and EasyPrivacy: ${status.rules.toLocaleString()} rules, ${(size / 1048576).toFixed(1)} MB, updated ${updated ? new Date(updated).toLocaleDateString() : "never"}. They refresh when this window opens and a copy is a week old, and apply while the shield is on. Ad slots are hidden with plain CSS; no scripts are added to pages.`
          : "The shield blocks a short built-in list of trackers. EasyList and EasyPrivacy (about 3 MB from easylist.to) block far more ads and trackers. Nothing is downloaded until you ask."}
      </p>
      <div className="browser-import">
        <button
          className="soft-button"
          disabled={busy || status.updating}
          onClick={() => run("browser.filters.update")}
        >
          <Icon
            name={status.installed ? "arrows-clockwise" : "download-simple"}
            size={16}
          />
          {busy || status.updating
            ? "Downloading…"
            : status.installed
              ? "Update now"
              : "Download filter lists"}
        </button>
        {status.installed && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => run("browser.filters.remove")}
          >
            Remove lists
          </button>
        )}
      </div>
    </section>
  );
}
