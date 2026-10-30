import http from "node:http";
import os from "node:os";
import { timingSafeEqual } from "node:crypto";
import { remotePage } from "./page.ts";

export const remotePort = 47822;
export type RemoteAbility =
  | "approvals"
  | "media"
  | "clipboard"
  | "screen"
  | "control";

/** The first private IPv4 address of this PC on the home network. */
export function lanAddress(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
) {
  for (const list of Object.values(interfaces))
    for (const net of list || [])
      if (
        net.family === "IPv4" &&
        !net.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address)
      )
        return net.address;
  return "";
}

type Deps = {
  token: () => string;
  allowed: (ability: RemoteAbility) => boolean;
  state: () => Promise<object>;
  approve: (id: string, decision: "allow" | "deny") => void;
  media: (action: string) => Promise<object>;
  clipboard: (text: string) => void;
  /** A JPEG of the primary screen. */
  frame: () => Promise<Buffer>;
  input: (body: unknown) => Promise<void>;
};

/**
 * Yami Remote: a page and a small JSON API for a phone on the same network.
 * It listens only on this PC's private address while the module is on, and
 * every API call needs the paired token.
 */
export function startRemote(
  deps: Deps,
  // The desktop checks use loopback so no firewall prompt appears.
  host = process.env.YAMI_REMOTE_HOST || lanAddress(),
  port = remotePort,
) {
  const server = http.createServer((req, res) => {
    const send = (
      status: number,
      body?: object | string,
      type = "application/json",
    ) => {
      res.writeHead(status, {
        "Content-Type": body === undefined ? "text/plain" : type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(type.startsWith("text/html") && {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:",
        }),
      });
      res.end(
        typeof body === "string"
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
      );
    };
    const url = new URL(req.url || "/", "http://remote");
    if (req.method === "GET" && url.pathname === "/")
      return send(200, remotePage, "text/html; charset=utf-8");
    if (!url.pathname.startsWith("/api/")) return send(404);
    const given = Buffer.from(
      String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""),
    );
    const want = Buffer.from(deps.token());
    if (
      !want.length ||
      given.length !== want.length ||
      !timingSafeEqual(given, want)
    )
      return send(401, { error: "Pair this phone again from Yami." });
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) req.destroy();
    });
    req.on("end", async () => {
      try {
        const a = body ? JSON.parse(body) : {};
        if (req.method === "GET" && url.pathname === "/api/state")
          return send(200, await deps.state());
        if (req.method === "GET" && url.pathname === "/api/screen") {
          if (!deps.allowed("screen"))
            return send(403, { error: "Screen view is off." });
          const jpeg = await deps.frame();
          res.writeHead(200, {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          });
          return res.end(jpeg);
        }
        if (req.method !== "POST") return send(405);
        if (url.pathname === "/api/approve") {
          if (!deps.allowed("approvals"))
            return send(403, { error: "Approvals from the phone are off." });
          if (a.decision !== "allow" && a.decision !== "deny")
            return send(400, { error: "Allow or deny." });
          deps.approve(String(a.id || ""), a.decision);
          return send(200, await deps.state());
        }
        if (url.pathname === "/api/media") {
          if (!deps.allowed("media"))
            return send(403, { error: "Media control is off." });
          return send(200, await deps.media(String(a.action || "")));
        }
        if (url.pathname === "/api/input") {
          if (!deps.allowed("screen") || !deps.allowed("control"))
            return send(403, { error: "Control from the phone is off." });
          await deps.input(a);
          return send(200, { ok: true });
        }
        if (url.pathname === "/api/clipboard") {
          if (!deps.allowed("clipboard"))
            return send(403, { error: "Sending to the clipboard is off." });
          const text = String(a.text || "");
          if (!text || text.length > 10000)
            return send(400, { error: "Send up to 10,000 characters." });
          deps.clipboard(text);
          return send(200, { ok: true });
        }
        send(404);
      } catch (error) {
        send(400, {
          error: error instanceof Error ? error.message : "That did not work.",
        });
      }
    });
  });
  const ready = new Promise<void>((resolve, reject) => {
    if (!host)
      return reject(
        new Error(
          "This PC has no home-network address, so a phone cannot reach it.",
        ),
      );
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(`Port ${port} is in use by another app.`)
          : error,
      ),
    );
    server.listen(port, host, () => resolve());
  });
  return {
    url: host ? `http://${host}:${port}/` : "",
    ready,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
