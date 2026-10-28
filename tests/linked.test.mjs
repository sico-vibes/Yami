import test from "node:test";
import assert from "node:assert/strict";
import { linkedArgs } from "../electron/browser/linked.ts";

test("a linked browser gets its own profile and loopback-only debugging", () => {
  const args = linkedArgs(
    "D:\\Yami\\linked-edge",
    47824,
    "https://accounts.google.com/",
  );
  assert.deepEqual(args.slice(0, 3), [
    "--user-data-dir=D:\\Yami\\linked-edge",
    "--remote-debugging-port=47824",
    "--remote-debugging-address=127.0.0.1",
  ]);
  assert.equal(args.at(-1), "https://accounts.google.com/");
  assert.ok(!args.includes("--headless=new"));
  assert.ok(linkedArgs("p", 1, "https://x/", true).includes("--headless=new"));
});
