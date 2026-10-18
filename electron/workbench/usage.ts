import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { UsageReading, UsageWindow } from "../../src/workbench-types";
import type { WorkbenchStorage } from "./storage";
import { findExecutable } from "./terminal";
import { serverUrl, boundedText } from "./network";
const exec = promisify(execFile);
const jsonFile = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const stamp = (value: any) =>
  typeof value === "number"
    ? value * (value < 1e12 ? 1000 : 1)
    : Number.isFinite(Date.parse(value))
      ? Date.parse(value)
      : undefined;
const percent = (v: any) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(1, v / 100))
    : null;
export function codexWindows(result: any): UsageWindow[] {
  const buckets = result.rateLimitsByLimitId || { codex: result.rateLimits };
  return Object.entries(buckets).flatMap(([bucket, r]: [string, any]) =>
    r
      ? ["primary", "secondary"].flatMap((id) => {
          const w = r[id];
          return w
            ? [
                {
                  id: `${bucket}:${id}`,
                  label: `${w.windowDurationMins ? w.windowDurationMins + " min" : id} limit`,
                  used: percent(w.usedPercent),
                  resetsAt: stamp(w.resetsAt),
                  group: bucket,
                },
              ]
            : [];
        })
      : [],
  );
}
export function claudeWindows(result: any): UsageWindow[] {
  const windows = new Map<string, UsageWindow>();
  for (const [id, w] of Object.entries(result) as [string, any][])
    if (w && typeof w.utilization === "number")
      windows.set(id, {
        id,
        label: id.replaceAll("_", " "),
        used: percent(w.utilization),
        resetsAt: stamp(w.resets_at),
      });
  for (const w of result.limits || [])
    if (typeof w.percent === "number")
      windows.set(w.kind, {
        id: w.kind,
        label: String(w.kind).replaceAll("_", " "),
        used: percent(w.percent),
        resetsAt: stamp(w.resets_at),
      });
  return [...windows.values()];
}
export function confirmedReset(
  before: UsageReading | undefined,
  next: UsageReading,
) {
  return (
    before?.status === "fresh" &&
    next.status === "fresh" &&
    next.fetchedAt > before.fetchedAt &&
    next.fetchedAt - before.fetchedAt < 15 * 60000 &&
    next.windows.some((w) => {
      const old = before.windows.find(
        (v) => v.id === w.id && v.group === w.group,
      );
      return (
        old &&
        old.used !== null &&
        old.used >= 0.1 &&
        w.used !== null &&
        w.used < old.used &&
        !!old.resetsAt &&
        !!w.resetsAt &&
        w.resetsAt > old.resetsAt + 60000
      );
    })
  );
}
export function grokCredential(root: any) {
  return Object.entries(root || {})
    .map(([issuer, value]: [string, any]) => ({ issuer, value }))
    .filter(
      ({ issuer, value }) =>
        (issuer.split("::")[0] === "https://auth.x.ai" ||
          value.oidc_issuer === "https://auth.x.ai") &&
        typeof value.key === "string" &&
        (!value.expires_at || (Date.parse(value.expires_at) || 0) > Date.now()),
    )
    .map(({ value }) => value)[0];
}
export function grokWindows(result: any): UsageWindow[] {
  const c = result.config;
  if (!c) return [];
  const resetsAt = stamp(c.currentPeriod?.end || c.billingPeriodEnd);
  if (typeof c.creditUsagePercent === "number")
    return [
      {
        id: "credits",
        label: "Grok Build",
        used: percent(c.creditUsagePercent),
        resetsAt,
      },
    ];
  const windows = (c.productUsage || [])
    .filter((p: any) => typeof p.usagePercent === "number")
    .map((p: any, i: number) => ({
      id: i ? String(p.product) : "credits",
      label: String(p.product || "Usage"),
      used: percent(p.usagePercent),
      resetsAt,
    }));
  if (!windows.length && /WEEKLY/.test(c.currentPeriod?.type || ""))
    return [{ id: "credits", label: "Weekly limit", used: 0, resetsAt }];
  return windows;
}
export async function readCodex(executable?: string) {
  const local = path.join(
    process.env.LOCALAPPDATA || "",
    "OpenAI",
    "Codex",
    "bin",
    "codex.exe",
  );
  const npm = path.join(
    process.env.APPDATA || "",
    "npm",
    "node_modules",
    "@openai",
    "codex",
  );
  const candidates = [
    local,
    path.join(npm, "vendor", "x86_64-pc-windows-msvc", "codex", "codex.exe"),
    path.join(
      npm,
      "node_modules",
      "@openai",
      "codex-win32-x64",
      "vendor",
      "x86_64-pc-windows-msvc",
      "codex",
      "codex.exe",
    ),
  ];
  const exe =
    executable || findExecutable("codex.exe") || candidates.find(fs.existsSync);
  if (!exe)
    throw new Error(
      "Install the native Codex CLI or choose codex.exe in Workspace settings.",
    );
  return new Promise<any>((resolve, reject) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(exe, ["app-server", "--listen", "stdio://"], {
      windowsHide: true,
      stdio: "pipe",
      env,
    });
    let total = 0,
      done = false;
    const finish = (error?: Error, value?: any) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error("Codex quota read timed out.")),
      15000,
    );
    child.on("error", (e) => finish(e));
    child.on("exit", () =>
      finish(new Error("Codex closed before returning account limits.")),
    );
    child.stderr.on("data", () => {});
    readline.createInterface({ input: child.stdout }).on("line", (line) => {
      total += line.length;
      if (total > 2097152)
        return finish(new Error("Codex response exceeded the limit."));
      try {
        const r = JSON.parse(line);
        if (r.id === 1) {
          if (r.error)
            return finish(
              new Error("Codex could not initialize its account reader."),
            );
          child.stdin.write(
            JSON.stringify({ method: "initialized" }) +
              "\n" +
              JSON.stringify({ id: 2, method: "account/rateLimits/read" }) +
              "\n",
          );
        } else if (r.id === 2) {
          if (r.error)
            finish(
              new Error("Sign in with the Codex CLI to read account limits."),
            );
          else finish(undefined, r.result);
        }
      } catch {}
    });
    child.stdin.write(
      JSON.stringify({
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "yami", version: "1" } },
      }) + "\n",
    );
  });
}
class UsageError extends Error {
  constructor(
    message: string,
    public status: UsageReading["status"],
    public retryAt?: number,
  ) {
    super(message);
  }
}
async function get(url: string, headers: Record<string, string>) {
  serverUrl(url);
  const response = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401)
    throw new UsageError(
      "Sign in using the provider's own application.",
      "needs-auth",
    );
  if (response.status === 403)
    throw new UsageError(
      "The provider refused access. This does not prove your login expired.",
      "error",
    );
  if (response.status === 429) {
    const retry = response.headers.get("retry-after") || "60";
    const at = /^\d+$/.test(retry)
      ? Date.now() + Math.max(60, Number(retry)) * 1000
      : Math.max(Date.now() + 60000, Date.parse(retry) || 0);
    throw new UsageError(
      "Provider rate limit. Refresh will resume after its retry deadline.",
      "backoff",
      at,
    );
  }
  if (!response.ok)
    throw new Error(`Usage is unavailable (HTTP ${response.status}).`);
  return JSON.parse(await boundedText(response));
}
export class UsageController {
  private active = new Map<string, Promise<UsageReading>>();
  private lastAlert = new Map<string, number>();
  constructor(
    private data: WorkbenchStorage,
    private changed: () => void,
    private notify: (message: string) => void,
  ) {}
  refresh(provider: string) {
    if (!this.active.has(provider))
      this.active.set(
        provider,
        this.read(provider).finally(() => this.active.delete(provider)),
      );
    return this.active.get(provider)!;
  }
  private async read(provider: string): Promise<UsageReading> {
    if (
      ![
        "codex",
        "claude",
        "cursor",
        "copilot",
        "opencode",
        "grok",
        "custom",
      ].includes(provider)
    )
      throw new Error("Unknown usage provider.");
    const previous = this.data.state.usage.find((r) => r.provider === provider);
    if (previous?.retryAt && previous.retryAt > Date.now()) return previous;
    if (
      previous?.fetchedAt &&
      Date.now() - previous.fetchedAt < 60000 &&
      previous.status === "fresh"
    )
      return previous;
    let reading: UsageReading = {
      provider,
      account: "Default",
      windows: [],
      status: "fresh",
      fetchedAt: Date.now(),
      source: "Provider",
      note: "",
    };
    try {
      if (provider === "codex") {
        reading.windows = codexWindows(
          await readCodex(
            this.data.state.settings.codexExecutable || undefined,
          ),
        );
        reading.source = "Codex app-server";
      } else if (provider === "claude") {
        const home =
          process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
        const profiles = [
          ...new Set([
            home,
            ...fs
              .readdirSync(os.homedir(), { withFileTypes: true })
              .filter((e) => e.isDirectory() && e.name.startsWith(".claude-"))
              .map((e) => path.join(os.homedir(), e.name)),
          ]),
        ].slice(0, 8);
        let connected = 0,
          missing = 0;
        for (const profile of profiles) {
          const file = [".credentials.json", "credentials.json"]
            .map((name) => path.join(profile, name))
            .find(fs.existsSync);
          if (!file) continue;
          const c = jsonFile(file).claudeAiOauth;
          if (!c?.accessToken || (c.expiresAt && c.expiresAt < Date.now())) {
            missing++;
            continue;
          }
          const windows = claudeWindows(
            await get("https://api.anthropic.com/api/oauth/usage", {
              Authorization: `Bearer ${c.accessToken}`,
              "anthropic-beta": "oauth-2025-04-20",
            }),
          );
          reading.windows.push(
            ...windows.map((w) => ({
              ...w,
              id: path.basename(profile) + ":" + w.id,
              group:
                path.basename(profile) === ".claude"
                  ? "Default account"
                  : path.basename(profile).replace(/^\.claude-/, ""),
            })),
          );
          connected++;
        }
        if (!connected)
          throw new UsageError(
            "Open Claude Code to sign in or renew its session.",
            "needs-auth",
          );
        reading.account = `${connected} connected account${connected === 1 ? "" : "s"}`;
        reading.note = missing
          ? `${missing} additional account(s) require sign-in in Claude Code.`
          : "";
        reading.retryAt = Date.now() + 300000;
        reading.source = "Claude usage endpoint (unpublished)";
      } else if (provider === "cursor") {
        const { DatabaseSync } = await import("node:sqlite");
        const file = path.join(
          process.env.APPDATA || "",
          "Cursor",
          "User",
          "globalStorage",
          "state.vscdb",
        );
        const db = new DatabaseSync(file, { readOnly: true });
        let token: string, authId: string;
        try {
          token = String(
            (
              db
                .prepare("SELECT value FROM ItemTable WHERE key = ?")
                .get("cursorAuth/accessToken") as any
            )?.value || "",
          );
          authId = String(
            (
              db
                .prepare("SELECT value FROM ItemTable WHERE key = ?")
                .get("cursorAuth/stripeMembershipAuthId") as any
            )?.value || "",
          );
        } finally {
          db.close();
        }
        if (!token || !authId)
          throw new UsageError(
            "Sign in to Cursor in the editor.",
            "needs-auth",
          );
        const r: any = await get("https://cursor.com/api/usage-summary", {
          Cookie: `WorkosCursorSessionToken=${authId}::${token}`,
          Accept: "application/json",
        });
        const plan = r.individualUsage?.plan || {};
        reading.windows = [
          ["included", "Included usage", plan.totalPercentUsed],
          ["api", "API usage", plan.apiPercentUsed],
        ]
          .filter((v) => typeof v[2] === "number")
          .map(([id, label, p]) => ({
            id: String(id),
            label: String(label),
            used: percent(p),
            resetsAt: stamp(r.billingCycleEnd),
          }));
        reading.source = "Cursor signed-in usage summary";
        reading.note = r.isUnlimited ? "Provider reports unlimited usage." : "";
      } else if (provider === "copilot") {
        const gh = findExecutable("gh.exe");
        const token =
          process.env.GH_TOKEN ||
          process.env.GITHUB_TOKEN ||
          (gh
            ? (
                await exec(gh, ["auth", "token"], {
                  windowsHide: true,
                  timeout: 8000,
                  maxBuffer: 65536,
                })
              ).stdout.trim()
            : "");
        if (!token)
          throw new UsageError(
            "Sign in using GitHub CLI (gh auth login).",
            "needs-auth",
          );
        const r: any = await get(
          "https://api.github.com/copilot_internal/user",
          { Authorization: `Bearer ${token}`, Accept: "application/json" },
        );
        reading.windows = Object.entries(r.quota_snapshots || {}).flatMap(
          ([id, w]: [string, any]) =>
            !w.unlimited && w.entitlement > 0
              ? [
                  {
                    id,
                    label: id.replaceAll("_", " "),
                    used: Math.max(
                      0,
                      Math.min(
                        1,
                        (typeof w.used === "number"
                          ? w.used
                          : w.entitlement - w.remaining) / w.entitlement,
                      ),
                    ),
                    resetsAt: stamp(w.reset_date || r.quota_reset_date),
                  },
                ]
              : [],
        );
        reading.source = "GitHub Copilot quota snapshots";
      } else if (provider === "opencode") {
        const files = [
          path.join(os.homedir(), ".local", "share", "opencode", "auth.json"),
          path.join(process.env.APPDATA || "", "opencode", "auth.json"),
        ];
        let c: any;
        for (const file of files)
          if (fs.existsSync(file)) {
            const root = jsonFile(file);
            c = root["opencode-go"] || root.opencode;
            if (c) break;
          }
        if (!c) {
          const { DatabaseSync } = await import("node:sqlite");
          for (const file of files.map((p) =>
            path.join(path.dirname(p), "opencode.db"),
          ))
            if (fs.existsSync(file)) {
              const db = new DatabaseSync(file, { readOnly: true });
              try {
                const row = db
                  .prepare(
                    "SELECT value FROM credential WHERE integration_id IN ('opencode-go','opencode') AND COALESCE(active,1) != 0 ORDER BY time_updated DESC LIMIT 1",
                  )
                  .get() as any;
                if (row?.value) c = JSON.parse(row.value);
              } finally {
                db.close();
              }
              if (c) break;
            }
        }
        const key = c?.key || c?.access;
        if (!key)
          throw new UsageError(
            "Sign in to an OpenCode Go subscription.",
            "needs-auth",
          );
        const r: any = await get(
          c.type === "oauth"
            ? "https://opencode.ai/inference/go/v1/usage"
            : "https://opencode.ai/zen/go/v1/usage",
          { Authorization: `Bearer ${key}` },
        );
        reading.windows = ["rolling", "weekly", "monthly"].flatMap((id) =>
          r.usage?.[id] && typeof r.usage[id].percent === "number"
            ? [
                {
                  id,
                  label: id,
                  used: percent(r.usage[id].percent),
                  resetsAt: stamp(r.usage[id].resetsAt),
                },
              ]
            : [],
        );
        reading.source = "OpenCode Go subscription";
        reading.note =
          "Zen pay-as-you-go credit is not a Go subscription quota.";
      } else if (provider === "grok") {
        const auth = jsonFile(
          path.join(
            process.env.GROK_HOME || path.join(os.homedir(), ".grok"),
            "auth.json",
          ),
        );
        const credential = grokCredential(auth),
          key = credential?.key;
        if (!key)
          throw new UsageError("Sign in using the Grok CLI.", "needs-auth");
        const r: any = await get(
          "https://cli-chat-proxy.grok.com/v1/billing?format=credits",
          {
            Authorization: `Bearer ${key}`,
            "X-XAI-Token-Auth": "xai-grok-cli",
          },
        );
        reading.windows = grokWindows(r);
        reading.source = "Grok CLI billing";
        if (!reading.windows.length)
          reading.note =
            "The provider returned a billing schema without supported quota windows.";
      } else {
        const url = this.data.state.settings.customUsageUrl;
        if (!url) throw new Error("Configure a custom usage endpoint first.");
        const r: any = await get(
          url,
          this.data.store.key("provider:usage")
            ? {
                Authorization: `Bearer ${this.data.store.key("provider:usage")}`,
              }
            : {},
        );
        reading.windows = Array.isArray(r.windows)
          ? r.windows.slice(0, 100).map((w: any) => ({
              id: String(w.id),
              label: String(w.label || w.id),
              used: percent(w.usedPercent),
              resetsAt: stamp(w.resetsAt),
              group: w.group ? String(w.group) : undefined,
            }))
          : claudeWindows(r);
        reading.source = "Configured usage endpoint";
      }
      if (!reading.windows.length && !reading.note)
        reading.note = "The account did not publish supported limit windows.";
      if (
        this.data.state.settings.usageAlerts &&
        Date.now() - (this.lastAlert.get(provider) || 0) > 15 * 60000
      ) {
        if (confirmedReset(previous, reading)) {
          this.notify(`${provider} allowance has reset.`);
          this.lastAlert.set(provider, Date.now());
        } else if (
          reading.windows.some((w) => w.used !== null && w.used >= 0.9)
        ) {
          this.notify(
            `${provider} has used at least 90% of a published allowance.`,
          );
          this.lastAlert.set(provider, Date.now());
        }
      }
    } catch (error) {
      reading = {
        ...reading,
        windows: previous?.windows || [],
        fetchedAt: previous?.fetchedAt || 0,
        status:
          error instanceof UsageError
            ? error.status
            : previous?.windows.length
              ? "stale"
              : "unavailable",
        note:
          error instanceof UsageError
            ? error.message
            : "Usage could not be read. Check that this client is installed and signed in.",
        source: previous?.source || reading.source,
        retryAt: Math.max(
          Date.now() + (provider === "claude" ? 300000 : 60000),
          error instanceof UsageError ? error.retryAt || 0 : 0,
        ),
      };
    }
    this.data.state.usage = [
      ...this.data.state.usage.filter((r) => r.provider !== provider),
      reading,
    ];
    this.data.save();
    this.changed();
    return reading;
  }
}
