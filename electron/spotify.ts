import http from "node:http";
import { createHash, randomBytes } from "node:crypto";

// Optional Spotify Web API control with the user's own app (client ID) and
// PKCE, so no secret is stored. Spotify requires Premium for playback
// endpoints, and an app in development mode allows at most five users.

export const spotifyRedirect = "http://127.0.0.1:47823/callback";
const scopes = "user-read-playback-state user-modify-playback-state";

export function pkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("hex") };
}

export function authorizeUrl(
  clientId: string,
  challenge: string,
  state: string,
) {
  if (!/^[0-9a-f]{32}$/i.test(clientId))
    throw new Error("Paste the 32-character Client ID from your Spotify app.");
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: spotifyRedirect,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: scopes,
    state,
  });
  return `https://accounts.spotify.com/authorize?${q}`;
}

/** Waits once for Spotify's redirect on 127.0.0.1, for up to five minutes. */
export function waitForCode(state: string, port = 47823, ms = 300_000) {
  return new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const ok =
        url.searchParams.get("state") === state && url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Yami</title><body style="font:16px system-ui;background:#0b0a22;color:#f4f1ff;padding:40px">${ok ? "Spotify is connected. You can close this tab." : "Spotify did not connect. Try again from Yami."}</body>`,
      );
      done();
      if (ok) resolve(url.searchParams.get("code")!);
      else
        reject(
          new Error(
            url.searchParams.get("error") === "access_denied"
              ? "Spotify sign-in was cancelled."
              : "Spotify sign-in did not match. Try again.",
          ),
        );
    });
    const timer = setTimeout(() => {
      done();
      reject(new Error("Spotify sign-in timed out."));
    }, ms);
    const done = () => {
      clearTimeout(timer);
      server.close();
    };
    server.once("error", (e: NodeJS.ErrnoException) =>
      reject(
        e.code === "EADDRINUSE"
          ? new Error(`Port ${port} is in use, so Spotify cannot reach Yami.`)
          : e,
      ),
    );
    server.listen(port, "127.0.0.1");
  });
}

type Tokens = { access: string; refresh: string; expires: number };

export class Spotify {
  private tokens?: Tokens;
  constructor(
    private clientId: () => string,
    private refreshToken: { get(): string; set(value: string): void },
    private fetchImpl: typeof fetch = fetch,
  ) {}

  connected() {
    return !!this.refreshToken.get();
  }

  async exchange(code: string, verifier: string) {
    await this.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: spotifyRedirect,
      code_verifier: verifier,
    });
  }

  disconnect() {
    this.tokens = undefined;
    this.refreshToken.set("");
  }

  private async token(body: Record<string, string>) {
    const response = await this.fetchImpl(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: this.clientId(), ...body }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (body.grant_type === "refresh_token") this.disconnect();
      throw new Error(
        json.error === "invalid_grant"
          ? "Spotify signed Yami out. Connect again."
          : "Spotify refused the sign-in.",
      );
    }
    this.tokens = {
      access: String(json.access_token),
      refresh: String(json.refresh_token || body.refresh_token || ""),
      expires: Date.now() + (Number(json.expires_in) || 3600) * 1000 - 60_000,
    };
    if (this.tokens.refresh) this.refreshToken.set(this.tokens.refresh);
  }

  private async call(method: string, path: string, body?: object) {
    if (!this.connected())
      throw new Error("Connect Spotify in Settings › Music first.");
    if (!this.tokens || Date.now() > this.tokens.expires)
      await this.token({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken.get(),
      });
    const response = await this.fetchImpl("https://api.spotify.com/v1" + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.tokens!.access,
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 204) return null;
    const json: any = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = json?.error?.reason;
      throw new Error(
        reason === "PREMIUM_REQUIRED"
          ? "Spotify needs Premium for remote playback control."
          : reason === "NO_ACTIVE_DEVICE"
            ? "Open Spotify on a device first."
            : response.status === 403
              ? "Spotify did not allow that. Apps in development mode need your account added in the Spotify dashboard."
              : `Spotify answered HTTP ${response.status}.`,
      );
    }
    return json;
  }

  async now() {
    const p = await this.call("GET", "/me/player");
    if (!p) return { active: false };
    return {
      active: true,
      playing: !!p.is_playing,
      title: p.item?.name || "",
      artist: (p.item?.artists || []).map((a: any) => a.name).join(", "),
      device: p.device?.name || "",
      volume: p.device?.volume_percent ?? null,
      shuffle: !!p.shuffle_state,
      repeat: p.repeat_state || "off",
    };
  }

  async devices() {
    const r = await this.call("GET", "/me/player/devices");
    return (r?.devices || []).map((d: any) => ({
      id: String(d.id),
      name: String(d.name),
      type: String(d.type),
      active: !!d.is_active,
    }));
  }

  async act(action: string, value?: unknown) {
    if (action === "play") await this.call("PUT", "/me/player/play");
    else if (action === "pause") await this.call("PUT", "/me/player/pause");
    else if (action === "next") await this.call("POST", "/me/player/next");
    else if (action === "previous")
      await this.call("POST", "/me/player/previous");
    else if (action === "volume") {
      const v = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (!Number.isFinite(v)) throw new Error("Choose a volume.");
      await this.call("PUT", `/me/player/volume?volume_percent=${v}`);
    } else if (action === "shuffle") {
      // The desktop app ignores shuffle and repeat sent through Windows;
      // Spotify's own service applies them.
      const now = await this.now();
      await this.call("PUT", `/me/player/shuffle?state=${!now?.shuffle}`);
    } else if (action === "repeat") {
      const now = await this.now();
      const next =
        { off: "context", context: "track", track: "off" }[
          String(now?.repeat || "off") as "off" | "context" | "track"
        ] || "off";
      await this.call("PUT", `/me/player/repeat?state=${next}`);
    } else if (action === "transfer") {
      const id = String(value || "");
      if (!/^[A-Za-z0-9]{10,64}$/.test(id)) throw new Error("Choose a device.");
      await this.call("PUT", "/me/player", { device_ids: [id], play: true });
    } else throw new Error("Unknown Spotify action.");
    return this.now();
  }
}
