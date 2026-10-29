import test from "node:test";
import assert from "node:assert/strict";
import { readAir } from "../electron/weather.ts";

test("air quality reads US AQI and UV, and leaves out what is missing", async () => {
  let url = "";
  const air = await readAir(30.04441, 31.23571, async (u) => {
    url = String(u);
    return new Response(
      JSON.stringify({ current: { us_aqi: 79.4, uv_index: 3.25 } }),
    );
  });
  assert.deepEqual(air, { aqi: 79, uv: 3.3 });
  assert.match(
    url,
    /^https:\/\/air-quality-api\.open-meteo\.com\/v1\/air-quality\?latitude=30\.0444&longitude=31\.2357&current=us_aqi,uv_index$/,
  );
  assert.deepEqual(
    await readAir(
      1,
      2,
      async () => new Response(JSON.stringify({ current: { us_aqi: null } })),
    ),
    {},
  );
  assert.equal(
    await readAir(1, 2, async () => new Response("", { status: 503 })),
    undefined,
  );
});
