import { useState } from "react";
import { api } from "../api";
import { Icon, IconButton, Modal } from "../ui";

type Variable = { name: string; value: string; expand: boolean };
type Env = { variables: Variable[]; changed: string[] };
/** Values that look like credentials are hidden until you edit them. */
const secret = (name: string) =>
  /key|token|secret|passw|pwd|credential/i.test(name);

/**
 * Tune › Environment variables: your account's variables, read when you
 * open them. Path is edited as a list of folders. Changes reach apps you
 * start afterwards; Put back restores what was there before Yami.
 */
export function EnvSection({ report }: { report: (m: string) => void }) {
  const [env, setEnv] = useState<Env | null>(null),
    [editing, setEditing] = useState<{ name: string; value: string } | null>(
      null,
    ),
    [folder, setFolder] = useState(""),
    [adding, setAdding] = useState<{ name: string; value: string } | null>(
      null,
    ),
    [asking, setAsking] = useState<{ title: string; run: () => void } | null>(
      null,
    );
  const fail = (e: Error) => report(e.message);
  const call = (method: string, args?: object) =>
    void api(method, args)
      .then((next: Env) => {
        setEnv(next);
        setEditing(null);
      })
      .catch(fail);
  const save = () => {
    if (!adding) return;
    call("tune.env.set", adding);
    setAdding(null);
  };
  const path = env?.variables.find((v) => v.name.toLowerCase() === "path");
  const folders = path ? path.value.split(";").filter(Boolean) : [];
  const setPath = (list: string[]) =>
    call("tune.env.set", { name: path?.name || "Path", value: list.join(";") });
  return (
    <section>
      <h3 className="group-title">Environment variables</h3>
      <p className="setting-note">
        Your account's variables, as in Windows' “Edit environment variables for
        your account”. Apps you start after a change see it; open apps keep what
        they had. Yami remembers each variable's earlier value.
      </p>
      <div className="setting-group">
        {env === null ? (
          <div className="setting-row">
            <div>
              <strong>Show your variables</strong>
              <p>Reads them; nothing changes until you edit one.</p>
            </div>
            <button className="soft-button" onClick={() => call("tune.env")}>
              <Icon name="brackets-curly" size={16} />
              Show variables
            </button>
          </div>
        ) : (
          <>
            <div className="setting-row env-path">
              <div className="startup-app">
                <strong>Path</strong>
                <p>Folders Windows searches for programs, in order.</p>
                <ul className="env-folders">
                  {folders.map((f, i) => (
                    <li key={f + i}>
                      <span data-tip={f}>{f}</span>
                      <IconButton
                        icon="x"
                        label={`Remove ${f} from Path`}
                        onClick={() =>
                          setAsking({
                            title: `Remove ${f} from Path?`,
                            run: () =>
                              setPath(folders.filter((_, n) => n !== i)),
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="env-add">
                  <input
                    aria-label="Folder to add to Path"
                    placeholder={"C:\\Tools\\bin"}
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                  />
                  <button
                    className="soft-button"
                    disabled={!folder.trim()}
                    onClick={() => {
                      setPath([...folders, folder.trim()]);
                      setFolder("");
                    }}
                  >
                    Add folder
                  </button>
                </div>
              </div>
            </div>
            {env.variables
              .filter((v) => v !== path)
              .map((v) => (
                <div className="setting-row" key={v.name}>
                  <div className="startup-app">
                    <strong>{v.name}</strong>
                    {editing?.name === v.name ? (
                      <input
                        aria-label={`Value of ${v.name}`}
                        value={editing.value}
                        autoFocus
                        onChange={(e) =>
                          setEditing({ name: v.name, value: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") call("tune.env.set", editing);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <p data-tip={secret(v.name) ? undefined : v.value}>
                        {secret(v.name)
                          ? "•••••••• (hidden; Edit shows it)"
                          : v.value || "(empty)"}
                      </p>
                    )}
                  </div>
                  <div className="setting-control">
                    {editing?.name === v.name ? (
                      <button
                        className="soft-button"
                        onClick={() => call("tune.env.set", editing)}
                      >
                        Save
                      </button>
                    ) : (
                      <IconButton
                        icon="pencil-simple"
                        label={`Edit ${v.name}`}
                        onClick={() =>
                          setEditing({ name: v.name, value: v.value })
                        }
                      />
                    )}
                    <IconButton
                      icon="trash"
                      label={`Delete ${v.name}`}
                      onClick={() =>
                        setAsking({
                          title: `Delete ${v.name}?`,
                          run: () => call("tune.env.remove", { name: v.name }),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            <div className="setting-row">
              {adding ? (
                <div className="env-add">
                  <input
                    aria-label="New variable name"
                    placeholder="NAME"
                    autoFocus
                    value={adding.name}
                    onChange={(e) =>
                      setAdding({ ...adding, name: e.target.value })
                    }
                  />
                  <input
                    aria-label="New variable value"
                    placeholder="Value"
                    value={adding.value}
                    onChange={(e) =>
                      setAdding({ ...adding, value: e.target.value })
                    }
                    onKeyDown={(e) =>
                      e.key === "Enter" && adding.name.trim() && save()
                    }
                  />
                  <button
                    className="soft-button"
                    disabled={!adding.name.trim()}
                    onClick={save}
                  >
                    Add
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setAdding(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="soft-button"
                  onClick={() => setAdding({ name: "", value: "" })}
                >
                  <Icon name="plus" size={16} />
                  New variable
                </button>
              )}
            </div>
            {env.changed.length > 0 && (
              <div className="setting-row">
                <div>
                  <strong>Put back</strong>
                  <p>
                    Restores {env.changed.join(", ")} as they were before Yami.
                  </p>
                </div>
                <button
                  className="soft-button"
                  onClick={() => call("tune.env.restore")}
                >
                  <Icon name="arrow-counter-clockwise" size={16} />
                  Put back
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {asking && (
        <Modal title={asking.title} onClose={() => setAsking(null)}>
          <p>
            Apps you start afterwards will not see it. Put back restores it if
            you change your mind.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setAsking(null)}>
              Cancel
            </button>
            <button
              className="soft-button danger"
              onClick={() => {
                asking.run();
                setAsking(null);
              }}
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
