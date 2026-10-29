import tls from "node:tls";
import type { Duplex } from "node:stream";
import { xoauth2 } from "./microsoft.ts";

export type MailGlance = {
  unread: number;
  total: number;
  latest: { from: string; subject: string; at: number }[];
};

/** IMAP quoted string; CR and LF can never be sent. */
export function quote(value: string) {
  if (/[\r\n\0]/.test(value))
    throw new Error("That text cannot be sent to the mail server.");
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/** RFC 2047 encoded words (=?utf-8?B?…?= and =?utf-8?Q?…?=) into text. */
export function decodeWords(text: string) {
  return text
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (_whole, charset: string, kind: string, data: string) => {
        try {
          const bytes =
            kind.toUpperCase() === "B"
              ? Buffer.from(data, "base64")
              : Buffer.from(
                  data
                    .replace(/_/g, " ")
                    .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) =>
                      String.fromCharCode(parseInt(h, 16)),
                    ),
                  "latin1",
                );
          return new TextDecoder(
            charset.toLowerCase() === "utf8" ? "utf-8" : charset,
          ).decode(bytes);
        } catch {
          return data;
        }
      },
    );
}

/** From, Subject and Date out of one header block. */
export function parseHeaders(block: string) {
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  const field = (name: string) =>
    decodeWords(
      new RegExp(`^${name}:[ \\t]*(.*)$`, "im").exec(unfolded)?.[1]?.trim() ||
        "",
    );
  const from = field("From")
    .replace(/\s*<[^>]+>\s*$/, "")
    .replace(/^"(.*)"$/, "$1");
  const at = Date.parse(field("Date"));
  return {
    from: from.slice(0, 120),
    subject: field("Subject").slice(0, 300) || "(no subject)",
    at: Number.isFinite(at) ? at : 0,
  };
}

/** Reads IMAP replies, including {n} literals, and resolves on tagged lines. */
class Session {
  private buffer = Buffer.alloc(0);
  private waiting?: {
    tag: string;
    resolve: (lines: string[]) => void;
    reject: (e: Error) => void;
  };
  private lines: string[] = [];
  private serial = 0;
  greeting: Promise<string[]>;
  constructor(private socket: Duplex) {
    this.greeting = new Promise(
      (resolve, reject) => (this.waiting = { tag: "*", resolve, reject }),
    );
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (this.buffer.length > 4 * 1024 * 1024)
        socket.destroy(new Error("The mail server sent too much."));
      this.drain();
    });
    socket.on("error", (e) => this.waiting?.reject(e));
    socket.on("close", () =>
      this.waiting?.reject(new Error("The mail server closed the connection.")),
    );
  }
  private drain() {
    for (;;) {
      const end = this.buffer.indexOf("\r\n");
      if (end < 0) return;
      let line = this.buffer.subarray(0, end).toString("utf8");
      const literal = /\{(\d+)\}$/.exec(line);
      if (literal) {
        const size = Number(literal[1]);
        if (this.buffer.length < end + 2 + size) return;
        line +=
          "\n" + this.buffer.subarray(end + 2, end + 2 + size).toString("utf8");
        this.buffer = this.buffer.subarray(end + 2 + size);
        this.lines.push(line);
        continue;
      }
      this.buffer = this.buffer.subarray(end + 2);
      const w = this.waiting;
      // A refused XOAUTH2 sign-in asks to continue; an empty line ends it
      // with the tagged NO that carries the reason.
      if (w && w.tag !== "*" && line.startsWith("+")) {
        this.socket.write("\r\n");
        continue;
      }
      this.lines.push(line);
      if (!w) continue;
      if (w.tag === "*" && line.startsWith("* ")) {
        this.waiting = undefined;
        w.resolve(this.lines.splice(0));
      } else if (line.startsWith(w.tag + " ")) {
        this.waiting = undefined;
        const lines = this.lines.splice(0);
        if (/^\S+ OK/i.test(line)) w.resolve(lines);
        else
          w.reject(
            new Error(
              line.replace(/^\S+ (NO|BAD)\s*(\[[^\]]*\]\s*)?/i, "").trim() ||
                "The mail server refused.",
            ),
          );
      }
    }
  }
  send(command: string) {
    const tag = "y" + ++this.serial;
    return new Promise<string[]>((resolve, reject) => {
      this.waiting = { tag, resolve, reject };
      this.socket.write(`${tag} ${command}\r\n`);
    });
  }
}

/**
 * Unread count and the newest subjects in INBOX. EXAMINE opens it read-only
 * and BODY.PEEK leaves messages unread; nothing is sent or deleted.
 */
export async function mailGlance(
  account: {
    host: string;
    port?: number;
    user: string;
    password?: string;
    /** An OAuth access token (Outlook.com), used instead of a password. */
    token?: string;
  },
  connect: (host: string, port: number) => Duplex = (host, port) =>
    tls.connect({ host, port, servername: host, minVersion: "TLSv1.2" }),
  count = 5,
): Promise<MailGlance> {
  if (!/^[a-z0-9.-]+$/i.test(account.host))
    throw new Error("Enter a mail server name.");
  const socket = connect(account.host, account.port || 993);
  const timer = setTimeout(
    () =>
      socket.destroy(
        new Error("The mail server did not answer in 20 seconds."),
      ),
    20000,
  );
  const session = new Session(socket);
  try {
    await session.greeting;
    await session
      .send(
        account.token
          ? `AUTHENTICATE XOAUTH2 ${xoauth2(account.user, account.token)}`
          : `LOGIN ${quote(account.user)} ${quote(account.password || "")}`,
      )
      .catch((e: Error) => {
        throw new Error(
          /AUTHENTICATIONFAILED|invalid|failed|credentials/i.test(e.message)
            ? account.token
              ? "The mail server refused the Microsoft sign-in. Remove the account and add it again."
              : "The mail server refused that address or app password."
            : e.message,
        );
      });
    const status = (await session.send("STATUS INBOX (MESSAGES UNSEEN)")).join(
      " ",
    );
    const total = Number(/MESSAGES (\d+)/i.exec(status)?.[1] || 0);
    const unread = Number(/UNSEEN (\d+)/i.exec(status)?.[1] || 0);
    const latest: MailGlance["latest"] = [];
    if (total > 0) {
      await session.send("EXAMINE INBOX");
      const from = Math.max(1, total - count + 1);
      const lines = await session.send(
        `FETCH ${from}:${total} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`,
      );
      for (const line of lines) {
        const at = line.indexOf("\n");
        if (/^\* \d+ FETCH/i.test(line) && at > 0)
          latest.push(parseHeaders(line.slice(at + 1)));
      }
    }
    await session.send("LOGOUT").catch(() => {});
    return { unread, total, latest: latest.reverse() };
  } finally {
    clearTimeout(timer);
    socket.destroy();
  }
}

/** Mail servers Yami knows; Outlook.com signs in with Microsoft (OAuth). */
export const mailServers: Record<string, { host: string; web: string }> = {
  gmail: { host: "imap.gmail.com", web: "https://mail.google.com/" },
  fastmail: { host: "imap.fastmail.com", web: "https://app.fastmail.com/" },
  yahoo: { host: "imap.mail.yahoo.com", web: "https://mail.yahoo.com/" },
  icloud: { host: "imap.mail.me.com", web: "https://www.icloud.com/mail" },
  outlook: {
    host: "outlook.office365.com",
    web: "https://outlook.live.com/mail/",
  },
};
