// Unit conversions for the launcher: "5 km to mi", "72 f in c", "2 gb mb".
// Each unit is a factor to the category's base unit; temperatures convert
// through Celsius.

type Unit = { names: string[]; factor: number; label: string };

const categories: Record<string, Unit[]> = {
  length: [
    {
      names: ["mm", "millimeter", "millimeters", "millimetre", "millimetres"],
      factor: 0.001,
      label: "mm",
    },
    {
      names: ["cm", "centimeter", "centimeters", "centimetre", "centimetres"],
      factor: 0.01,
      label: "cm",
    },
    {
      names: ["m", "meter", "meters", "metre", "metres"],
      factor: 1,
      label: "m",
    },
    {
      names: ["km", "kilometer", "kilometers", "kilometre", "kilometres"],
      factor: 1000,
      label: "km",
    },
    { names: ["in", "inch", "inches", '"'], factor: 0.0254, label: "in" },
    { names: ["ft", "foot", "feet", "'"], factor: 0.3048, label: "ft" },
    { names: ["yd", "yard", "yards"], factor: 0.9144, label: "yd" },
    { names: ["mi", "mile", "miles"], factor: 1609.344, label: "mi" },
  ],
  mass: [
    { names: ["mg", "milligram", "milligrams"], factor: 0.001, label: "mg" },
    { names: ["g", "gram", "grams"], factor: 1, label: "g" },
    {
      names: ["kg", "kilo", "kilos", "kilogram", "kilograms"],
      factor: 1000,
      label: "kg",
    },
    { names: ["oz", "ounce", "ounces"], factor: 28.349523125, label: "oz" },
    { names: ["lb", "lbs", "pound", "pounds"], factor: 453.59237, label: "lb" },
    { names: ["st", "stone", "stones"], factor: 6350.29318, label: "st" },
  ],
  volume: [
    {
      names: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
      factor: 0.001,
      label: "ml",
    },
    {
      names: ["l", "liter", "liters", "litre", "litres"],
      factor: 1,
      label: "l",
    },
    {
      names: ["tsp", "teaspoon", "teaspoons"],
      factor: 0.00492892159375,
      label: "tsp",
    },
    {
      names: ["tbsp", "tablespoon", "tablespoons"],
      factor: 0.01478676478125,
      label: "tbsp",
    },
    { names: ["cup", "cups"], factor: 0.2365882365, label: "cups" },
    {
      names: ["floz", "fl oz", "fluid ounce", "fluid ounces"],
      factor: 0.0295735295625,
      label: "fl oz",
    },
    { names: ["gal", "gallon", "gallons"], factor: 3.785411784, label: "gal" },
  ],
  data: [
    { names: ["b", "byte", "bytes"], factor: 1, label: "B" },
    { names: ["kb", "kilobyte", "kilobytes"], factor: 1e3, label: "KB" },
    { names: ["mb", "megabyte", "megabytes"], factor: 1e6, label: "MB" },
    { names: ["gb", "gigabyte", "gigabytes"], factor: 1e9, label: "GB" },
    { names: ["tb", "terabyte", "terabytes"], factor: 1e12, label: "TB" },
    { names: ["kib"], factor: 1024, label: "KiB" },
    { names: ["mib"], factor: 1024 ** 2, label: "MiB" },
    { names: ["gib"], factor: 1024 ** 3, label: "GiB" },
  ],
  time: [
    {
      names: ["ms", "millisecond", "milliseconds"],
      factor: 0.001,
      label: "ms",
    },
    { names: ["s", "sec", "secs", "second", "seconds"], factor: 1, label: "s" },
    { names: ["min", "mins", "minute", "minutes"], factor: 60, label: "min" },
    { names: ["h", "hr", "hrs", "hour", "hours"], factor: 3600, label: "h" },
    { names: ["d", "day", "days"], factor: 86400, label: "days" },
    { names: ["wk", "week", "weeks"], factor: 604800, label: "weeks" },
  ],
  speed: [
    { names: ["m/s", "mps"], factor: 1, label: "m/s" },
    { names: ["km/h", "kmh", "kph"], factor: 1 / 3.6, label: "km/h" },
    { names: ["mph"], factor: 0.44704, label: "mph" },
    { names: ["kn", "knot", "knots"], factor: 0.514444, label: "kn" },
  ],
};

const temperatures: Record<
  string,
  { label: string; toC: (v: number) => number; fromC: (v: number) => number }
> = {
  c: { label: "°C", toC: (v) => v, fromC: (v) => v },
  f: {
    label: "°F",
    toC: (v) => ((v - 32) * 5) / 9,
    fromC: (v) => (v * 9) / 5 + 32,
  },
  k: { label: "K", toC: (v) => v - 273.15, fromC: (v) => v + 273.15 },
};
const temperatureNames: Record<string, string> = {
  c: "c",
  "°c": "c",
  celsius: "c",
  f: "f",
  "°f": "f",
  fahrenheit: "f",
  k: "k",
  kelvin: "k",
};

function find(name: string) {
  const n = name.trim().toLowerCase();
  for (const [category, units] of Object.entries(categories)) {
    const unit = units.find((u) => u.names.includes(n));
    if (unit) return { category, unit };
  }
  return undefined;
}

/** Up to 6 significant digits, without trailing zeros. */
function tidy(value: number) {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  const text =
    abs !== 0 && (abs >= 1e9 || abs < 1e-4)
      ? value.toExponential(4)
      : String(Number(value.toPrecision(6)));
  return text;
}

/** "5 km to mi" → { text: "3.10686 mi", … }, or undefined. */
export function convertUnits(query: string) {
  const m =
    /^\s*(-?\d+(?:[.,]\d+)?)\s*([^\d\s][^]*?)\s+(?:to|in|as|->|=)?\s*([^\d\s][^]*?)\s*$/i.exec(
      query,
    );
  if (!m) return undefined;
  const value = Number(m[1].replace(",", "."));
  const from = m[2].toLowerCase(),
    to = m[3].toLowerCase();
  if (temperatureNames[from] && temperatureNames[to]) {
    const a = temperatures[temperatureNames[from]],
      b = temperatures[temperatureNames[to]];
    const out = b.fromC(a.toC(value));
    return {
      value: out,
      text: `${tidy(out)} ${b.label}`,
      from: `${tidy(value)} ${a.label}`,
    };
  }
  const a = find(from),
    b = find(to);
  if (!a || !b || a.category !== b.category || a.unit === b.unit)
    return undefined;
  const out = (value * a.unit.factor) / b.unit.factor;
  return {
    value: out,
    text: `${tidy(out)} ${b.unit.label}`,
    from: `${tidy(value)} ${a.unit.label}`,
  };
}
