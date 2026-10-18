import { useState } from "react";
import type { State, Task } from "./shared";
import { api, time } from "./api";
import { Empty, Icon, IconButton, Modal, Toggle } from "./ui";
import { Select } from "./controls";
export function Plans({
  state,
  report,
}: {
  state: State;
  report: (m: string) => void;
}) {
  const [modal, setModal] = useState(false),
    [title, setTitle] = useState(""),
    [action, setAction] = useState("remind"),
    [value, setValue] = useState(""),
    [at, setAt] = useState(""),
    [repeat, setRepeat] = useState("none"),
    [todo, setTodo] = useState(""),
    [month, setMonth] = useState(new Date());
  const tasks = state.tasks.filter((t) => t.repeat !== "none"),
    once = state.tasks.filter((t) => t.repeat === "none");
  async function save() {
    try {
      const args =
        action === "remind"
          ? { text: title }
          : action === "open_app"
            ? { name: value }
            : action === "open_url"
              ? { url: value }
              : action === "routine"
                ? {
                    steps: value
                      .split(",")
                      .filter(Boolean)
                      .map((name) => ({
                        tool: "open_app",
                        args: { name: name.trim() },
                      })),
                  }
                : { site: "youtube", query: value };
      await api("task.save", {
        title,
        tool: action,
        args,
        at: new Date(at).toISOString(),
        repeat,
      });
      setModal(false);
      setTitle("");
      setValue("");
    } catch (e) {
      report((e as Error).message);
    }
  }
  const taskRow = (t: Task) => (
    <div className="plan-row" key={t.id}>
      <span className="plan-icon">
        <Icon name={t.repeat === "none" ? "calendar" : "repeat"} />
      </span>
      <div>
        <b>{t.title}</b>
        <p>
          {new Date(t.at).toLocaleDateString()} · {time(t.at)}
          {t.repeat !== "none" ? " · " + t.repeat : ""}
        </p>
        {t.lastRun && (
          <small className={t.status === "failed" ? "error-text" : ""}>
            {t.status === "failed"
              ? t.lastResult
              : "Last run: " + new Date(t.lastRun).toLocaleString()}
          </small>
        )}
      </div>
      <Toggle
        label={"Enable " + t.title}
        value={t.enabled}
        onChange={() => void api("task.toggle", { id: t.id })}
      />
      <IconButton
        icon="trash"
        label="Delete task"
        onClick={() => void api("task.delete", { id: t.id })}
      />
    </div>
  );
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay(),
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <section className="plans-page">
      <div className="page-head">
        <div>
          <h1>Your desk</h1>
          <p className="page-description">Say it once. Then forget it.</p>
        </div>
        <button className="soft-button" onClick={() => setModal(true)}>
          <Icon name="plus" size={17} /> Add a plan
        </button>
      </div>
      <div className="desk-grid">
        <div>
          <section className="desk-section">
            <h2>
              To-do list{" "}
              <small>
                {state.todos.filter((t) => t.done).length}/{state.todos.length}
              </small>
            </h2>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (todo.trim())
                  void api("todo.add", { title: todo.trim() }).then(() =>
                    setTodo(""),
                  );
              }}
            >
              <input
                placeholder="What needs doing?"
                value={todo}
                onChange={(e) => setTodo(e.target.value)}
              />
              <IconButton
                icon="plus"
                label="Add to-do"
                onClick={() => {
                  if (todo.trim())
                    void api("todo.add", { title: todo.trim() }).then(() =>
                      setTodo(""),
                    );
                }}
              />
            </form>
            {state.todos.map((t) => (
              <div className="todo-row" key={t.id}>
                <button
                  className={`check-circle ${t.done ? "checked" : ""}`}
                  aria-label={"Complete " + t.title}
                  onClick={() => void api("todo.toggle", { id: t.id })}
                >
                  {t.done && <Icon name="check" size={12} />}
                </button>
                <span className={t.done ? "done" : ""}>{t.title}</span>
                <IconButton
                  icon="x"
                  label="Delete to-do"
                  onClick={() => void api("todo.delete", { id: t.id })}
                />
              </div>
            ))}
          </section>
          <section className="desk-section">
            <h2>Scheduled</h2>
            {once.length ? (
              once.map(taskRow)
            ) : (
              <Empty icon="calendar-blank" title="Nothing scheduled">
                Ask Yami to remind you or open something later.
              </Empty>
            )}
          </section>
          <section className="desk-section">
            <h2>Routines</h2>
            {tasks.length ? (
              tasks.map(taskRow)
            ) : (
              <Empty icon="repeat" title="Make room for a routine">
                “Every morning at nine, open Spotify.”
              </Empty>
            )}
          </section>
        </div>
        <aside>
          <div className="calendar">
            <div className="calendar-head">
              <b>
                {month.toLocaleDateString([], {
                  month: "long",
                  year: "numeric",
                })}
              </b>
              <IconButton
                icon="caret-left"
                label="Previous month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              />
              <IconButton
                icon="caret-right"
                label="Next month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              />
            </div>
            <div className="calendar-grid">
              {"SMTWTFS".split("").map((v, i) => (
                <small key={"w" + i}>{v}</small>
              ))}
              {Array.from({ length: start }, (_, i) => (
                <span key={"e" + i} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1,
                  date = new Date(month.getFullYear(), month.getMonth(), day);
                const today = date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={day}
                    className={today ? "today" : ""}
                    onClick={() => {
                      const v = new Date(
                        date.getTime() - date.getTimezoneOffset() * 60000,
                      );
                      setAt(v.toISOString().slice(0, 16));
                      setModal(true);
                    }}
                  >
                    {day}
                    {state.tasks.some(
                      (t) =>
                        new Date(t.at).toDateString() === date.toDateString(),
                    ) && <i />}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="setting-note">
            Routines run while Yami is running, including in the tray. Missed
            tasks are checked when it resumes.
          </p>
        </aside>
      </div>
      {modal && (
        <Modal title="Add a plan" onClose={() => setModal(false)}>
          <label className="form-label">
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should happen?"
            />
          </label>
          <label className="form-label">
            Action
            <Select
              label="Action"
              value={action}
              onChange={setAction}
              options={[
                { value: "remind", label: "Remind me", icon: "bell" },
                { value: "open_app", label: "Open an app", icon: "app-window" },
                { value: "routine", label: "Open several apps", icon: "stack" },
                { value: "open_url", label: "Open a website", icon: "globe" },
                { value: "search_site", label: "Search YouTube", icon: "youtube-logo" },
              ]}
            />
          </label>
          {action !== "remind" && (
            <label className="form-label">
              {action === "routine"
                ? "App names, separated by commas"
                : action === "open_url"
                  ? "Website address"
                  : action === "open_app"
                    ? "Application name"
                    : "Search phrase"}
              <input value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
          )}
          <div className="form-two">
            <label className="form-label">
              When
              <input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </label>
            <label className="form-label">
              Repeat
              <Select
                label="Repeat"
                value={repeat}
                onChange={setRepeat}
                options={[
                  { value: "none", label: "Once" },
                  { value: "daily", label: "Every day" },
                  { value: "weekly", label: "Every week" },
                ]}
              />
            </label>
          </div>
          <button
            className="primary-button"
            disabled={
              !title.trim() || !at || (action !== "remind" && !value.trim())
            }
            onClick={() => void save()}
          >
            Save plan
          </button>
        </Modal>
      )}
    </section>
  );
}
