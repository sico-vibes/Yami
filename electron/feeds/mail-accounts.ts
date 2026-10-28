import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MailAccount } from "../../src/feeds-types.ts";
import { mailGlance, mailServers, type MailGlance } from "./mail.ts";

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
  constructor(
    private file: string,
    private secrets: Secrets,
    private glance: typeof mailGlance = mailGlance,
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

  remove(id: string) {
    if (!this.saved.accounts.some((a) => a.id === id)) return this.list();
    this.secrets.set(id, "");
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
          const glance = await this.glance({
            host: a.host,
            user: a.user,
            password: this.secrets.get(a.id),
          });
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
