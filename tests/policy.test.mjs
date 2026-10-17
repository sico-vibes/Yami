import test from "node:test";
import assert from "node:assert/strict";
import {
  checkToolPermission,
  nextOccurrence,
  safeWebUrl,
  requiredTarget,
} from "../electron/policy.ts";
test("missing target names cannot select an arbitrary application or control", () => {
  for (const value of ["", "   ", undefined, null])
    assert.throws(() => requiredTarget(value), /Choose an application/);
  assert.equal(requiredTarget(" Calculator "), "Calculator");
});
test("terminal and coordinate input remain opt-in", () => {
  assert.throws(() =>
    checkToolPermission("run_terminal", {
      terminalEnabled: false,
      desktopEnabled: false,
    }),
  );
  assert.throws(() =>
    checkToolPermission("click_desktop", {
      terminalEnabled: true,
      desktopEnabled: false,
    }),
  );
  assert.doesNotThrow(() =>
    checkToolPermission("open_app", {
      terminalEnabled: false,
      desktopEnabled: false,
    }),
  );
});
test("external links cannot launch executable protocols or contain credentials", () => {
  for (const url of [
    "file:///C:/Windows/cmd.exe",
    "javascript:alert(1)",
    "https://user:pass@example.com",
  ])
    assert.throws(() => safeWebUrl(url));
  assert.equal(safeWebUrl("https://example.com"), "https://example.com/");
});
test("recurring tasks advance past missed dates without replaying every missed run", () => {
  const task = { at: "2026-10-10T09:00:00Z", repeat: "daily" };
  assert.equal(
    nextOccurrence(task, new Date("2026-10-17T10:00:00Z")),
    "2026-10-18T09:00:00.000Z",
  );
  assert.equal(nextOccurrence({ ...task, repeat: "none" }), null);
  assert.throws(() => nextOccurrence({ at: "invalid", repeat: "daily" }));
});
