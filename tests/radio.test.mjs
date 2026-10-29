import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Radio, streams } from "../electron/radio-directory.ts";

const uuid = (n) => `${n}`.repeat(8) + "-1111-2222-3333-444444444444";

test("stations are listed with their streams kept for playback only", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-radio-"));
  const asked = [];
  let down = true;
  const radio = new Radio(dir, async (url, init) => {
    asked.push(String(url));
    assert.match(init.headers["User-Agent"], /^Yami\//);
    // The first mirror is down: the next one answers.
    if (down) {
      down = false;
      throw new Error("offline");
    }
    return new Response(
      JSON.stringify([
        {
          stationuuid: uuid(1).toUpperCase(),
          name: " Jazz FM ",
          url_resolved: "https://stream.example/jazz",
          country: "Demoland",
          tags: "jazz,smooth,late,night,extra",
          codec: "MP3",
          bitrate: 128,
        },
        { stationuuid: "not-a-uuid", name: "Bad", url_resolved: "https://x" },
        { stationuuid: uuid(2), name: "No stream", url_resolved: "ftp://x" },
      ]),
    );
  });
  const list = await radio.search("jazz");
  assert.match(
    asked[1],
    /\/json\/stations\/search\?name=jazz&limit=24&hidebroken=true/,
  );
  assert.equal(asked.length, 2, "fell back to the next mirror");
  assert.deepEqual(list, [
    {
      id: uuid(1),
      name: "Jazz FM",
      country: "Demoland",
      tags: "jazz, smooth, late, night",
      codec: "MP3",
      bitrate: 128,
    },
  ]);
  assert.equal(streams.get(uuid(1)), "https://stream.example/jazz");
  assert.ok(!streams.has(uuid(2)));
  // Favourites keep the stream, so they play after a restart.
  assert.deepEqual(
    radio.favourite(list[0], true).map((s) => s.id),
    [uuid(1)],
  );
  streams.clear();
  const again = new Radio(dir, async () => new Response("[]"));
  assert.equal(streams.get(uuid(1)), "https://stream.example/jazz");
  assert.deepEqual(again.favourite(list[0], false), []);
  assert.throws(() => again.favourite({ id: uuid(9) }, true), /Search/);
  fs.rmSync(dir, { recursive: true, force: true });
});
