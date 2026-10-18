import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { api } from "./api";
import { Icon, IconButton } from "./ui";
import type { WorkbenchState, WorkbenchSettings } from "./workbench-types";
type View = {
  id: string;
  terminal: Terminal;
  fit: FitAddon;
  element: HTMLDivElement;
  shell: string;
  cwd: string;
  exited?: boolean;
  orphaned?: boolean;
};
export default function TerminalWindow() {
  const host = useRef<HTMLDivElement>(null),
    views = useRef(new Map<string, View>()),
    active = useRef("");
  const [list, setList] = useState<{ id: string; shell: string }[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [data, setData] = useState<WorkbenchState | null>(null),
    [background, setBackground] = useState("");
  const backlog = useRef(new Map<string, any[]>()),
    mounted = useRef(true);
  function select(id: string) {
    active.current = id;
    setSelected(id);
    for (const view of views.current.values())
      view.element.hidden = view.id !== id;
    const view = views.current.get(id);
    view?.fit.fit();
    view?.terminal.focus();
  }
  const report = (e: any) => setError(e.message || String(e));
  function output(event: any) {
    const view = views.current.get(event.session);
    if (!view) {
      const queue = backlog.current.get(event.session) || [];
      if (queue.length < 64) {
        queue.push(event);
        backlog.current.set(event.session, queue);
      }
      return;
    }
    if (event.kind === "data") {
      const bytes = Uint8Array.from(atob(event.data), (c) => c.charCodeAt(0));
      view.terminal.write(bytes, () => {
        void api("terminal.ack", {
          session: view.id,
          bytes: bytes.length,
        }).catch(() => {});
      });
    } else if (event.kind === "exit") {
      view.exited = true;
      view.terminal.writeln(`\r\n[Process exited: ${event.code}]`);
    } else if (event.error) setError(event.error);
  }
  async function create(cwd?: string, settings?: WorkbenchSettings) {
    try {
      const session = await api("terminal.create", { cwd });
      if (!mounted.current || !host.current) {
        void api("terminal.end", { session: session.id });
        return;
      }
      const element = document.createElement("div");
      element.className = "terminal-view";
      host.current.appendChild(element);
      const terminal = new Terminal({
        allowTransparency: true,
        cursorBlink: false,
        convertEol: false,
        scrollback: (settings || data?.settings)?.terminalScrollback || 3000,
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 14,
        theme: {
          background: "#00000000",
          foreground: "#f4f4f4",
          cursor: "#8dccff",
          selectionBackground: "#8dccff55",
          black: "#11191e",
          blue: "#8dccff",
        },
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(element);
      const view = { ...session, terminal, fit, element };
      views.current.set(session.id, view);
      terminal.onData(
        (text) =>
          void api("terminal.write", { session: session.id, text }).catch(
            report,
          ),
      );
      terminal.onResize(
        (size) =>
          void api("terminal.resize", {
            session: session.id,
            cols: size.cols,
            rows: size.rows,
          }).catch(report),
      );
      terminal.attachCustomKeyEventHandler((e) => {
        if (
          e.type === "keydown" &&
          e.ctrlKey &&
          e.shiftKey &&
          e.key.toLowerCase() === "c"
        ) {
          void navigator.clipboard
            .writeText(terminal.getSelection())
            .catch(report);
          return false;
        }
        if (
          e.type === "keydown" &&
          e.ctrlKey &&
          e.shiftKey &&
          e.key.toLowerCase() === "v"
        ) {
          void navigator.clipboard
            .readText()
            .then((text) => terminal.paste(text))
            .catch(report);
          return false;
        }
        return true;
      });
      for (const e of backlog.current.get(session.id) || []) output(e);
      backlog.current.delete(session.id);
      setList((old) => [...old, { id: session.id, shell: session.shell }]);
      select(session.id);
    } catch (e) {
      report(e);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let imageKey = "";
    let followsYami = true,
      lastWallpaper = "";
    const apply = (value: WorkbenchState) => {
      setData(value);
      followsYami = value.settings.terminalBackground === "yami";
      const key =
        value.settings.terminalBackground + value.settings.terminalImage;
      if (key !== imageKey) {
        imageKey = key;
        void api("workbench.backgroundData").then(setBackground).catch(report);
      }
    };
    void api("workbench.state")
      .then((value) => {
        apply(value);
        void create(undefined, value.settings);
      })
      .catch(report);
    const off = window.yami.on((e) => {
      if (e.type === "terminal-output") output(e);
      if (e.type === "workbench-state") apply(e.state);
      if (
        e.type === "state" &&
        followsYami &&
        e.state.currentWallpaper !== lastWallpaper
      ) {
        lastWallpaper = e.state.currentWallpaper;
        void api("workbench.backgroundData").then(setBackground).catch(report);
      }
      if (e.type === "terminal-closed") {
        for (const view of views.current.values()) {
          view.exited = true;
          view.orphaned = true;
        }
        setError(
          "The terminal host closed. End its sessions and open a new one.",
        );
      }
    });
    const observer = new ResizeObserver(() => {
      if (host.current?.offsetWidth)
        views.current.get(active.current)?.fit.fit();
    });
    if (host.current) observer.observe(host.current);
    return () => {
      mounted.current = false;
      off();
      observer.disconnect();
      for (const view of views.current.values()) view.terminal.dispose();
      views.current.clear();
    };
  }, []);
  async function end() {
    const view = views.current.get(selected);
    if (!view) return;
    if (
      !view.exited &&
      !window.confirm(
        "End this shell and its running processes? Hide the window instead to keep them running.",
      )
    )
      return;
    try {
      if (!view.orphaned) await api("terminal.end", { session: selected });
      view.terminal.dispose();
      view.element.remove();
      views.current.delete(selected);
      setList((old) => old.filter((v) => v.id !== selected));
      const next = [...views.current.keys()][0];
      if (next) select(next);
      else setSelected("");
    } catch (e) {
      report(e);
    }
  }
  return (
    <div
      className="terminal-shell"
      style={
        {
          "--terminal-image": background ? `url("${background}")` : "none",
          "--terminal-blur": `${data?.settings.terminalBlur || 0}px`,
          "--terminal-opacity": data?.settings.terminalOpacity ?? 0.22,
        } as React.CSSProperties
      }
    >
      <header className="titlebar">
        <div className="brand">
          <Icon name="terminal-window" />
          <span>Yami Terminal</span>
        </div>
        <div className="window-controls">
          <IconButton
            icon="minus"
            label="Minimize terminal"
            onClick={() => void api("terminal.minimize")}
          />
          <IconButton
            icon="x"
            label="Hide terminal and keep sessions running"
            onClick={() => void api("terminal.hide")}
          />
        </div>
      </header>
      <nav className="terminal-tabs" aria-label="Terminal sessions">
        {list.map((v, i) => (
          <button
            key={v.id}
            data-session={v.id}
            className={selected === v.id ? "selected" : ""}
            onClick={() => select(v.id)}
          >
            {v.shell} {i + 1}
          </button>
        ))}
        <IconButton
          icon="plus"
          label="New terminal session"
          onClick={() => void create()}
        />
        <IconButton
          icon="folder-open"
          label="Open shell in a folder"
          onClick={() =>
            void api("terminal.folder")
              .then((cwd) => {
                if (cwd) void create(cwd);
              })
              .catch(report)
          }
        />
        <button
          className="text-button"
          disabled={!selected}
          onClick={() => {
            const text = views.current.get(selected)?.terminal.getSelection();
            if (!text) setError("Select terminal output first.");
            else void api("terminal.context", { text }).catch(report);
          }}
        >
          Attach selection
        </button>
        <button
          className="text-button"
          disabled={!selected}
          onClick={() => void end()}
        >
          End session
        </button>
      </nav>
      {error && (
        <div className="terminal-error" role="status">
          {error}
          <IconButton
            icon="x"
            label="Dismiss terminal error"
            onClick={() => setError("")}
          />
        </div>
      )}
      <div className="terminal-host" ref={host} />
      <footer className="terminal-footer">
        {views.current.get(selected)?.cwd || "Open a shell to begin"}
        <span>Ctrl+Shift+C / V · Closing this window hides it</span>
      </footer>
    </div>
  );
}
