import test from "node:test";
import assert from "node:assert/strict";
import { focusSites } from "../src/focus-sites.ts";

test("focus sites are cleaned into plain domains", () => {
  assert.deepEqual(
    focusSites("youtube.com, https://www.Reddit.com/r/all  x.com,,bad x.com"),
    ["youtube.com", "www.reddit.com", "x.com"],
  );
  assert.deepEqual(focusSites("not a site"), []);
});
