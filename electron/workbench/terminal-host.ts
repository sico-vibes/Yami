import readline from "node:readline";
import type { IPty } from "node-pty";
// Loaded only in the on-demand Node sidecar, never in an idle renderer/main.
const pty = require(
  process.env.YAMI_PTY_MODULE || "node-pty",
) as typeof import("node-pty");
const sessions = new Map<string, IPty>();
let stopping = false;
const send = (value: unknown) =>
  process.stdout.write(JSON.stringify(value) + "\n");
const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
lines.on("line", (line) => {
  if (line.length > 1048576) return;
  let request: any;
  try {
    request = JSON.parse(line);
    const { method, session } = request;
    if (method === "open") {
      if (sessions.size >= 8 || sessions.has(session))
        throw new Error("Terminal session limit reached.");
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.YAMI_PTY_MODULE;
      const child = pty.spawn(
        request.shell,
        // PowerShell hides its banner; Git Bash starts as a login shell.
        /(pwsh|powershell)\.exe$/i.test(request.shell)
          ? ["-NoLogo"]
          : /bash\.exe$/i.test(request.shell)
            ? ["--login", "-i"]
            : [],
        {
          name: "xterm-256color",
          cols: request.cols,
          rows: request.rows,
          cwd: request.cwd,
          env: env as Record<string, string>,
          useConpty: true,
          useConptyDll: true,
        },
      );
      sessions.set(session, child);
      send({ id: request.id, result: { pid: child.pid } });
      child.onData((data) => {
        if (
          !send({
            type: "data",
            session,
            data: Buffer.from(data, "utf8").toString("base64"),
          })
        )
          child.pause();
      });
      child.onExit(({ exitCode }) => {
        send({ type: "exit", session, code: exitCode });
        sessions.delete(session);
      });
      return;
    }
    const child = sessions.get(session);
    if (method === "write") {
      if (!child) throw new Error("Shell has exited.");
      child.write(Buffer.from(request.data, "base64").toString("utf8"));
    } else if (method === "resize") {
      if (child) child.resize(request.cols, request.rows);
    } else if (method === "close") {
      if (child) {
        child.resume();
        child.kill();
        sessions.delete(session);
      }
    } else throw new Error("Unknown terminal operation.");
    send({ id: request.id, result: true });
  } catch (error) {
    send({ id: request?.id, error: (error as Error).message });
  }
});
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of sessions.values()) {
    try {
      child.resume();
      child.kill();
    } catch {}
  }
  sessions.clear();
  lines.close();
  setTimeout(() => process.exit(0), 500).unref();
}
process.stdin.on("end", stop);
process.on("SIGTERM", stop);
process.on("disconnect", stop);
process.stdout.on("drain", () => {
  for (const child of sessions.values()) child.resume();
});
process.stdout.on("error", stop);
