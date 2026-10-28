// Desktop check for Fan out: two stand-in "claude" and "codex" commands are
// put first on PATH, so no real agent starts. Yami makes a worktree for each
// in a throwaway repository, writes the task file and types the command;
// the stand-ins record what they were given. Uses an isolated profile.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/fanout-verify-" + Date.now());
skipSetup(profile);
const bin = path.join(profile, "bin");
fs.mkdirSync(bin, { recursive: true });
for (const name of ["claude", "codex"])
  fs.writeFileSync(
    path.join(bin, name + ".cmd"),
    `@echo off\r\necho ${name} %*> "%CD%\\agent-ran.txt"\r\n`,
  );
const env = {
  ...process.env,
  YAMI_DATA_DIR: profile,
  PATH: bin + path.delimiter + process.env.PATH,
};
delete env.ELECTRON_RUN_AS_NODE;
const repo = path.join(profile, "fan-repo");
fs.mkdirSync(repo, { recursive: true });
const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
git(repo, "init", "-q", "-b", "main");
fs.writeFileSync(path.join(repo, "README.md"), "demo\n");
git(repo, "add", ".");
git(
  repo,
  "-c",
  "user.name=Yami",
  "-c",
  "user.email=yami@example.invalid",
  "commit",
  "-qm",
  "init",
);
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const windowFor = async (mode) => {
  for (let i = 0; i < 150; i++) {
    const p = app.windows().find((p) => p.url().includes("window=" + mode));
    if (p) return p;
    await wait(100);
  }
  throw new Error("Missing window: " + mode);
};
const call = (page, method, args) =>
  page.evaluate(
    ([m, a]) =>
      window.yami.invoke(m, a).then(
        (value) => ({ value }),
        (e) => ({ error: e.message }),
      ),
    [method, args],
  );
try {
  await app.firstWindow();
  const main = await windowFor("main");
  await main.locator(".bottom-dock").waitFor();
  const project = (await call(main, "dev.projects.add", { path: repo })).value;
  const task = "Keep the email after a wrong password, and add a test.";
  const fan = (agents, name = "fix login") =>
    call(main, "dev.fanout", { id: project.id, name, prompt: task, agents });
  assert.match((await fan(["claude"])).error, /two to four/);
  assert.match((await fan(["claude", "amp"])).error, /not installed/);
  const started = await fan(["claude", "codex"]);
  assert.ok(started.value, started.error);
  assert.deepEqual(
    started.value.map((s) => s.branch),
    ["yami/fix-login-claude", "yami/fix-login-codex"],
  );
  assert.match((await fan(["claude", "codex"])).error, /already exists/);
  // Each stand-in ran in its own worktree with the fixed instruction.
  for (const s of started.value) {
    const ran = path.join(s.path, "agent-ran.txt");
    for (let i = 0; i < 100 && !fs.existsSync(ran); i++) await wait(150);
    assert.match(
      fs.readFileSync(ran, "utf8"),
      new RegExp(
        `^${s.agent} "Read \\.yami-task\\.md in this folder and do the task it describes\\."`,
      ),
    );
    assert.equal(
      fs.readFileSync(path.join(s.path, ".yami-task.md"), "utf8"),
      `# Task\n\n${task}\n`,
    );
    // The task file is ignored; only the stand-in's own file shows.
    assert.equal(
      git(s.path, "status", "--porcelain").trim(),
      "?? agent-ran.txt",
    );
  }
  const exclude = fs.readFileSync(
    path.join(repo, ".git", "info", "exclude"),
    "utf8",
  );
  assert.equal(exclude.split("/.yami-task.md").length, 2, "excluded once");
  // Compare: each "agent" changed something different.
  const [claudeTask, codexTask] = started.value;
  fs.writeFileSync(
    path.join(claudeTask.path, "README.md"),
    "demo\nfixed by claude\n",
  );
  fs.writeFileSync(
    path.join(codexTask.path, "login.js"),
    "export const ok = 1;\n",
  );
  const compared = await call(main, "dev.compare", {
    id: project.id,
    paths: [claudeTask.path, codexTask.path],
  });
  assert.ok(compared.value, compared.error);
  const byBranch = Object.fromEntries(
    compared.value.map((c) => [c.branch, c.files.map((f) => f.file)]),
  );
  assert.deepEqual(byBranch["yami/fix-login-claude"], [
    "agent-ran.txt",
    "README.md",
  ]);
  assert.deepEqual(byBranch["yami/fix-login-codex"], [
    "agent-ran.txt",
    "login.js",
  ]);
  const readme = await call(main, "dev.compare.file", {
    id: project.id,
    path: claudeTask.path,
    file: "README.md",
  });
  assert.match(readme.value, /^\+fixed by claude$/m);
  assert.match(
    (
      await call(main, "dev.compare.file", {
        id: project.id,
        path: codexTask.path,
        file: "../README.md",
      })
    ).error,
    /outside the task/,
  );
  // The same view in Dev › Projects.
  await call(main, "show", { tab: "ai" });
  await main.getByRole("button", { name: "Projects" }).first().click();
  await main
    .getByRole("button", { name: /Parallel tasks/ })
    .first()
    .click();
  await main.getByRole("button", { name: "Compare" }).click();
  await main.locator(".compare-col").nth(1).waitFor();
  await main.getByRole("button", { name: /README\.md/ }).click();
  await main.getByText("+fixed by claude").waitFor();
  await main.getByText("This task did not change this file.").waitFor();
  await main.getByRole("button", { name: "Close" }).last().click();
  // Clean up the way a user would: end the tabs, then remove each task.
  const terminal = await windowFor("terminal");
  for (const tab of await terminal.locator("[data-session]").all())
    await call(terminal, "terminal.end", {
      session: await tab.getAttribute("data-session"),
    });
  await wait(500);
  for (const s of started.value) {
    fs.rmSync(path.join(s.path, "agent-ran.txt"));
    git(s.path, "checkout", "--", ".");
    git(s.path, "clean", "-fdq");
    const removed = await call(main, "dev.task.remove", {
      id: project.id,
      path: s.path,
    });
    assert.ok(removed.value, removed.error);
    assert.equal(
      fs.existsSync(s.path),
      false,
      "the task file does not block removal",
    );
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, started: started.value }));
} finally {
  await app.close();
}
