import fs from "node:fs";
import path from "node:path";
import type { Store } from "./store";
export async function readWeather(store: Store, assetRoot: () => string) {
  if (!store.state.settings.weatherEnabled) return null;
  let lat: number,
    lon: number,
    place = store.state.settings.location;
  const citiesFile = path.join(assetRoot(), "cities.json");
  const cities = fs.existsSync(citiesFile)
    ? JSON.parse(fs.readFileSync(citiesFile, "utf8"))
    : [];
  const city =
    place &&
    cities.find((c: any) => c.name.toLowerCase() === place.toLowerCase());
  if (city) {
    lat = city.lat;
    lon = city.lon;
    place = city.name;
  } else if (place) {
    const coordinates = place.split(",").map(Number);
    if (coordinates.length !== 2 || coordinates.some(Number.isNaN))
      throw new Error(
        "Choose a city from the location list or enter latitude,longitude.",
      );
    [lat, lon] = coordinates;
  } else {
    const r: any = await (
      await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(10000) })
    ).json();
    if (!r.success)
      throw new Error("Location is unavailable. Enter your city in Settings.");
    lat = r.latitude;
    lon = r.longitude;
    place = r.city;
  }
  // UV and air quality from Open-Meteo (free, no key, CC BY 4.0), asked
  // alongside the forecast; the forecast still shows when it fails.
  const air = readAir(lat, lon).catch(() => undefined);
  const response = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
    {
      headers: { "User-Agent": "Yami/0.1 personal Windows companion" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error("Weather is unavailable.");
  const data: any = await response.json();
  const now = data.properties.timeseries[0];
  return {
    place,
    temperature: now.data.instant.details.air_temperature,
    condition: now.data.next_1_hours?.summary.symbol_code || "",
    air: await air,
  };
}

/** The current US AQI and UV index; undefined values are left out. */
export async function readAir(
  lat: number,
  lon: number,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=us_aqi,uv_index`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) return undefined;
  const now = ((await response.json()) as any).current || {};
  const aqi = now.us_aqi,
    uv = now.uv_index;
  return {
    ...(typeof aqi === "number" &&
      Number.isFinite(aqi) && { aqi: Math.round(aqi) }),
    ...(typeof uv === "number" &&
      Number.isFinite(uv) && { uv: Math.round(uv * 10) / 10 }),
  };
}
