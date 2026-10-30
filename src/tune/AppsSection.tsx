import { useMemo, useState } from "react";
import { api } from "../api";
import { Icon, IconButton, Modal } from "../ui";

type InstalledApp = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  sizeKb: number;
  user: boolean;
};

const size = (kb: number) =>
  !kb
    ? ""
    : kb >= 1024 * 1024
      ? `${(kb / 1024 / 1024).toFixed(1)} GB`
      : kb >= 1024
        ? `${Math.round(kb / 1024)} MB`
        : `${kb} KB`;

/**
 * Tune › Installed apps. The list is read only when asked for; Uninstall
 * starts the app's own uninstaller after a confirmation, like Settings › Apps.
 */
export function AppsSection({ report }: { report: (m: string) => void }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState(""),
    [pending, setPending] = useState<InstalledApp | null>(null);
  const load = () => {
    setLoading(true);
    void api("tune.apps")
      .then(setApps)
      .catch((e) => report(e.message))
      .finally(() => setLoading(false));
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps || []).filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.publisher.toLowerCase().includes(q),
    );
  }, [apps, query]);
  const uninstall = () => {
    if (!pending) return;
    const app = pending;
    setPending(null);
    void api("tune.apps.uninstall", { id: app.id })
      .then(() =>
        report(
          `${app.name}'s uninstaller is open. Open the list again when it finishes.`,
        ),
      )
      .catch((e) => report(e.message));
  };
  return (
    <section>
      <h3 className="group-title">Installed apps</h3>
      <p className="setting-note">
        Uninstall runs the app's own uninstaller, the same one Windows Settings
        starts. Apps installed for all users ask for administrator approval
        themselves.
      </p>
      <div className="setting-group">
        {apps === null ? (
          <div className="setting-row">
            <div>
              <strong>Show installed apps</strong>
              <p>Reads the list Windows keeps; nothing is changed.</p>
            </div>
            <button
              type="button"
              className="soft-button"
              disabled={loading}
              onClick={load}
            >
              <Icon name="list-magnifying-glass" size={16} />
              {loading ? "Reading…" : "Show apps"}
            </button>
          </div>
        ) : (
          <>
            <div className="setting-row apps-search">
              <label className="search-field">
                <Icon name="magnifying-glass" size={18} />
                <input
                  placeholder={`Search ${apps.length} apps`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <IconButton
                icon="arrows-clockwise"
                label="Read the list again"
                disabled={loading}
                onClick={load}
              />
            </div>
            {!shown.length && (
              <div className="setting-row">
                <p>No apps match.</p>
              </div>
            )}
            {shown.map((a) => (
              <div className="setting-row" key={a.id}>
                <div className="startup-app">
                  <strong>{a.name}</strong>
                  <p>
                    {[
                      a.publisher,
                      a.version,
                      size(a.sizeKb),
                      a.user ? "Just you" : "All users",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => setPending(a)}
                  aria-label={`Uninstall ${a.name}`}
                >
                  <Icon name="trash" size={16} />
                  Uninstall
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      {pending && (
        <Modal
          title={`Uninstall ${pending.name}?`}
          onClose={() => setPending(null)}
        >
          <p>
            Yami starts {pending.name}'s own uninstaller. It opens its own
            window and may ask more questions there
            {pending.user
              ? ""
              : ", and Windows asks for administrator approval"}
            . Yami cannot undo this.
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="soft-button danger"
              onClick={uninstall}
            >
              Uninstall
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
