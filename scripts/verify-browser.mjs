// Desktop check for the Yami Browser against a local test server (no
// internet): tabs, the page view's placement, background-tab discarding,
// refused non-web addresses, and an agent reading the page over MCP.
import { _electron } from "playwright";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const site = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    req.url === "/two"
      ? "<title>Second page</title><p>two</p>"
      : "<title>Yami test page</title><h1>Hello from the local test page</h1><p>Agents can read this.</p>",
  );
});
await new Promise((r) => site.listen(47896, "127.0.0.1", r));
const profile = path.resolve(".artifacts/browser-verify-" + Date.now());
skipSetup(profile);
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  YAMI_TAB_DISCARD_MS: "1500",
  YAMI_LINKED_HEADLESS: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  await assert.rejects(call("browser.show"), /turned off/);
  await call("modules.set", { id: "browser", enabled: true });
  await call("browser.show", { url: "http://127.0.0.1:47896/" });
  let ui;
  for (let i = 0; i < 100 && !ui; i++) {
    ui = app.windows().find((p) => p.url().includes("window=browser"));
    if (!ui) await wait(100);
  }
  assert.ok(ui, "browser window");
  await ui
    .getByRole("tab", { name: /Yami test page/ })
    .waitFor({ timeout: 15000 });
  let state = await call("browser.state");
  assert.equal(state.tabs.length, 2, "a new tab plus the opened page");
  // The page view sits exactly over the page box.
  const box = await ui.locator(".browser-page").boundingBox();
  const views = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("window=browser"),
    );
    return w.contentView.children.map((v) => ({
      ...v.getBounds(),
      visible: v.getVisible?.(),
    }));
  });
  const shown = views.find((v) => v.visible !== false && v.width > 0);
  assert.ok(shown, JSON.stringify(views));
  assert.ok(
    Math.abs(shown.x - box.x) <= 1 && Math.abs(shown.y - box.y) <= 1,
    JSON.stringify({ shown, box }),
  );
  // An agent reads the page through Yami for your agents.
  await call("modules.set", { id: "agentLink", enabled: true });
  await call("agentlink.tools", { name: "browser_read", allowed: true });
  const info = await call("agentlink.info");
  const rpc = async (method, params) =>
    (
      await fetch(info.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + info.token,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      })
    ).json();
  const read = await rpc("tools/call", { name: "browser_read", arguments: {} });
  const page = JSON.parse(read.result.content[0].text);
  assert.equal(page.title, "Yami test page");
  assert.match(page.text, /Hello from the local test page/);
  // A javascript: address never runs; it becomes a search.
  const active = state.active;
  await call("browser.navigate", {
    id: active,
    input: "javascript:document.title='hacked'",
  });
  // Stop the search before it reaches the internet, then check the page.
  await call("browser.go", { id: active, step: "stop" });
  await wait(300);
  const after = await rpc("tools/call", {
    name: "browser_read",
    arguments: {},
  });
  assert.notEqual(JSON.parse(after.result.content[0].text).title, "hacked");
  // A tab left in the background is discarded, then reloads on return.
  const second = await call("browser.open", {
    input: "http://127.0.0.1:47896/two",
  });
  await wait(2500);
  state = await call("browser.state");
  assert.equal(
    state.tabs.find((t) => t.id === active).discarded,
    true,
    "discarded",
  );
  assert.equal(state.tabs.find((t) => t.id === second).discarded, false);
  await call("browser.select", { id: active });
  state = await call("browser.state");
  assert.equal(
    state.tabs.find((t) => t.id === active).discarded,
    false,
    "woken",
  );
  // Linked browser mode: an installed Chromium browser, headless here, with
  // its own profile inside this test profile. The agent tool reads it.
  const linked = await call("browser.linked");
  let linkedChecked = "";
  if (linked.browsers.length) {
    const pick = linked.browsers[0];
    await call("browser.linked.open", {
      id: pick.id,
      url: "http://127.0.0.1:47896/two",
    });
    let viaLinked = "";
    for (let i = 0; i < 30 && viaLinked !== "Second page"; i++) {
      const r = await rpc("tools/call", {
        name: "browser_read",
        arguments: {},
      });
      viaLinked = JSON.parse(r.result.content[0].text || "{}").title || "";
      if (viaLinked !== "Second page") await wait(300);
    }
    assert.equal(viaLinked, "Second page", "read through the linked browser");
    await call("browser.linked.close");
    linkedChecked = pick.name;
  }
  await call("modules.set", { id: "browser", enabled: false });
  for (
    let i = 0;
    i < 50 && app.windows().some((p) => p.url().includes("window=browser"));
    i++
  )
    await wait(100);
  assert.ok(
    !app.windows().some((p) => p.url().includes("window=browser")),
    "closed when off",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      views: views.length,
      linked: linkedChecked,
    }),
  );
} finally {
  await app.close();
  site.close();
}
