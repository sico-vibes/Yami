// Currency questions for the launcher, such as "100 usd to eur", "$20 in egp"
// or "eur to gbp". Only the parsing lives here; the rate is asked for in the
// main process (Frankfurter, daily rates, no key).

const codes = new Set(
  (
    "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
    "CAD CDF CHF CLP CNH CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GGP " +
    "GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS IMP INR IQD IRR ISK JEP JMD JOD JPY KES KGS KHR " +
    "KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN " +
    "MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR " +
    "SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD " +
    "UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG"
  ).split(" "),
);

/** Words and symbols people type instead of a code. */
const names: Record<string, string> = {
  $: "USD",
  dollar: "USD",
  dollars: "USD",
  "€": "EUR",
  euro: "EUR",
  euros: "EUR",
  "£": "GBP",
  pound: "GBP",
  pounds: "GBP",
  "¥": "JPY",
  yen: "JPY",
  "₹": "INR",
  rupee: "INR",
  rupees: "INR",
  yuan: "CNY",
  franc: "CHF",
  francs: "CHF",
  dirham: "AED",
  dirhams: "AED",
  riyal: "SAR",
  riyals: "SAR",
  lira: "TRY",
  won: "KRW",
  peso: "MXN",
  pesos: "MXN",
};

const code = (word: string) => {
  const w = word.toLowerCase();
  if (names[w]) return names[w];
  const upper = word.toUpperCase();
  return codes.has(upper) ? upper : undefined;
};

export type CurrencyQuestion = { amount: number; from: string; to: string };

export function parseCurrency(query: string): CurrencyQuestion | undefined {
  const m =
    /^\s*([$€£¥₹])?\s*(\d[\d,]*(?:\.\d+)?)?\s*([$€£¥₹]|[a-z]{3,8})?\s+(?:to|in|into|=)\s+([$€£¥₹]|[a-z]{3,8})\s*$/i.exec(
      query,
    );
  if (!m) return undefined;
  const [, symbol, number, word, target] = m;
  const from = code(symbol || word || "");
  const to = code(target);
  if (!from || !to || from === to || (symbol && word)) return undefined;
  const amount = number ? Number(number.replace(/,/g, "")) : 1;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12)
    return undefined;
  return { amount, from, to };
}

export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: value < 1 ? 4 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
