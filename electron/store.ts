import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { State, Settings } from "../src/shared";
import { defaults } from "../src/default-settings";
import { migrateState } from "../src/migrations";
export { defaults } from "../src/default-settings";
export class Store {
  file = path.join(app.getPath("userData"), "data.json");
  secretsFile = path.join(app.getPath("userData"), "credentials.bin");
  state: State;
  secrets: Record<string, string> = {};
  constructor() {
    let saved: any = {};
    try {
      saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {}
    const clipboard = (saved.clipboard || []).flatMap((item: any) => {
      try {
        return [
          {
            ...item,
            text: item.encrypted
              ? safeStorage.decryptString(Buffer.from(item.text, "base64"))
              : item.text,
          },
        ];
      } catch {
        return [];
      }
    });
    this.state = {
      todos: [],
      tasks: [],
      memories: [],
      messages: [],
      snippets: [],
      favorites: [],
      recentApps: [],
      wallpapers: [],
      wallpaperFolder: "",
      currentWallpaper: "",
      embers: 0,
      owned: ["yami", "Charon", "chad"],
      usage: {},
      ...saved,
      clipboard,
      settings: { ...defaults, ...saved.settings },
      keys: { gemini: false, tavily: false, tavilyHint: "" },
    };
    migrateState(this.state);
    // Old model IDs can still appear in discovery but reject new accounts.
    if (this.state.settings.textModel === "gemini-2.5-flash")
      this.state.settings.textModel = defaults.textModel;
    if (
      this.state.settings.voiceModel ===
      "gemini-2.5-flash-native-audio-preview-12-2025"
    )
      this.state.settings.voiceModel = defaults.voiceModel;
    try {
      this.secrets = JSON.parse(
        safeStorage.decryptString(fs.readFileSync(this.secretsFile)),
      );
    } catch {}
  }
  publicState() {
    return {
      ...this.state,
      keys: {
        gemini: !!this.secrets.gemini,
        tavily: !!this.secrets.tavily,
        tavilyHint: this.secrets.tavily
          ? `tvly-…${this.secrets.tavily.slice(-4)}`
          : "",
      },
    };
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const clipboard = this.state.clipboard.map((item) =>
      item.pinned
        ? item
        : {
            ...item,
            text: safeStorage.encryptString(item.text).toString("base64"),
            encrypted: true,
          },
    );
    const temp = this.file + ".tmp";
    fs.writeFileSync(
      temp,
      JSON.stringify({ ...this.state, clipboard, keys: undefined }, null, 2),
    );
    fs.renameSync(temp, this.file);
  }
  key(name: string): string;
  key(name: string, value: string): boolean;
  key(name: string, value?: string): string | boolean {
    if (
      !["gemini", "tavily"].includes(name) &&
      !/^(connection|provider):[a-z0-9-]{1,64}$/.test(name)
    )
      throw new Error("Unknown API provider.");
    if (value === undefined) return this.secrets[name] || "";
    this.setKeys({ [name]: value });
    return !!value;
  }
  setKeys(changes: Record<string, string>) {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("Windows credential encryption is unavailable.");
    const secrets = { ...this.secrets };
    for (const [name, value] of Object.entries(changes)) {
      if (
        !["gemini", "tavily"].includes(name) &&
        !/^(connection|provider):[a-z0-9-]{1,64}$/.test(name)
      )
        throw new Error("Unknown API provider.");
      if (typeof value !== "string" || value.length > 12000)
        throw new Error("Invalid credential.");
      if (value) secrets[name] = value;
      else delete secrets[name];
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
    fs.mkdirSync(path.dirname(this.secretsFile), { recursive: true });
    fs.writeFileSync(this.secretsFile + ".tmp", encrypted);
    fs.renameSync(this.secretsFile + ".tmp", this.secretsFile);
    this.secrets = secrets;
  }
  usage(
    type: "words" | "dictations" | "turns" | "searches" | "credits",
    amount = 1,
  ) {
    const day = new Date().toLocaleDateString("en-CA");
    const u = (this.state.usage[day] ||= {
      words: 0,
      dictations: 0,
      turns: 0,
      searches: 0,
      credits: 0,
    });
    u[type] += amount;
    if (type === "turns" || type === "dictations") this.state.embers += 1;
    this.save();
  }
  message(role: "user" | "assistant", text: string, sources?: any[]) {
    const item = {
      id: randomUUID(),
      role,
      text,
      at: new Date().toISOString(),
      sources,
    };
    this.state.messages.push(item);
    this.save();
    return item;
  }
}
