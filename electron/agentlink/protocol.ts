// A small MCP server core (JSON-RPC 2.0, protocol 2025-06-18) for Yami's own
// tools. The HTTP layer lives in server.ts; this part has no I/O.

export type AgentTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
};

type Message = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

const version = "2025-06-18";

/**
 * Answers one JSON-RPC message, or returns undefined for a notification.
 * `allowed` is read on every call, so switching a tool off takes effect at once.
 */
export async function answer(
  message: Message,
  tools: AgentTool[],
  allowed: (name: string) => boolean,
): Promise<object | undefined> {
  const reply = (result: object) => ({
    jsonrpc: "2.0",
    id: message.id,
    result,
  });
  const fail = (code: number, text: string) => ({
    jsonrpc: "2.0",
    id: message.id ?? null,
    error: { code, message: text },
  });
  if (message?.jsonrpc !== "2.0" || typeof message.method !== "string")
    return fail(-32600, "Invalid request.");
  if (message.id === undefined) return undefined;
  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "yami", version: "0.1" },
        instructions:
          "Yami is the user's Windows desktop companion. Use notify for short status updates, ask_user for a yes or no decision.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: tools
          .filter((t) => allowed(t.name))
          .map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
      });
    case "tools/call": {
      const tool = tools.find((t) => t.name === message.params?.name);
      if (!tool || !allowed(tool.name))
        return fail(
          -32602,
          "That tool is not available. The user can turn it on in Yami.",
        );
      try {
        const text = await tool.run(message.params?.arguments || {});
        return reply({ content: [{ type: "text", text }], isError: false });
      } catch (error) {
        return reply({
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "The tool failed.",
            },
          ],
          isError: true,
        });
      }
    }
    default:
      return fail(-32601, "Unknown method.");
  }
}

/** Only requests without a browser Origin, or from this PC, are accepted. */
export function trustedOrigin(origin: string | undefined) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
