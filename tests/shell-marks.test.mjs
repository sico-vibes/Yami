import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import os from "node:os";
import {
  integratedLaunch,
  integrationScripts,
} from "../electron/workbench/shell-integration.ts";
import { osc133, osc7Path } from "../src/terminal-marks.ts";

test("OSC 7 and OSC 133 marks parse into folders and exit codes", () => {
  assert.equal(
    osc7Path("file://localhost/C:/Users/Ana/My%20App"),
    "C:\\Users\\Ana\\My App",
  );
  assert.equal(osc7Path("file://localhost/C:/100% done"), "C:\\100% done");
  assert.equal(osc7Path("file://localhost//home/ana"), "/home/ana");
  assert.equal(
    osc7Path("file://localhost///server/share"),
    "\\\\server\\share",
  );
  assert.equal(osc7Path("C:\\Work"), "C:\\Work");
  assert.equal(osc7Path(""), "");
  assert.deepEqual(osc133("D;2"), { kind: "D", exit: 2 });
  assert.deepEqual(osc133("D"), { kind: "D", exit: undefined });
  assert.deepEqual(osc133("A"), { kind: "A", exit: undefined });
  assert.equal(osc133("Z;1"), null);
});

test("each shell gets its marks without losing its usual start", () => {
  const pwsh = integratedLaunch(
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
    true,
  );
  assert.deepEqual(pwsh.args.slice(0, 3), [
    "-NoLogo",
    "-NoExit",
    "-EncodedCommand",
  ]);
  assert.deepEqual(integratedLaunch("C:\\x\\pwsh.exe", false).args, [
    "-NoLogo",
  ]);
  const bash = integratedLaunch("C:\\Git\\bin\\bash.exe", true);
  assert.deepEqual(bash.args, ["--login", "-i"]);
  assert.match(bash.env.PROMPT_COMMAND, /133;D;%s/);
  const cmd = integratedLaunch("C:\\Windows\\System32\\cmd.exe", true, {
    PROMPT: "$N$G",
  });
  assert.equal(
    cmd.env.PROMPT,
    "$e]133;D$e\\$e]7;$P$e\\$e]133;A$e\\$N$G$e]133;B$e\\",
  );
  assert.deepEqual(
    integratedLaunch("C:\\Windows\\System32\\cmd.exe", false).env,
    {},
  );
  assert.deepEqual(integratedLaunch("C:\\Windows\\System32\\wsl.exe", true), {
    args: [],
    env: {},
  });
});

test("the PowerShell prompt reports the folder, the exit code and keeps the old prompt", () => {
  // Two prompts: the first only starts tracking; the second follows a
  // failing native command.
  // A history id the prompt has not seen stands for a newly run command.
  const add = "$Global:__YamiHistory = 999999";
  const script = [
    integrationScripts.powershellPrompt,
    "[Console]::Out.Write((prompt))",
    add,
    "cmd /c exit 3",
    "[Console]::Out.Write((prompt))",
  ].join("\n");
  const out = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { cwd: os.tmpdir(), encoding: "utf8" },
  );
  const marks = [...out.matchAll(/\x1b\](\d+);([^\x07]*)\x07/g)].map((m) => [
    m[1],
    m[2],
  ]);
  assert.deepEqual(marks[0], ["7", marks[0][1]]);
  assert.ok(
    osc7Path(marks[0][1])
      .toLowerCase()
      .startsWith(os.tmpdir().toLowerCase().slice(0, 3)),
  );
  assert.deepEqual(
    marks.slice(1).map((m) => m.join(";")),
    ["133;A", "133;B", "133;D;3", marks[4].join(";"), "133;A", "133;B"],
  );
  assert.equal(marks[4][0], "7");
  assert.match(out, /PS .*> /, "the usual prompt is still there");
});
