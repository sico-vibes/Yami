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
  };
}
