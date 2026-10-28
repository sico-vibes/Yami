import test from "node:test";
import assert from "node:assert/strict";
import { Duplex } from "node:stream";
import {
  decodeWords,
  mailGlance,
  parseHeaders,
  quote,
} from "../electron/feeds/mail.ts";

// A scripted IMAP server: answers each tagged command and records it.
function fakeServer(script) {
  const seen = [];
  let pending = "";
  const socket = new Duplex({
    read() {},
    write(chunk, _enc, done) {
      pending += chunk.toString();
      let end;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        seen.push(line);
        const [tag, ...rest] = line.split(" ");
        const reply = script(rest.join(" "), tag);
        setImmediate(() => socket.push(reply));
      }
      done();
    },
  });
  setImmediate(() => socket.push("* OK IMAP ready\r\n"));
  return { socket, seen };
}

const header = (from, subject, date) =>
  `From: ${from}\r\nSubject: ${subject}\r\nDate: ${date}\r\n\r\n`;

test("the glance logs in, reads INBOX read-only and leaves mail unread", async () => {
  const h1 = header(
    '"Ada" <ada@example.com>',
    "=?utf-8?B?SGVsbG8g8J+Riw==?=",
    "Tue, 27 Oct 2026 10:00:00 +0000",
  );
  const h2 = header(
    "Bob <bob@example.com>",
    "Build\r\n passed",
    "Wed, 28 Oct 2026 09:00:00 +0000",
  );
  const server = fakeServer((command, tag) => {
    if (command.startsWith("LOGIN")) return `${tag} OK logged in\r\n`;
    if (command.startsWith("STATUS"))
      return `* STATUS INBOX (MESSAGES 2 UNSEEN 1)\r\n${tag} OK\r\n`;
    if (command.startsWith("EXAMINE"))
      return `* 2 EXISTS\r\n${tag} OK [READ-ONLY]\r\n`;
    if (command.startsWith("FETCH"))
      return (
        `* 1 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {${Buffer.byteLength(h1)}}\r\n${h1})\r\n` +
        `* 2 FETCH (BODY[HEADER.FIELDS (FROM SUBJECT DATE)] {${Buffer.byteLength(h2)}}\r\n${h2})\r\n${tag} OK\r\n`
      );
    return `* BYE\r\n${tag} OK\r\n`;
  });
  const glance = await mailGlance(
    { host: "imap.example.com", user: "me@example.com", password: 'p"ss' },
    () => server.socket,
  );
  assert.deepEqual(glance.unread, 1);
  assert.deepEqual(
    glance.latest.map((m) => m.subject),
    ["Build passed", "Hello 👋"],
  );
  assert.equal(glance.latest[1].from, "Ada");
  assert.equal(server.seen[0], 'y1 LOGIN "me@example.com" "p\\"ss"');
  assert.ok(
    server.seen.some((l) => l.includes("EXAMINE INBOX")),
    "read-only open",
  );
  assert.ok(
    server.seen.some((l) => l.includes("BODY.PEEK[")),
    "peek keeps mail unread",
  );
  assert.ok(
    !server.seen.some((l) => /STORE|EXPUNGE|SELECT|APPEND|DELETE/.test(l)),
  );
});

test("a refused login says so in plain words", async () => {
  const server = fakeServer((command, tag) =>
    command.startsWith("LOGIN")
      ? `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`
      : `${tag} OK\r\n`,
  );
  await assert.rejects(
    mailGlance(
      { host: "imap.example.com", user: "a", password: "b" },
      () => server.socket,
    ),
    /refused that address or app password/,
  );
});

test("quoting, encoded words and headers", () => {
  assert.throws(() => quote("a\r\nb LOGOUT"), /cannot be sent/);
  assert.equal(quote("back\\slash"), '"back\\\\slash"');
  assert.equal(decodeWords("=?iso-8859-1?Q?Caf=E9_ouvert?="), "Café ouvert");
  assert.equal(
    decodeWords("=?utf-8?B?SGk=?= =?utf-8?B?IHRoZXJl?="),
    "Hi there",
  );
  assert.deepEqual(parseHeaders("Subject: \r\nFrom: x@y.z\r\n"), {
    from: "x@y.z",
    subject: "(no subject)",
    at: 0,
  });
});

test("mail accounts keep passwords in the encrypted store and survive failures", async () => {
  const { MailAccounts } = await import("../electron/feeds/mail-accounts.ts");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-mail-")),
    "mail.json",
  );
  const secrets = new Map();
  const store = {
    get: (id) => secrets.get(id) || "",
    set: (id, v) => (v ? secrets.set(id, v) : secrets.delete(id)),
  };
  let fail = false;
  const glance = async (a) => {
    if (fail || a.password !== "app-pass")
      throw new Error("The mail server refused that address or app password.");
    return { unread: 2, total: 9, latest: [] };
  };
  const mail = new MailAccounts(file, store, glance);
  await assert.rejects(
    mail.add({ provider: "gmail", user: "me@x.com", password: "wrong" }),
    /refused/,
  );
  assert.equal(mail.list().length, 0, "a failed sign-in is not saved");
  await assert.rejects(
    mail.add({ provider: "custom", user: "me@x.com", password: "p" }),
    /IMAP server/,
  );
  const [account] = await mail.add({
    provider: "gmail",
    user: "me@x.com",
    password: "app-pass",
  });
  assert.equal(account.host, "imap.gmail.com");
  assert.equal(account.glance.unread, 2);
  assert.ok(
    !fs.readFileSync(file, "utf8").includes("app-pass"),
    "no password on disk",
  );
  assert.equal(secrets.get(account.id), "app-pass");
  fail = true;
  const [after] = await new MailAccounts(file, store, glance).refresh();
  assert.match(after.error, /refused/);
  mail.remove("unknown");
  assert.equal(mail.remove(account.id).length, 0);
  assert.equal(secrets.size, 0, "removing forgets the password");
});
