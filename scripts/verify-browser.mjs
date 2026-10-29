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
      : req.url === "/form"
        ? "<title>form</title><form onsubmit='document.title=\"submitted\";return false'><input placeholder='Search' oninput='document.title=\"typed \"+this.value'><input type='password' placeholder='Password'><label for='size'>Size</label><select id='size' onchange='document.title=\"size \"+this.value'><option value='s'>Small</option><option value='m'>Medium</option></select><button>Submit</button></form><a href='#' onclick='document.title=\"more\";return false'>More info</a>"
        : req.url === "/upload"
          ? "<title>upload</title><label for='doc'>Document</label><input id='doc' type='file' onchange='document.title=\"file \"+this.files[0].name'>"
          : req.url === "/tracker"
            ? // A request to a listed tracker host; blocking cancels it locally.
              "<title>tracker test</title><script>fetch('https://www.google-analytics.com/collect?v=1').then(() => document.title = 'tracker reached', () => document.title = 'tracker blocked')</script>"
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
  // The reader shows the page's text; the page joins the recent list.
  const reader = await call("browser.reader");
  assert.match(reader.text, /Hello from the local test page/);
  assert.ok(
    (await call("browser.history")).some((h) => h.title === "Yami test page"),
    "recent pages",
  );
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
  // Agents type and click; a submit asks first, passwords are refused.
  await call("agentlink.tools", { name: "browser_click", allowed: true });
  await call("agentlink.tools", { name: "browser_type", allowed: true });
  const formTab = await call("browser.open", {
    input: "http://127.0.0.1:47896/form",
  });
  const titleOf = async () =>
    (await call("browser.state")).tabs.find((t) => t.id === formTab)?.title ||
    "";
  for (let i = 0; i < 30 && (await titleOf()) !== "form"; i++) await wait(200);
  const tool = async (name, args) => {
    const r = await rpc("tools/call", { name, arguments: args });
    return { error: r.result.isError, text: r.result.content[0].text };
  };
  const typed = await tool("browser_type", { text: "Search", value: "hello" });
  assert.equal(typed.error, false, typed.text);
  assert.equal(await titleOf(), "typed hello");
  assert.match(
    (await tool("browser_type", { text: "Password", value: "x" })).text,
    /password fields/,
  );
  assert.equal(
    (await tool("browser_click", { text: "More info" })).error,
    false,
  );
  assert.equal(await titleOf(), "more");
  // Menus: an option by its text; an unknown one returns the choices.
  await call("agentlink.tools", { name: "browser_select", allowed: true });
  const picked = await tool("browser_select", {
    text: "Size",
    option: "Medium",
  });
  assert.equal(picked.error, false, picked.text);
  assert.equal(JSON.parse(picked.text).chosen, "Medium");
  assert.equal(await titleOf(), "size m");
  assert.deepEqual(
    JSON.parse(
      (await tool("browser_select", { text: "Size", option: "Huge" })).text,
    ).options,
    ["Small", "Medium"],
  );
  const asking = tool("browser_click", { text: "Submit" });
  const card = main.getByRole("dialog");
  await card.getByText(/Let an agent press “Submit”/).waitFor();
  await card.getByRole("button", { name: "Cancel" }).click();
  assert.match((await asking).text, /said no/);
  assert.notEqual(await titleOf(), "submitted", "nothing was submitted");
  await call("browser.close", { id: formTab });
  // Uploads always ask: once declined, once allowed.
  await call("agentlink.tools", { name: "browser_upload", allowed: true });
  const doc = path.join(profile, "report.txt");
  (await import("node:fs")).writeFileSync(doc, "quarterly numbers");
  const uploadTab = await call("browser.open", {
    input: "http://127.0.0.1:47896/upload",
  });
  const uploadTitle = async () =>
    (await call("browser.state")).tabs.find((t) => t.id === uploadTab)?.title ||
    "";
  for (let i = 0; i < 30 && (await uploadTitle()) !== "upload"; i++)
    await wait(200);
  const declined = tool("browser_upload", { text: "Document", path: doc });
  await card.getByText(/Let an agent upload “report\.txt”/).waitFor();
  await card.getByRole("button", { name: "Cancel" }).click();
  assert.match((await declined).text, /said no/);
  assert.equal(await uploadTitle(), "upload", "nothing was attached");
  const allowed = tool("browser_upload", { text: "Document", path: doc });
  await card.getByText(/Let an agent upload “report\.txt”/).waitFor();
  await card.getByRole("button", { name: "Confirm" }).click();
  const uploaded = await allowed;
  assert.equal(uploaded.error, false, uploaded.text);
  for (let i = 0; i < 20 && (await uploadTitle()) !== "file report.txt"; i++)
    await wait(150);
  assert.equal(await uploadTitle(), "file report.txt");
  assert.match(
    (await tool("browser_upload", { path: "Z:\\nope.txt" })).text,
    /not on this PC/,
  );
  await call("browser.close", { id: uploadTab });
  // Known trackers are cancelled before they leave the PC.
  const trackerTab = await call("browser.open", {
    input: "http://127.0.0.1:47896/tracker",
  });
  let trackerTitle = "";
  for (
    let i = 0;
    i < 40 && !/^tracker (blocked|reached)$/.test(trackerTitle);
    i++
  ) {
    await wait(200);
    trackerTitle =
      (await call("browser.state")).tabs.find((t) => t.id === trackerTab)
        ?.title || "";
  }
  assert.equal(trackerTitle, "tracker blocked");
  assert.ok((await call("browser.state")).blocked >= 1, "counted");
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
    let viaLinked = "",
      lastUrl = "";
    for (let i = 0; i < 30 && viaLinked !== "Second page"; i++) {
      const r = await rpc("tools/call", {
        name: "browser_read",
        arguments: {},
      });
      const read = JSON.parse(r.result.content[0].text || "{}");
      viaLinked = read.title || "";
      if (viaLinked !== "Second page") lastUrl = read.url;
      if (viaLinked !== "Second page") await wait(300);
    }
    assert.equal(
      viaLinked,
      "Second page",
      `read through the linked browser (${lastUrl})`,
    );
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
