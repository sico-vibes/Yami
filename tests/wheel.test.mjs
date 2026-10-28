import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DragGesture } from "../src/wheel/gesture.ts";
import { emptyHint, kindOf, petalsFor } from "../src/wheel/catalog.ts";
import { filesFromArgv } from "../src/wheel/argv.ts";
import { assertWheelPath } from "../electron/wheel/paths.ts";

const ids = (names, mode, caps) => petalsFor(names, mode, caps).map((petal) => petal.id);

test("convert petals follow the file kind and skip a no-op format", () => {
  assert.equal(kindOf("grove.JPEG"), "image");
  assert.ok(ids(["grove.png"], "convert").includes("to:jpg"));
  assert.equal(ids(["grove.png"], "convert").includes("to:png"), false);
  assert.equal(ids(["grove.png"], "convert").includes("to:heic"), false);
  assert.ok(ids(["grove.png"], "convert", { heicEncode: true }).includes("to:heic"));
  assert.deepEqual(
    ids(["loop.gif"], "convert").filter((id) => id.startsWith("to:")),
    ["to:mp4", "to:mov", "to:mkv", "to:webm", "to:avi", "to:wmv"],
  );
  assert.ok(ids(["walk.mp4"], "convert").includes("to:mp3"));
  assert.ok(ids(["walk.mp4"], "convert").includes("to:gif"));
  assert.equal(ids(["notes.pdf"], "convert").includes("to:docx"), false);
  assert.ok(ids(["bundle.tar.gz"], "convert").includes("to:zip"));
});

test("tools change when several files are selected", () => {
  assert.ok(ids(["grove.png"], "tools").includes("tool:background"));
  assert.equal(ids(["grove.png", "orchard.jpg"], "tools").includes("tool:background"), false);
  assert.ok(ids(["grove.png", "orchard.jpg"], "tools").includes("tool:collage"));
  assert.ok(ids(["notes.pdf", "extra.pdf"], "tools").includes("tool:merge"));
  assert.equal(ids(["notes.pdf"], "tools").includes("tool:merge"), false);
  assert.deepEqual(ids(["grove.png", "notes.pdf"], "tools"), ["tool:compress", "tool:metadata", "tool:rename"]);
  assert.equal(ids(["notes.pdf"], "tools").includes("tool:rename"), false, "rename needs several files");
  assert.equal(ids(["grove.png", "notes.pdf"], "convert").length, 0);
  assert.match(emptyHint("convert", ["grove.png", "notes.pdf"]), /different kinds/);
  assert.ok(ids(["bundle.rar"], "tools").includes("tool:extract"));
  assert.equal(ids(["anywhere.txt"], "actions").length, 5);
});

test("a modifier opens the wheel only as a short tap during a drag", () => {
  const idle = new DragGesture();
  idle.pointerDown(0, 0);
  idle.pointerMove(4, 0);
  idle.keyDown(0x10, 0);
  assert.equal(idle.keyUp(0x10, 100), null);

  const held = new DragGesture();
  held.pointerDown(0, 0);
  held.pointerMove(40, 0);
  held.keyDown(0x11, 0);
  assert.equal(held.keyUp(0x11, 500), null);

  const drag = new DragGesture();
  drag.pointerDown(10, 10);
  drag.pointerMove(40, 10);
  drag.keyDown(0x10, 1000);
  const opened = drag.keyUp(0x10, 1200);
  assert.equal(opened?.type, "open");
  assert.equal(opened?.mode, "convert");
  drag.keyDown(0x12, 1300);
  const swapped = drag.keyUp(0x12, 1400);
  assert.equal(swapped?.type, "swap");
  assert.equal(swapped?.mode, "actions");
  assert.equal(drag.pointerUp(44, 12)?.type, "release");
  assert.equal(drag.cancel()?.type, "close");
});

test("argv keeps only real files and the hook constants stay paired", () => {
  assert.deepEqual(
    filesFromArgv(
      ["--file-wheel", "C:/Users/me/grove.png", "electron.exe", "--hidden"],
      (value) => value.endsWith(".png"),
      "electron.exe",
    ),
    ["C:/Users/me/grove.png"],
  );
  assert.equal(assertWheelPath("preview://grove.png"), "preview://grove.png");
  assert.throws(() => assertWheelPath("/tmp/project/.env"), /blocked/);
  assert.throws(() => assertWheelPath("/home/me/.ssh/id_ed25519"), /blocked/);
  const native = fs.readFileSync("native/Wheel.cs", "utf8");
  const model = fs.readFileSync("src/wheel/gesture.ts", "utf8");
  assert.match(native, /const int DragSlop = 12/);
  assert.match(native, /const int TapMs = 350/);
  assert.match(model, /DRAG_SLOP_PX = 12/);
  assert.match(model, /TAP_MS = 350/);
});
