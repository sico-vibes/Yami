import { screen, type BrowserWindow } from "electron";
import { makeWindow } from "./windows";

// The strip of accent choices while a letter is held (native QuickAccent).
// One small window that never takes focus, at the top of the screen the
// pointer is on, so typing stays in the app. It is hidden between uses and
// closed after a minute unused.

let strip: BrowserWindow | undefined;
let state = { open: false, choices: "", index: 0 };
let idle: NodeJS.Timeout | undefined;

export const accentState = () => state;

export function onAccent(
  e: { open: boolean; choices?: string; index?: number },
  broadcast: (event: any) => void,
) {
  state = {
    open: e.open,
    choices: String(e.choices || state.choices),
    index: Number(e.index) || 0,
  };
  broadcast({ type: "accent", ...state });
  clearTimeout(idle);
  if (!e.open) {
    strip?.hide();
    idle = setTimeout(() => {
      strip?.destroy();
      strip = undefined;
    }, 60_000);
    return;
  }
  const area = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  ).workArea;
  const width = Math.min(area.width - 40, 24 + [...state.choices].length * 46),
    height = 70;
  const bounds = {
    x: Math.round(area.x + (area.width - width) / 2),
    y: area.y + 24,
    width,
    height,
  };
  if (!strip || strip.isDestroyed()) {
    strip = makeWindow("accent", {
      ...bounds,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      hasShadow: false,
    });
    strip.setAlwaysOnTop(true, "screen-saver");
    strip.setIgnoreMouseEvents(true);
    strip.once("ready-to-show", () => strip?.showInactive());
  } else {
    strip.setBounds(bounds);
    if (!strip.isVisible()) strip.showInactive();
  }
}
