import test from "node:test";
import assert from "node:assert/strict";
import { parseCurrency } from "../src/currency.ts";
import { convertUnits } from "../src/units.ts";
import { Rates } from "../electron/currency.ts";

test("currency questions are recognised, and units are left alone", () => {
  assert.deepEqual(parseCurrency("100 usd to eur"), {
    amount: 100,
    from: "USD",
    to: "EUR",
  });
  assert.deepEqual(parseCurrency("$20 in egp"), {
    amount: 20,
    from: "USD",
    to: "EGP",
  });
  assert.deepEqual(parseCurrency("1,250.50 GBP into JPY"), {
    amount: 1250.5,
    from: "GBP",
    to: "JPY",
  });
  assert.deepEqual(parseCurrency("eur to gbp"), {
    amount: 1,
    from: "EUR",
    to: "GBP",
  });
  assert.deepEqual(parseCurrency("50 euros to dollars"), {
    amount: 50,
    from: "EUR",
    to: "USD",
  });
  for (const q of [
    "5 km to mi",
    "2 gb to mb",
    "100 usd to usd",
    "100 abc to eur",
    "$5 usd to eur",
    "hello to you",
    "0 usd to eur",
  ])
    assert.equal(parseCurrency(q), undefined, q);
  assert.ok(convertUnits("5 km to mi"), "units still convert");
});

test("rates are asked once per pair and kept for six hours", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const asked = [];
  const rates = new Rates(async (url) => {
    asked.push(String(url));
    if (url.includes("/xyz"))
      return new Response('{"status":422}', { status: 422 });
    return new Response(
      JSON.stringify({
        date: "2026-10-29",
        base: "USD",
        quote: "EUR",
        rate: 0.9,
      }),
    );
  });
  const r = await rates.convert({ amount: 100, from: "usd", to: "eur" });
  assert.deepEqual(r, {
    amount: 100,
    from: "USD",
    to: "EUR",
    rate: 0.9,
    value: 90,
    date: "2026-10-29",
  });
  await rates.convert({ amount: 5, from: "USD", to: "EUR" });
  assert.equal(asked.length, 1, "cached");
  assert.equal(asked[0], "https://api.frankfurter.dev/v2/rate/usd/eur");
  t.mock.timers.tick(6 * 60 * 60_000 + 1);
  await rates.convert({ amount: 5, from: "USD", to: "EUR" });
  assert.equal(asked.length, 2, "asked again after six hours");
  await assert.rejects(
    rates.convert({ amount: 1, from: "USD", to: "XYZ" }),
    /no rate/,
  );
  await assert.rejects(
    rates.convert({ amount: -1, from: "USD", to: "EUR" }),
    /amount/,
  );
});
