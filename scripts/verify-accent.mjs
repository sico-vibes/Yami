// Desktop check for accent characters. No key reaches Windows: with
// YAMI_ACCENT_TEST the native host accepts a list of key steps and runs them
// through the same accent logic as real keys, then returns what it would
// type ("\b" for each erased letter, then the character). It also checks the
// strip window opens. Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/accent-verify-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile, YAMI_ACCENT_TEST: "1" };
delete env.ELECTRON_RUN_AS_NODE;
const E = 0x45,
  SPACE = 0x20,
  LEFT = 0x25,
  ESC = 0x1b,
  N = 0x4e;
const step = (vk, up, wait) => ({ vk, up, wait });
const app = await _electron.launch({ args: [path.resolve(".")], env });
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await new Promise((r) => setTimeout(r, 100));
  }
  await main.locator(".bottom-dock").waitFor();
  const call = (m, a) =>
    main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  // Off by default: nothing is held back.
  let r = await call("accent.feed", {
    steps: [
      step(E, false, 400),
      step(SPACE, false, 20),
      step(SPACE, true, 20),
      step(E, true, 20),
    ],
  });
  assert.deepEqual(r, { typed: "", consumed: [false, false, false, false] });
  await call("settings", { quickAccent: true });
  // Hold E 0.4 s, Space, Space: the second choice, è; one "e" erased.
  r = await call("accent.feed", {
    steps: [
      step(E, false, 400),
      step(SPACE, false, 50),
      step(SPACE, true, 50),
      step(SPACE, false, 50),
      step(SPACE, true, 50),
      step(E, true, 50),
    ],
  });
  assert.equal(r.typed, "\bè");
  assert.deepEqual(r.consumed, [false, true, true, true, true, true]);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(
    app.windows().some((p) => p.url().includes("window=accent")),
    "the accent strip window opened",
  );
  // Left wraps to the last choice; held-letter repeats are erased too.
  r = await call("accent.feed", {
    steps: [
      step(N, false, 350),
      step(N, false, 30),
      step(SPACE, false, 30),
      step(LEFT, false, 30),
      step(N, true, 30),
    ],
  });
  assert.equal(r.typed, "\b\bň");
  // Esc cancels: nothing typed.
  r = await call("accent.feed", {
    steps: [
      step(E, false, 350),
      step(SPACE, false, 30),
      step(ESC, false, 30),
      step(E, true, 30),
    ],
  });
  assert.equal(r.typed, "");
  // Typing quickly (Space 40 ms after E) is left alone.
  r = await call("accent.feed", {
    steps: [
      step(E, false, 40),
      step(SPACE, false, 30),
      step(E, true, 30),
      step(SPACE, true, 30),
    ],
  });
  assert.deepEqual(r, { typed: "", consumed: [false, false, false, false] });
  console.log(JSON.stringify({ passed: true }));
} finally {
  await app.close();
}
