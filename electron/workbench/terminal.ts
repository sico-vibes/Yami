import { app, BrowserWindow, dialog, shell, type WebContents } from "electron";
import {
  spawn,
  execFileSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { randomUUID } from "node:crypto";
import { integratedLaunch } from "./shell-integration";
import { readSshHosts } from "./ssh-hosts";
import { makeWindow } from "../windows";
export function helperPath(name: string) {
  return path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    "native",
    app.isPackaged ? "" : "bin",
    name,
  );
}
export function findExecutable(name: string): string | undefined {
  const candidates = [
    ...(process.env.PATH || "")
      .split(path.delimiter)
      .map((p) => path.join(p.replace(/^"|"$/g, ""), name)),
    path.join(os.homedir(), ".local", "bin", name),
    path.join(
      process.env.LOCALAPPDATA || "",
      "Microsoft",
      "WinGet",
      "Links",
      name,
    ),
  ];
  return candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}
const isFolder = (p: string) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
export const shellNames = ["auto", "pwsh", "powershell", "cmd", "bash", "wsl"];

/** Git Bash is looked for where Git for Windows installs, never WSL's bash.exe. */
export function findShell(name: string): string | undefined {
  if (name === "auto")
    return (
      findExecutable("pwsh.exe") ||
      findExecutable("powershell.exe") ||
      findExecutable("cmd.exe")
    );
  if (name === "bash")
    return [
      path.join(
        process.env.ProgramFiles || "C:\\Program Files",
        "Git",
        "bin",
        "bash.exe",
      ),
      path.join(
        process.env.LOCALAPPDATA || "",
        "Programs",
        "Git",
        "bin",
        "bash.exe",
      ),
    ].find((p) => fs.existsSync(p));
  return findExecutable(`${name}.exe`);
}

type Port = { port: number; pid: number; address: string; name: string };

export class TerminalController {
  window?: BrowserWindow;
  child?: ChildProcessWithoutNullStreams;
  private lines?: readline.Interface;
  private credit = new Map<string, number>();
  private ready: Promise<any> = Promise.resolve();
  private serial = 0;
  private pending = new Map<
    number,
    {
      resolve: (r: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private sessions = new Map<
    string,
    { owner: number; cwd: string; shell: string; pid?: number }
  >();
  // Tabs another page asked for; the terminal page drains them when ready.
  private launches: { cwd: string; command?: string; title: string }[] = [];
  constructor(
    private settings: () => {
      terminalShell: string;
      terminalMarks?: boolean;
      terminalRestore?: boolean;
    },
    private selection: (text: string) => void,
    private processJob: (pid: number, own: boolean) => Promise<any>,
    private notice: (text: string) => void = () => {},
    /** Where the tab layout is kept between sessions. */
    private layoutFile = "",
    /** Ports a process and everything it started listen on (native host). */
    private ports: (pid: number) => Promise<Port[]> = async () => [],
  ) {}
  open() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.focus();
      return;
    }
    this.window = makeWindow("terminal", {
      width: 1000,
      height: 650,
      minWidth: 650,
      minHeight: 400,
      backgroundColor: "#11191e",
    });
    this.window.once("ready-to-show", () => this.window?.show());
    this.window.on("close", (e) => {
      if (!this.disposing) {
        e.preventDefault();
        this.window?.hide();
      }
    });
    this.window.on("closed", () => {
      this.window = undefined;
      this.disposeHost();
    });
  }
  /** Opens a tab in `cwd` and types `command`, which comes from Yami's list. */
  launch(item: { cwd: string; command?: string; title: string }) {
    this.launches = [...this.launches, item].slice(-4);
    this.open();
    const page = this.window?.webContents;
    if (page && !page.isLoading())
      page.send("yami:event", { type: "terminal-launch" });
  }
  private disposing = false;
  private startHost() {
    if (this.child) return;
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_INSPECT_RESUME_ON_START;
    env.ELECTRON_RUN_AS_NODE = "1";
    env.YAMI_PTY_MODULE = app.isPackaged
      ? path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "node_modules",
          "node-pty",
        )
      : require.resolve("node-pty");
    const child = (this.child = spawn(
      process.execPath,
      [path.join(__dirname, "terminal-host.cjs")],
      {
        stdio: "pipe",
        windowsHide: true,
        env,
      },
    ));
    const lines = (this.lines = readline.createInterface({
      input: child.stdout,
    }));
    this.ready = child.pid
      ? this.processJob(child.pid, true).catch((error) => {
          child.kill();
          throw error;
        })
      : Promise.reject(new Error("Terminal helper did not start."));
    lines.on("line", (line) => {
      if (line.length > 2 * 1024 * 1024) {
        this.disposeHost();
        return;
      }
      try {
        const value = JSON.parse(line);
        if (value.id) {
          const p = this.pending.get(value.id);
          if (!p) return;
          clearTimeout(p.timer);
          this.pending.delete(value.id);
          if (value.error) p.reject(new Error(value.error));
          else p.resolve(value.result);
        } else {
          const session = this.sessions.get(value.session);
          if (session?.pid && value.type === "exit") {
            void this.processJob(session.pid, false).catch(() => {});
            session.pid = undefined;
          }
          if (session && value.type === "data") {
            this.credit.set(
              value.session,
              (this.credit.get(value.session) || 0) +
                Buffer.byteLength(value.data || "", "base64"),
            );
            if ([...this.credit.values()].reduce((n, v) => n + v, 0) > 524288)
              lines.pause();
          }
          if (session && this.window && !this.window.isDestroyed())
            this.window.webContents.send("yami:event", {
              ...value,
              type: "terminal-output",
              kind: value.type,
            });
        }
      } catch {}
    });
    const failed = () => {
      if (this.child !== child) return;
      this.child = undefined;
      this.lines = undefined;
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("The terminal host closed."));
      }
      this.pending.clear();
      this.sessions.clear();
      if (this.window && !this.window.isDestroyed())
        this.window.webContents.send("yami:event", { type: "terminal-closed" });
    };
    child.on("error", failed);
    child.stdin.on("error", failed);
    child.on("exit", failed);
    child.stderr.on("data", () => {});
  }
  private async call(method: string, args: any) {
    this.startHost();
    await this.ready;
    return new Promise<any>((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Terminal operation timed out."));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.child!.stdin.write(
        JSON.stringify({ id, method, ...args }) + "\n",
        (error) => {
          if (error) {
            clearTimeout(timer);
            this.pending.delete(id);
            reject(error);
          }
        },
      );
    });
  }
  private owner(sender?: WebContents) {
    if (!sender || this.window?.webContents.id !== sender.id)
      throw new Error("Terminal input must come from its own window.");
    return sender.id;
  }
  async invoke(method: string, a: any, sender?: WebContents) {
    if (method === "terminal.open") {
      this.open();
      return true;
    }
    const owner = this.owner(sender);
    if (method === "terminal.shells")
      return shellNames.filter((n) => n !== "auto" && findShell(n));
    // Hosts from ~/.ssh/config, offered when Windows' OpenSSH client is here.
    // The tabs to reopen: shells and folders only, never the processes.
    if (method === "terminal.layout") {
      if (!this.layoutFile || this.settings().terminalRestore === false)
        return [];
      try {
        const saved = JSON.parse(fs.readFileSync(this.layoutFile, "utf8"));
        return (Array.isArray(saved) ? saved : [])
          .slice(0, 8)
          .map((tab: any) => ({
            shell: shellNames.includes(tab.shell) ? tab.shell : "",
            cwd: typeof tab.cwd === "string" && isFolder(tab.cwd) ? tab.cwd : "",
            title: String(tab.title || "").slice(0, 60),
          }));
      } catch {
        return [];
      }
    }
    if (method === "terminal.layout.save") {
      if (!this.layoutFile) return false;
      const tabs = (Array.isArray(a.tabs) ? a.tabs : []).slice(0, 8).map(
        (tab: any) => ({
          shell: shellNames.includes(tab.shell) ? tab.shell : "",
          cwd: String(tab.cwd || "").slice(0, 1024),
          title: String(tab.title || "").slice(0, 60),
        }),
      );
      fs.mkdirSync(path.dirname(this.layoutFile), { recursive: true });
      fs.writeFileSync(this.layoutFile, JSON.stringify(tabs));
      return true;
    }
    if (method === "terminal.ssh")
      return findExecutable("ssh.exe") ? readSshHosts() : [];
    if (method === "terminal.launches") {
      const queued = this.launches;
      this.launches = [];
      return queued;
    }
    if (method === "terminal.hide") {
      this.window?.hide();
      return true;
    }
    if (method === "terminal.minimize") {
      this.window?.minimize();
      return true;
    }
    if (method === "terminal.folder")
      return (
        (
          await dialog.showOpenDialog(this.window!, {
            properties: ["openDirectory"],
          })
        ).filePaths[0] || ""
      );
    if (method === "terminal.context") {
      const text = String(a.text || "");
      if (text.length > 24000)
        throw new Error("Select up to 24,000 characters.");
      this.selection(text);
      return true;
    }
    if (method === "terminal.create") {
      if (this.sessions.size >= 8)
        throw new Error(
          "Close a terminal before opening another (maximum eight).",
        );
      const shellName = String(a.shell || this.settings().terminalShell);
      if (!shellNames.includes(shellName))
        throw new Error("Unsupported shell.");
      const shell = findShell(shellName);
      if (!shell) throw new Error("This shell is not installed.");
      const cwd = a.cwd ? path.resolve(String(a.cwd)) : os.homedir();
      if (!fs.statSync(cwd).isDirectory())
        throw new Error("Choose a working folder.");
      const id = randomUUID();
      this.sessions.set(id, { owner, cwd, shell });
      try {
        const opened = await this.call("open", {
          session: id,
          shell,
          cwd,
          cols: 100,
          rows: 30,
          ...integratedLaunch(shell, this.settings().terminalMarks !== false),
        });
        if (opened?.pid) {
          await this.processJob(opened.pid, true);
          this.sessions.get(id)!.pid = opened.pid;
        }
      } catch (e) {
        await this.call("close", { session: id }).catch(() => {});
        this.sessions.delete(id);
        if (!this.sessions.size) this.disposeHost();
        throw e;
      }
      return { id, cwd, shell: path.basename(shell) };
    }
    if (method === "terminal.reveal") {
      // A path Ctrl+clicked in output: shown in Explorer if it is there.
      const target = path.resolve(String(a.path || ""));
      if (!/^([A-Za-z]:\\|\\\\)/.test(target) || !fs.existsSync(target))
        throw new Error("That path is not on this PC.");
      if (fs.statSync(target).isDirectory()) {
        const error = await shell.openPath(target);
        if (error) throw new Error(error);
      } else shell.showItemInFolder(target);
      return true;
    }
    const session = this.sessions.get(a.session);
    if (!session || session.owner !== owner)
      throw new Error("Terminal session is closed.");
    if (method === "terminal.ports") {
      if (!session.pid) return [];
      const seen = new Set<number>();
      // One row per port; a server often listens on IPv4 and IPv6 alike.
      return (await this.ports(session.pid))
        .filter((p) => !seen.has(p.port) && seen.add(p.port))
        .sort((x, y) => x.port - y.port)
        .map((p) => ({
          port: p.port,
          name: String(p.name || "").replace(/\.exe$/i, ""),
          // 127.0.0.1 or every address; :: and 0.0.0.0 both reach localhost.
          url: `http://localhost:${p.port}/`,
        }));
    }
    if (method === "terminal.finished") {
      // A long command ended; say so only when nobody is looking.
      if (this.window?.isVisible() && this.window.isFocused()) return false;
      const title = String(a.title || "Terminal").slice(0, 60);
      const code = Number(a.exit);
      const seconds = Math.round(Math.max(0, Number(a.ms) || 0) / 1000);
      this.notice(
        Number.isInteger(code) && code !== 0
          ? `${title}: the command failed (exit ${code}) after ${seconds} s.`
          : `${title}: the command finished after ${seconds} s.`,
      );
      return true;
    }
    if (method === "terminal.ack") {
      this.credit.set(
        a.session,
        Math.max(
          0,
          (this.credit.get(a.session) || 0) -
            Math.max(0, Math.min(65536, Number(a.bytes) || 0)),
        ),
      );
      if ([...this.credit.values()].reduce((n, v) => n + v, 0) < 262144)
        this.lines?.resume();
      return true;
    }
    if (method === "terminal.write") {
      const text = String(a.text || "");
      if (Buffer.byteLength(text) > 65536)
        throw new Error("Paste up to 64 KB at a time.");
      return this.call("write", {
        session: a.session,
        data: Buffer.from(text).toString("base64"),
      });
    }
    if (method === "terminal.resize")
      return this.call("resize", {
        session: a.session,
        cols: Math.min(500, Math.max(2, Number(a.cols) || 100)),
        rows: Math.min(250, Math.max(2, Number(a.rows) || 30)),
      });
    if (method === "terminal.end") {
      if (session.pid) await this.processJob(session.pid, false);
      await this.call("close", { session: a.session });
      this.sessions.delete(a.session);
      if (!this.sessions.size) this.disposeHost();
      return true;
    }
    throw new Error("Unknown terminal operation.");
  }
  focus(_id?: string) {
    this.open();
  }
  private disposeHost() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("The terminal host closed."));
    }
    this.pending.clear();
    this.lines?.close();
    this.lines = undefined;
    this.credit.clear();
    for (const item of this.sessions.values())
      if (item.pid) void this.processJob(item.pid, false).catch(() => {});
    if (this.child?.pid)
      void this.processJob(this.child.pid, false).catch(() => {});
    this.child?.stdin.end();
    this.child = undefined;
    this.sessions.clear();
  }
  dispose() {
    this.disposing = true;
    if (
      this.child?.pid &&
      this.child.exitCode === null &&
      process.platform === "win32"
    ) {
      try {
        execFileSync(
          "taskkill.exe",
          ["/PID", String(this.child.pid), "/T", "/F"],
          { windowsHide: true, timeout: 3000, stdio: "ignore" },
        );
      } catch {}
    }
    this.window?.destroy();
    this.disposeHost();
  }
}
