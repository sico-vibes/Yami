// Desktop check for the Dev hub: adds this repository as a project, reads its
// git state, detects installed agent CLIs and opens a terminal tab there. It
// never starts an agent CLI. Uses an isolated profile under .artifacts.
import { _electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/projects-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const errors = [];
app.on("window", (p) => p.on("pageerror", (e) => errors.push(e.message)));
const windowFor = async (mode) => {
  for (let i = 0; i < 150; i++) {
    const p = app.windows().find((p) => p.url().includes("window=" + mode));
    if (p) return p;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Missing window: " + mode);
};
const call = (page, method, args) =>
  page.evaluate(
    ([m, a]) =>
      window.yami.invoke(m, a).then(
        (value) => ({ value }),
        (error) => ({ error: String(error.message || error) }),
      ),
    [method, args],
  );
try {
  await app.firstWindow();
  const main = await windowFor("main");
  await main.locator(".bottom-dock").waitFor();
  const repo = path.resolve(".");
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
  }).trim();
  const project = (await call(main, "dev.projects.add", { path: repo })).value;
  assert.equal(project.name, path.basename(repo));
  const again = (await call(main, "dev.projects.add", { path: repo + "\\" }))
    .value;
  assert.equal(again.id, project.id, "the same folder is not added twice");
  const [info] = (await call(main, "dev.projects")).value;
  assert.equal(info.exists, true);
  assert.equal(info.git.branch, branch);
  const agents = (await call(main, "dev.agents")).value;
  assert.ok(Array.isArray(agents));
  for (const a of agents) assert.ok(fs.existsSync(a.path), a.path);
  const missing = ["goose", "amp", "aider", "pi", "qwen"].find(
    (id) => !agents.some((a) => a.id === id),
  );
  if (missing)
    assert.match(
      (await call(main, "dev.launch", { project: project.id, agent: missing }))
        .error,
      /not installed/,
    );
  assert.match(
    (await call(main, "dev.launch", { project: project.id, agent: "rm -rf" }))
      .error,
    /Unknown coding agent/,
  );
  // The page shows the project card with its branch.
  await main.getByRole("button", { name: "AI", exact: true }).click();
  await main.getByRole("button", { name: "Projects", exact: true }).click();
  await main
    .locator(".project-card")
    .getByText(branch, { exact: true })
    .waitFor();
  // A plain terminal tab opens in the project, named after it.
  assert.equal(
    (await call(main, "dev.launch", { project: project.id })).value,
    true,
  );
  const terminal = await windowFor("terminal");
  await terminal
    .locator("[data-session]", { hasText: path.basename(repo) })
    .waitFor({ timeout: 20000 });
  const id = await terminal
    .locator("[data-session]")
    .first()
    .getAttribute("data-session");
  await call(terminal, "terminal.end", { session: id });
  assert.equal(
    (await call(main, "dev.projects.remove", { id: project.id })).value,
    true,
  );
  assert.deepEqual((await call(main, "dev.projects")).value, []);
  // Parallel tasks in a throwaway repository: add a worktree, refuse to
  // remove it while it has changes, then remove it once clean.
  const sandbox = path.join(profile, "task-repo");
  fs.mkdirSync(sandbox, { recursive: true });
  const git = (...args) =>
    execFileSync("git", ["-C", sandbox, ...args], { encoding: "utf8" });
  git("init", "-q", "-b", "main");
  fs.writeFileSync(path.join(sandbox, "README.md"), "demo\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Yami",
    "-c",
    "user.email=yami@example.invalid",
    "commit",
    "-qm",
    "init",
  );
  const taskRepo = (await call(main, "dev.projects.add", { path: sandbox }))
    .value;
  const task = (
    await call(main, "dev.task", { id: taskRepo.id, name: "Fix Login" })
  ).value;
  assert.equal(task.branch, "yami/fix-login");
  assert.ok(fs.existsSync(path.join(task.path, "README.md")));
  assert.match(
    (await call(main, "dev.task", { id: taskRepo.id, name: "fix login" }))
      .error,
    /already/,
  );
  let trees = (await call(main, "dev.worktrees", { id: taskRepo.id })).value;
  assert.deepEqual(
    trees.map((t) => [t.branch, t.main]),
    [
      ["main", true],
      ["yami/fix-login", false],
    ],
  );
  fs.writeFileSync(path.join(task.path, "change.txt"), "work in progress\n");
  assert.match(
    (await call(main, "dev.task.remove", { id: taskRepo.id, path: task.path }))
      .error,
    /not committed/,
  );
  fs.rmSync(path.join(task.path, "change.txt"));
  // The task opened a terminal tab in its folder; end it so Windows lets the
  // folder go.
  for (const tab of await terminal.locator("[data-session]").all())
    await call(terminal, "terminal.end", {
      session: await tab.getAttribute("data-session"),
    });
  const removed = await call(main, "dev.task.remove", {
    id: taskRepo.id,
    path: task.path,
  });
  assert.ok(removed.value, removed.error);
  trees = removed.value;
  assert.equal(trees.length, 1);
  assert.equal(fs.existsSync(task.path), false);
  assert.match(
    git("branch", "--list", "yami/fix-login"),
    /yami\/fix-login/,
    "branch kept",
  );
  assert.match(
    (await call(main, "dev.task.remove", { id: taskRepo.id, path: sandbox }))
      .error,
    /gone|main checkout/,
  );
  await call(main, "dev.projects.remove", { id: taskRepo.id });
  const saved = JSON.parse(
    fs.readFileSync(path.join(profile, "workbench.json"), "utf8"),
  );
  assert.deepEqual(saved.projects, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      branch,
      agents: agents.map((a) => a.id),
    }),
  );
} finally {
  await app.close();
}
