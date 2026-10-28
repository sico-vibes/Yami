// Desktop check for "Yami for your agents": turns the module on in an
// isolated profile, then talks MCP to http://127.0.0.1:47821/mcp the way a
// coding agent would. ask_user must show Yami's approval card, and pressing
// Confirm must answer "yes". No agent CLI or its config is touched.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/agentlink-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (method, args) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [method, args]);
  let info = await call("agentlink.info");
  assert.equal(info.enabled, false);
  await assert.rejects(fetch(info.url, { method: "POST", body: "{}" }));
  await call("modules.set", { id: "agentLink", enabled: true });
  info = await call("agentlink.info");
  assert.equal(info.enabled, true);
  assert.equal(info.error, "", info.error);
  assert.match(info.token, /^[0-9a-f]{48}$/);
  let id = 0;
  const rpc = async (method, params, token = info.token) => {
    const response = await fetch(info.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  };
  assert.equal((await rpc("ping", {}, "0".repeat(48))).status, 401);
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "verify", version: "1" },
  });
  assert.equal(init.body.result.serverInfo.name, "yami");
  const listed = (await rpc("tools/list", {})).body.result.tools.map(
    (t) => t.name,
  );
  assert.deepEqual(listed, ["notify", "ask_user", "list_projects"]);
  const notified = await rpc("tools/call", {
    name: "notify",
    arguments: { message: "Verify: build finished" },
  });
  assert.equal(notified.body.result.isError, false);
  // ask_user waits for the visible approval card.
  const asking = rpc("tools/call", {
    name: "ask_user",
    arguments: { question: "Run the release check?" },
  });
  const card = main.getByRole("dialog");
  await card.getByText("A coding agent asks: Run the release check?").waitFor();
  await card.getByRole("button", { name: "Confirm" }).click();
  assert.equal((await asking).body.result.content[0].text, "yes");
  // Turning a tool off hides it at once; a new token locks out the old one.
  await call("agentlink.tools", { name: "notify", allowed: false });
  assert.ok(
    !(await rpc("tools/list", {})).body.result.tools.some(
      (t) => t.name === "notify",
    ),
  );
  const old = info.token;
  info = await call("agentlink.rotate");
  assert.notEqual(info.token, old);
  assert.equal((await rpc("ping", {}, old)).status, 401);
  assert.equal((await rpc("ping", {})).status, 200);
  // The page shows the panel.
  await main.getByRole("button", { name: "AI", exact: true }).click();
  await main.getByRole("button", { name: "MCP", exact: true }).click();
  await main.getByText("Yami for your agents").first().waitFor();
  await call("modules.set", { id: "agentLink", enabled: false });
  await assert.rejects(fetch(info.url, { method: "POST", body: "{}" }));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, tools: listed }));
} finally {
  await app.close();
}
