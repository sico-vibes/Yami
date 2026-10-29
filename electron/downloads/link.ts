import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { linkedBrowsers } from "../browser/linked.ts";

// The link between the Yami Home extension and Yami's downloads: a small
// server on 127.0.0.1:47823 (this PC only) that exists only while the link
// is on. Every request must carry the key Yami wrote into the extension
// folder; it accepts one thing, "download this http(s) link".

export const LINK_PORT = 47823;

type Saved = { on: boolean; token: string };

export class BrowserLink {
  private server?: http.Server;
  private saved: Saved;
  constructor(
    private dataDir: string,
    /** The extension as shipped with Yami. */
    private source: string,
    private add: (url: string, name?: string) => void,
    private port = LINK_PORT,
  ) {
    try {
      this.saved = JSON.parse(fs.readFileSync(this.file(), "utf8"));
    } catch {
      this.saved = { on: false, token: "" };
    }
  }

  private file = () => path.join(this.dataDir, "browser-link.json");
  /** Where the prepared extension is, ready for Load unpacked. */
  folder = () => path.join(this.dataDir, "extension");

  private save() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.file(), JSON.stringify(this.saved));
  }

  status() {
    return {
      on: this.saved.on,
      running: !!this.server?.listening,
      folder: this.folder(),
      prepared: fs.existsSync(path.join(this.folder(), "manifest.json")),
      browsers: linkedBrowsers().map(({ id, name }) => ({ id, name })),
    };
  }

  private allowed(header: string | undefined) {
    const want = Buffer.from(`Bearer ${this.saved.token}`);
    const got = Buffer.from(String(header || ""));
    return (
      !!this.saved.token &&
      got.length === want.length &&
      timingSafeEqual(got, want)
    );
  }

  private async listen() {
    if (this.server?.listening) return;
    const server = http.createServer((req, res) => {
      const send = (code: number, body: object) => {
        res.writeHead(code, {
          "content-type": "application/json",
          // One request per connection: nothing lingers once the link is off.
          connection: "close",
        });
        res.end(JSON.stringify(body));
      };
      if (!this.allowed(req.headers.authorization))
        return send(401, { error: "Not linked." });
      if (req.method === "GET" && req.url === "/ping")
        return send(200, { ok: true });
      if (req.method !== "POST" || req.url !== "/download")
        return send(404, { error: "Unknown." });
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 16384) req.destroy();
      });
      req.on("end", () => {
        try {
          const { url, filename } = JSON.parse(body);
          if (!/^https?:\/\//i.test(String(url)))
            return send(400, { error: "Only http and https links." });
          const name = filename ? path.basename(String(filename)) : undefined;
          this.add(String(url), name);
          send(200, { ok: true });
        } catch (error) {
          send(400, { error: (error as Error).message });
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.port, "127.0.0.1", () => resolve());
    });
    this.server = server;
  }

  /** Copies the extension with a fresh key, so a browser can load it. */
  prepare() {
    this.saved.token ||= randomBytes(24).toString("base64url");
    fs.rmSync(this.folder(), { recursive: true, force: true });
    fs.cpSync(this.source, this.folder(), { recursive: true });
    fs.writeFileSync(
      path.join(this.folder(), "yami-link.json"),
      JSON.stringify({ token: this.saved.token }),
    );
    this.save();
    return this.status();
  }

  async set(on: unknown) {
    this.saved.on = on === true;
    if (this.saved.on) {
      if (!this.saved.token) this.prepare();
      this.save();
      await this.listen();
    } else {
      this.save();
      await this.close();
    }
    return this.status();
  }

  /** Starts the server at launch when the link was left on. */
  async resume() {
    if (this.saved.on) await this.listen().catch(() => {});
  }

  /** Opens a browser's extensions page; Load unpacked is the user's step. */
  openBrowser(id: unknown) {
    const browser = linkedBrowsers().find((b) => b.id === id);
    if (!browser) throw new Error("That browser is not installed.");
    if (!this.status().prepared) this.prepare();
    const page =
      browser.id === "edge"
        ? "edge://extensions"
        : browser.id === "brave"
          ? "brave://extensions"
          : "chrome://extensions";
    spawn(browser.exe, [page], { detached: true, stdio: "ignore" }).unref();
    return this.status();
  }

  /** Stops listening; resolves once the port is free again. */
  close() {
    const server = this.server;
    this.server = undefined;
    if (!server) return Promise.resolve();
    // Open keep-alive connections go too, so nothing answers once off.
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
