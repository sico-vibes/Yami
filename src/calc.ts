// A small calculator for the launcher: numbers, + - * / % ^, parentheses and
// a leading "=". It parses the text itself; nothing is evaluated as code.

export function calculate(input: string): number | undefined {
  const text = input
    .trim()
    .replace(/^=/, "")
    .replace(/,/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/");
  // Needs an operator, so a plain number or a word is not a sum.
  if (
    !/^[\d\s.+\-*/%^()]+$/.test(text) ||
    !/\d\s*[+\-*/%^]\s*[\d(.]|^\(/.test(text)
  )
    return undefined;
  let at = 0;
  const peek = () => text[at];
  const skip = () => {
    while (text[at] === " ") at++;
  };
  const number = (): number => {
    skip();
    if (peek() === "(") {
      at++;
      const value = sum();
      skip();
      if (text[at++] !== ")") throw new Error("bracket");
      return value;
    }
    if (peek() === "-") {
      at++;
      return -number();
    }
    const match = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(text.slice(at));
    if (!match) throw new Error("number");
    at += match[0].length;
    return Number(match[0]);
  };
  const power = (): number => {
    const base = number();
    skip();
    if (peek() === "^") {
      at++;
      return base ** power();
    }
    return base;
  };
  const product = (): number => {
    let value = power();
    for (;;) {
      skip();
      const op = peek();
      if (op !== "*" && op !== "/" && op !== "%") return value;
      at++;
      const next = power();
      value =
        op === "*" ? value * next : op === "/" ? value / next : value % next;
    }
  };
  const sum = (): number => {
    let value = product();
    for (;;) {
      skip();
      const op = peek();
      if (op !== "+" && op !== "-") return value;
      at++;
      value = op === "+" ? value + product() : value - product();
    }
  };
  try {
    const value = sum();
    skip();
    return at === text.length && Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** A readable result: up to 10 significant digits, no float noise. */
export function formatResult(value: number) {
  return Number.parseFloat(value.toPrecision(10)).toLocaleString("en-US", {
    maximumFractionDigits: 10,
  });
}
