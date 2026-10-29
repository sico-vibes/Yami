import fs from "node:fs";
import path from "node:path";

// Public holidays for Today's week strip, from Nager.Date (date.nager.at):
// free, no key. One request per country and year, kept on disk for 30
// days. The country is Windows' own region setting.

export type Holiday = { date: string; name: string; localName: string };
const MONTH = 30 * 24 * 60 * 60_000;

export class Holidays {
  constructor(
    private dir: string,
    private country: () => string,
    private fetcher: typeof fetch = fetch,
  ) {}

  async year(
    value: unknown,
  ): Promise<{ country: string; holidays: Holiday[] }> {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 1975 || year > 2075)
      throw new Error("Choose a year.");
    const country = this.country().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return { country: "", holidays: [] };
    const file = path.join(this.dir, `holidays-${country}-${year}.json`);
    try {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Date.now() - saved.at < MONTH)
        return { country, holidays: saved.holidays };
    } catch {}
    const response = await this.fetcher(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      { signal: AbortSignal.timeout(8000) },
    );
    // 204 or 404: Nager.Date has no list for this country.
    if (response.status === 204 || response.status === 404) {
      await response.body?.cancel();
      return { country, holidays: [] };
    }
    if (!response.ok) throw new Error("The holiday list could not be read.");
    const list: any[] = await response.json();
    const holidays = (Array.isArray(list) ? list : [])
      .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h?.date) && h.global !== false)
      .map((h) => ({
        date: String(h.date),
        name: String(h.name || h.localName).slice(0, 80),
        localName: String(h.localName || h.name).slice(0, 80),
      }));
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ at: Date.now(), holidays }));
    return { country, holidays };
  }
}
