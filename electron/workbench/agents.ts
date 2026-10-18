import net, { type Socket } from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  AgentSession,
  AgentRequest,
  AgentPhase,
} from "../../src/workbench-types";
import type { WorkbenchStorage } from "./storage";
export const agentNames = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "copilot",
  "cursor",
  "antigravity",
  "amp",
  "hermes",
  "muse",
];
const phaseFor: Record<string, AgentPhase> = {
  SessionStart: "idle",
  UserPromptSubmit: "thinking",
  BeforeAgent: "thinking",
  userPromptSubmitted: "thinking",
  PreToolUse: "working",
  BeforeTool: "working",
  preToolUse: "working",
  PostToolUse: "working",
  AfterTool: "working",
  PostToolUseFailure: "working",
  Stop: "finished",
  AfterAgent: "finished",
  agentStop: "finished",
  StopFailure: "error",
  SessionEnd: "disconnected",
  sessionEnd: "disconnected",
  sessionStart: "idle",
  "session.idle": "finished",
  "session.busy": "working",
  "session.error": "error",
  "tool.execute.before": "working",
  "tool.execute.after": "working",
  beforeSubmitPrompt: "thinking",
  beforeShellExecution: "working",
  afterFileEdit: "working",
  stop: "finished",
  Interrupt: "finished",
};
export function normalizeAgentEvent(
  payload: any,
  now = Date.now(),
): AgentSession {
  const agent = String(payload.yami_agent || "claude").toLowerCase();
  if (!agentNames.includes(agent)) throw new Error("Unknown agent.");
  const event = String(
    payload.hook_event_name || payload.event || payload.type || "Notification",
  );
  const cwd = String(payload.cwd || payload.workspace_roots?.[0] || "").slice(
    0,
    2000,
  );
  const id = String(
    payload.session_id ||
      payload.sessionId ||
      payload.conversation_id ||
      payload.thread_id ||
      createHash("sha256")
        .update(agent + cwd)
        .digest("hex")
        .slice(0, 16),
  ).slice(0, 180);
  const tool = String(
    payload.tool_name || payload.toolName || payload.tool?.name || "",
  ).slice(0, 100);
  const files = [
    payload.tool_input?.file_path,
    payload.tool_input?.path,
    payload.toolInput?.file_path,
  ]
    .filter((x) => typeof x === "string")
    .map((x) => x.slice(0, 2000));
  let phase = phaseFor[event] || "working";
  if (
    /permission|question|input_required/i.test(event) ||
    (event === "PreToolUse" && tool === "AskUserQuestion")
  )
    phase = "waiting";
  if (event === "Notification")
    phase = /permission|input|idle_prompt/i.test(
      String(payload.notification_type),
    )
      ? "waiting"
      : "idle";
  return {
    id: `${agent}:${id}`,
    agent,
    cwd,
    project: path.basename(cwd) || agent,
    phase,
    detail: (tool
      ? `${tool}${files[0] ? " · " + path.basename(files[0]) : ""}`
      : String(payload.message || payload.prompt || event)
    ).slice(0, 250),
    at: now,
    source: "hook",
    window: Number(payload.yami_window) || undefined,
    files,
  };
}
export class AgentHub {
  server?: net.Server;
  private token = randomBytes(32).toString("hex");
  private sockets = new Set<Socket>();
  private waiting = new Map<
    string,
    {
      socket: Socket;
      timer: NodeJS.Timeout;
      payload: any;
      acknowledged: boolean;
    }
  >();
  readonly configFile: string;
  private pipe: string;
  constructor(
    private storage: WorkbenchStorage,
    private changed: () => void,
  ) {
    this.configFile = path.join(path.dirname(storage.file), "agent-relay.json");
    this.pipe =
      "yami-" +
      createHash("sha256")
        .update(os.userInfo().username + storage.file)
        .digest("hex")
        .slice(0, 24);
  }
  start() {
    if (this.server) return;
    fs.mkdirSync(path.dirname(this.configFile), { recursive: true });
    fs.writeFileSync(
      this.configFile,
      JSON.stringify({ pipe: this.pipe, token: this.token }),
      { mode: 0o600 },
    );
    this.server = net.createServer((socket) => this.accept(socket));
    this.server.on("error", () => {
      this.storage.state.sessions = this.storage.state.sessions.map((s) => ({
        ...s,
        phase: "disconnected",
      }));
      this.changed();
    });
    this.server.listen(
      process.platform === "win32"
        ? `\\\\.\\pipe\\${this.pipe}`
        : path.join(os.tmpdir(), this.pipe + ".sock"),
    );
  }
  private accept(socket: Socket) {
    if (this.sockets.size >= 32) {
      socket.destroy();
      return;
    }
    this.sockets.add(socket);
    socket.setTimeout(5000, () => socket.destroy());
    let body = "",
      received = false;
    socket.on("close", () => {
      this.sockets.delete(socket);
      for (const [id, w] of this.waiting)
        if (w.socket === socket) this.finish(id, "ask");
    });
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      if (received) return;
      body += chunk.toString("utf8");
      if (Buffer.byteLength(body) > 1048576) {
        socket.destroy();
        return;
      }
      if (!body.includes("\n")) return;
      received = true;
      try {
        const p = JSON.parse(body.split("\n")[0]);
        const token = Buffer.from(String(p.token || ""));
        if (
          token.length !== this.token.length ||
          !timingSafeEqual(token, Buffer.from(this.token))
        )
          throw new Error("Invalid relay token.");
        const s = normalizeAgentEvent(p);
        this.update(s);
        const permission = /^(PermissionRequest|permissionRequest)$/.test(
          String(p.hook_event_name),
        );
        const question =
          p.tool_name === "AskUserQuestion" &&
          Array.isArray(p.tool_input?.questions);
        if (p.tool_name === "AskUserQuestion" && permission) {
          socket.end("{}\n");
          return;
        }
        if (
          question &&
          (p.tool_input.questions.length < 1 ||
            p.tool_input.questions.length > 4 ||
            p.tool_input.questions.some(
              (q: any) =>
                typeof q.question !== "string" ||
                q.question.length > 4000 ||
                !Array.isArray(q.options) ||
                q.options.length < 2 ||
                q.options.length > 8 ||
                q.options.some(
                  (o: any) =>
                    typeof o.label !== "string" || o.label.length > 300,
                ),
            ))
        ) {
          socket.end("{}\n");
          return;
        }
        if (
          (permission &&
            ["claude", "codex", "copilot", "muse"].includes(s.agent)) ||
          (question && s.agent === "claude")
        ) {
          const id = randomUUID();
          const request: AgentRequest = {
            id,
            sessionId: s.id,
            agent: s.agent,
            kind: question ? "question" : "permission",
            title: question
              ? "Your agent has a question"
              : `${s.agent} needs permission`,
            detail: JSON.stringify(
              p.tool_input || p.toolInput || p,
              (key, v) => (key === "token" ? undefined : v),
              2,
            ).slice(0, 12000),
            expiresAt: Date.now() + 108000,
            questions: question
              ? p.tool_input.questions.slice(0, 4)
              : undefined,
          };
          socket.setTimeout(110000);
          this.waiting.set(id, {
            socket,
            payload: p,
            acknowledged: false,
            timer: setTimeout(() => this.finish(id, "ask"), 1200),
          });
          this.storage.state.requests.push(request);
          this.changed();
        } else socket.end("{}\n");
      } catch {
        socket.end("{}\n");
      }
    });
  }
  update(session: AgentSession) {
    const previous = this.storage.state.sessions.find(
      (s) => s.id === session.id,
    );
    this.storage.state.sessions = [
      ...this.storage.state.sessions.filter((s) => s.id !== session.id),
      {
        ...session,
        files: [
          ...new Set([...(previous?.files || []), ...session.files]),
        ].slice(-100),
      },
    ].slice(-100);
    if (previous?.phase !== session.phase)
      this.storage.state.history.push({
        session: session.id,
        agent: session.agent,
        project: session.project,
        phase: session.phase,
        at: session.at,
      });
    if (session.phase !== "waiting")
      for (const [id, w] of this.waiting)
        if (
          this.storage.state.requests.find((r) => r.id === id)?.sessionId ===
          session.id
        )
          this.finish(id, "ask");
    this.storage.scheduleSave();
    this.changed();
  }
  acknowledge(id: string) {
    const w = this.waiting.get(id);
    if (!w || w.acknowledged) return;
    w.acknowledged = true;
    clearTimeout(w.timer);
    w.timer = setTimeout(() => this.finish(id, "ask"), 106000);
  }
  finish(
    id: string,
    decision: string,
    answers?: Record<string, string | string[]>,
  ) {
    const w = this.waiting.get(id),
      request = this.storage.state.requests.find((r) => r.id === id);
    if (!w || !request) return;
    let reply: any = {};
    if (["allow", "deny", "answer"].includes(decision) && !w.acknowledged)
      throw new Error("Display the request before replying.");
    if (decision === "answer") {
      const questions = request.questions || [];
      if (
        !answers ||
        questions.some(
          (q) =>
            !answers[q.question] ||
            (Array.isArray(answers[q.question])
              ? !q.multiSelect ||
                !(answers[q.question] as string[]).length ||
                (answers[q.question] as string[]).some(
                  (v) => typeof v !== "string" || !v.trim() || v.length > 4000,
                )
              : typeof answers[q.question] !== "string" ||
                !(answers[q.question] as string).trim() ||
                (answers[q.question] as string).length > 4000),
        )
      )
        throw new Error("Answer every question.");
      reply = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: { ...w.payload.tool_input, answers },
        },
      };
    } else if (decision === "allow" || decision === "deny") {
      reply =
        request.agent === "copilot" || request.agent === "muse"
          ? { permissionDecision: decision }
          : {
              hookSpecificOutput: {
                hookEventName: "PermissionRequest",
                decision: { behavior: decision },
              },
            };
    } else if (request.agent === "copilot")
      reply = { permissionDecision: "ask" };
    clearTimeout(w.timer);
    this.waiting.delete(id);
    this.storage.state.requests = this.storage.state.requests.filter(
      (r) => r.id !== id,
    );
    if (!w.socket.destroyed) w.socket.end(JSON.stringify(reply) + "\n");
    this.changed();
  }
  stop() {
    for (const id of [...this.waiting.keys()]) this.finish(id, "ask");
    for (const socket of this.sockets) socket.destroy();
    this.server?.close();
    this.server = undefined;
    this.storage.state.sessions = this.storage.state.sessions.map((s) => ({
      ...s,
      phase: "disconnected",
    }));
  }
}
