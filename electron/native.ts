import { app } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
export class Native {
  process?: ChildProcessWithoutNullStreams;
  counter = 0;
  pending = new Map<
    number,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  constructor(private event: (e: any) => void) {}
  start() {
    const exe = app.isPackaged
      ? path.join(process.resourcesPath, "native", "Yami.Native.exe")
      : path.join(app.getAppPath(), "native", "bin", "Yami.Native.exe");
    this.process = spawn(exe, [], { windowsHide: true, stdio: "pipe" });
    readline
      .createInterface({ input: this.process.stdout })
      .on("line", (line) => {
        try {
          const m = JSON.parse(line);
          if (m.eventName) {
            this.event(m);
            return;
          }
          const p = this.pending.get(m.id);
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(m.id);
            m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
          }
        } catch {}
      });
    this.process.on("error", (e) => this.fail(e));
    this.process.on("exit", () =>
      this.fail(
        new Error("Windows integration stopped. Restart Yami to reconnect."),
      ),
    );
  }
  fail(error: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }
  call(method: string, args: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        reject(new Error("Windows integration is not running."));
        return;
      }
      const id = ++this.counter;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Windows did not respond to " + method));
      }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ id, method, args }) + "\n");
    });
  }
  close() {
    this.process?.kill();
  }
}
