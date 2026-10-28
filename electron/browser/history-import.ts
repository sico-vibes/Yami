import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { webOnly } from "../../src/browser-rules.ts";
import type { Bookmark } from "./vault.ts";

// History (and Firefox bookmarks) read from other browsers' own databases.
// The live files are locked while those browsers run, so a temporary copy
// is opened read-only and deleted straight after. Passwords and cookies are
// never read.

export type Visit = { url: string; title: string; at: number; from: string };

const MAX_VISITS = 2000;
/**
 * Chromium counts microseconds from 1601 and Firefox from 1970. The queries
 * divide by 1000 first, since microseconds overflow a JavaScript number.
 */
const chromiumTime = (ms: number) => Math.round(ms - 11_644_473_600_000);
const firefoxTime = (ms: number) => Math.round(ms);

function withCopy<T>(
  file: string,
  name: string,
  read: (db: DatabaseSync) => T,
) {
  if (!fs.existsSync(file))
    throw new Error(`${name} has no history file on this PC.`);
  const temp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "yami-import-")),
    "copy.sqlite",
  );
  try {
    try {
      fs.copyFileSync(file, temp);
    } catch {
      throw new Error(
        `${name} is holding its history open. Close ${name} and try again.`,
      );
    }
    const db = new DatabaseSync(temp, { readOnly: true });
    try {
      return read(db);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(path.dirname(temp), { recursive: true, force: true });
  }
}

/** Newest visited pages from a Chromium History database. */
export function readChromiumHistory(file: string, from: string): Visit[] {
  return withCopy(file, from, (db) =>
    (
      db
        .prepare(
          "SELECT url, title, last_visit_time / 1000 AS t FROM urls WHERE hidden = 0 ORDER BY last_visit_time DESC LIMIT ?",
        )
        .all(MAX_VISITS) as { url: string; title: string; t: number }[]
    )
      .filter((r) => webOnly(r.url))
      .map((r) => ({
        url: r.url,
        title: String(r.title || r.url).slice(0, 300),
        at: chromiumTime(Number(r.t)),
        from,
      })),
  );
}

/** Firefox keeps bookmarks and history in one places.sqlite. */
export function readFirefoxPlaces(file: string) {
  const from = "Firefox";
  return withCopy(file, from, (db) => {
    const visits = (
      db
        .prepare(
          "SELECT url, title, last_visit_date / 1000 AS t FROM moz_places WHERE last_visit_date IS NOT NULL AND hidden = 0 ORDER BY last_visit_date DESC LIMIT ?",
        )
        .all(MAX_VISITS) as { url: string; title: string | null; t: number }[]
    )
      .filter((r) => webOnly(r.url))
      .map((r) => ({
        url: r.url,
        title: String(r.title || r.url).slice(0, 300),
        at: firefoxTime(Number(r.t)),
        from,
      }));
    const bookmarks: Bookmark[] = (
      db
        .prepare(
          "SELECT p.url AS url, b.title AS title, f.title AS folder FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk LEFT JOIN moz_bookmarks f ON f.id = b.parent WHERE b.type = 1 LIMIT 5000",
        )
        .all() as { url: string; title: string | null; folder: string | null }[]
    )
      .filter((r) => webOnly(r.url))
      .map((r) => ({
        url: r.url,
        title: String(r.title || r.url).slice(0, 300),
        folder: String(r.folder || ""),
        from,
      }));
    return { visits, bookmarks };
  });
}

/** The default Firefox profile's places.sqlite, when Firefox is installed. */
export function firefoxPlaces(roaming: string) {
  const root = path.join(roaming, "Mozilla", "Firefox");
  try {
    const ini = fs.readFileSync(path.join(root, "profiles.ini"), "utf8");
    // The [Install…] section names the profile Firefox opens by default.
    const preferred = /^Default=(Profiles\/[^\r\n]+)$/m.exec(ini)?.[1];
    const any = /^Path=([^\r\n]+)$/m.exec(ini)?.[1];
    const rel = preferred || any;
    return rel ? path.join(root, ...rel.split("/"), "places.sqlite") : "";
  } catch {
    return "";
  }
}
