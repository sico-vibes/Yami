import fs from "node:fs";
import type { Store } from "./store";

// Wallpaper rotation from Yami's own library: one timer set for the next
// change (hourly or daily), not a poll. The next wallpaper is the one after
// the current one in the library, skipping files that have gone missing.

export const rotationEvery: Record<string, number> = {
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

/** The wallpaper after `current`, wrapping round; "" when none is usable. */
export function nextWallpaper(
  library: string[],
  current: string,
  exists: (file: string) => boolean = fs.existsSync,
) {
  const start = library.indexOf(current);
  for (let step = 1; step <= library.length; step++) {
    const file = library[(start + step + library.length) % library.length];
    if (file !== current && exists(file)) return file;
  }
  return "";
}

/** How long until the next change, given when the last one happened. */
export function rotationDelay(every: number, last: number, now = Date.now()) {
  if (!last || now - last >= every) return 0;
  return every - (now - last);
}

export function createWallpaperRotation(deps: {
  store: Store;
  native: { call: (method: string, args?: object) => Promise<unknown> };
  changed: () => void;
  /** For the tests; the real one checks the disk. */
  exists?: (file: string) => boolean;
}) {
  let timer: NodeJS.Timeout | undefined;
  let key = "";
  const rotate = async () => {
    const { state } = deps.store;
    const file = nextWallpaper(
      state.wallpapers,
      state.currentWallpaper,
      deps.exists,
    );
    state.settings.wallpaperRotatedAt = Date.now();
    if (file) {
      await deps.native.call("wallpaperSet", { path: file }).catch(() => {});
      state.currentWallpaper = file;
    }
    deps.changed();
    sync(true);
  };
  function sync(force = false) {
    const { settings, wallpapers } = deps.store.state;
    const every = rotationEvery[settings.wallpaperRotate] || 0;
    const next = `${every}|${wallpapers.length}`;
    if (!force && next === key) return;
    key = next;
    clearTimeout(timer);
    timer = undefined;
    if (!every || wallpapers.length < 2) return;
    // A first change waits a full interval after rotation is turned on.
    if (!settings.wallpaperRotatedAt) settings.wallpaperRotatedAt = Date.now();
    timer = setTimeout(
      () => void rotate(),
      rotationDelay(every, settings.wallpaperRotatedAt),
    );
  }
  return {
    sync,
    dispose() {
      clearTimeout(timer);
    },
  };
}
