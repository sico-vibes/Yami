import type { PowerSaveBlocker } from "electron";

// Keep awake (the idea of PowerToys Awake): stops Windows from sleeping, and
// optionally from turning the screen off, until a time or until switched
// off. Electron's power-save blocker asks Windows through
// SetThreadExecutionState; it ends when Yami quits. One timer, only while
// a timed keep-awake is on.

export type KeepAwakeState = {
  on: boolean;
  /** Keep the screen on too, not only the PC. */
  screen: boolean;
  /** When it ends; 0 means until switched off. */
  until: number;
};

export const keepAwakeMinutes = [0, 30, 60, 120, 240] as const;

export class KeepAwake {
  private id?: number;
  private timer?: NodeJS.Timeout;
  private state: KeepAwakeState = { on: false, screen: false, until: 0 };
  constructor(
    /** Electron's powerSaveBlocker; tests pass a stand-in. */
    private blocker: Pick<PowerSaveBlocker, "start" | "stop">,
    private changed: (state: KeepAwakeState) => void = () => {},
  ) {}

  status(): KeepAwakeState {
    return { ...this.state };
  }

  set(a: { minutes?: unknown; screen?: unknown }) {
    const minutes = Number(a.minutes);
    if (!keepAwakeMinutes.includes(minutes as any))
      throw new Error("Choose how long to keep the PC awake.");
    this.release();
    const screen = a.screen === true;
    this.id = this.blocker.start(
      screen ? "prevent-display-sleep" : "prevent-app-suspension",
    );
    this.state = {
      on: true,
      screen,
      until: minutes ? Date.now() + minutes * 60_000 : 0,
    };
    if (minutes) this.timer = setTimeout(() => this.stop(), minutes * 60_000);
    this.changed(this.status());
    return this.status();
  }

  stop() {
    this.release();
    this.state = { on: false, screen: false, until: 0 };
    this.changed(this.status());
    return this.status();
  }

  private release() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.id !== undefined) this.blocker.stop(this.id);
    this.id = undefined;
  }
}
