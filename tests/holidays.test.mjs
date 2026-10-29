import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Holidays } from "../electron/holidays.ts";

test("holidays are read once per country and year, and kept a month", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yami-hol-"));
  const asked = [];
  let country = "EG";
  const h = new Holidays(
    dir,
    () => country,
    async (url) => {
      asked.push(String(url));
      if (url.includes("/ZZ")) return new Response(null, { status: 404 });
      return new Response(
        JSON.stringify([
          {
            date: "2026-10-06",
            name: "Armed Forces Day",
            localName: "عيد القوات المسلحة",
            global: true,
          },
          {
            date: "2026-10-07",
            name: "Regional",
            localName: "x",
            global: false,
          },
          { date: "bad", name: "Broken" },
        ]),
      );
    },
  );
  let r = await h.year(2026);
  assert.deepEqual(r, {
    country: "EG",
    holidays: [
      {
        date: "2026-10-06",
        name: "Armed Forces Day",
        localName: "عيد القوات المسلحة",
      },
    ],
  });
  assert.equal(asked[0], "https://date.nager.at/api/v3/PublicHolidays/2026/EG");
  await h.year(2026);
  assert.equal(asked.length, 1, "kept on disk");
  country = "ZZ";
  assert.deepEqual(await h.year(2026), { country: "ZZ", holidays: [] });
  country = "";
  assert.deepEqual(await h.year(2026), { country: "", holidays: [] });
  await assert.rejects(h.year("next"), /year/);
  fs.rmSync(dir, { recursive: true, force: true });
});
