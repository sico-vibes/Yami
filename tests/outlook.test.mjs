import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Duplex } from "node:stream";
import { mailGlance } from "../electron/feeds/mail.ts";
import { MailAccounts } from "../electron/feeds/mail-accounts.ts";
import { idTokenUser, xoauth2 } from "../electron/feeds/microsoft.ts";

// A scripted IMAP server; an empty line answers a "+" continuation.
function fakeServer(script) {
  const seen = [];
  let pending = "",
    last = "";
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
        if (line) last = tag;
        const reply = script(line ? rest.join(" ") : "", line ? tag : last);
        setImmediate(() => socket.push(reply));
      }
      done();
    },
  });
  setImmediate(() => socket.push("* OK IMAP ready\r\n"));
  return { socket, seen };
}

const idToken = (claims) =>
  "x." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".y";

test("Outlook signs in to IMAP with XOAUTH2, and a refusal ends cleanly", async () => {
  const ok = fakeServer((command, tag) => {
    if (command.startsWith("AUTHENTICATE XOAUTH2 ")) return `${tag} OK\r\n`;
    if (command.startsWith("STATUS"))
      return `* STATUS INBOX (MESSAGES 0 UNSEEN 0)\r\n${tag} OK\r\n`;
    return `${tag} OK\r\n`;
  });
  const glance = await mailGlance(
    { host: "outlook.office365.com", user: "ana@outlook.com", token: "tok" },
    () => ok.socket,
  );
  assert.deepEqual(glance, { unread: 0, total: 0, latest: [] });
  const sent = ok.seen[0].split(" ");
  assert.deepEqual(sent.slice(1, 3), ["AUTHENTICATE", "XOAUTH2"]);
  assert.equal(
    Buffer.from(sent[3], "base64").toString(),
    "user=ana@outlook.com\x01auth=Bearer tok\x01\x01",
  );
  assert.equal(sent[3], xoauth2("ana@outlook.com", "tok"));
  assert.ok(!ok.seen.some((l) => l.includes("LOGIN")), "no password login");
  // A refused token: the server asks to continue, Yami sends an empty line.
  const refused = fakeServer((command, tag) =>
    command.startsWith("AUTHENTICATE")
      ? "+ eyJzdGF0dXMiOiI0MDEifQ==\r\n"
      : command === ""
        ? `${tag} NO AUTHENTICATE failed.\r\n`
        : `${tag} OK\r\n`,
  );
  await assert.rejects(
    mailGlance(
      { host: "outlook.office365.com", user: "ana@outlook.com", token: "bad" },
      () => refused.socket,
    ),
    /refused the Microsoft sign-in/,
  );
  assert.equal(refused.seen[1], "", "the continuation was answered");
  assert.equal(
    idTokenUser(idToken({ email: "ana@outlook.com" })),
    "ana@outlook.com",
  );
  assert.equal(idTokenUser("garbage"), undefined);
});

test("the Microsoft code adds an Outlook account and refreshes its token", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-outlook-"));
  const secrets = new Map();
  const asked = [];
  let polls = 0,
    hold = false;
  const fetcher = async (url, init) => {
    const body = Object.fromEntries(new URLSearchParams(String(init.body)));
    asked.push([
      String(url).split("/").pop(),
      body.grant_type || "",
      body.client_id,
    ]);
    const json = (v, status = 200) =>
      new Response(JSON.stringify(v), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.endsWith("/devicecode"))
      return json({
        device_code: "dev",
        user_code: "ABCD-1234",
        verification_uri: "https://microsoft.com/link",
        expires_in: 900,
        interval: 1,
      });
    if (body.grant_type === "refresh_token")
      return json({
        access_token: "access-2",
        refresh_token: "refresh-2",
        expires_in: 3600,
      });
    if (hold || ++polls === 1)
      return json({ error: "authorization_pending" }, 400);
    return json({
      access_token: "access-1",
      refresh_token: "refresh-1",
      expires_in: 30, // already due, so the next read refreshes
      id_token: idToken({ preferred_username: "ana@outlook.com" }),
    });
  };
  const glances = [];
  const accounts = new MailAccounts(
    path.join(dir, "mail.json"),
    { get: (id) => secrets.get(id) || "", set: (id, v) => secrets.set(id, v) },
    async (a) => {
      glances.push(a);
      return { unread: 2, total: 9, latest: [] };
    },
    () => "11111111-2222-3333-4444-555555555555",
    fetcher,
    async () => {},
  );
  await assert.rejects(
    accounts.add({ provider: "outlook", user: "a", password: "b" }),
    /Microsoft/,
  );
  const started = await accounts.startOutlook();
  assert.deepEqual(
    [started.userCode, started.verificationUri],
    ["ABCD-1234", "https://microsoft.com/link"],
  );
  const list = await accounts.finishOutlook();
  assert.equal(list.length, 1);
  assert.deepEqual(
    [list[0].provider, list[0].user, list[0].host],
    ["outlook", "ana@outlook.com", "outlook.office365.com"],
  );
  assert.deepEqual(glances[0], {
    host: "outlook.office365.com",
    user: "ana@outlook.com",
    token: "access-1",
  });
  assert.equal(
    secrets.get(list[0].id),
    "refresh-1",
    "refresh token kept as a secret",
  );
  assert.ok(
    !fs.readFileSync(path.join(dir, "mail.json"), "utf8").includes("refresh"),
    "not in mail.json",
  );
  await accounts.refresh();
  assert.equal(glances[1].token, "access-2");
  assert.equal(
    secrets.get(list[0].id),
    "refresh-2",
    "the new refresh token replaces the old",
  );
  assert.deepEqual(
    asked.map((a) => a[1]),
    [
      "",
      "urn:ietf:params:oauth:grant-type:device_code",
      "urn:ietf:params:oauth:grant-type:device_code",
      "refresh_token",
    ],
  );
  assert.ok(
    asked.every((a) => a[2] === "11111111-2222-3333-4444-555555555555"),
  );
  // Cancelling stops the wait.
  hold = true;
  await accounts.startOutlook();
  const waiting = accounts.finishOutlook();
  accounts.cancelOutlook();
  await assert.rejects(waiting, /cancelled/);
  fs.rmSync(dir, { recursive: true, force: true });
});
