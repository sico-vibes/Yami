import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { EventEmitter, once } from "node:events";
import { build } from "esbuild";

// Stub only Electron's resource locator. Protocols, storage and HTTP use real code.
const compiled = await build({
  stdin: {
    contents: [
      "agents",
      "connections",
      "hooks",
      "local-model",
      "meetings",
      "mcp",
      "network",
      "speech",
      "storage",
      "usage",
    ]
      .map((name) => `export * from './electron/workbench/${name}';`)
      .join("\n"),
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node24",
  plugins: [
    {
      name: "resource-locator",
      setup(b) {
        b.onResolve({ filter: /^\.\/terminal$/ }, () => ({
          path: "resource-locator",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const helperPath = name => 'C:/Yami fixture/' + name; export const findExecutable = () => undefined;`,
        }));
      },
    },
  ],
});
const wb = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-contract-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keys = new Map();
  const store = {
    file: path.join(dir, "data.json"),
    state: { settings: {} },
    key(name, value) {
      if (value !== undefined) keys.set(name, value);
      return keys.get(name) || "";
    },
  };
  const data = new wb.WorkbenchStorage(store);
  t.after(() => data.dispose());
  return { dir, data, store, keys };
}
async function server(t, handle) {
  const instance = http.createServer(handle).listen(0, "127.0.0.1");
  await once(instance, "listening");
  t.after(() => {
    instance.closeAllConnections();
    instance.close();
  });
  return `http://127.0.0.1:${instance.address().port}`;
}
test("dictation rules preserve boundaries, literal replacements and whole spoken snippets", () => {
  const rules = [
    { kind: "word", heard: "Yummy", replacement: "Yami $&" },
    { kind: "word", heard: "c++", replacement: "C++" },
    { kind: "snippet", heard: "my signature", replacement: "Regards,\nYami" },
  ];
  assert.equal(
    wb.applyDictationRules("Yummy Yummyland c++!", rules),
    "Yami $& Yummyland C++!",
  );
  assert.equal(
    wb.applyDictationRules("MY SIGNATURE.", rules),
    "Regards,\nYami",
  );
  assert.equal(
    wb.applyDictationRules("Include my signature here", rules),
    "Include my signature here",
  );
  assert.equal(wb.applyDictationRules("éYummy Yummyé", rules), "éYummy Yummyé");
});
test("quota windows retain unknowns and buckets; resets require successive fresh evidence", () => {
  const windows = wb.codexWindows({
    rateLimitsByLimitId: {
      codex: { primary: { usedPercent: 35, resetsAt: 1800000000 } },
      other: { primary: { usedPercent: null } },
    },
  });
  assert.equal(windows[0].used, 0.35);
  assert.equal(windows[0].resetsAt, 1800000000000);
  assert.equal(windows[1].group, "other");
  assert.equal(windows[1].used, null);
  const previous = {
    status: "fresh",
    fetchedAt: 100000,
    windows: [{ id: "a", used: 0.9, resetsAt: 200000 }],
  };
  const next = {
    status: "fresh",
    fetchedAt: 110000,
    windows: [{ id: "a", used: 0.1, resetsAt: 500000 }],
  };
  assert.equal(wb.confirmedReset(previous, next), true);
  assert.equal(
    wb.confirmedReset({ ...previous, status: "stale" }, next),
    false,
  );
  assert.equal(wb.confirmedReset(undefined, next), false);
  assert.equal(
    wb.grokCredential({ "https://auth.x.ai.evil": { key: "bad" } }),
    undefined,
  );
  assert.equal(
    wb.grokCredential({ "https://auth.x.ai::account": { key: "fixture" } }).key,
    "fixture",
  );
});
test("workspace persistence excludes pending approvals, keeps notes and marks cached quota stale", (t) => {
  const { data, store } = fixture(t);
  fs.writeFileSync(store.file, '{"messages":["preserve"]}');
  store.key("provider:local", "secret-fixture");
  data.state.notes.push({
    id: "note",
    title: "Keep",
    text: "x".repeat(1000),
    at: new Date().toISOString(),
  });
  data.state.requests.push({ id: "pending" });
  data.state.sessions.push({ id: "session" });
  data.state.usage.push({
    provider: "codex",
    status: "fresh",
    windows: [],
    fetchedAt: Date.now(),
  });
  data.save();
  const restarted = new wb.WorkbenchStorage(store);
  assert.equal(restarted.state.requests.length, 0);
  assert.equal(restarted.state.sessions.length, 0);
  assert.equal(restarted.state.notes[0].text.length, 1000);
  assert.equal(restarted.state.usage[0].status, "stale");
  assert.equal(data.publicState().notes[0].text.length, 200);
  assert.ok(!JSON.stringify(data.publicState()).includes("secret-fixture"));
  assert.equal(
    fs.readFileSync(store.file, "utf8"),
    '{"messages":["preserve"]}',
  );
});
test("hook install/remove preserves unrelated settings and rejects changed preview", (t) => {
  const { dir } = fixture(t),
    file = path.join(dir, ".claude/settings.json");
  fs.mkdirSync(path.dirname(file));
  const original = {
    model: "keep",
    hooks: {
      Stop: [
        { matcher: "*", hooks: [{ type: "command", command: "echo keep" }] },
      ],
    },
  };
  fs.writeFileSync(file, JSON.stringify(original));
  const plan = wb.hookPlan(
    "claude",
    true,
    "C:/Basem's/$literal/relay.json",
    dir,
  );
  assert.ok(plan.after.includes("echo keep"));
  const opencode = wb.hookPlan(
    "opencode",
    true,
    "C:/Basem's/$literal/agent-relay.json",
    dir,
  );
  assert.match(opencode.after, /export default \{/);
  assert.match(opencode.after, /id: 'yami\.activity'/);
  assert.match(opencode.after, /ctx\.event\.subscribe/);
  assert.match(opencode.after, /execute\.before/);
  assert.doesNotMatch(opencode.after, /export const YamiPlugin/);
  const applied = wb.applyHookPlan(
    "claude",
    true,
    plan.fingerprint,
    "C:/Basem's/$literal/relay.json",
    dir,
  );
  assert.ok(fs.existsSync(applied.backup));
  assert.throws(
    () => wb.applyHookPlan("claude", false, plan.fingerprint, "relay", dir),
    /changed since/,
  );
  const remove = wb.hookPlan("claude", false, "relay", dir);
  assert.deepEqual(JSON.parse(remove.after), original);
  const codex = JSON.parse(wb.hookPlan("codex", true, "relay", dir).after);
  assert.equal(codex.hooks.SessionEnd[0].hooks[0].timeout, 3);
  const copilot = JSON.parse(wb.hookPlan("copilot", true, "relay", dir).after);
  assert.ok(!copilot.hooks.sessionStart[0].bash.startsWith("&"));
});
test(
  "named-pipe approvals require valid authentication and display ACK; unattended requests fall back",
  { timeout: 10000 },
  async (t) => {
    const { data } = fixture(t);
    let onChange = () => {};
    const hub = new wb.AgentHub(data, () => onChange());
    hub.start();
    t.after(() => hub.stop());
    await once(hub.server, "listening");
    const config = JSON.parse(fs.readFileSync(hub.configFile, "utf8"));
    const address =
      process.platform === "win32"
        ? `\\\\.\\pipe\\${config.pipe}`
        : path.join(os.tmpdir(), config.pipe + ".sock");
    async function send(payload, reply) {
      const socket = net.connect(address);
      let response = "";
      socket.on("data", (chunk) => (response += chunk));
      socket.on("error", () => {});
      onChange = () => {
        const request = data.state.requests[0];
        if (request && reply) reply(request);
      };
      await once(socket, "connect");
      socket.write(
        JSON.stringify({
          token: config.token,
          yami_agent: "claude",
          session_id: "fixture",
          hook_event_name: "PermissionRequest",
          tool_name: "Bash",
          tool_input: { command: "echo fixture" },
          ...payload,
        }) + "\n",
      );
      await once(socket, "end");
      return JSON.parse(response);
    }
    assert.deepEqual(await send({ token: "bad" }), {});
    assert.equal(data.state.sessions.length, 0);
    for (const decision of ["allow", "deny"]) {
      const response = await send({}, (r) => {
        assert.throws(() => hub.finish(r.id, decision), /Display/);
        hub.acknowledge(r.id);
        hub.finish(r.id, decision);
      });
      assert.equal(response.hookSpecificOutput.decision.behavior, decision);
    }
    assert.deepEqual(await send({}), {});
    assert.equal(data.state.requests.length, 0);
    const question = await send(
      {
        hook_event_name: "PreToolUse",
        tool_name: "AskUserQuestion",
        tool_input: {
          questions: [
            {
              question: "Pick",
              options: [{ label: "One" }, { label: "Two" }],
              multiSelect: true,
            },
          ],
        },
      },
      (r) => {
        hub.acknowledge(r.id);
        assert.throws(() => hub.finish(r.id, "answer", { Pick: [] }), /Answer/);
        hub.finish(r.id, "answer", { Pick: ["One"] });
      },
    );
    assert.deepEqual(question.hookSpecificOutput.updatedInput.answers, {
      Pick: ["One"],
    });
  },
);
test("meeting transcription retains audio on failure and commits before removal", async (t) => {
  const owner = Object.assign(new EventEmitter(), { id: 10 }),
    other = { id: 11 };
  let failing = true,
    transcriptionCalls = 0;
  const meetings = new wb.Meetings({
    cancel() {},
    async transcribe(data, mime) {
      transcriptionCalls++;
      assert.equal(mime, "audio/wav");
      assert.equal(
        Buffer.from(data, "base64").subarray(0, 4).toString(),
        "RIFF",
      );
      if (failing) throw new Error("fixture offline");
      return "Fixture transcript";
    },
  });
  t.after(() => meetings.dispose());
  await assert.rejects(meetings.start(owner, false, "windows"), /participants/);
  const starting = meetings.start(owner, true, "windows");
  await assert.rejects(
    meetings.start(owner, true, "windows"),
    /Finish the current/,
  );
  const { id } = await starting;
  const pcm = Buffer.alloc(32000).toString("base64");
  assert.throws(() => meetings.chunk(id, pcm, other), /no longer/);
  await meetings.chunk(id, pcm, owner);
  await assert.rejects(meetings.finish(id, owner), /fixture offline/);
  assert.equal(meetings.active, true);
  failing = false;
  await assert.rejects(
    meetings.finish(id, owner, async () => {
      throw new Error("disk full");
    }),
    /disk full/,
  );
  assert.equal(meetings.active, true);
  let committed = false;
  assert.equal(
    await meetings.finish(id, owner, async (text) => {
      assert.equal(text, "Fixture transcript");
      committed = true;
    }),
    "Fixture transcript",
  );
  assert.equal(committed, true);
  assert.equal(meetings.active, false);
  assert.equal(transcriptionCalls, 3);
});
test("HTTP forbids credential URLs/redirects, bounds responses and respects retry-after", async (t) => {
  assert.throws(() => wb.serverUrl("http://example.com"), /HTTPS/);
  assert.throws(
    () => wb.serverUrl("https://user:secret@example.com"),
    /credentials/,
  );
  assert.throws(
    () => wb.serverUrl("https://example.com?api_token=x"),
    /credential/,
  );
  const url = await server(t, (req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/secret" });
      res.end();
    } else {
      res.writeHead(429, { "retry-after": "120" });
      res.end();
    }
  });
  await assert.rejects(
    wb.requestJson(url + "/redirect", "fixture"),
    /fetch failed/,
  );
  await assert.rejects(
    wb.requestJson(url, "fixture"),
    (error) => error.retryAt >= Date.now() + 119000,
  );
  await assert.rejects(wb.boundedText(new Response("12345"), 4), /exceeded/);
});
test("local chat discovers models, hides reasoning, surfaces stream errors and cancels", async (t) => {
  const { data } = fixture(t);
  let mode = "stream";
  const url = await server(t, (req, res) => {
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "test" }, { id: "embedding" }] }));
      return;
    }
    if (mode === "hang") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.flushHeaders();
      return;
    }
    res.writeHead(200, {
      "content-type":
        mode === "json" ? "application/json" : "text/event-stream",
    });
    if (mode === "error")
      res.end('data: {"error":{"message":"private internal details"}}\n\n');
    else if (mode === "json")
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "<think>private</think>Answer" } }],
        }),
      );
    else
      res.end(
        'data: {"choices":[{"delta":{"content":"<think>private</think>Answer"}}]}\n\ndata: [DONE]\n\n',
      );
  });
  data.state.settings.localUrl = url + "/v1";
  data.state.settings.localModel = "test";
  const events = [],
    local = new wb.LocalModel(data, (e) => events.push(e));
  assert.deepEqual(await local.models(), ["test"]);
  assert.equal(await local.chat("a", "hello"), "Answer");
  assert.ok(!JSON.stringify(events).includes("private"));
  mode = "json";
  assert.equal(await local.chat("b", "hello"), "Answer");
  mode = "error";
  await assert.rejects(local.chat("c", "hello"), /reported an error/);
  mode = "hang";
  const pending = local.chat("d", "hello");
  setTimeout(() => local.cancel("d"), 50);
  await assert.rejects(pending, /abort/i);
});
test("MCP initializes, lists advertised tools and requires explicit confirmation before calling", async (t) => {
  const { data } = fixture(t);
  let allowed = false;
  const methods = [];
  const url = await server(t, (req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const p = JSON.parse(body);
      methods.push(p.method);
      if (p.method === "notifications/initialized") {
        res.writeHead(202);
        res.end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.setHeader("mcp-session-id", "fixture-session");
      const result =
        p.method === "initialize"
          ? { protocolVersion: "2025-03-26" }
          : p.method === "tools/list"
            ? { tools: [{ name: "fixture", inputSchema: { type: "object" } }] }
            : { content: [{ type: "text", text: "done" }] };
      res.end(JSON.stringify({ jsonrpc: "2.0", id: p.id, result }));
    });
  });
  data.state.settings.mcpUrl = url;
  const mcp = new wb.McpClient(data, async () => allowed);
  assert.equal((await mcp.connect())[0].name, "fixture");
  await assert.rejects(mcp.call("unknown", {}), /advertised/);
  await assert.rejects(mcp.call("fixture", {}), /cancelled/);
  assert.equal(methods.includes("tools/call"), false);
  allowed = true;
  assert.equal((await mcp.call("fixture", {})).content[0].text, "done");
  mcp.disconnect();
  await assert.rejects(mcp.call("fixture", {}), /advertised/);
});
test("connection validation preserves credentials on failure and formats currency units", (t) => {
  const { data, store } = fixture(t);
  const c = new wb.Connections(
    data,
    () => {},
    () => {},
  );
  t.after(() => c.dispose());
  const saved = c.save({
    kind: "n8n",
    url: "http://127.0.0.1:5678",
    key: "keep",
    enabled: true,
  });
  assert.throws(
    () =>
      c.save({
        ...saved,
        url: "http://localhost:5678",
        key: "x".repeat(12001),
      }),
    /too long/,
  );
  assert.equal(store.key("connection:" + saved.id), "keep");
  assert.equal(data.state.connections[0].url, saved.url);
  assert.equal(wb.formatAmount(150, "usd"), "$1.50");
  assert.equal(wb.formatAmount(150, "jpy"), "¥150");
});
test("connection retry-after also bounds manual refresh and disabled in-flight results are ignored", async (t) => {
  const { data } = fixture(t);
  let calls = 0,
    release;
  const url = await server(t, (_req, res) => {
    calls++;
    if (calls === 1) {
      res.writeHead(429, { "retry-after": "120" });
      res.end();
    } else release = () => res.end('{"data":[]}');
  });
  const c = new wb.Connections(
    data,
    () => {},
    () => {},
  );
  t.after(() => c.dispose());
  let saved = c.save({
    kind: "n8n",
    url,
    key: "fixture",
    enabled: true,
    background: false,
  });
  assert.equal((await c.refresh(saved.id)).status, "error");
  await c.refresh(saved.id);
  assert.equal(calls, 1);
  saved = c.save({ ...saved, url: url + "/other", key: "fixture" });
  const pending = c.refresh(saved.id);
  for (let i = 0; !release && i < 100; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.ok(release);
  c.save({ ...saved, enabled: false });
  release();
  await pending;
  assert.equal(data.state.readings.length, 0);
});
