import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  agentFolders,
  editorLink,
  findCommand,
  parseGitStatus,
  projectName,
  sameFolder,
  fanOutPlan,
  promptCommand,
} from "../electron/workbench/dev-rules.ts";
import { agentClis } from "../src/dev-types.ts";

test("agent CLIs prefer a real .exe over npm shims and search extra folders", () => {
  const home = "C:\\Users\\demo";
  const folders = agentFolders(
    { PATH: 'C:\\Tools;"C:\\Quoted"', APPDATA: "C:\\Roaming" },
    home,
  );
  assert.ok(folders.includes("C:\\Quoted"), "quotes are stripped");
  assert.ok(folders.includes(path.join("C:\\Roaming", "npm")));
  assert.ok(folders.includes(path.join(home, ".local", "bin")));
  const files = new Set(
    [
      path.join("C:\\Roaming", "npm", "codex.cmd"),
      path.join("C:\\Roaming", "npm", "codex.ps1"),
      path.join("C:\\Tools", "codex.exe"),
    ].map((f) => f.toLowerCase()),
  );
  const exists = (f) => files.has(f.toLowerCase());
  assert.equal(
    findCommand("codex", folders, exists),
    path.join("C:\\Tools", "codex.exe"),
  );
  files.delete(path.join("C:\\Tools", "codex.exe").toLowerCase());
  assert.equal(
    findCommand("codex", folders, exists),
    path.join("C:\\Roaming", "npm", "codex.cmd"),
  );
  assert.equal(findCommand("claude", folders, exists), "");
});

test("the catalogue has unique ids, commands and two-letter marks", () => {
  assert.equal(new Set(agentClis.map((c) => c.id)).size, agentClis.length);
  assert.equal(new Set(agentClis.map((c) => c.command)).size, agentClis.length);
  for (const c of agentClis) {
    assert.match(c.command, /^[a-z][a-z-]*$/, "a plain command, no arguments");
    assert.equal(c.mark.length, 2);
    assert.match(c.site, /^https:\/\//);
  }
});

test("git porcelain v2 status gives branch, changes and ahead/behind", () => {
  const status = [
    "# branch.oid 1234",
    "# branch.head yami-expansion",
    "# branch.upstream origin/yami-expansion",
    "# branch.ab +2 -1",
    "1 .M N... 100644 100644 100644 a b src/App.tsx",
    "2 R. N... 100644 100644 100644 a b R100 new.ts\told.ts",
    "u UU N... 100644 100644 100644 100644 a b c merge.ts",
    "? notes.txt",
    "! ignored.log",
  ].join("\n");
  assert.deepEqual(parseGitStatus(status), {
    branch: "yami-expansion",
    changes: 4,
    ahead: 2,
    behind: 1,
  });
  assert.deepEqual(parseGitStatus("# branch.head (detached)\r\n"), {
    branch: "detached",
    changes: 0,
    ahead: 0,
    behind: 0,
  });
});

test("folders compare like Windows and open as editor links", () => {
  assert.equal(projectName("D:\\Code\\yami\\"), "yami");
  assert.ok(sameFolder("D:\\Code\\Yami", "d:\\code\\yami\\"));
  assert.ok(!sameFolder("D:\\Code\\Yami", "D:\\Code\\Yami2"));
  if (process.platform === "win32")
    assert.equal(
      editorLink("vscode", "D:\\Basem's\\My Code"),
      "vscode://file/D:/Basem's/My%20Code",
    );
});

test("worktrees list with the main checkout first and plans stay beside it", async () => {
  const { parseWorktrees, worktreePlan } =
    await import("../electron/workbench/dev-rules.ts");
  const list = parseWorktrees(
    [
      "worktree D:/Code/yami",
      "HEAD 1234567890abcdef1234",
      "branch refs/heads/main",
      "",
      "worktree D:/Code/yami.worktrees/fix-login",
      "HEAD abcdef1234567890abcd",
      "branch refs/heads/yami/fix-login",
      "",
      "worktree D:/Code/yami.worktrees/old",
      "HEAD 0000000000000000",
      "detached",
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    list.map((w) => [w.branch, w.main, w.head.length]),
    [
      ["main", true, 12],
      ["yami/fix-login", false, 12],
      ["detached", false, 12],
    ],
  );
  const plan = worktreePlan("D:\\Code\\yami", "  Fix Login / OAuth!! ");
  assert.equal(plan.branch, "yami/fix-login-oauth");
  assert.equal(
    plan.folder,
    path.join("D:\\Code", "yami.worktrees", "fix-login-oauth"),
  );
  assert.deepEqual(plan.args.slice(2), [
    "worktree",
    "add",
    "-b",
    plan.branch,
    plan.folder,
  ]);
  assert.throws(
    () => worktreePlan("D:\\Code\\yami", "!!!"),
    /letters or numbers/,
  );
});

test("fan out plans one worktree per agent and types no task text", () => {
  const pick = (...ids) => ids.map((id) => agentClis.find((c) => c.id === id));
  const plans = fanOutPlan(
    path.join("C:", "code", "site"),
    "Fix the login!",
    pick("claude", "opencode"),
  );
  assert.deepEqual(
    plans.map((p) => [p.branch, path.basename(p.folder), p.command]),
    [
      [
        "yami/fix-the-login-claude",
        "fix-the-login-claude",
        'claude "Read .yami-task.md in this folder and do the task it describes."',
      ],
      [
        "yami/fix-the-login-opencode",
        "fix-the-login-opencode",
        'opencode --prompt "Read .yami-task.md in this folder and do the task it describes."',
      ],
    ],
  );
  assert.equal(path.basename(path.dirname(plans[0].folder)), "site.worktrees");
  // A long name is cut so the agent's id always survives.
  const long = fanOutPlan("C:/p", "x".repeat(80), pick("codex", "gemini"));
  assert.ok(long.every((p, i) => p.branch.endsWith(["-codex", "-gemini"][i])));
  assert.throws(() => fanOutPlan("C:/p", "a", pick("claude")), /two to four/);
  assert.throws(
    () => fanOutPlan("C:/p", "a", pick("claude", "claude")),
    /once/,
  );
  assert.throws(
    () => fanOutPlan("C:/p", "!!", pick("claude", "codex")),
    /letters or numbers/,
  );
  assert.throws(
    () => promptCommand(agentClis.find((c) => c.id === "crush")),
    /cannot start/,
  );
  for (const c of agentClis.filter((c) => c.prompt))
    assert.doesNotMatch(promptCommand(c), /['$`;&|<>%]/, c.id);
});
