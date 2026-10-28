import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseMail } from "./mail-parse.ts";

// Yami's own mail catcher for developers: a small SMTP server on this PC only.
// Apps under development send to 127.0.0.1:1025 and the mail lands in Dev ›
// Projects instead of anyone's inbox. It runs only between Start and Stop,
// relays nothing, and accepts any login so app settings need no changes.

export const MAIL_HOST = "127.0.0.1";
const MAX_MESSAGE = 10 * 1024 * 1024;
const MAX_KEPT = 500;
const MAX_CLIENTS = 20;
const IDLE_MS = 60_000;

export type CaughtMail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  at: number;
  size: number;
};

export class MailCatcher {
  private server?: net.Server;
  private clients = new Set<net.Socket>();
  private index?: CaughtMail[];
  constructor(
    private deps: {
      dataDir: string;
      port?: number;
      /** Called after each message is saved, so the inbox can refresh. */
      caught?: (mail: CaughtMail) => void;
    },
  ) {}

  private get dir() {
    return path.join(this.deps.dataDir, "mail-catcher");
  }
  private get port() {
    return this.deps.port ?? 1025;
  }
  private load() {
    if (this.index) return this.index;
    try {
      this.index = JSON.parse(
        fs.readFileSync(path.join(this.dir, "index.json"), "utf8"),
      );
    } catch {
      this.index = [];
    }
    return this.index!;
  }
  private saveIndex() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(
      path.join(this.dir, "index.json"),
      JSON.stringify(this.load()),
    );
  }
  private file = (id: string) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Unknown message.");
    return path.join(this.dir, id + ".eml");
  };

  running() {
    return !!this.server?.listening;
  }
  status() {
    return {
      running: this.running(),
      smtp: `${MAIL_HOST}:${this.port}`,
      count: this.load().length,
    };
  }

  start() {
    if (this.running()) return Promise.resolve(this.status());
    return new Promise<ReturnType<MailCatcher["status"]>>((resolve, reject) => {
      const server = net.createServer((socket) => this.session(socket));
      server.maxConnections = MAX_CLIENTS;
      server.once("error", (error: NodeJS.ErrnoException) => {
        reject(
          new Error(
            error.code === "EADDRINUSE"
              ? `Port ${this.port} is already in use, so the mail catcher could not start.`
              : error.message,
          ),
        );
      });
      server.listen(this.port, MAIL_HOST, () => {
        this.server = server;
        resolve(this.status());
      });
    });
  }

  stop() {
    for (const s of this.clients) s.destroy();
    this.clients.clear();
    this.server?.close();
    this.server = undefined;
    return this.status();
  }

  list() {
    return [...this.load()].sort((a, b) => b.at - a.at);
  }
  read(id: string) {
    const meta = this.load().find((m) => m.id === id);
    if (!meta) throw new Error("That message is gone.");
    return { ...meta, ...parseMail(fs.readFileSync(this.file(id), "latin1")) };
  }
  /** Path of the saved .eml, for opening it in the user's mail app. */
  path(id: string) {
    if (!this.load().some((m) => m.id === id))
      throw new Error("That message is gone.");
    return this.file(id);
  }
  remove(id: string) {
    fs.rmSync(this.file(id), { force: true });
    this.index = this.load().filter((m) => m.id !== id);
    this.saveIndex();
    return this.list();
  }
  clear() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    this.index = [];
    return this.list();
  }

  private store(raw: Buffer, from: string, to: string[]) {
    fs.mkdirSync(this.dir, { recursive: true });
    const id = randomUUID();
    fs.writeFileSync(this.file(id), raw);
    const head = parseMail(raw.toString("latin1").slice(0, 64 * 1024));
    const mail: CaughtMail = {
      id,
      from: head.from || from,
      to: head.to || to.join(", "),
      subject: head.subject,
      at: Date.now(),
      size: raw.length,
    };
    const list = this.load();
    list.push(mail);
    // Oldest messages go first once the inbox is full.
    while (list.length > MAX_KEPT) {
      const old = list.shift()!;
      fs.rmSync(this.file(old.id), { force: true });
    }
    this.saveIndex();
    this.deps.caught?.(mail);
  }

  /** One SMTP conversation (RFC 5321, no relaying, no TLS). */
  private session(socket: net.Socket) {
    this.clients.add(socket);
    socket.setTimeout(IDLE_MS, () => socket.destroy());
    socket.on("close", () => this.clients.delete(socket));
    socket.on("error", () => {});
    const say = (line: string) => socket.write(line + "\r\n");
    let from = "",
      to: string[] = [],
      buffer = Buffer.alloc(0),
      data: Buffer[] | null = null,
      dataSize = 0,
      auth = "";
    say("220 yami mail catcher ready");
    const command = (line: string) => {
      if (auth) {
        // AUTH LOGIN asks for a user, then a password; any answer passes.
        if (auth === "user") {
          auth = "pass";
          return say("334 UGFzc3dvcmQ6");
        }
        auth = "";
        return say("235 2.7.0 Accepted");
      }
      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO")
        return socket.write(
          `250-yami\r\n250-SIZE ${MAX_MESSAGE}\r\n250-8BITMIME\r\n250 AUTH PLAIN LOGIN\r\n`,
        );
      if (verb === "HELO") return say("250 yami");
      if (verb === "AUTH") {
        if (/^AUTH LOGIN\s*$/i.test(line)) {
          auth = "user";
          return say("334 VXNlcm5hbWU6");
        }
        return say("235 2.7.0 Accepted");
      }
      if (/^MAIL FROM:/i.test(line)) {
        from = /<([^>]*)>/.exec(line)?.[1] || line.slice(10).trim();
        to = [];
        return say("250 OK");
      }
      if (/^RCPT TO:/i.test(line)) {
        if (to.length >= 100) return say("452 Too many recipients");
        to.push(/<([^>]*)>/.exec(line)?.[1] || line.slice(8).trim());
        return say("250 OK");
      }
      if (verb === "DATA") {
        if (!to.length) return say("503 Send RCPT TO first");
        data = [];
        dataSize = 0;
        return say("354 End data with <CR><LF>.<CR><LF>");
      }
      if (verb === "RSET") {
        from = "";
        to = [];
        return say("250 OK");
      }
      if (verb === "NOOP") return say("250 OK");
      if (verb === "QUIT") {
        say("221 Bye");
        return socket.end();
      }
      if (verb === "STAR")
        return say("454 TLS is not offered; turn it off for this server");
      return say("502 Command not implemented");
    };
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        const end = buffer.indexOf("\r\n");
        if (end < 0) {
          if (!data && buffer.length > 4096) socket.destroy();
          break;
        }
        const line = buffer.subarray(0, end);
        buffer = buffer.subarray(end + 2);
        if (data) {
          if (line.length === 1 && line[0] === 0x2e) {
            const message = Buffer.concat(data);
            data = null;
            if (dataSize > MAX_MESSAGE) say("552 Message too large");
            else {
              this.store(message, from, to);
              say("250 OK: caught");
            }
            from = "";
            to = [];
            continue;
          }
          // Dot-stuffing: a leading "." was doubled by the sender.
          const body = line[0] === 0x2e ? line.subarray(1) : line;
          dataSize += body.length + 2;
          if (dataSize <= MAX_MESSAGE) data.push(body, Buffer.from("\r\n"));
          continue;
        }
        command(line.toString("latin1"));
      }
    });
  }
}
