import type { WorkbenchStorage } from "./storage";
import { serverUrl } from "./network";
export class McpClient {
  private id = 0;
  private session = "";
  private protocol = "2025-03-26";
  private tools: any[] = [];
  constructor(
    private data: WorkbenchStorage,
    private confirm: (title: string, detail: string) => Promise<boolean>,
  ) {}
  disconnect() {
    this.session = "";
    this.tools = [];
  }
  private async rpc(
    method: string,
    params: any = {},
    notification = false,
  ): Promise<any> {
    const url = serverUrl(this.data.state.settings.mcpUrl).href;
    const key = this.data.store.key("provider:mcp");
    const id = ++this.id;
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(method === "tools/call" ? 60000 : 15000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": this.protocol,
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(this.session ? { "Mcp-Session-Id": this.session } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        ...(notification ? {} : { id }),
        method,
        params,
      }),
    });
    if (!response.ok)
      throw new Error(`MCP server returned HTTP ${response.status}.`);
    if (response.headers.get("mcp-session-id"))
      this.session = response.headers.get("mcp-session-id")!;
    if (notification || response.status === 202 || !response.body) {
      await response.body?.cancel();
      return {};
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let text = "",
      bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 2097152)
          throw new Error("MCP response exceeded its limit.");
        text += decoder.decode(part.value, { stream: true });
        if (
          response.headers.get("content-type")?.includes("text/event-stream")
        ) {
          const blocks = text.split(/\r?\n\r?\n/);
          text = blocks.pop() || "";
          for (const block of blocks) {
            const raw = block
              .split(/\r?\n/)
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
              .join("\n");
            if (!raw) continue;
            const value = JSON.parse(raw);
            if (value.id !== id) continue;
            if (value.error)
              throw new Error(String(value.error.message).slice(0, 500));
            return value.result;
          }
        }
      }
      const value = JSON.parse(text);
      if (value.error)
        throw new Error(String(value.error.message).slice(0, 500));
      return value.result;
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  async connect() {
    this.disconnect();
    const r = await this.rpc("initialize", {
      protocolVersion: this.protocol,
      capabilities: {},
      clientInfo: { name: "Yami", version: "1" },
    });
    if (typeof r.protocolVersion !== "string")
      throw new Error("The server did not negotiate an MCP protocol.");
    this.protocol = r.protocolVersion;
    await this.rpc("notifications/initialized", {}, true);
    const result = await this.rpc("tools/list");
    this.tools = (result.tools || []).slice(0, 100);
    return this.tools;
  }
  async call(name: string, args: any) {
    const endpoint = this.data.state.settings.mcpUrl;
    if (!this.tools.some((t) => t.name === name))
      throw new Error("Connect and select an advertised tool first.");
    if (JSON.stringify(args).length > 24000)
      throw new Error("Tool input is too large.");
    if (
      !(await this.confirm(
        `Run ${name}?`,
        `Server: ${this.data.state.settings.mcpUrl}\n\n${JSON.stringify(args, null, 2)}`,
      ))
    )
      throw new Error("Tool call cancelled.");
    if (
      this.data.state.settings.mcpUrl !== endpoint ||
      !this.tools.some((t) => t.name === name)
    )
      throw new Error(
        "The MCP connection changed. Reconnect and review the tool again.",
      );
    return this.rpc("tools/call", { name, arguments: args });
  }
}
