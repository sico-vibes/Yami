import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

// A local mail catcher for developers: Mailpit (MIT), downloaded as a pack,
// started and stopped only by the user. It listens on this PC only, so apps
// under development can send mail to 127.0.0.1:1025 and nothing leaves.

export const MAIL_SMTP = "127.0.0.1:1025";
export const MAIL_WEB = "127.0.0.1:8025";

/** Mailpit's options; both addresses are bound to loopback explicitly. */
export function mailpitArgs(database: string) {
  return [
    "--listen",
    MAIL_WEB,
    "--smtp",
    MAIL_SMTP,
    "--database",
    database,
    "--max",
    "500",
    "--disable-version-check",
  ];
}

export class MailCatcher {
  private child?: ChildProcess;
  constructor(
    private deps: {
      /** The installed mailpit.exe, or "" when the pack is not installed. */
      exe: () => Promise<string>;
      dataDir: string;
      spawnImpl?: typeof spawn;
    },
  ) {}

  running() {
    return !!this.child && this.child.exitCode === null;
  }

  async status() {
    return {
      installed: !!(await this.deps.exe()),
      running: this.running(),
      smtp: MAIL_SMTP,
      web: `http://${MAIL_WEB}`,
    };
  }

  async start() {
    if (this.running()) return this.status();
    const exe = await this.deps.exe();
    if (!exe) throw new Error("Download the Mailpit pack first.");
    const child = (this.deps.spawnImpl || spawn)(
      exe,
      mailpitArgs(path.join(this.deps.dataDir, "mailpit.db")),
      { windowsHide: true, stdio: "ignore" },
    );
    this.child = child;
    child.once("exit", () => {
      if (this.child === child) this.child = undefined;
    });
    // Mailpit exits at once when a port is taken; say so instead of "running".
    const early = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      child.once("exit", (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });
      child.once("error", () => {
        clearTimeout(timer);
        resolve(1);
      });
    });
    if (early !== null)
      throw new Error(
        "Mailpit stopped straight away. Is something else using port 1025 or 8025?",
      );
    return this.status();
  }

  stop() {
    this.child?.kill();
    this.child = undefined;
    return this.status();
  }
}
