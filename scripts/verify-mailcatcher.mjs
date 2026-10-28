// Desktop check for Yami's own mail catcher: starts it from Dev › Projects,
// sends one message to 127.0.0.1:1025 over SMTP from this script, and checks
// it appears in the list and opens as text; then stops it. Isolated profile.
import { _electron } from "playwright";
import net from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/mailcatcher-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sends one message the way an app under development would. */
function send() {
  const lines = [
    "EHLO dev-app",
    "MAIL FROM:<app@demo.test>",
    "RCPT TO:<ana@demo.test>",
    "DATA",
    "From: Demo App <app@demo.test>\r\nTo: ana@demo.test\r\nSubject: Welcome to the demo\r\n\r\nYour code is 4242.\r\n.",
    "QUIT",
  ];
  return new Promise((resolve, reject) => {
    const socket = net.connect(1025, "127.0.0.1");
    const replies = [];
    socket.on("data", (d) => {
      replies.push(d.toString().trim());
      const line = lines.shift();
      if (line) socket.write(line + "\r\n");
    });
    socket.on("close", () => resolve(replies));
    socket.on("error", reject);
  });
}

try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  await call("modules.set", { id: "workbench", enabled: true });
  await call("show", { tab: "ai" });
  await main.getByRole("button", { name: "Projects" }).first().click();
  await main.getByText("Catch your app's mail").waitFor();
  await main.getByRole("button", { name: "Start" }).click();
  await main.getByText(/Listening on 127\.0\.0\.1:1025/).waitFor();
  const replies = await send();
  assert.ok(
    replies.some((r) => /^250 OK: caught/.test(r)),
    replies.join(" | "),
  );
  await main.getByText("Welcome to the demo").click();
  await main.getByText("Your code is 4242.").waitFor();
  await main.getByRole("button", { name: "Done" }).click();
  await main.getByRole("button", { name: "Stop" }).click();
  await main.getByRole("button", { name: "Start" }).waitFor();
  await assert.rejects(send(), /ECONNREFUSED/, "nothing listens once stopped");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, replies: replies.length }));
} finally {
  await app.close();
}
