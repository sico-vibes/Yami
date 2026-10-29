import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MailAccount } from "../../src/feeds-types.ts";
import { mailGlance, mailServers, type MailGlance } from "./mail.ts";
import {
  refreshMicrosoft,
  startDeviceCode,
  waitForDeviceCode,
  type MicrosoftTokens,
} from "./microsoft.ts";

type Secrets = {
  get(id: string): string;
  set(id: string, value: string): void;
};
type Saved = { accounts: Omit<MailAccount, "glance" | "error">[] };

/**
 * Mail accounts for the inbox glance. Addresses and servers live in
 * mail.json; app passwords stay in Yami's encrypted credentials.
 */
export class MailAccounts {
  private saved: Saved;
  private glances = new Map<
    string,
    { glance?: MailGlance; error?: string; at: number }
  >();
  /** Outlook.com access tokens, in memory only; refresh tokens are secrets. */
  private access = new Map<string, { token: string; expiresAt: number }>();
  private signIn?: { abort: AbortController; done: Promise<MailAccount[]> };
  constructor(
    private file: string,
    private secrets: Secrets,
    private glance: typeof mailGlance = mailGlance,
    /** The Microsoft app (client) ID from Settings. */
    private clientId: () => string = () => "",
    private fetcher: typeof fetch = fetch,
    private sleep?: (ms: number) => Promise<unknown>,
  ) {
    let saved: Partial<Saved> = {};
    try {
      saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {}
    this.saved = { accounts: saved.accounts || [] };
  }

  list(): MailAccount[] {
    return this.saved.accounts.map((a) => {
      const g = this.glances.get(a.id);
      return { ...a, glance: g?.glance, error: g?.error, checkedAt: g?.at };
    });
  }

  /** Signs in once to check the app password, then keeps the account. */
  async add(a: {
    provider?: unknown;
    host?: unknown;
    user?: unknown;
    password?: unknown;
  }) {
    const provider = String(a.provider || "custom");
    if (provider === "outlook")
      throw new Error("Outlook.com signs in with Microsoft, not a password.");
    const host =
      provider === "custom"
        ? String(a.host || "").trim()
        : mailServers[provider]?.host;
    if (!host)
      throw new Error("Choose a mail provider or enter its IMAP server.");
    const user = String(a.user || "").trim();
    const password = String(a.password || "");
    if (!user || user.length > 200) throw new Error("Enter the mail address.");
    if (!password || password.length > 500)
      throw new Error("Enter an app password.");
    if (this.saved.accounts.length >= 5)
      throw new Error("Up to five mail accounts.");
    const glance = await this.glance({ host, user, password });
    const account = {
      id: randomUUID().slice(0, 12),
      provider,
      host,
      user,
      added: Date.now(),
    };
    this.secrets.set(account.id, password);
    this.saved.accounts.push(account);
    this.glances.set(account.id, { glance, at: Date.now() });
    this.save();
    return this.list();
  }

  /**
   * Outlook.com: shows a code to enter at microsoft.com/link. The account is
   * added once Microsoft confirms; finishOutlook waits for that.
   */
  async startOutlook() {
    this.signIn?.abort.abort();
    if (this.saved.accounts.length >= 5)
      throw new Error("Up to five mail accounts.");
    const clientId = this.clientId();
    const code = await startDeviceCode(clientId, this.fetcher);
    const abort = new AbortController();
    const done = (async () => {
      const tokens = await waitForDeviceCode(
        clientId,
        code,
        abort.signal,
        this.fetcher,
        this.sleep as any,
      );
      if (!tokens.user || !tokens.refresh)
        throw new Error("Microsoft did not say which address signed in.");
      const host = mailServers.outlook.host;
      const glance = await this.glance({
        host,
        user: tokens.user,
        token: tokens.access,
      });
      const account = {
        id: randomUUID().slice(0, 12),
        provider: "outlook",
        host,
        user: tokens.user,
        added: Date.now(),
      };
      this.keep(account.id, tokens);
      this.saved.accounts.push(account);
      this.glances.set(account.id, { glance, at: Date.now() });
      this.save();
      return this.list();
    })();
    done.catch(() => {});
    this.signIn = { abort, done };
    return {
      userCode: code.userCode,
      verificationUri: code.verificationUri,
      expiresAt: code.expiresAt,
    };
  }

  finishOutlook() {
    if (!this.signIn) throw new Error("Start the Microsoft sign-in first.");
    const { done } = this.signIn;
    return done.finally(() => {
      if (this.signIn?.done === done) this.signIn = undefined;
    });
  }

  cancelOutlook() {
    this.signIn?.abort.abort();
    this.signIn = undefined;
    return this.list();
  }

  private keep(id: string, tokens: MicrosoftTokens) {
    this.secrets.set(id, tokens.refresh);
    this.access.set(id, { token: tokens.access, expiresAt: tokens.expiresAt });
  }

  /** A fresh access token; Microsoft may hand back a new refresh token. */
  private async token(id: string) {
    const held = this.access.get(id);
    if (held && held.expiresAt > Date.now()) return held.token;
    const tokens = await refreshMicrosoft(
      this.clientId(),
      this.secrets.get(id),
      this.fetcher,
    );
    this.keep(id, tokens);
    return tokens.access;
  }

  remove(id: string) {
    if (!this.saved.accounts.some((a) => a.id === id)) return this.list();
    this.secrets.set(id, "");
    this.access.delete(id);
    this.saved.accounts = this.saved.accounts.filter((a) => a.id !== id);
    this.glances.delete(id);
    this.save();
    return this.list();
  }

  /** One sign-in per account; a failure keeps the last glance. */
  async refresh() {
    await Promise.all(
      this.saved.accounts.map(async (a) => {
        const old = this.glances.get(a.id);
        try {
          const glance = await this.glance(
            a.provider === "outlook"
              ? { host: a.host, user: a.user, token: await this.token(a.id) }
              : {
                  host: a.host,
                  user: a.user,
                  password: this.secrets.get(a.id),
                },
          );
          this.glances.set(a.id, { glance, at: Date.now() });
        } catch (error) {
          this.glances.set(a.id, {
            glance: old?.glance,
            error:
              error instanceof Error
                ? error.message
                : "The mail server could not be read.",
            at: Date.now(),
          });
        }
      }),
    );
    return this.list();
  }

  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.saved));
    fs.renameSync(temp, this.file);
  }
}
