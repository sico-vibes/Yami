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
import { trackShellMarks, type ShellMarks } from "./terminal-marks";
import { attachLinks } from "./terminal-links";
type View = {
  id: string;
  terminal: Terminal;
  fit: FitAddon;
  search: SearchAddon;
  element: HTMLDivElement;
  shell: string;
  cwd: string;
  title?: string;
  /** The shell asked for ("" for the default), kept for layout restore. */
  shellId: string;
  /** Opened to run a command (an agent or ssh), which is not restored. */
  ran?: boolean;
  marks: ShellMarks;
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
    [background, setBackground] = useState(""),
    // Bumped when a tab's folder or last command changes.
    [marked, setMarked] = useState(0);
  // Saving waits until the last layout has been reopened, so an empty window
  // never overwrites it.
  const restored = useRef(false);
  const [finding, setFinding] = useState(false),
    [needle, setNeedle] = useState(""),
    [shells, setShells] = useState<string[]>([]),
    [sshHosts, setSshHosts] = useState<string[]>([]),
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
  // Split view: up to four tabs at once. One fills the window, two sit side
  // by side, three put one on the left and two on the right, four make a
  // grid. The active pane takes input; the others are dimmed a little.
  const panes = useRef<string[]>([]);
  const [split, setSplit] = useState(0);
  const slots: Record<number, [number, number, number, number][]> = {
    1: [[0, 0, 1, 1]],
    2: [
      [0, 0, 0.5, 1],
      [0.5, 0, 1, 1],
    ],
    3: [
      [0, 0, 0.5, 1],
      [0.5, 0, 1, 0.5],
      [0.5, 0.5, 1, 1],
    ],
    4: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 1, 0.5],
      [0, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1],
    ],
  };
  function layout() {
    panes.current = panes.current.filter((id) => views.current.has(id));
    if (!panes.current.includes(active.current))
      panes.current = active.current ? [active.current] : [];
    const shown = panes.current;
    const many = shown.length > 1;
    for (const view of views.current.values()) {
      const at = shown.indexOf(view.id);
      view.element.hidden = at < 0;
      view.element.classList.toggle(
        "pane-a",
        many && view.id === active.current,
      );
      view.element.classList.toggle(
        "pane-b",
        many && at >= 0 && view.id !== active.current,
      );
      const [l, t, r, b] = (slots[shown.length] || slots[1])[Math.max(0, at)];
      // 12px/16px is the usual inset; 6px either side of a shared edge.
      const edge = (v: number, outer: string) =>
        v === 0 || v === 1 ? outer : `calc(${v * 100}% + 6px)`;
      view.element.style.left = edge(l, "16px");
      view.element.style.top = edge(t, "12px");
      view.element.style.right =
        r === 1 ? "16px" : `calc(${(1 - r) * 100}% + 6px)`;
      view.element.style.bottom =
        b === 1 ? "12px" : `calc(${(1 - b) * 100}% + 6px)`;
      if (at >= 0) view.fit.fit();
    }
    setSplit(shown.length);
  }
  function select(id: string) {
    // A tab that is not on screen takes the active pane's place.
    if (!panes.current.includes(id)) {
      const at = panes.current.indexOf(active.current);
      if (at >= 0) panes.current[at] = id;
    }
    active.current = id;
    setSelected(id);
    layout();
    views.current.get(id)?.terminal.focus();
  }
  /** Adds a pane: the newest tab not shown yet, or a new one. */
  async function addPane() {
    if (panes.current.length >= 4) return;
    const other = [...views.current.keys()]
      .reverse()
      .find((k) => !panes.current.includes(k));
    if (other) {
      panes.current = [...panes.current, other];
      layout();
      return;
    }
    const before = [...panes.current];
    await create();
    if (active.current && !before.includes(active.current)) {
      panes.current = [...before, active.current];
      layout();
    }
  }
  function onePane() {
    panes.current = active.current ? [active.current] : [];
    layout();
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
  type Launch = {
    cwd: string;
    command?: string;
    title: string;
    /** A shell from the saved layout, instead of the menu's choice. */
    shell?: string;
  };
  async function create(
    cwd?: string,
    settings?: WorkbenchSettings,
    launch?: Launch,
  ) {
    // "ssh:<host>" opens the default shell and runs ssh to that host.
    const ssh =
      !launch && shellChoice.current.startsWith("ssh:")
        ? shellChoice.current.slice(4)
        : "";
    if (ssh) launch = { cwd: cwd || "", command: `ssh ${ssh}`, title: ssh };
    const shellId =
      launch?.shell ??
      (ssh || shellChoice.current.startsWith("ssh:")
        ? ""
        : shellChoice.current);
    try {
      const session = await api("terminal.create", {
        cwd,
        ...(shellId && { shell: shellId }),
      });
      if (!mounted.current || !host.current) {
        void api("terminal.end", { session: session.id });
        return;
      }
      const element = document.createElement("div");
      element.className = "terminal-view";
      // Pressing a pane makes it the one that takes input.
      element.addEventListener("mousedown", () => {
        if (active.current !== session.id) select(session.id);
      });
      host.current.appendChild(element);
      const terminal = new Terminal({
        allowTransparency: true,
        cursorBlink: false,
        convertEol: false,
        scrollback: (settings || data?.settings)?.terminalScrollback || 3000,
        fontFamily: '"Cascadia Mono", Consolas, monospace',
        fontSize: 14,
        theme: terminalTheme(),
        // Decorations colour finished commands in the overview ruler.
        allowProposedApi: true,
        overviewRuler: { width: 6 },
      });
      const fit = new FitAddon();
      const search = new SearchAddon();
      terminal.loadAddon(fit);
      terminal.loadAddon(search);
      terminal.open(element);
      attachLinks(terminal, report);
      const marks = trackShellMarks(terminal, {
        cwd: (where) => {
          view.cwd = where;
          setMarked((n) => n + 1);
        },
        finished: (block) => {
          setMarked((n) => n + 1);
          if ((block.ms || 0) >= 10000)
            void api("terminal.finished", {
              session: session.id,
              title: view.title || session.shell,
              exit: block.exit,
              ms: block.ms,
            }).catch(() => {});
        },
        color: (failed) => cssToken(failed ? "--danger" : "--mint"),
      });
      const view: View = {
        ...session,
        title: launch?.title,
        shellId,
        ran: !!launch?.command,
        terminal,
        fit,
        search,
        element,
        marks,
      };
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
        // Ctrl+Up and Ctrl+Down move between prompts once the shell marks them.
        if (
          e.type === "keydown" &&
          e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          (e.key === "ArrowUp" || e.key === "ArrowDown") &&
          marks.active
        ) {
          marks.jump(e.key === "ArrowUp" ? -1 : 1);
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
      if (!queued.length && fallback) {
        const layout: { shell: string; cwd: string; title: string }[] =
          await api("terminal.layout").catch(() => []);
        for (const tab of layout)
          await create(tab.cwd || undefined, settings, {
            cwd: tab.cwd,
            title: tab.title,
            shell: tab.shell,
          });
        if (!layout.length) await create(undefined, settings);
      }
      restored.current = true;
    };
    void api("terminal.shells")
      .then(setShells)
      .catch(() => {});
    void api("terminal.ssh")
      .then(setSshHosts)
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
      if (host.current?.offsetWidth) layout();
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
  // Tabs and their folders are saved a moment after they change.
  useEffect(() => {
    if (!restored.current) return;
    const timer = setTimeout(() => {
      const tabs = list
        .map((item) => views.current.get(item.id))
        .filter((v): v is View => !!v && !v.exited)
        .map((v) => ({
          shell: v.shellId,
          cwd: v.cwd,
          title: v.ran ? "" : v.title || "",
        }));
      void api("terminal.layout.save", { tabs }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [list, marked]);
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
      // The other panes stay; the next one shown takes input.
      panes.current = panes.current.filter((id) => id !== selected);
      setList((old) => old.filter((v) => v.id !== selected));
      const next = panes.current[0] || [...views.current.keys()][0];
      if (next) select(next);
      else {
        active.current = "";
        setSelected("");
        layout();
      }
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
        {(shells.length > 1 || sshHosts.length > 0) && (
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
              ...sshHosts.map((host) => ({
                value: "ssh:" + host,
                label: "SSH: " + host,
                icon: "globe-simple",
              })),
            ]}
          />
        )}
        <IconButton
          icon="plus"
          label="New terminal session"
          onClick={() => void create()}
        />
        {split < 4 && (
          <IconButton
            icon={split >= 2 ? "squares-four" : "columns"}
            label={`Split: add a pane (${Math.max(1, split)} of 4)`}
            active={split > 1}
            onClick={() => void addPane()}
          />
        )}
        {split > 1 && (
          <IconButton icon="square" label="Show one tab" onClick={onePane} />
        )}
        <IconButton
          icon="magnifying-glass"
          label="Search this tab (Ctrl+Shift+F)"
          active={finding}
          onClick={() => setFinding(!finding)}
        />
        <IconButton
          icon="clipboard-text"
          label="Copy the last command and its output"
          onClick={() => {
            const text = views.current.get(active.current)?.marks.lastBlock();
            if (!text)
              setError(
                "No finished command yet. Shells Yami opens mark each command once a prompt appears.",
              );
            else void navigator.clipboard.writeText(text).catch(report);
          }}
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
        <LastCommand marks={views.current.get(selected)?.marks} />
        <span>
          {views.current.get(selected)?.marks.active
            ? "Ctrl+Up / Down: prompts · "
            : ""}
          Ctrl+click links · Ctrl+Shift+C / V · Closing this window hides it
        </span>
      </footer>
    </div>
  );
}

/** How the selected tab's last command ended, when the shell reports it. */
function LastCommand({ marks }: { marks?: ShellMarks }) {
  const last = marks?.last();
  if (!last || last.exit === undefined) return null;
  const seconds = (last.ms || 0) / 1000;
  const took =
    seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`;
  return (
    <span
      className={"terminal-exit" + (last.exit ? " failed" : "")}
      role="status"
    >
      <Icon name={last.exit ? "x-circle" : "check-circle"} size={14} />
      {last.exit ? `Exit ${last.exit}` : "Done"} · {took}
    </span>
  );
}

// xterm needs literal colours, so the Nightglow terminal tokens are read here.
function terminalTheme() {
  const t = (name: string) => cssToken("--term-" + name);
  const clear = "rgba(0, 0, 0, 0)";
  return {
    background: clear,
    overviewRulerBorder: clear,
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
