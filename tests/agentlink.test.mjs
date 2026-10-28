import test from "node:test";
import assert from "node:assert/strict";
import { answer, trustedOrigin } from "../electron/agentlink/protocol.ts";
import { startAgentLink } from "../electron/agentlink/server.ts";
import { agentTools } from "../electron/agentlink/tools.ts";

const shown = [];
const tools = agentTools({
  notify: (m) => shown.push(m),
  ask: async (q) => q.includes("deploy"),
  projects: () => [{ id: "p1", name: "yami", path: "D:\\yami", added: 0 }],
  openTerminal: () => {},
});
const rpc = (method, params, id = 1) => ({
  jsonrpc: "2.0",
  id,
  method,
  params,
});

test("the MCP core lists only allowed tools and calls them", async () => {
  const allowed = new Set(["notify", "ask_user"]);
  const init = await answer(rpc("initialize", {}), tools, (n) =>
    allowed.has(n),
  );
  assert.equal(init.result.serverInfo.name, "yami");
  const list = await answer(rpc("tools/list"), tools, (n) => allowed.has(n));
  assert.deepEqual(
    list.result.tools.map((t) => t.name),
    ["notify", "ask_user"],
  );
  const call = await answer(
    rpc("tools/call", {
      name: "notify",
      arguments: { message: "Tests passed" },
    }),
    tools,
    (n) => allowed.has(n),
  );
  assert.equal(call.result.isError, false);
  assert.deepEqual(shown, ["Tests passed"]);
  const yes = await answer(
    rpc("tools/call", {
      name: "ask_user",
      arguments: { question: "Can I deploy?" },
    }),
    tools,
    (n) => allowed.has(n),
  );
  assert.equal(yes.result.content[0].text, "yes");
  const blocked = await answer(
    rpc("tools/call", { name: "list_projects" }),
    tools,
    (n) => allowed.has(n),
  );
  assert.equal(blocked.error.code, -32602);
  const empty = await answer(
    rpc("tools/call", { name: "notify", arguments: {} }),
    tools,
    () => true,
  );
  assert.equal(empty.result.isError, true);
  assert.equal(
    await answer(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      tools,
      () => true,
    ),
    undefined,
  );
  assert.equal(
    (await answer({ method: "x" }, tools, () => true)).error.code,
    -32600,
  );
});

test("only this PC's origins are trusted", () => {
  assert.equal(trustedOrigin(undefined), true);
  assert.equal(trustedOrigin("http://localhost:5173"), true);
  assert.equal(trustedOrigin("https://evil.example"), false);
  assert.equal(trustedOrigin("not a url"), false);
});

test("the endpoint needs the token, refuses web pages and answers JSON-RPC", async () => {
  const link = startAgentLink({
    token: () => "secret-token",
    tools,
    allowed: () => true,
    port: 47899,
  });
  await link.ready;
  try {
    const url = "http://127.0.0.1:47899/mcp";
    const post = (body, headers = {}) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    assert.equal((await post(rpc("ping"))).status, 401);
    assert.equal(
      (await post(rpc("ping"), { Authorization: "Bearer wrong-token!" }))
        .status,
      401,
    );
    const auth = { Authorization: "Bearer secret-token" };
    assert.equal(
      (await post(rpc("ping"), { ...auth, Origin: "https://evil.example" }))
        .status,
      403,
    );
    const list = await (await post(rpc("tools/list"), auth)).json();
    assert.equal(list.result.tools.length, 4);
    assert.equal(
      (
        await post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          auth,
        )
      ).status,
      202,
    );
    assert.equal((await fetch("http://127.0.0.1:47899/other")).status, 404);
  } finally {
    await link.close();
  }
});
