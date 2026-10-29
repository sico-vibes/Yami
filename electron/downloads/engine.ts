import fs from "node:fs";
import path from "node:path";

// Yami's download engine (the idea of Motrix's multi-connection downloads,
// written for Yami, not aria2): a file the server can serve in ranges is
// split into parts fetched in parallel and written into place; pause keeps
// each part's progress, so resume continues where it stopped, even after a
// restart. A server without ranges gets one plain stream.

export type Part = { start: number; end: number; done: number };
export type Job = {
  id: string;
  url: string;
  name: string;
  folder: string;
  size: number;
  received: number;
  state: "queued" | "downloading" | "paused" | "done" | "error";
  parts: Part[];
  /** The server serves byte ranges, so parts can resume. */
  ranged?: boolean;
  /** Bytes per second, while downloading. */
  speed: number;
  error?: string;
  added: number;
  finished?: number;
  /** Where the file is, once done. */
  file?: string;
};

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** A safe file name from a header, a URL or a fallback. */
export function fileName(url: string, disposition?: string | null) {
  let name = "";
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition || "");
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition || "");
  try {
    name = star
      ? decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""))
      : plain
        ? plain[1].trim()
        : "";
  } catch {
    name = plain?.[1].trim() || "";
  }
  if (!name)
    try {
      name = decodeURIComponent(path.posix.basename(new URL(url).pathname));
    } catch {}
  name = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return name || "download";
}

/** A name in the folder that does not overwrite anything: "a (2).zip". */
export function freeName(folder: string, name: string) {
  const ext = path.extname(name),
    stem = name.slice(0, name.length - ext.length);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
    const full = path.join(folder, candidate);
    if (!fs.existsSync(full) && !fs.existsSync(full + ".yamipart"))
      return candidate;
  }
  return `${stem} (${Date.now()})${ext}`;
}

/** Splits a size into up to `count` parts of at least 1 MB. */
export function split(size: number, count: number): Part[] {
  const parts = Math.max(
    1,
    Math.min(count, Math.floor(size / (1024 * 1024)) || 1),
  );
  const each = Math.ceil(size / parts);
  return Array.from({ length: parts }, (_, i) => ({
    start: i * each,
    end: Math.min(size, (i + 1) * each) - 1,
    done: 0,
  }));
}

/** What the server says about a URL: size, ranges, final name. */
export async function probe(
  url: string,
  fetcher: Fetcher,
  signal: AbortSignal,
) {
  const r = await fetcher(url, { headers: { Range: "bytes=0-0" }, signal });
  const range = /\/(\d+)\s*$/.exec(r.headers.get("content-range") || "");
  const size = range
    ? Number(range[1])
    : Number(r.headers.get("content-length")) || 0;
  await r.body?.cancel().catch(() => {});
  if (!r.ok) throw new Error(`The server answered ${r.status}.`);
  return {
    size,
    ranges: r.status === 206 && !!range,
    name: fileName(r.url || url, r.headers.get("content-disposition")),
  };
}

/** Fetches one part into its place in the file, from where it stopped. */
export async function fetchPart(
  job: Job,
  part: Part,
  handle: fs.promises.FileHandle,
  fetcher: Fetcher,
  signal: AbortSignal,
  onBytes: (n: number) => void,
  ranged: boolean,
) {
  const from = part.start + part.done;
  if (ranged && from > part.end) return;
  const r = await fetcher(job.url, {
    headers: ranged ? { Range: `bytes=${from}-${part.end}` } : {},
    signal,
  });
  if (ranged ? r.status !== 206 : !r.ok)
    throw new Error(`The server answered ${r.status}.`);
  if (!r.body) throw new Error("The server sent nothing.");
  let at = from;
  for await (const chunk of r.body as AsyncIterable<Uint8Array>) {
    const room = ranged ? part.end + 1 - at : chunk.length;
    const piece = room < chunk.length ? chunk.subarray(0, room) : chunk;
    await handle.write(piece, 0, piece.length, at);
    at += piece.length;
    part.done += piece.length;
    onBytes(piece.length);
    if (ranged && at > part.end) break;
  }
}
