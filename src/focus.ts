import { api } from "./api";
import { playStation, stopRadio, type PlayingStation } from "./radio-player";
import { focusSites } from "./focus-sites";
export { defaultSites } from "./focus-sites";

// A focus session: the focus timer plus, if chosen, keep awake, a kept radio
// station, and blocking distracting sites through the network shield. The
// island (always open) ends it when the timer stops or finishes, and a
// session left over from a restart is cleaned up when the island loads.

export type FocusChoice = {
  awake: boolean;
  station?: PlayingStation;
  block: boolean;
  /** Comma- or space-separated domains. */
  sites: string;
};
type Session = {
  endsAt: number;
  awake: boolean;
  radio: boolean;
  blocked: string[];
};

const KEY = "yami-focus-session";
const read = (): Session | undefined => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null") || undefined;
  } catch {
    return undefined;
  }
};
const write = (s: Session | undefined) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
};

export async function startFocus(minutes: number, choice: FocusChoice) {
  const timer = await api("timer.start", { minutes });
  const session: Session = {
    endsAt: timer.endsAt,
    awake: false,
    radio: false,
    blocked: [],
  };
  if (choice.awake) {
    const awake = await api("awake").catch(() => ({ on: true }));
    // A keep-awake you started yourself is left alone.
    if (!awake.on) {
      await api("awake.set", { minutes: 0 });
      session.awake = true;
    }
  }
  if (choice.station) {
    playStation(choice.station);
    session.radio = true;
  }
  if (choice.block) {
    const shield = await api("tune.shield").catch(() => undefined);
    if (shield?.running) {
      const already = new Set<string>([...shield.block, ...shield.allow]);
      for (const site of focusSites(choice.sites))
        if (!already.has(site)) {
          await api("tune.shield.rule", { domain: site, kind: "block" });
          session.blocked.push(site);
        }
    }
  }
  write(session);
  return { timer, session };
}

/** Undoes what the session started; safe to call more than once. */
export async function endFocus() {
  const s = read();
  if (!s) return;
  write(undefined);
  if (s.awake) await api("awake.stop").catch(() => {});
  if (s.radio) stopRadio();
  for (const site of s.blocked)
    await api("tune.shield.rule", { domain: site, kind: "none" }).catch(
      () => {},
    );
}

/** Called once by the island: ends a session the timer no longer runs. */
export function watchFocus() {
  const s = read();
  if (s && s.endsAt < Date.now()) void endFocus();
  return window.yami.on((e) => {
    if (e.type === "timer" && !e.endsAt) void endFocus();
  });
}

export function focusRunning() {
  return !!read();
}
