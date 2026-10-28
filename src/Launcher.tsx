import { useEffect, useState } from "react";
import type { AppItem, State } from "./shared";
import { api } from "./api";
import { Empty, Icon, IconButton, Modal } from "./ui";
import { paletteItems, type PaletteItem } from "./palette";
export function Launcher({
  state,
  report,
}: {
  state: State;
  report: (message: string) => void;
}) {
  const [apps, setApps] = useState<AppItem[]>([]),
    [query, setQuery] = useState(""),
    [files, setFiles] = useState<{ name: string; path: string }[]>([]),
    [newSnippet, setNewSnippet] = useState(false),
    [name, setName] = useState(""),
    [text, setText] = useState(""),
    [projects, setProjects] = useState<
      { id: string; name: string; path: string }[]
    >([]);
  useEffect(() => {
    api("apps")
      .then(setApps)
      .catch((e) => report(e.message));
    api("palette.projects")
      .then(setProjects)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      api("launcher.files", { query })
        .then(setFiles)
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);
  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase()),
  );
  const groups = query
    ? [["Applications", filtered] as const]
    : ([
        ["Starred", filtered.filter((a) => state.favorites.includes(a.path))],
        [
          "Recent",
          state.recentApps
            .map((p) => apps.find((a) => a.path === p))
            .filter(Boolean) as AppItem[],
        ],
        [
          "Applications",
          filtered.filter((a) => !state.favorites.includes(a.path)),
        ],
      ] as const);
  const commands = paletteItems(query, state.settings, projects);
  const run = ({ run: action }: PaletteItem) => {
    const done =
      "copy" in action
        ? navigator.clipboard
            .writeText(action.copy)
            .then(() => report("Copied " + action.copy))
        : api(action.method, action.args);
    void done.catch((e: Error) => report(e.message));
  };
  // Enter opens the first result: a command or sum, then an app, then a file.
  const first = () => {
    if (commands[0]) return run(commands[0]);
    if (query && filtered[0])
      return void api("apps.launch", { path: filtered[0].path }).catch((e) =>
        report(e.message),
      );
    if (files[0])
      void api("files.open", { path: files[0].path }).catch((e) =>
        report(e.message),
      );
  };
  const snippets = state.snippets.filter((s) =>
    (s.name + " " + s.text).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <label className="search-field">
        <Icon name="magnifying-glass" size={18} />
        <input
          autoFocus
          aria-label="Search apps"
          placeholder="Search apps, files, Yami and sums…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && first()}
        />
        <kbd>Win+A</kbd>
      </label>
      <div className="apps-scroll">
        <div className="snippet-chips">
          {snippets.map((s) => (
            <div className="snippet-chip" key={s.id}>
              <button
                onClick={() =>
                  void api("snippets.copy", { id: s.id }).then(() =>
                    report("Snippet copied."),
                  )
                }
              >
                <Icon name="lightning" size={12} />
                {s.name}
              </button>
              <button
                aria-label={"Delete snippet " + s.name}
                onClick={() => void api("snippets.delete", { id: s.id })}
              >
                <Icon name="x" size={10} />
              </button>
            </div>
          ))}
          <IconButton
            icon="plus"
            label="Add snippet"
            onClick={() => setNewSnippet(true)}
          />
        </div>
        {commands.length > 0 && (
          <section>
            <h4>Yami</h4>
            {commands.map((c, i) => (
              <div className="launcher-row" key={c.id}>
                <button onClick={() => run(c)}>
                  <Icon name={c.icon} size={22} />
                  <b>{c.title}</b>
                  <small>{c.hint}</small>
                </button>
                {i === 0 && <kbd className="launcher-enter">Enter</kbd>}
              </div>
            ))}
          </section>
        )}
        {groups.map(
          ([title, list]) =>
            list.length > 0 && (
              <section key={title}>
                <h4>{title}</h4>
                {list.slice(0, 80).map((a) => (
                  <div className="launcher-row" key={title + a.path}>
                    <button
                      onClick={() =>
                        void api("apps.launch", { path: a.path }).catch((e) =>
                          report(e.message),
                        )
                      }
                    >
                      <span className="app-letter">{a.name[0]}</span>
                      <b>{a.name}</b>
                      <small>{a.kind}</small>
                    </button>
                    <IconButton
                      icon="star"
                      label={
                        state.favorites.includes(a.path) ? "Unstar" : "Star"
                      }
                      active={state.favorites.includes(a.path)}
                      onClick={() =>
                        void api("apps.favorite", { path: a.path })
                      }
                    />
                  </div>
                ))}
              </section>
            ),
        )}
        {files.length > 0 && (
          <section>
            <h4>Files</h4>
            {files.map((f) => (
              <div className="launcher-row" key={f.path}>
                <button
                  onClick={() =>
                    void api("files.open", { path: f.path }).catch((e) =>
                      report(e.message),
                    )
                  }
                >
                  <Icon name="file" size={22} />
                  <b>{f.name}</b>
                  <small>{f.path.split(/[\\/]/).slice(-2, -1)[0]}</small>
                </button>
              </div>
            ))}
          </section>
        )}
        {!filtered.length &&
          !files.length &&
          !snippets.length &&
          !commands.length && (
            <Empty
              icon="magnifying-glass"
              title={apps.length ? "No matches" : "Finding your applications…"}
            />
          )}
      </div>
      {newSnippet && (
        <Modal title="Add a snippet" onClose={() => setNewSnippet(false)}>
          <label className="form-label">
            Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A short name"
            />
          </label>
          <label className="form-label">
            Text
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your reusable text"
            />
          </label>
          <button
            className="primary-button"
            disabled={!name.trim() || !text.trim()}
            onClick={() =>
              void api("snippets.save", { name: name.trim(), text })
                .then(() => {
                  setNewSnippet(false);
                  setName("");
                  setText("");
                })
                .catch((e) => report(e.message))
            }
          >
            Save snippet
          </button>
        </Modal>
      )}
    </>
  );
}
