import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import type { AgentSession } from "../../src/workbench-types";
export class TranscriptWatcher {
  private watchers: fs.FSWatcher[] = [];
  private timers = new Map<string, NodeJS.Timeout>();
  private quiet = new Map<string, NodeJS.Timeout>();
  private roots = [
    {
      agent: "claude",
      root: path.join(
        process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"),
        "projects",
      ),
    },
    {
      agent: "codex",
      root: path.join(
        process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
        "sessions",
      ),
    },
  ];
  constructor(
    private current: () => AgentSession[],
    private update: (s: AgentSession) => void,
  ) {}
  start() {
    if (this.watchers.length) return;
    for (const { root, agent } of this.roots)
      if (fs.existsSync(root)) {
        const watcher = fs.watch(root, { recursive: true }, (_event, file) => {
          if (!file || !file.toString().endsWith(".jsonl")) return;
          const target = path.resolve(root, file.toString());
          if (!target.startsWith(path.resolve(root) + path.sep)) return;
          clearTimeout(this.timers.get(target));
          this.timers.set(
            target,
            setTimeout(() => {
              this.timers.delete(target);
              this.read(agent, root, target);
            }, 200),
          );
        });
        watcher.on("error", () => {});
        this.watchers.push(watcher);
      }
    this.rescan();
  }
  rescan() {
    for (const { root, agent } of this.roots) {
      const found: { file: string; at: number }[] = [];
      let visited = 0;
      const walk = (directory: string, depth: number) => {
        if (depth > 4 || visited++ > 80) return;
        try {
          for (const entry of fs
            .readdirSync(directory, { withFileTypes: true })
            .slice(-100)) {
            if (entry.isSymbolicLink()) continue;
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(file, depth + 1);
            else if (entry.name.endsWith(".jsonl")) {
              const info = fs.statSync(file);
              if (Date.now() - info.mtimeMs < 10 * 60000)
                found.push({ file, at: info.mtimeMs });
            }
          }
        } catch {}
      };
      walk(root, 0);
      for (const item of found.sort((a, b) => b.at - a.at).slice(0, 8))
        this.read(agent, root, item.file);
    }
  }
  private read(agent: string, root: string, file: string) {
    let fd: number | undefined;
    try {
      const real = fs.realpathSync(file);
      if (!real.startsWith(fs.realpathSync(root) + path.sep)) return;
      const info = fs.statSync(real);
      if (
        info.size > 128 * 1024 * 1024 ||
        Date.now() - info.mtimeMs > 10 * 60000
      )
        return;
      fd = fs.openSync(real, "r");
      const size = Math.min(info.size, 256 * 1024),
        bytes = Buffer.alloc(size);
      fs.readSync(fd, bytes, 0, size, info.size - size);
      const records = bytes
        .toString("utf8")
        .split("\n")
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
      const last = [...records]
        .reverse()
        .find(
          (r) =>
            r.type === "assistant" ||
            [
              "agent_message",
              "task_complete",
              "task_started",
              "user_message",
            ].includes(r.payload?.type),
        );
      if (!last) return;
      const uuid = file.match(
        /[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/i,
      )?.[0];
      const id = `${agent}:${last.session_id || last.sessionId || last.thread_id || uuid || createHash("sha256").update(file).digest("hex").slice(0, 16)}`;
      const existing = this.current().find((s) => s.id === id);
      if (existing?.source === "hook" && Date.now() - existing.at < 5 * 60000)
        return;
      const cwd = last.cwd || records.find((r) => r.cwd)?.cwd || "";
      const tool = last.message?.content?.some(
        (c: any) => c.type === "tool_use",
      );
      const finished = last.payload?.type === "task_complete";
      const value: AgentSession = {
        id,
        agent,
        cwd,
        project: path.basename(cwd) || "Client session",
        phase: finished ? "finished" : "working",
        detail: finished
          ? "Client reported completion"
          : "Local transcript changed (inferred)",
        at: info.mtimeMs,
        source: "transcript",
        files: [],
      };
      this.update(value);
      clearTimeout(this.quiet.get(id));
      if (!finished)
        this.quiet.set(
          id,
          setTimeout(
            () => {
              this.quiet.delete(id);
              const fresh = this.current().find((s) => s.id === id);
              if (fresh?.source === "hook" || (fresh && fresh.at > value.at))
                return;
              this.update({
                ...value,
                phase: tool ? "waiting" : "finished",
                detail: tool
                  ? "Possible attention — inferred from silence; verify in the client"
                  : "Transcript settled — completion inferred",
                at: Date.now(),
              });
            },
            tool ? 20000 : 2500,
          ),
        );
    } catch {
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }
  stop() {
    for (const watcher of this.watchers) watcher.close();
    this.watchers = [];
    for (const timer of [...this.timers.values(), ...this.quiet.values()])
      clearTimeout(timer);
    this.timers.clear();
    this.quiet.clear();
  }
}
