import { type BrowserWindow, powerMonitor, screen } from "electron";
import type { Store } from "./store";
import { makeSmallWindow, makeWindow } from "./windows";
import { toolActivity } from "./activity";
import { createDeskWidget } from "./desk-widget";

// The roaming Yami window ("stray") and the bottom-of-screen caption pill.
// Neither runs a timer at idle: the stray only moves after a hover, a drag,
// a voice turn or a lazy drift minutes apart, and the caption window exists
// only during a voice or dictation turn.
const STRAY = { width: 240, height: 180 };
const CAT = { x: 120, y: 112 };
const CAPTION = { width: 760, height: 190 };
type Caption = { mode: string; keys: string[]; you: string; yami: string };
const emptyCaption = (): Caption => ({ mode: "", keys: [], you: "", yami: "" });

export function createOverlays({
  store,
  showMain,
  broadcast,
  fullscreen,
  host,
}: {
  store: Store;
  /** The island, whose renderer process the stray and desk widget share. */
  host: () => BrowserWindow | undefined;
  showMain: () => void;
  broadcast: (event: any) => void;
  // True while a fullscreen app, game or presentation is in front.
  fullscreen: () => Promise<boolean>;
}) {
  let stray: BrowserWindow | undefined,
    caption: BrowserWindow | undefined,
    home: { x: number; y: number } | undefined,
    glide: NodeJS.Timeout | undefined,
    drift: NodeJS.Timeout | undefined,
    closeTimer: NodeJS.Timeout | undefined,
    undockTimer: NodeJS.Timeout | undefined,
    docked = false,
    covered = false,
    strayOpening = false,
    busy = false,
    activityId = 0,
    captionData = emptyCaption();
  const desk = createDeskWidget(store, host);
  const alive = (w?: BrowserWindow): w is BrowserWindow =>
    !!w && !w.isDestroyed();
  const send = (w: BrowserWindow | undefined, event: any) => {
    if (alive(w)) w.webContents.send("yami:event", event);
  };
  const keysOf = (shortcut: string) =>
    shortcut
      .split("+")
      .map((k) => k.trim())
      .filter(Boolean);

  function clamp(x: number, y: number) {
    const wa = screen.getDisplayNearestPoint({
      x: Math.round(x + CAT.x),
      y: Math.round(y + CAT.y),
    }).workArea;
    return {
      x: Math.round(
        Math.min(wa.x + wa.width - CAT.x - 50, Math.max(wa.x - CAT.x + 50, x)),
      ),
      y: Math.round(
        Math.min(wa.y + wa.height - STRAY.height, Math.max(wa.y - 40, y)),
      ),
    };
  }
  function restingSpot() {
    const wa = screen.getPrimaryDisplay().workArea;
    return {
      x: wa.x + wa.width - STRAY.width - 60,
      y: wa.y + wa.height - STRAY.height - 10,
    };
  }
  function islandSpot() {
    const d = screen.getPrimaryDisplay().bounds;
    return { x: Math.round(d.x + d.width / 2 - CAT.x), y: d.y - 70 };
  }
  // Eased move driven only for the length of the glide.
  function glideTo(
    target: { x: number; y: number },
    ms = 650,
    done?: () => void,
  ) {
    if (!alive(stray)) return;
    clearInterval(glide);
    const [sx, sy] = stray.getPosition(),
      start = Date.now(),
      dx = target.x - sx,
      dy = target.y - sy,
      len = Math.hypot(dx, dy) || 1;
    send(stray, { type: "stray-move", moving: true, x: dx / len, y: dy / len });
    glide = setInterval(() => {
      if (!alive(stray)) return clearInterval(glide);
      const t = Math.min(1, (Date.now() - start) / ms),
        e = 1 - (1 - t) ** 3;
      stray.setPosition(Math.round(sx + dx * e), Math.round(sy + dy * e));
      if (t === 1) {
        clearInterval(glide);
        send(stray, { type: "stray-move", moving: false, x: 0, y: 0 });
        done?.();
      }
    }, 16);
  }
  function scheduleDrift() {
    clearTimeout(drift);
    drift = setTimeout(
      async () => {
        if (
          alive(stray) &&
          !docked &&
          !busy &&
          !covered &&
          !powerMonitor.isOnBatteryPower() &&
          !(await fullscreen())
        ) {
          const [x, y] = stray.getPosition(),
            angle = Math.random() * Math.PI * 2;
          home = clamp(x + Math.cos(angle) * 260, y + Math.sin(angle) * 120);
          glideTo(home, 2400);
        }
        scheduleDrift();
      },
      (3 + Math.random() * 3) * 60_000,
    );
  }
  function syncStray() {
    const roam = store.state.settings.roam;
    if (roam && !alive(stray) && !strayOpening) {
      const spot = home || restingSpot();
      strayOpening = true;
      void makeSmallWindow(host(), "stray", {
        ...spot,
        ...STRAY,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: false,
      }).then((w) => {
        strayOpening = false;
        stray = w;
        w.setAlwaysOnTop(true, "floating");
        w.setIgnoreMouseEvents(true, { forward: true });
        w.once("ready-to-show", () => {
          if (alive(w) && !docked && !covered) w.showInactive();
        });
        w.on("closed", () => {
          if (stray !== w) return;
          stray = undefined;
          clearInterval(glide);
          clearTimeout(drift);
        });
        // Turned off while it was opening.
        if (!store.state.settings.roam) w.close();
        else scheduleDrift();
      });
    } else if (!roam && alive(stray)) stray.close();
  }
  function dock() {
    clearTimeout(undockTimer);
    if (!alive(stray) || docked) return;
    docked = true;
    const [x, y] = stray.getPosition();
    home = { x, y };
    send(stray, { type: "stray-dock", docked: true });
    glideTo(islandSpot(), 420, () => {
      if (docked && alive(stray)) stray.hide();
    });
  }
  function undock(delay = 1200) {
    clearTimeout(undockTimer);
    undockTimer = setTimeout(() => {
      if (!alive(stray) || !docked) return;
      docked = false;
      stray.setPosition(islandSpot().x, islandSpot().y);
      if (!covered) stray.showInactive();
      send(stray, { type: "stray-dock", docked: false });
      glideTo(home || restingSpot(), 900);
    }, delay);
  }
  // Step out of the way of fullscreen games, videos and presentations.
  async function checkCover() {
    if (!alive(stray)) return;
    const next = await fullscreen();
    if (next === covered || !alive(stray)) return;
    covered = next;
    if (covered) stray.hide();
    else if (!docked) stray.showInactive();
  }
  function flee(px: number, py: number) {
    if (!alive(stray) || docked) return;
    const [x, y] = stray.getPosition();
    let ax = CAT.x - px,
      ay = CAT.y - py;
    const len = Math.hypot(ax, ay);
    if (len < 1) {
      const angle = Math.random() * Math.PI * 2;
      ax = Math.cos(angle);
      ay = Math.sin(angle);
    } else {
      ax /= len;
      ay /= len;
    }
    const dist = 170 + Math.random() * 90;
    let target = clamp(x + ax * dist, y + ay * dist * 0.6);
    // Cornered: slip sideways along the edge instead of jittering in place.
    if (Math.hypot(target.x - x, target.y - y) < 80)
      target = clamp(x - ax * dist * 1.4, y + (Math.random() - 0.5) * 160);
    home = target;
    glideTo(target, 520);
  }

  function openCaption() {
    clearTimeout(closeTimer);
    if (alive(caption)) return;
    const wa = screen.getDisplayNearestPoint(
      screen.getCursorScreenPoint(),
    ).workArea;
    caption = makeWindow("caption", {
      x: Math.round(wa.x + (wa.width - CAPTION.width) / 2),
      y: wa.y + wa.height - CAPTION.height - 24,
      ...CAPTION,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      focusable: false,
    });
    caption.setAlwaysOnTop(true, "screen-saver");
    caption.setIgnoreMouseEvents(true);
    caption.once("ready-to-show", () => caption?.showInactive());
    caption.on("closed", () => {
      caption = undefined;
    });
  }
  function pushCaption(patch: Partial<Caption>) {
    captionData = { ...captionData, ...patch };
    send(caption, { type: "caption", data: captionData });
  }
  function closeCaption(ms: number) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (alive(caption)) caption.close();
      captionData = emptyCaption();
    }, ms);
  }
  // A short message in the caption pill, used where the collapsed island has
  // no room (for example a missing API key).
  function notice(message: string, ms = 4500) {
    openCaption();
    pushCaption({ mode: "notice", keys: [], you: "", yami: message });
    if (!busy) closeCaption(ms);
  }
  function begin(mode: "voice" | "dictation") {
    if (!store.key("gemini")) {
      notice(
        "Connect your Gemini API key in Settings > API keys to talk to Yami.",
      );
      return;
    }
    busy = true;
    dock();
    openCaption();
    const s = store.state.settings;
    pushCaption({
      mode,
      you: "",
      yami: "",
      keys: keysOf(mode === "voice" ? s.voiceShortcut : s.dictationShortcut),
    });
  }
  function finish(ms = 4000) {
    busy = false;
    pushCaption({ keys: [] });
    closeCaption(ms);
    undock();
  }

  return {
    syncStray() {
      syncStray();
      desk.sync();
    },
    // Called for every broadcast event.
    observe(e: any) {
      switch (e.type) {
        case "state":
          syncStray();
          return desk.sync();
        case "foreground":
          return void checkCover();
        case "voice-start":
          return begin("voice");
        case "record":
          if (!busy) begin(e.kind === "dictation" ? "dictation" : "voice");
          return;
        case "dictation-start":
          return begin("dictation");
        case "voice-stop":
        case "dictation-stop":
          return pushCaption({ keys: [] });
        case "transcript":
          if (!busy) return;
          openCaption();
          return pushCaption(
            e.role === "user" ? { you: e.text } : { yami: e.text },
          );
        case "dictation-result":
          pushCaption({ mode: "dictated", you: e.text, yami: "" });
          return finish(3200);
        case "status":
          if (e.status === "idle" && busy) finish();
          else if (e.status !== "idle" && busy) clearTimeout(closeTimer);
          return;
        case "error":
          if (busy || alive(caption)) {
            pushCaption({ yami: e.message });
            finish(5000);
          }
          return;
        case "cancel-recording":
          if (busy) finish(600);
          return;
      }
    },
    // Wraps a model tool call so the island can show what Yami is doing.
    async track<T>(name: string, args: any, run: () => Promise<T>) {
      const id = ++activityId;
      broadcast({ type: "activity", id, ...toolActivity(name, args) });
      try {
        return await run();
      } finally {
        broadcast({ type: "activity", id, done: true });
      }
    },
    handles: (method: string) => /^(stray|caption|widget)\./.test(method),
    async invoke(method: string, a: any = {}) {
      switch (method) {
        case "widget.fit":
          return desk.fit(Number(a.height));
        case "caption.data":
          return captionData;
        case "caption.notice":
          notice(String(a.message || "").slice(0, 240));
          return true;
        case "stray.mouse":
          if (alive(stray))
            stray.setIgnoreMouseEvents(!!a.ignore, { forward: true });
          return true;
        case "stray.flee":
          flee(Number(a.x) || 0, Number(a.y) || 0);
          return true;
        case "stray.drag": {
          if (!alive(stray) || docked) return false;
          clearInterval(glide);
          const [x, y] = stray.getPosition();
          home = clamp(x + (Number(a.dx) || 0), y + (Number(a.dy) || 0));
          stray.setPosition(home.x, home.y);
          return true;
        }
        case "stray.open":
          showMain();
          return true;
        default:
          throw new Error("Unknown application request: " + method);
      }
    },
    dispose() {
      clearInterval(glide);
      clearTimeout(drift);
      clearTimeout(closeTimer);
      clearTimeout(undockTimer);
    },
  };
}
