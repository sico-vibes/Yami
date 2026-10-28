import type { Terminal } from "@xterm/xterm";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { api } from "./api";
import { findPaths } from "./terminal-paths";

// Clickable web addresses and Windows paths in Yami Terminal. Both need
// Ctrl+click, as in Windows Terminal and VS Code, so a stray click on output
// never opens anything. Web links open in the browser; paths in Explorer.

export function attachLinks(terminal: Terminal, report: (e: Error) => void) {
  terminal.loadAddon(
    new WebLinksAddon((event, uri) => {
      if (!event.ctrlKey) return;
      void api("open.external", { url: uri }).catch(report);
    }),
  );
  return terminal.registerLinkProvider({
    provideLinks(y, callback) {
      const text = terminal.buffer.active
        .getLine(y - 1)
        ?.translateToString(true);
      if (!text) return callback(undefined);
      const links = findPaths(text).map((p) => ({
        text: p.path,
        range: { start: { x: p.start + 1, y }, end: { x: p.end, y } },
        decorations: { pointerCursor: true, underline: true },
        activate: (event: MouseEvent) => {
          if (!event.ctrlKey) return;
          void api("terminal.reveal", { path: p.path }).catch(report);
        },
      }));
      callback(links.length ? links : undefined);
    },
  });
}
