import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon, Toggle } from "./ui";

type Link = {
  on: boolean;
  running: boolean;
  folder: string;
  prepared: boolean;
  browsers: { id: string; name: string }[];
};

/**
 * Downloads › Yami Home extension: a new tab page for Chrome, Edge and Brave
 * that also hands downloads to Yami. Those browsers only add extensions
 * from their store or by "Load unpacked", so Yami prepares the folder,
 * opens the browser's extensions page and shows the three clicks.
 */
export function BrowserLinkCard({ report }: { report: (m: string) => void }) {
  const [link, setLink] = useState<Link | null>(null),
    [installing, setInstalling] = useState("");
  const fail = (e: Error) => report(e.message);
  useEffect(() => {
    void api("downloads.link")
      .then(setLink)
      .catch(() => {});
  }, []);
  if (!link) return null;
  const install = (id: string, name: string) =>
    void api("downloads.link.open", { browser: id })
      .then((next: Link) => {
        setLink(next);
        setInstalling(name);
        void navigator.clipboard.writeText(next.folder).catch(() => {});
      })
      .catch(fail);
  return (
    <section className="browser-link">
      <h3 className="group-title">Yami Home for your browser</h3>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Link browsers to Yami</strong>
            <p>
              A calm new tab with your background and bookmark folders, plus
              “Download with Yami” on links. It talks only to Yami on this PC.
            </p>
          </div>
          <Toggle
            label="Link browsers to Yami"
            value={link.on}
            onChange={(on) =>
              void api("downloads.link.set", { on }).then(setLink).catch(fail)
            }
          />
        </div>
        {link.on &&
          link.browsers.map((b) => (
            <div className="setting-row" key={b.id}>
              <div>
                <strong>{b.name}</strong>
                <p>Adds Yami Home with {b.name}'s Load unpacked.</p>
              </div>
              <button
                type="button"
                className="soft-button"
                onClick={() => install(b.id, b.name)}
              >
                <Icon name="puzzle-piece" size={16} />
                Install in {b.name}
              </button>
            </div>
          ))}
        {link.on && !link.browsers.length && (
          <div className="setting-row">
            <p>
              No Chrome, Edge or Brave was found. The Yami Browser already sends
              its downloads to Yami.
            </p>
          </div>
        )}
      </div>
      {installing && (
        <ol className="link-steps">
          <li>
            In the {installing} tab that just opened, turn on{" "}
            <b>Developer mode</b> (top right).
          </li>
          <li>
            Click <b>Load unpacked</b>.
          </li>
          <li>
            Paste this folder (already copied) and choose <b>Select folder</b>:
            <code>{link.folder}</code>
          </li>
        </ol>
      )}
      {link.on && (
        <p className="setting-note">
          Browsers allow only their own store or Load unpacked for extensions,
          so this one step is yours.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => void api("downloads.link.folder").catch(fail)}
          >
            Open the extension folder
          </button>
        </p>
      )}
    </section>
  );
}
