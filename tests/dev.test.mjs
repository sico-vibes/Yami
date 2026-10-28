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
} from "../electron/workbench/dev-rules.ts";
import { agentClis } from "../src/dev-types.ts";

test("agent CLIs prefer a real .exe over npm shims and search extra folders", () => {
  const home = "C:\\Users\\demo";
  const folders = agentFolders(
    { PATH: "C:\\Tools;\"C:\\Quoted\"", APPDATA: "C:\\Roaming" },
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
  assert.equal(
    new Set(agentClis.map((c) => c.command)).size,
    agentClis.length,
  );
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
