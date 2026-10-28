import test from "node:test";
import assert from "node:assert/strict";
import { currentLine, parseLrc } from "../src/lyrics-line.ts";
import { findLyrics } from "../electron/lyrics.ts";

test("synced lyrics parse and the current line follows the position", () => {
  const lines = parseLrc(
    "[00:12.50]Second\n[00:05.00][01:00.0]First and again\n[ar: x]\nno stamp",
  );
  assert.deepEqual(
    lines.map((l) => [l.at, l.text]),
    [
      [5, "First and again"],
      [12.5, "Second"],
      [60, "First and again"],
    ],
  );
  assert.equal(currentLine(lines, 4), undefined);
  assert.equal(currentLine(lines, 13).text, "Second");
  assert.equal(currentLine(lines, 61).text, "First and again");
});

test("LRCLIB is asked once per track and sends only artist, title and length", async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return url.includes("Missing")
      ? new Response("", { status: 404 })
      : Response.json({ syncedLyrics: "[00:01.00]Hi", plainLyrics: "Hi" });
  };
  const found = await findLyrics("Band", "Song", 184.4, fetchImpl);
  assert.equal(found.lines[0].text, "Hi");
  await findLyrics("Band", "Song", 184.4, fetchImpl);
  assert.equal(urls.length, 1, "cached");
  const url = new URL(urls[0]);
  assert.equal(url.origin + url.pathname, "https://lrclib.net/api/get");
  assert.deepEqual(
    [...url.searchParams.keys()],
    ["artist_name", "track_name", "duration"],
  );
  assert.equal(await findLyrics("Band", "Missing", 10, fetchImpl), null);
  assert.equal(await findLyrics("Band", "  ", 10, fetchImpl), null);
});
