import test from "node:test";
import { freePort } from "./free-port.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { MailCatcher } from "../electron/workbench/mail-catcher.ts";
import {
  decodeWords,
  htmlToText,
  parseMail,
} from "../electron/workbench/mail-parse.ts";

/** A minimal SMTP client: sends lines and waits for each reply. */
async function smtp(port, lines) {
  const socket = net.connect(port, "127.0.0.1");
  const replies = [];
  let pending = "";
  let waiter;
  socket.on("data", (d) => {
    pending += d.toString();
    // A reply is complete when its last line has a space after the code.
    if (/(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(pending)) {
      replies.push(pending.trim());
      pending = "";
      waiter?.();
    }
  });
  const next = () => new Promise((r) => (waiter = r));
  await next();
  // After a 354 reply the message lines get no reply until the lone ".".
  let body = false;
  for (const line of lines) {
    socket.write(line + "\r\n");
    if (body && line !== ".") continue;
    await next();
    body = /^354/.test(replies.at(-1));
  }
  socket.end();
  return replies;
}

const message = [
  "From: =?utf-8?B?WWFtaSBBcHA=?= <app@demo.test>",
  "To: ana@demo.test",
  "Subject: =?utf-8?Q?R=C3=A9initialiser?= your password",
  "Date: Wed, 28 Oct 2026 19:30:00 +0200",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b1"',
  "",
  "--b1",
  'Content-Type: multipart/alternative; boundary="b2"',
  "",
  "--b2",
  "Content-Type: text/plain; charset=utf-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Caf=C3=A9 link: https://demo.test/reset=",
  "?t=1",
  "..A line that starts with a dot",
  "--b2",
  "Content-Type: text/html",
  "",
  "<p>HTML <b>version</b></p>",
  "--b2--",
  "--b1",
  'Content-Type: application/pdf; name="invoice.pdf"',
  'Content-Disposition: attachment; filename="invoice.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("%PDF-1.4 demo").toString("base64"),
  "--b1--",
];

test("mail parts, encoded words and HTML read as plain text", () => {
  assert.equal(decodeWords("=?utf-8?Q?Caf=C3=A9_au_lait?="), "Café au lait");
  assert.equal(
    htmlToText("<style>x{}</style><p>Hi &amp; bye</p><script>evil()</script>"),
    "Hi & bye",
  );
  const parsed = parseMail(
    "Subject: Only HTML\r\nContent-Type: text/html\r\n\r\n<h1>Hello</h1><img src=https://tracker.test/p.gif>",
  );
  assert.equal(parsed.text, "Hello");
});

test("the catcher receives mail over SMTP, keeps it and refuses a taken port", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-mail-"));
  const caught = [];
  const port = await freePort();
  const catcher = new MailCatcher({
    dataDir: dir,
    port,
    caught: (m) => caught.push(m),
  });
  assert.equal(catcher.status().running, false);
  assert.equal((await catcher.start()).smtp, `127.0.0.1:${port}`);
  const replies = await smtp(port, [
    "EHLO tester",
    "AUTH LOGIN",
    Buffer.from("user").toString("base64"),
    Buffer.from("secret").toString("base64"),
    "MAIL FROM:<app@demo.test>",
    "RCPT TO:<ana@demo.test>",
    "DATA",
    ...message,
    ".",
    "QUIT",
  ]);
  assert.match(replies[1], /AUTH PLAIN LOGIN/);
  assert.match(replies.at(-2), /^250 OK: caught/);
  assert.equal(caught.length, 1);
  const [first] = catcher.list();
  assert.equal(first.subject, "Réinitialiser your password");
  assert.equal(first.from, "Yami App <app@demo.test>");
  const read = catcher.read(first.id);
  assert.match(read.text, /Café link: https:\/\/demo\.test\/reset\?t=1/);
  assert.match(
    read.text,
    /^\.A line that starts with a dot$/m,
    "dot-stuffing undone",
  );
  assert.deepEqual(read.attachments, [{ name: "invoice.pdf", size: 13 }]);
  assert.ok(fs.existsSync(catcher.path(first.id)));
  // No recipient means no DATA; unknown commands are refused politely.
  const refused = await smtp(port, [
    "HELO x",
    "DATA",
    "VRFY ana",
    "STARTTLS",
    "QUIT",
  ]);
  assert.match(refused[2], /^503/);
  assert.match(refused[3], /^502/);
  assert.match(refused[4], /^454/);
  // A second catcher cannot take the same port.
  const other = new MailCatcher({ dataDir: dir, port });
  await assert.rejects(other.start(), /already in use/);
  catcher.stop();
  assert.equal(catcher.status().running, false);
  // The inbox survives a restart; then delete and clear.
  const again = new MailCatcher({ dataDir: dir, port });
  assert.equal(again.list().length, 1);
  assert.deepEqual(again.remove(first.id), []);
  assert.throws(() => again.read(first.id), /gone/);
  assert.throws(() => again.path("../../etc"), /gone|Unknown/);
  assert.deepEqual(again.clear(), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
