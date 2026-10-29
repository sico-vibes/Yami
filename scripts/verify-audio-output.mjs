// Desktop check for choosing the output device: lists the active outputs,
// switches the default to another one for a moment, and puts the original
// back (also on failure). Sound moves for about a second. Isolated profile.
import { _electron } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { skipSetup } from "./test-profile.mjs";

const profile = path.resolve(".artifacts/audio-output-" + Date.now());
skipSetup(profile);
const env = { ...process.env, YAMI_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ args: [path.resolve(".")], env });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let original = "";
let call;
try {
  await app.firstWindow();
  let main;
  for (let i = 0; i < 100 && !main; i++) {
    main = app.windows().find((p) => p.url().includes("window=main"));
    if (!main) await wait(100);
  }
  await main.locator(".bottom-dock").waitFor();
  call = (m, a) => main.evaluate(([m, a]) => window.yami.invoke(m, a), [m, a]);
  const outputs = await call("audio.outputs");
  assert.ok(outputs.length >= 1, "at least one output");
  original = outputs.find((o) => o.isDefault)?.id || "";
  assert.ok(original, "there is a default output");
  await assert.rejects(
    call("audio.output", { id: "not-a-device" }),
    /Choose an output/,
  );
  const other = outputs.find((o) => !o.isDefault);
  let switched = "skipped: only one output";
  if (other) {
    const after = await call("audio.output", { id: other.id });
    assert.equal(
      after.find((o) => o.isDefault)?.id,
      other.id,
      "the default moved",
    );
    switched = other.name;
    await wait(800);
  }
  const back = await call("audio.output", { id: original });
  assert.equal(
    back.find((o) => o.isDefault)?.id,
    original,
    "the original is back",
  );
  original = "";
  console.log(
    JSON.stringify({
      passed: true,
      outputs: outputs.map((o) => o.name),
      switched,
    }),
  );
} finally {
  if (original && call)
    await call("audio.output", { id: original }).catch(() => {});
  await app.close();
}
