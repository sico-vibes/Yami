import fs from "node:fs";
import path from "node:path";
import { webOnly } from "../../src/browser-rules.ts";

export type Bookmark = {
  title: string;
  url: string;
  folder: string;
  from: string;
};

/** Chromium-family browsers whose plain Bookmarks file Yami can import. */
export function browserProfiles(local: string) {
  const at = (...parts: string[]) =>
    path.join(local, ...parts, "User Data", "Default", "Bookmarks");
  return [
    { id: "chrome", name: "Google Chrome", file: at("Google", "Chrome") },
    { id: "edge", name: "Microsoft Edge", file: at("Microsoft", "Edge") },
    { id: "brave", name: "Brave", file: at("BraveSoftware", "Brave-Browser") },
    { id: "vivaldi", name: "Vivaldi", file: at("Vivaldi") },
    { id: "helium", name: "Helium", file: at("imput", "Helium") },
  ];
}

/** Every http(s) bookmark in a Chromium Bookmarks file, with its folder. */
export function readChromiumBookmarks(json: string, from: string): Bookmark[] {
  const data = JSON.parse(json);
  const out: Bookmark[] = [];
  const walk = (node: any, folder: string, depth: number) => {
    if (!node || depth > 30 || out.length >= 5000) return;
    if (
      node.type === "url" &&
      typeof node.url === "string" &&
      webOnly(node.url)
    )
      out.push({
        title: String(node.name || node.url).slice(0, 300),
        url: node.url,
        folder,
        from,
      });
    if (Array.isArray(node.children))
      for (const child of node.children)
        walk(
          child,
          node.type === "folder" && depth > 0
            ? (folder ? folder + " › " : "") + String(node.name || "")
            : folder,
          depth + 1,
        );
  };
  for (const root of Object.values(data.roots || {})) walk(root, "", 0);
  return out;
}

type Crypto = {
  encrypt: (text: string) => Buffer;
  decrypt: (data: Buffer) => string;
  available: () => boolean;
};

/**
 * Bookmarks kept for the Yami Browser, encrypted as a whole with Windows'
 * DPAPI (Electron safeStorage). Yami imports only plain Bookmarks files; it
 * never decrypts other browsers' passwords or cookies.
 */
export class Vault {
  private bookmarks: Bookmark[] = [];
  constructor(
    private file: string,
    private crypto: Crypto,
  ) {
    try {
      this.bookmarks =
        JSON.parse(crypto.decrypt(fs.readFileSync(file))).bookmarks || [];
    } catch {}
  }
  list() {
    return this.bookmarks;
  }
  sources(local: string) {
    return browserProfiles(local).map((b) => ({
      id: b.id,
      name: b.name,
      found: fs.existsSync(b.file),
    }));
  }
  import(id: string, local: string) {
    const browser = browserProfiles(local).find((b) => b.id === id);
    if (!browser) throw new Error("Choose a browser.");
    let json: string;
    try {
      json = fs.readFileSync(browser.file, "utf8");
    } catch {
      throw new Error(`${browser.name} has no bookmarks file on this PC.`);
    }
    const found = readChromiumBookmarks(json, browser.name);
    const known = new Set(this.bookmarks.map((b) => b.url));
    const added = found.filter((b) => !known.has(b.url) && known.add(b.url));
    this.bookmarks = [...this.bookmarks, ...added].slice(0, 5000);
    this.save();
    return { added: added.length, total: this.bookmarks.length };
  }
  remove(url: string) {
    this.bookmarks = this.bookmarks.filter((b) => b.url !== url);
    this.save();
    return this.bookmarks;
  }
  clear() {
    this.bookmarks = [];
    fs.rmSync(this.file, { force: true });
    return this.bookmarks;
  }
  private save() {
    if (!this.crypto.available())
      throw new Error(
        "Windows credential encryption is unavailable, so the vault was not saved.",
      );
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + ".tmp";
    fs.writeFileSync(
      temp,
      this.crypto.encrypt(JSON.stringify({ bookmarks: this.bookmarks })),
    );
    fs.renameSync(temp, this.file);
  }
}
