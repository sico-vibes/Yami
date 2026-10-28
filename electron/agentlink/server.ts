import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { answer, trustedOrigin, type AgentTool } from "./protocol.ts";

export const agentLinkPort = 47821;

/**
 * Yami's MCP endpoint for coding agents: http://127.0.0.1:47821/mcp. It
 * listens on loopback only, needs the bearer token, refuses browser origins
 * (DNS rebinding), and exists only while the module is on.
 */
export function startAgentLink(options: {
  token: () => string;
  tools: AgentTool[];
  allowed: (name: string) => boolean;
  port?: number;
}) {
  const port = options.port ?? agentLinkPort;
  const server = http.createServer((req, res) => {
    const send = (status: number, body?: object) => {
      res.writeHead(status, body ? { "Content-Type": "application/json" } : {});
      res.end(body ? JSON.stringify(body) : undefined);
    };
    if (new URL(req.url || "/", "http://127.0.0.1").pathname !== "/mcp")
      return send(404);
    if (!trustedOrigin(req.headers.origin)) return send(403);
    const given = Buffer.from(
      String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""),
    );
    const want = Buffer.from(options.token());
    if (
      !want.length ||
      given.length !== want.length ||
      !timingSafeEqual(given, want)
    )
      return send(401, { error: "Yami needs its agent token." });
    if (req.method === "GET") return send(405);
    if (req.method === "DELETE") return send(200);
    if (req.method !== "POST") return send(405);
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) req.destroy();
    });
    req.on("end", async () => {
      let message: any;
      try {
        message = JSON.parse(body);
      } catch {
        return send(400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error." },
        });
      }
      if (Array.isArray(message))
        return send(400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Send one message at a time." },
        });
      const reply = await answer(message, options.tools, options.allowed);
      if (!reply) return send(202);
      send(200, reply);
    });
  });
  const ready = new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `Port ${port} is in use by another app, so agents cannot reach Yami.`,
            )
          : error,
      ),
    );
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return {
    port,
    ready,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
