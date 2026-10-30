// Fails when a tracked file looks like it holds a secret, or is a file that
// must never be committed (user data, profiles, credentials, executables).
// Runs in npm run check and before every push. Test fixtures that need a
// fake key-shaped value use one that is clearly fake and listed below.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbidden = [
  [/(^|\/)\.env(\.|$)(?!example)/, "an environment file"],
  [/(^|\/)credentials\.bin$/, "Yami's encrypted credentials"],
  [/(^|\/)data\.json$/, "a Yami profile"],
  [/(^|\/)\.artifacts\//, "a test artifact"],
  [/(^|\/)(release|dist|dist-electron)\//, "build output"],
  [/\.(exe|dll|msi|pfx|p12|pem|key)$/i, "a binary or key file"],
  [/\.(wav|webm|pcm|dmp)$/i, "a recording or dump"],
];
const secrets = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI key", /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["AWS key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["Stripe key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
];
// Fake values the tests use on purpose to prove masking works.
const fakes = [
  "AIzaSyD0notreal0123456789abcdefghijklmn",
  "AIzaSyA1234567890abcdefghijklmnopqrstuv",
  "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789",
  "sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345",
  "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB",
  "AKIAABCDEFGHIJKLMNOP",
  "-----BEGIN RSA PRIVATE KEY-----\\nMIIE...",
];
// Files whose job is to describe these patterns.
const describes = new Set(["scripts/check-secrets.mjs", "electron/mask.ts"]);

const problems = [];
for (const file of files) {
  for (const [pattern, what] of forbidden)
    if (pattern.test(file))
      problems.push(`${file}: ${what} must not be committed`);
  if (describes.has(file) || !fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  if (stat.size > 2_000_000) continue;
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) continue; // binary
  let text = buf.toString("utf8");
  for (const fake of fakes) text = text.split(fake).join("");
  for (const [label, pattern] of secrets) {
    const m = pattern.exec(text);
    if (m) {
      const line = text.slice(0, m.index).split("\n").length;
      problems.push(`${file}:${line}: looks like a ${label}`);
    }
  }
}
if (problems.length) {
  console.error(
    "Secret check failed:\n" + problems.map((p) => "  " + p).join("\n"),
  );
  process.exit(1);
}
console.log(
  `PASS: no secrets or forbidden files in ${files.length} tracked files.`,
);
