import { desktopCapturer, screen } from "electron";
import { parseRemoteInput } from "./input.ts";

// Yami Remote's own screen view, instead of a remote-desktop program: a still
// JPEG of the primary screen each time the phone asks (about once a second
// while its Screen view is open), and taps, scrolls and keys from the phone,
// sent through the native host. Both are abilities that start off.

const NOTICE_GAP = 60_000;

export function createScreenShare(deps: {
  native: { call: (method: string, args?: object) => Promise<unknown> };
  notify: (text: string) => void;
}) {
  let viewedAt = 0,
    controlledAt = 0;
  return {
    /** The primary screen, at most 1280 pixels wide. */
    async frame() {
      const now = Date.now();
      // Say so on the PC whenever the phone starts looking again.
      if (now - viewedAt > NOTICE_GAP)
        deps.notify("Your phone is viewing this screen through Yami Remote.");
      viewedAt = now;
      const display = screen.getPrimaryDisplay();
      const width = Math.min(1280, display.size.width);
      const height = Math.round(
        (width * display.size.height) / display.size.width,
      );
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height },
      });
      const source =
        sources.find((s) => s.display_id === String(display.id)) || sources[0];
      if (!source) throw new Error("The screen could not be captured.");
      return source.thumbnail.toJPEG(70);
    },
    async input(body: unknown) {
      const command = parseRemoteInput(body);
      const now = Date.now();
      if (now - controlledAt > NOTICE_GAP)
        deps.notify("Your phone is controlling this PC through Yami Remote.");
      controlledAt = now;
      await deps.native.call(command.method, command.args);
    },
  };
}
