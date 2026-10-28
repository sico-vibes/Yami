import type { IMarker, Terminal } from "@xterm/xterm";

// Reads the OSC 7 and OSC 133 marks that electron/workbench/shell-integration.ts
// adds to the prompt: command blocks, exit codes and the shell's folder.

/** The folder in an OSC 7 report: file://host/C:/path, or a plain path. */
export function osc7Path(data: string) {
  let value = data.trim();
  const url = /^file:\/\/[^/]*\/(.*)$/i.exec(value);
  if (url) {
    value = url[1];
    try {
      value = decodeURIComponent(value);
    } catch {
      // Paths are sent unescaped; a stray % is just a character.
    }
    // file://localhost//server/share keeps its two leading slashes.
    if (/^[a-z]:\//i.test(value) || value.startsWith("//"))
      value = value.replace(/\//g, "\\");
    else if (!value.startsWith("/")) value = "/" + value;
  }
  return value.length > 0 && value.length < 1024 ? value : "";
}

/** One OSC 133 mark: A prompt start, B prompt end, C output, D finished. */
export function osc133(data: string) {
  const [kind, code] = data.split(";");
  if (!/^[ABCD]$/.test(kind)) return null;
  const exit =
    code !== undefined && /^-?\d+$/.test(code) ? Number(code) : undefined;
  return { kind: kind as "A" | "B" | "C" | "D", exit };
}

export type Block = {
  marker: IMarker;
  exit?: number;
  started?: number;
  ms?: number;
};

const LIMIT = 300;

/** The newest finished block's index; Array#findLastIndex is ES2023. */
function lastFinished(blocks: Block[]) {
  for (let i = blocks.length - 1; i >= 0; i--)
    if (blocks[i].ms !== undefined && !blocks[i].marker.isDisposed) return i;
  return -1;
}

/**
 * Tracks the command blocks of one terminal. `finished` runs when a typed
 * command ends; an empty Enter does not count.
 */
export function trackShellMarks(
  terminal: Terminal,
  on: {
    cwd: (path: string) => void;
    finished: (block: Block) => void;
    color: (failed: boolean) => string;
  },
) {
  const blocks: Block[] = [];
  let prompting = false;
  let seen = false;
  const osc7 = terminal.parser.registerOscHandler(7, (data) => {
    const where = osc7Path(data);
    if (where) on.cwd(where);
    return true;
  });
  const osc = terminal.parser.registerOscHandler(133, (data) => {
    const mark = osc133(data);
    if (!mark) return true;
    seen = true;
    if (mark.kind === "A") {
      const marker = terminal.registerMarker(0);
      if (marker) {
        blocks.push({ marker });
        while (blocks.length > LIMIT) blocks.shift()?.marker.dispose();
      }
      prompting = true;
    } else if (mark.kind === "D") {
      const block = blocks.at(-1);
      prompting = false;
      if (!block?.started || block.ms !== undefined) return true;
      block.ms = Date.now() - block.started;
      block.exit = mark.exit;
      if (mark.exit !== undefined)
        terminal.registerDecoration({
          marker: block.marker,
          overviewRulerOptions: { color: on.color(mark.exit !== 0) },
        });
      on.finished(block);
    }
    return true;
  });
  // The command starts when Enter is pressed at a prompt.
  const typed = terminal.onData((text) => {
    const block = blocks.at(-1);
    if (prompting && block && !block.started && text.includes("\r")) {
      block.started = Date.now();
      prompting = false;
    }
  });
  const lines = () =>
    blocks.filter((b) => !b.marker.isDisposed).map((b) => b.marker.line);
  return {
    /** Whether this shell sends marks at all. */
    get active() {
      return seen;
    },
    /** Scrolls to the previous (-1) or next (1) prompt. */
    jump(direction: -1 | 1) {
      const top = terminal.buffer.active.viewportY;
      const all = lines();
      const line =
        direction < 0
          ? all.filter((l) => l < top).at(-1)
          : all.find((l) => l > top);
      if (line !== undefined) terminal.scrollToLine(line);
      else if (direction > 0) terminal.scrollToBottom();
    },
    /** The last finished command with its output, prompt line included. */
    lastBlock() {
      const index = lastFinished(blocks);
      if (index < 0) return "";
      const buffer = terminal.buffer.active;
      const from = blocks[index].marker.line;
      const next = blocks[index + 1];
      const to =
        next && !next.marker.isDisposed ? next.marker.line : buffer.length;
      const out: string[] = [];
      for (let y = from; y < to; y++) {
        const line = buffer.getLine(y);
        if (!line) continue;
        if (line.isWrapped && out.length)
          out[out.length - 1] += line.translateToString(true);
        else out.push(line.translateToString(true));
      }
      return out.join("\n").trimEnd();
    },
    last() {
      return blocks[lastFinished(blocks)];
    },
    dispose() {
      osc7.dispose();
      osc.dispose();
      typed.dispose();
      for (const b of blocks) b.marker.dispose();
    },
  };
}

export type ShellMarks = ReturnType<typeof trackShellMarks>;
