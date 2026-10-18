import type { WorkbenchStorage } from "./storage";
import { serverUrl, requestJson, boundedText } from "./network";
export function visibleModelText(text: string) {
  return text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trimStart();
}
export class LocalModel {
  private pending = new Map<string, AbortController>();
  constructor(
    private data: WorkbenchStorage,
    private emit: (event: any) => void,
  ) {}
  private base() {
    return serverUrl(this.data.state.settings.localUrl).href.replace(/\/$/, "");
  }
  async models() {
    const r = await requestJson(
      `${this.base()}/models`,
      this.data.store.key("provider:local"),
    );
    return (r.data || [])
      .filter(
        (m: any) => typeof m.id === "string" && !/embed|rerank/i.test(m.id),
      )
      .map((m: any) => m.id)
      .slice(0, 200);
  }
  async chat(id: string, text: string) {
    if (this.pending.size)
      throw new Error("Finish or cancel the current local-model request.");
    if (!this.data.state.settings.localModel)
      throw new Error("Select a model first.");
    const controller = new AbortController();
    this.pending.set(id, controller);
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const key = this.data.store.key("provider:local");
      const response = await fetch(`${this.base()}/chat/completions`, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          model: this.data.state.settings.localModel,
          messages: [{ role: "user", content: text.slice(0, 24000) }],
          stream: true,
        }),
      });
      if (!response.ok || !response.body)
        throw new Error(
          `Model server rejected the request (${response.status}).`,
        );
      if (response.headers.get("content-type")?.includes("application/json")) {
        const data = JSON.parse(await boundedText(response));
        if (data.error) throw new Error("The model server reported an error.");
        return visibleModelText(
          String(data.choices?.[0]?.message?.content || ""),
        );
      }
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        output = "",
        total = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          total += part.value.length;
          if (total > 2097152)
            throw new Error("Model output reached its limit.");
          buffer += decoder.decode(part.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines)
            if (line.startsWith("data:") && line.slice(5).trim() !== "[DONE]") {
              let data;
              try {
                data = JSON.parse(line.slice(5));
              } catch {
                continue;
              }
              if (data.error)
                throw new Error("The model server reported an error.");
              output += data.choices?.[0]?.delta?.content || "";
            }
          this.emit({
            type: "local-model-delta",
            id,
            text: visibleModelText(output),
          });
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      return visibleModelText(output);
    } finally {
      clearTimeout(timeout);
      this.pending.delete(id);
    }
  }
  cancel(id?: string) {
    if (id) this.pending.get(id)?.abort();
    else for (const pending of this.pending.values()) pending.abort();
  }
}
