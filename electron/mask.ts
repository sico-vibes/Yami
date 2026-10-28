// Secret masking for text Yami sends to Gemini: chat messages and attached
// context. Recognisable credentials are replaced by a labelled placeholder
// in the main process, before any request is built.

const patterns: [label: string, pattern: RegExp][] = [
  [
    "private key",
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  ],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g,
  ],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["AWS key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["Stripe key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g],
  [
    "JWT",
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  ],
  [
    "password",
    /\b((?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*)(["']?)[^\s"']{6,}\2/gi,
  ],
];

/** Luhn check, so ordinary long numbers are left alone. */
function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function maskSecrets(text: string) {
  const found: string[] = [];
  let out = text;
  for (const [label, pattern] of patterns)
    out = out.replace(pattern, (match, prefix?: string) => {
      found.push(label);
      // Keep "password=" so the sentence still reads; hide only the value.
      return label === "password" && typeof prefix === "string"
        ? `${prefix}[hidden ${label}]`
        : `[hidden ${label}]`;
    });
  out = out.replace(/\b(?:\d[ -]?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return match;
    found.push("card number");
    return "[hidden card number]";
  });
  return { text: out, found: [...new Set(found)] };
}
