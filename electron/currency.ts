// Exchange rates for the launcher from Frankfurter (frankfurter.dev): free,
// no key, daily reference rates. Asked only when a conversion is typed, and
// kept for six hours per pair, so typing does not repeat requests.

const SIX_HOURS = 6 * 60 * 60_000;

export class Rates {
  private cache = new Map<string, { rate: number; date: string; at: number }>();
  constructor(private fetcher: typeof fetch = fetch) {}

  async convert(a: { amount?: unknown; from?: unknown; to?: unknown }) {
    const from = String(a.from || "").toUpperCase(),
      to = String(a.to || "").toUpperCase(),
      amount = Number(a.amount);
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to))
      throw new Error("Choose two currencies.");
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Enter an amount.");
    const key = `${from}/${to}`;
    let hit = this.cache.get(key);
    if (!hit || Date.now() - hit.at > SIX_HOURS) {
      const response = await this.fetcher(
        `https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`,
        { signal: AbortSignal.timeout(8000) },
      );
      const json: any = await response.json().catch(() => ({}));
      if (!response.ok || !(Number(json.rate) > 0))
        throw new Error(
          response.status === 422
            ? "Frankfurter has no rate for that pair."
            : "The exchange rate could not be read.",
        );
      hit = {
        rate: Number(json.rate),
        date: String(json.date || ""),
        at: Date.now(),
      };
      this.cache.set(key, hit);
      if (this.cache.size > 50)
        this.cache.delete(this.cache.keys().next().value!);
    }
    return {
      amount,
      from,
      to,
      rate: hit.rate,
      value: amount * hit.rate,
      date: hit.date,
    };
  }
}
