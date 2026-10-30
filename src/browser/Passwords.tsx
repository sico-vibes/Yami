import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon, IconButton, Modal } from "../ui";

type LoginChoice = { id: string; username: string; name: string };

/**
 * The toolbar's key: shown when the vault has a login for this page's site.
 * Pressing it fills that login (or asks which one); nothing fills on its own.
 */
export function LoginButton({
  url,
  loading,
  fail,
}: {
  url: string;
  loading: boolean;
  fail: (e: Error) => void;
}) {
  const [logins, setLogins] = useState<LoginChoice[]>([]),
    [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (loading || !/^https?:/.test(url)) return setLogins([]);
    void api("browser.logins")
      .then(setLogins)
      .catch(() => setLogins([]));
  }, [url, loading]);
  if (!logins.length) return null;
  const fill = (id: string) => {
    setChoosing(false);
    void api("browser.fill", { id }).catch(fail);
  };
  return (
    <>
      <IconButton
        icon="key"
        label={
          logins.length === 1
            ? `Fill the login for ${logins[0].username || logins[0].name}`
            : `Fill a login (${logins.length} saved for this site)`
        }
        onClick={() =>
          logins.length === 1 ? fill(logins[0].id) : setChoosing(true)
        }
      />
      {choosing && (
        <Modal title="Fill which login?" onClose={() => setChoosing(false)}>
          <div className="browser-bookmarks">
            {logins.map((l) => (
              <button
                type="button"
                key={l.id}
                className="browser-bookmark"
                onClick={() => fill(l.id)}
              >
                <b>{l.username || "(no username)"}</b>
                <small>{l.name}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

/** New-tab card: import an exported passwords file, or remove them all. */
export function PasswordsCard({ fail }: { fail: (e: Error) => void }) {
  const [count, setCount] = useState<number | null>(null),
    [imported, setImported] = useState<{ added: number; file: string } | null>(
      null,
    );
  const load = () =>
    void api("vault.passwords", {})
      .then(setCount)
      .catch(() => {});
  useEffect(load, []);
  if (count === null) return null;
  return (
    <section className="browser-linked browser-filters">
      <strong>
        <Icon name="key" size={16} />
        {count ? `${count} saved login${count === 1 ? "" : "s"}` : "Passwords"}
      </strong>
      <p className="setting-note">
        Export your passwords from Chrome, Edge, Firefox or Bitwarden as a CSV
        file, then import it here. They are encrypted on this PC with Windows'
        own protection, and a login is filled only when you press the key on its
        site. Other browsers' saved-password stores are never read, and agents
        cannot see them.
      </p>
      <div className="browser-import">
        <button
          type="button"
          className="soft-button"
          onClick={() =>
            void api("vault.passwords", { action: "import" })
              .then((r) => {
                if (r) setImported(r);
                load();
              })
              .catch(fail)
          }
        >
          <Icon name="upload-simple" size={16} />
          Import a passwords file
        </button>
        {count > 0 && (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              void api("vault.passwords", { action: "clear" })
                .then(setCount)
                .catch(fail)
            }
          >
            Remove all
          </button>
        )}
      </div>
      {imported && (
        <Modal
          title="Delete the exported file?"
          onClose={() => setImported(null)}
        >
          <p>
            Added {imported.added} login{imported.added === 1 ? "" : "s"}. The
            file you exported still holds your passwords as plain text:{" "}
            <code>{imported.file}</code>
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="soft-button"
              onClick={() => setImported(null)}
            >
              Keep the file
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void api("vault.passwords", {
                  action: "delete-file",
                  file: imported.file,
                })
                  .then(() => setImported(null))
                  .catch(fail)
              }
            >
              Delete it
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
