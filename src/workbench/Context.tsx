import { useState } from "react";
import { api } from "../api";
import { Empty, Icon } from "../ui";
import { Select } from "../controls";
export function ContextView({ report }: { report: (text: string) => void }) {
  const [items, setItems] = useState<any[]>([]),
    [windows, setWindows] = useState<any[]>([]),
    [selected, setSelected] = useState("");
  const error = (e: Error) => report(e.message);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Selected context</h1>
          <p className="page-description">
            Choose what to attach. Nothing is sent until you submit a message.
          </p>
        </div>
        <button
          type="button"
          className="soft-button"
          onClick={() =>
            void api("context.pick")
              .then((next) => setItems((old) => [...old, ...next]))
              .catch(error)
          }
        >
          <Icon name="paperclip" />
          Choose files
        </button>
      </div>
      <div className="setting-group">
        <div className="setting-row">
          <div>
            <strong>Window context</strong>
            <p>
              Select a window, then read its accessible content.
              Private/password contexts are excluded.
            </p>
          </div>
          <button
            type="button"
            className="soft-button"
            onClick={() =>
              void api("context.windows").then(setWindows).catch(error)
            }
          >
            Choose window
          </button>
        </div>
        {!!windows.length && (
          <div className="setting-row">
            <Select
              className="select-wide"
              label="Window to attach"
              value={selected}
              onChange={setSelected}
              options={[
                { value: "", label: "Choose a window" },
                ...windows.map((w) => ({
                  value: String(w.handle),
                  label: w.name || w.process,
                  hint: w.title,
                  icon: "app-window",
                })),
              ]}
            />
            <button
              type="button"
              className="soft-button"
              disabled={!selected}
              onClick={() =>
                void api("context.window", { handle: selected })
                  .then((item) => setItems((old) => [...old, item]))
                  .catch(error)
              }
            >
              Read selected window
            </button>
          </div>
        )}
      </div>
      {!items.length && (
        <Empty icon="paperclip" title="Bring only what matters">
          Attach selected code, a file diff, accessible window text or a
          terminal selection.
        </Empty>
      )}
      {items.map((item) => (
        <section className="workbench-usage" key={item.id}>
          <h2>{item.title}</h2>
          <pre className="confirmation-detail">{item.text}</pre>
          <button
            type="button"
            className="soft-button"
            onClick={() =>
              void api("context.use", {
                title: item.title,
                text: item.text,
              }).catch(error)
            }
          >
            Attach to Yami chat
          </button>
        </section>
      ))}
    </>
  );
}
