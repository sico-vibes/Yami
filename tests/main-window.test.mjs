import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createMainWindow, releaseAfter } from "../electron/main-window.ts";

let nextId = 1;
function fakeWindow() {
  const w = new EventEmitter();
  Object.assign(w, {
    visible: false,
    destroyed: false,
    loading: true,
    sent: [],
    isDestroyed: () => w.destroyed,
    isVisible: () => w.visible,
    isMinimized: () => false,
    restore() {},
    focus() {},
    show() {
      w.visible = true;
      w.emit("show");
    },
    hide() {
      w.visible = false;
      w.emit("hide");
    },
    destroy() {
      w.destroyed = true;
      w.emit("closed");
    },
    webContents: {
      id: nextId++,
      isLoading: () => w.loading,
      send: (_channel, event) => w.sent.push(event),
    },
  });
  return w;
}
function harness() {
  const made = [];
  let busy = false,
    quitting = false;
  const main = createMainWindow({
    create: () => {
      const w = fakeWindow();
      made.push(w);
      return w;
    },
    quitting: () => quitting,
    busy: () => busy,
  });
  return {
    main,
    made,
    setBusy: (v) => (busy = v),
    setQuitting: (v) => (quitting = v),
  };
}

test("the main window is created only when shown", () => {
  const { main, made } = harness();
  assert.equal(main.current(), undefined);
  main.send({ type: "toast", message: "dropped" });
  main.show();
  assert.equal(made.length, 1);
  assert.equal(made[0].visible, false, "waits for ready-to-show");
  made[0].loading = false;
  made[0].emit("ready-to-show");
  assert.equal(made[0].visible, true);
  main.show();
  assert.equal(made.length, 1, "reused while it exists");
});

test("events wait until the page is listening; state snapshots are skipped", () => {
  const { main, made } = harness();
  main.show("settings");
  main.send({ type: "state", state: {} });
  main.send({ type: "confirm", id: "a" });
  assert.deepEqual(made[0].sent, []);
  assert.equal(main.ready({ id: 999 }), false, "other windows cannot flush");
  assert.equal(main.ready(made[0].webContents), true);
  assert.deepEqual(
    made[0].sent.map((e) => e.type),
    ["navigate", "confirm"],
  );
  main.send({ type: "state", state: {} });
  assert.equal(made[0].sent.at(-1).type, "state", "live after ready");
});

test("a hidden window is released after the grace period unless busy", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { main, made, setBusy } = harness();
    main.show();
    made[0].loading = false;
    made[0].emit("ready-to-show");
    made[0].emit("close", { preventDefault() {} });
    assert.equal(made[0].visible, false, "close hides");
    setBusy(true);
    mock.timers.tick(releaseAfter);
    assert.equal(made[0].destroyed, false, "kept while busy");
    setBusy(false);
    mock.timers.tick(releaseAfter);
    assert.equal(made[0].destroyed, true);
    assert.equal(main.current(), undefined);
    main.show();
    assert.equal(made.length, 2, "a fresh window on next show");
    made[1].loading = false;
    made[1].emit("ready-to-show");
    made[1].hide();
    made[1].show();
    mock.timers.tick(releaseAfter * 2);
    assert.equal(made[1].destroyed, false, "showing again cancels release");
  } finally {
    mock.timers.reset();
  }
});

test("closing while quitting lets the window close", () => {
  const { main, made, setQuitting } = harness();
  main.show();
  setQuitting(true);
  let prevented = false;
  made[0].emit("close", { preventDefault: () => (prevented = true) });
  assert.equal(prevented, false);
});
