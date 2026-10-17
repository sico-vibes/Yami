import { Notification } from "electron";

// One focus countdown owned by the main process so it finishes even when the
// Today panel is closed. Nothing runs unless a timer was started.
export function createFocusTimer({
  notify,
  broadcast,
}: {
  notify: (message: string) => void;
  broadcast: (event: any) => void;
}) {
  let endsAt = 0,
    duration = 0,
    timer: NodeJS.Timeout | undefined;
  const snapshot = () => ({ endsAt, duration });
  const publish = () => broadcast({ type: "timer", ...snapshot() });
  function stop() {
    clearTimeout(timer);
    endsAt = 0;
    publish();
  }
  function done() {
    endsAt = 0;
    publish();
    if (Notification.isSupported())
      new Notification({
        title: "Focus timer",
        body: "Time's up. Stretch, sip some water.",
        silent: false,
      }).show();
    notify("Focus timer finished.");
  }
  return {
    handles: (method: string) => method.startsWith("timer."),
    async invoke(method: string, a: any = {}) {
      switch (method) {
        case "timer.state":
          return snapshot();
        case "timer.start": {
          const minutes = Number(a.minutes);
          if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180)
            throw new Error("Choose between 1 and 180 minutes.");
          clearTimeout(timer);
          duration = Math.round(minutes * 60_000);
          endsAt = Date.now() + duration;
          timer = setTimeout(done, duration);
          publish();
          return snapshot();
        }
        case "timer.stop":
          stop();
          return snapshot();
        default:
          throw new Error("Unknown application request: " + method);
      }
    },
    dispose: () => clearTimeout(timer),
  };
}
