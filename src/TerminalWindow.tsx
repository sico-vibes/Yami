import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { api } from "./api";
import { Icon, IconButton, Modal } from "./ui";
import { cssToken } from "./css-token";
import { Select, TooltipLayer } from "./controls";
import type { WorkbenchState, WorkbenchSettings } from "./workbench-types";
type View = {
  id: string;
  terminal: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  element: HTMLDivElement;
  shell: string;
  cwd: string;
  exited?: boolean;
  orphaned?: boolean;
};
const shellLabels: Record<string, string> = {
  pwsh: "PowerShell 7",
  powershell: "Windows PowerShell",
  cmd: "Command Prompt",
  bash: "Git Bash",
  wsl: "WSL",
};

export default function TerminalWindow() {
  const host = useRef<HTMLDivElement>(null),
    views = useRef(new Map<string, View>()),
    active = useRef("");
  const [list, setList] = useState<
      { id: string; shell: string; title?: string }[]
    >([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [ending, setEnding] = useState(false),
    [data, setData] = useState<WorkbenchState | null>(null),
    [background, setBackground] = useState("");
  const [finding, setFinding] = useState(false),
    [needle, setNeedle] = useState(""),
    [shells, setShells] = useState<string[]>([]),
    [shell, setShell] = useState("");
  // Read by create(), which outlives a render.
  const shellChoice = useRef("");
  shellChoice.current = shell;
  const find = (back = false) => {
    const view = views.current.get(active.current);
    if (!view || !needle) return;
    const found = back
      ? view.search.findPrevious(needle)
      : view.search.findNext(needle);
    if (!found) setError(`"${needle}" is not in this tab's scrollback.`);
  };
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
  type Launch = { cwd: string; command?: string; title: string };
  async function create(
    cwd?: string,
    settings?: WorkbenchSettings,
    launch?: Launch,
  ) {
    try {
      const session = await api("terminal.create", {
        cwd,
        ...(shellChoice.current && { shell: shellChoice.current }),
      });
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
        theme: terminalTheme(),
      });
      const fit = new FitAddon();
      const search = new SearchAddon();
      terminal.loadAddon(fit);
      terminal.loadAddon(search);
      terminal.open(element);
      const view = { ...session, terminal, fit, search, element };
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
        if (
          e.type === "keydown" &&
          e.ctrlKey &&
          e.shiftKey &&
          e.key.toLowerCase() === "f"
        ) {
          setFinding(true);
          return false;
        }
        return true;
      });
      for (const e of backlog.current.get(session.id) || []) output(e);
      backlog.current.delete(session.id);
      setList((old) => [
        ...old,
        { id: session.id, shell: session.shell, title: launch?.title },
      ]);
      select(session.id);
      // The command is one of Yami's agent CLIs, typed as if by the user.
      if (launch?.command)
        void api("terminal.write", {
          session: session.id,
          text: launch.command + "\r",
        }).catch(report);
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
    // Tabs other pages asked for (a project or an agent), else one shell.
    const drain = async (settings?: WorkbenchSettings, fallback = false) => {
      const queued: Launch[] = await api("terminal.launches");
      for (const item of queued) await create(item.cwd, settings, item);
      if (!queued.length && fallback) await create(undefined, settings);
    };
    void api("terminal.shells")
      .then(setShells)
      .catch(() => {});
    void api("workbench.state")
      .then((value) => {
        apply(value);
        return drain(value.settings, true);
      })
      .catch(report);
    const off = window.yami.on((e) => {
      if (e.type === "terminal-output") output(e);
      if (e.type === "terminal-launch") void drain().catch(report);
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
  async function end(confirmed = false) {
    const view = views.current.get(selected);
    if (!view) return;
    if (!view.exited && !confirmed) {
      setEnding(true);
      return;
    }
    setEnding(false);
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
      <TooltipLayer />
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
        <div className="terminal-sessions">
          {list.map((v, i) => (
            <button
              key={v.id}
              data-session={v.id}
              className={selected === v.id ? "selected" : ""}
              onClick={() => select(v.id)}
            >
              {v.title || `${v.shell} ${i + 1}`}
            </button>
          ))}
        </div>
        {shells.length > 1 && (
          <Select
            label="Shell for new tabs"
            value={shell}
            onChange={setShell}
            options={[
              { value: "", label: "Default shell", icon: "terminal-window" },
              ...shells.map((name) => ({
                value: name,
                label: shellLabels[name] || name,
                icon: "terminal",
              })),
            ]}
          />
        )}
        <IconButton
          icon="plus"
          label="New terminal session"
          onClick={() => void create()}
        />
        <IconButton
          icon="magnifying-glass"
          label="Search this tab (Ctrl+Shift+F)"
          active={finding}
          onClick={() => setFinding(!finding)}
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
        <span className="spacer" />
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
      {finding && (
        <form
          className="terminal-find"
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
        >
          <input
            autoFocus
            aria-label="Find in this tab"
            placeholder="Find in this tab's scrollback"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setFinding(false);
                views.current.get(active.current)?.terminal.focus();
              }
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                find(true);
              }
            }}
          />
          <IconButton
            icon="caret-up"
            label="Previous match"
            onClick={() => find(true)}
          />
          <IconButton
            icon="caret-down"
            label="Next match"
            onClick={() => find()}
          />
          <IconButton
            icon="x"
            label="Close search"
            onClick={() => setFinding(false)}
          />
        </form>
      )}
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
      {ending && (
        <Modal title="End this session?" onClose={() => setEnding(false)}>
          <p className="setting-note">
            The shell and everything it started will stop. Hide the window
            instead to keep them running.
          </p>
          <div className="dialog-actions">
            <button className="soft-button" onClick={() => setEnding(false)}>
              Keep running
            </button>
            <button
              className="primary-button"
              autoFocus
              onClick={() => void end(true)}
            >
              End session
            </button>
          </div>
        </Modal>
      )}
      <footer className="terminal-footer">
        {views.current.get(selected)?.cwd || "Open a shell to begin"}
        <span>Ctrl+Shift+C / V · Closing this window hides it</span>
      </footer>
    </div>
  );
}

// xterm needs literal colours, so the Nightglow terminal tokens are read here.
function terminalTheme() {
  const t = (name: string) => cssToken("--term-" + name);
  return {
    background: "rgba(0, 0, 0, 0)",
    foreground: t("fg"),
    cursor: t("cursor"),
    cursorAccent: cssToken("--ink-1"),
    selectionBackground: t("selection"),
    black: t("black"),
    red: t("red"),
    green: t("green"),
    yellow: t("yellow"),
    blue: t("blue"),
    magenta: t("magenta"),
    cyan: t("cyan"),
    white: t("white"),
    brightBlack: t("bright-black"),
    brightRed: t("bright-red"),
    brightGreen: t("bright-green"),
    brightYellow: t("bright-yellow"),
    brightBlue: t("bright-blue"),
    brightMagenta: t("bright-magenta"),
    brightCyan: t("bright-cyan"),
    brightWhite: t("bright-white"),
  };
}
