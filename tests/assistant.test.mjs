import test from "node:test";
import assert from "node:assert/strict";
import { Assistant } from "../electron/assistant.ts";
test("a circle-to-ask voice turn closes the microphone without clearing queued speech", async () => {
  const events = [];
  let closed = false;
  const a = new Assistant(
    store(),
    async () => {},
    (e) => events.push(e),
    async () => "",
  );
  a.session = {
    close() {
      closed = true;
    },
  };
  a.audioActive = true;
  a.singleTurn = true;
  a.inputText = "What is this?";
  a.outputText = "A tree.";
  await a.liveMessage({ serverContent: { turnComplete: true } });
  assert.equal(closed, true);
  assert.ok(events.some((e) => e.type === "recording-ended"));
  assert.ok(!events.some((e) => e.type === "audio-clear"));
});
function store() {
  return {
    state: {
      settings: {
        textModel: "gemini-2.5-flash",
        voiceModel: "live",
        voice: "Charon",
        memoryEnabled: false,
        contextEnabled: false,
      },
      messages: [],
      memories: [],
    },
    key: () => "test-key-not-a-real-credential",
    usage() {},
    message(role, text, sources) {
      this.state.messages.push({ role, text, sources });
    },
  };
}
test("voice input waits for setup and stale closes cannot clear a newer session", async () => {
  const callbacks = [],
    sessions = [];
  const a = new Assistant(
    store(),
    async () => {},
    () => {},
    async () => "",
  );
  a.client = () => ({
    live: {
      async connect(options) {
        const session = {
          sent: [],
          sendRealtimeInput(v) {
            this.sent.push(v);
          },
          close() {},
        };
        callbacks.push(options.callbacks);
        sessions.push(session);
        return session;
      },
    },
  });
  let ready = false;
  const first = a.startLive().then(() => {
    ready = true;
  });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(ready, false);
  assert.deepEqual(sessions[0].sent, []);
  callbacks[0].onmessage({ setupComplete: {} });
  await first;
  assert.deepEqual(sessions[0].sent, [{ activityStart: {} }]);
  a.endAudio();
  assert.deepEqual(sessions[0].sent.at(-1), { activityEnd: {} });
  a.stopLive();
  const second = a.startLive();
  await new Promise((r) => setTimeout(r, 0));
  callbacks[1].onmessage({ setupComplete: {} });
  await second;
  callbacks[0].onclose({ code: 1000, reason: "" });
  assert.equal(a.session, sessions[1]);
  assert.equal(a.liveReady, true);
  a.stopLive();
});
test("Gemini SDK tool round trip executes a requested tool before reporting its result", async () => {
  const previous = globalThis.fetch,
    requests = [],
    actions = [];
  const responses = [
    {
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                functionCall: {
                  name: "open_app",
                  args: { name: "Calculator" },
                },
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
    },
    {
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Calculator opened." }] },
          finishReason: "STOP",
        },
      ],
    },
  ];
  globalThis.fetch = async (url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const s = store(),
      a = new Assistant(
        s,
        async (name, args) => {
          actions.push({ name, args });
          return { opened: "Calculator" };
        },
        () => {},
        async () => "",
      );
    assert.equal(await a.chat("Open Calculator"), "Calculator opened.");
    assert.deepEqual(actions, [
      { name: "open_app", args: { name: "Calculator" } },
    ]);
    assert.ok(
      requests[1].contents.some((c) => c.parts.some((p) => p.functionResponse)),
    );
    assert.equal(s.state.messages.at(-1).role, "assistant");
  } finally {
    globalThis.fetch = previous;
  }
});
test("Tavily deep research preserves sources and records bounded search/extraction credits", async () => {
  const previous = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("generativelanguage"))
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: '["second query","third query"]' }] },
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    if (String(url).endsWith("/extract"))
      return new Response(
        JSON.stringify({
          results: [
            { url: "https://example.com", raw_content: "Extracted evidence" },
          ],
        }),
      );
    return new Response(
      JSON.stringify({
        results: [
          {
            title: "Evidence",
            url: "https://example.com",
            content: "Search evidence",
          },
        ],
      }),
    );
  };
  try {
    const a = new Assistant(
      store(),
      async () => {},
      () => {},
      async () => "",
    );
    const result = await a.research("Question", true);
    assert.equal(calls.filter((c) => c.endsWith("/search")).length, 3);
    assert.equal(result.credits, 7);
    assert.equal(result.sources[0].content, "Extracted evidence");
  } finally {
    globalThis.fetch = previous;
  }
});
test("deep research still executes three searches when the planner returns incomplete JSON", async () => {
  const previous = globalThis.fetch;
  let searches = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("generativelanguage"))
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "[" }] } }],
        }),
        { headers: { "content-type": "application/json" } },
      );
    if (String(url).endsWith("/extract"))
      return new Response(
        JSON.stringify({
          results: [{ url: "https://example.com", raw_content: "Evidence" }],
        }),
      );
    searches++;
    return new Response(
      JSON.stringify({
        results: [
          {
            url: "https://example.com",
            title: "Evidence",
            content: "Evidence",
          },
        ],
      }),
    );
  };
  try {
    const a = new Assistant(
      store(),
      async () => {},
      () => {},
      async () => "",
    );
    const result = await a.research("Question", true);
    assert.equal(searches, 3);
    assert.equal(result.credits, 7);
  } finally {
    globalThis.fetch = previous;
  }
});
