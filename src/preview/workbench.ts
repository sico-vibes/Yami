import { workbenchDefaults, type WorkbenchState } from "../workbench-types";
let nextId = 0;
const demo: WorkbenchState = {
  settings: { ...workbenchDefaults },
  connections: [],
  readings: [],
  requests: [],
  rules: [],
  notes: [],
  sessions: [
    {
      id: "demo-codex",
      agent: "codex",
      project: "Demo workspace",
      cwd: "Demo folder",
      phase: "working",
      detail: "Reviewing a local change (demo)",
      at: Date.now(),
      source: "hook",
      files: ["Demo folder/src/App.tsx", "Demo folder/README.md"],
    },
  ],
  usage: [
    {
      provider: "codex",
      account: "Demo account",
      status: "fresh",
      source: "Synthetic preview fixture",
      note: "Demo figures; no account was read.",
      fetchedAt: Date.now(),
      windows: [
        {
          id: "codex:primary",
          label: "5-hour limit",
          used: 0.24,
          resetsAt: Date.now() + 3600000,
          group: "Demo account",
        },
        {
          id: "codex:weekly",
          label: "Weekly limit",
          used: 0.78,
          resetsAt: Date.now() + 4 * 86400000,
          group: "Demo account",
        },
        {
          id: "codex:review",
          label: "Code review",
          used: 0.93,
          resetsAt: Date.now() + 2 * 86400000,
          group: "Demo account",
        },
      ],
    },
  ],
  // Synthetic recap events so the timeline has something to show.
  history: (
    [
      ["finished", 3],
      ["working", 12],
      ["thinking", 13],
      ["waiting", 40],
      ["finished", 320],
      ["idle", 330],
    ] as const
  ).map(([phase, minutes]) => ({
    session: "demo-codex",
    agent: "codex",
    project: "Demo workspace",
    phase,
    at: Date.now() - minutes * 60000,
  })),
};
const text = (value: string) => btoa(unescape(encodeURIComponent(value)));
export function previewWorkbench(
  method: string,
  a: any,
  emit: (event: any) => void,
): any {
  const changed = () =>
    emit({ type: "workbench-state", state: structuredClone(demo) });
  if (method === "workbench.state") return structuredClone(demo);
  if (method === "workbench.settings") {
    if (a.localKey || a.mcpKey || a.usageKey)
      throw new Error(
        "Preview never stores credentials. Configure connections in Windows.",
      );
    for (const key of Object.keys(workbenchDefaults))
      if (key in a) (demo.settings as any)[key] = a[key];
    changed();
    return structuredClone(demo);
  }
  if (method === "workbench.backgroundData")
    return "/wallpapers/starter-01.jpg";
  if (method === "workbench.background")
    throw new Error(
      "Choose files in the Windows app. Preview has no file access.",
    );
  if (method === "terminal.create") {
    const id = `demo-terminal-${++nextId}`;
    setTimeout(
      () =>
        emit({
          type: "terminal-output",
          kind: "data",
          session: id,
          data: text(
            "\u001b[36mYami Terminal preview\u001b[0m\r\nSynthetic text only. No shell, commands or files are accessed.\r\n\r\nDemo > ",
          ),
        }),
      50,
    );
    return { id, cwd: "Demo workspace", shell: "Preview" };
  }
  if (method === "terminal.write") {
    emit({
      type: "terminal-output",
      kind: "data",
      session: a.session,
      data: text(a.text),
    });
    return true;
  }
  if (
    [
      "terminal.resize",
      "terminal.ack",
      "terminal.end",
      "terminal.minimize",
      "terminal.hide",
    ].includes(method)
  )
    return true;
  if (method === "terminal.open") {
    emit({
      type: "toast",
      message:
        "Use the Terminal preview screen for the fixture. A real shell is available in Windows.",
    });
    return false;
  }
  if (method === "terminal.folder") return "";
  if (method === "context.pick" || method === "context.windows") return [];
  if (method === "context.use") {
    emit({
      type: "context-selected",
      item: { id: "demo-context", title: a.title, text: a.text },
    });
    emit({ type: "navigate", tab: "home" });
    return true;
  }
  if (method === "usage.refresh") {
    const existing = demo.usage.find((r) => r.provider === a.provider);
    if (!existing)
      demo.usage.push({
        provider: a.provider,
        account: "Demo",
        status: "unavailable",
        windows: [],
        fetchedAt: 0,
        source: "Preview",
        note: "No provider is contacted in preview.",
      });
    changed();
    return existing;
  }
  if (method === "agents.preview")
    return {
      agent: a.agent,
      install: a.install,
      file: "Demo hook configuration (no file access)",
      before: "{}",
      after: JSON.stringify({ demo: true, agent: a.agent }),
      fingerprint: "demo",
      note: "Preview only. No CLI configuration will be changed.",
    };
  if (method === "agents.install")
    return { note: "Preview only — no agent configuration was changed." };
  if (method === "agents.dismiss") {
    demo.sessions = demo.sessions.filter((s) => s.id !== a.id);
    changed();
    return true;
  }
  if (method.startsWith("agents.")) return false;
  if (method === "connections.save") {
    if (a.key) throw new Error("Preview never stores credentials.");
    const c = { ...a, id: a.id || `demo-${++nextId}`, hasKey: false };
    delete c.key;
    demo.connections = [...demo.connections.filter((c) => c.id !== a.id), c];
    changed();
    return c;
  }
  if (method === "connections.remove") {
    demo.connections = demo.connections.filter((c) => c.id !== a.id);
    changed();
    return true;
  }
  if (method === "connections.refresh") {
    demo.readings = [
      ...demo.readings.filter((r) => r.id !== a.id),
      {
        id: a.id,
        at: Date.now(),
        status: "ready",
        items: [
          {
            id: "demo-item",
            title: "Synthetic service event",
            detail: "No public request was made",
            status: "demo",
          },
        ],
      },
    ];
    changed();
    return true;
  }
  if (method === "speech.rules.save") {
    const rule = { ...a, id: a.id || `demo-rule-${++nextId}` };
    demo.rules = [...demo.rules.filter((r) => r.id !== rule.id), rule];
    changed();
    return rule;
  }
  if (method === "speech.rules.remove") {
    demo.rules = demo.rules.filter((r) => r.id !== a.id);
    changed();
    return true;
  }
  if (method === "speech.recognizers") return [];
  if (method === "speech.copyLast") return false;
  if (method === "notes.save") {
    const note = {
      ...a,
      id: a.id || `demo-note-${++nextId}`,
      at: new Date().toISOString(),
    };
    demo.notes = [...demo.notes.filter((n) => n.id !== note.id), note];
    changed();
    return note;
  }
  if (method === "notes.get") return demo.notes.find((n) => n.id === a.id);
  if (method === "notes.search")
    return demo.notes.filter((n) =>
      `${n.title} ${n.text}`
        .toLowerCase()
        .includes(String(a.query || "").toLowerCase()),
    );
  if (method === "notes.remove") {
    demo.notes = demo.notes.filter((n) => n.id !== a.id);
    changed();
    return true;
  }
  if (method === "notes.summarize")
    return "Preview summary only. No provider request was made.";
  if (method === "local.models") return ["demo-model"];
  if (method === "local.chat")
    return "This is a synthetic preview response. No model server was contacted.";
  if (method === "mcp.connect")
    return [
      {
        name: "demo_tool",
        description: "A synthetic tool. Nothing executes.",
        inputSchema: { type: "object" },
      },
    ];
  if (method === "mcp.call") return { preview: true, executed: false };
  if (method === "local.disconnect") {
    demo.settings.localModel = "";
    changed();
    return true;
  }
  if (method === "local.cancel" || method === "mcp.disconnect") return true;
  if (method.startsWith("meeting.") || method.startsWith("speech."))
    throw new Error(
      "Recording is unavailable in preview. No microphone, system audio or provider is accessed.",
    );
  throw new Error("Desktop-only workspace action: " + method);
}
