import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWatchers } from "../electron/wheel/watch.ts";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("watch folders convert new matching files once and skip the rest", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "yami-watch-"));
  fs.writeFileSync(path.join(folder, "before.md"), "# old");
  const converted = [];
  const watchers = createWatchers({
    settleMs: 150,
    notify: () => {},
    convert: async (petal, file) => {
      converted.push([petal, path.basename(file)]);
      // The output lands beside it, as the wheel does; it must not loop.
      fs.writeFileSync(file.replace(/\.md$/, ".html"), "<h1>out</h1>");
    },
  });
  watchers.sync([{ id: "w", folder, target: "to:html", enabled: true }]);
  assert.equal(watchers.count(), 1);
  fs.writeFileSync(path.join(folder, "new.md"), "# new");
  fs.writeFileSync(path.join(folder, "photo.png"), "not markdown");
  fs.writeFileSync(path.join(folder, "draft.md.tmp"), "partial");
  await wait(900);
  assert.deepEqual(converted, [["to:html", "new.md"]]);
  watchers.sync([{ id: "w", folder, target: "to:html", enabled: false }]);
  assert.equal(watchers.count(), 0, "a switched-off watch stops listening");
  fs.writeFileSync(path.join(folder, "later.md"), "# later");
  await wait(400);
  assert.equal(converted.length, 1);
  watchers.dispose();
});
