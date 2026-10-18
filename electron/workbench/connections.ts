import { randomUUID } from "node:crypto";
import type {
  ConnectionConfig,
  ConnectionItem,
  ConnectionReading,
} from "../../src/workbench-types";
import type { WorkbenchStorage } from "./storage";
import { requestJson, serverUrl } from "./network";
export const connectionKinds = [
  "github",
  "vercel",
  "n8n",
  "notion",
  "calcom",
  "resend",
  "stripe",
];
export class Connections {
  private disposed = false;
  private retryUntil = new Map<string, number>();
  private timers = new Map<string, NodeJS.Timeout>();
  private pending = new Map<string, Promise<ConnectionReading>>();
  constructor(
    private data: WorkbenchStorage,
    private changed: () => void,
    private notify: (text: string) => void,
  ) {}
  sync() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    for (const c of this.data.state.connections)
      if (c.enabled && c.background) this.schedule(c);
  }
  private schedule(c: ConnectionConfig, after?: number) {
    clearTimeout(this.timers.get(c.id));
    this.timers.set(
      c.id,
      setTimeout(
        () => {
          void this.refresh(c.id);
        },
        after || Math.max(60, c.interval) * 1000,
      ),
    );
  }
  save(input: any) {
    if (!connectionKinds.includes(input.kind))
      throw new Error("Unknown connection type.");
    const old = this.data.state.connections.find((c) => c.id === input.id);
    const id = old?.id || randomUUID();
    const url = String(input.url || "").trim();
    if (url) serverUrl(url);
    const config: ConnectionConfig = {
      id,
      kind: input.kind,
      name: String(input.name || input.kind).slice(0, 80),
      url,
      enabled: !!input.enabled,
      background: !!input.background,
      interval: Math.max(60, Math.min(3600, Number(input.interval) || 300)),
    };
    if (typeof input.key === "string" && input.key.length > 12000)
      throw new Error("Credential is too long.");
    const replacement =
      typeof input.key === "string" && input.key.trim()
        ? input.key.trim()
        : old && (old.url !== url || old.kind !== config.kind)
          ? ""
          : undefined;
    if (replacement !== undefined)
      this.data.store.key(`connection:${id}`, replacement);
    if (old && (old.url !== url || old.kind !== config.kind)) {
      this.retryUntil.delete(id);
      this.data.state.readings = this.data.state.readings.filter(
        (r) => r.id !== id,
      );
    }
    this.data.state.connections = [
      ...this.data.state.connections.filter((c) => c.id !== id),
      config,
    ];
    this.data.save();
    this.sync();
    this.changed();
    return config;
  }
  remove(id: string) {
    this.retryUntil.delete(id);
    this.data.store.key(`connection:${id}`, "");
    this.data.state.connections = this.data.state.connections.filter(
      (c) => c.id !== id,
    );
    this.data.state.readings = this.data.state.readings.filter(
      (c) => c.id !== id,
    );
    this.data.save();
    this.sync();
    this.changed();
  }
  refresh(id: string) {
    if ((this.retryUntil.get(id) || 0) > Date.now()) {
      const cached = this.data.state.readings.find((r) => r.id === id);
      if (cached) return Promise.resolve(cached);
    }
    if (!this.pending.has(id))
      this.pending.set(
        id,
        this.read(id).finally(() => this.pending.delete(id)),
      );
    return this.pending.get(id)!;
  }
  private async read(id: string): Promise<ConnectionReading> {
    const c = this.data.state.connections.find((c) => c.id === id);
    if (!c || !c.enabled)
      throw new Error("Enable this connection before refreshing.");
    let reading: ConnectionReading = {
      id,
      at: Date.now(),
      status: "ready",
      items: [],
    };
    let delay = Math.max(60, c.interval) * 1000;
    try {
      const key = this.data.store.key(`connection:${id}`);
      if (!key) throw new Error("Add a credential for this connection.");
      const get = (
        url: string,
        options?: RequestInit,
        headers?: Record<string, string>,
      ) => requestJson(url, key, options, headers);
      let items: ConnectionItem[] = [];
      if (c.kind === "github") {
        const query = `query { viewer { login pullRequests(first: 15, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {nodes {id title url updatedAt commits(last:1) {nodes {commit {statusCheckRollup {state}}}}}}}}`;
        const r = await get(
          "https://api.github.com/graphql",
          { method: "POST", body: JSON.stringify({ query }) },
          { "Content-Type": "application/json" },
        );
        if (r.errors?.length)
          throw new Error(
            "GitHub could not return pull requests. Check the token's repository access.",
          );
        items = (r.data?.viewer?.pullRequests?.nodes || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          detail: "Your pull request",
          status:
            p.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state || "open",
          url: p.url,
          at: p.updatedAt,
        }));
        const reviews = await get(
          `https://api.github.com/search/issues?q=${encodeURIComponent(`is:pr is:open review-requested:${r.data.viewer.login}`)}&per_page=10`,
        );
        items.push(
          ...(reviews.items || []).map((p: any) => ({
            id: "review:" + p.id,
            title: p.title,
            detail: "Review requested",
            status: "waiting",
            url: p.html_url,
            at: p.updated_at,
          })),
        );
      } else if (c.kind === "vercel") {
        const r = await get("https://api.vercel.com/v6/deployments?limit=15");
        items = (r.deployments || []).map((d: any) => ({
          id: d.uid,
          title: d.name,
          status: d.readyState || d.state,
          detail: d.meta?.githubCommitMessage || "Deployment",
          url: d.url ? `https://${d.url}` : undefined,
        }));
      } else if (c.kind === "n8n") {
        if (!c.url) throw new Error("Enter your n8n server address.");
        const root = serverUrl(c.url).href.replace(/\/$/, "");
        const r = await get(`${root}/api/v1/executions?limit=15`, undefined, {
          "X-N8N-API-KEY": key,
        });
        items = (r.data || []).map((e: any) => ({
          id: String(e.id),
          title: e.workflowData?.name || `Workflow ${e.workflowId}`,
          detail: e.finished ? "Execution finished" : "Execution",
          status: e.status || (e.finished ? "finished" : "running"),
          at: e.startedAt,
          url: `${root}/workflow/${encodeURIComponent(e.workflowId)}/executions/${encodeURIComponent(e.id)}`,
        }));
      } else if (c.kind === "notion") {
        const r = await get(
          "https://api.notion.com/v1/search",
          {
            method: "POST",
            body: JSON.stringify({
              page_size: 15,
              sort: { direction: "descending", timestamp: "last_edited_time" },
            }),
          },
          {
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
        );
        items = (r.results || []).map((p: any) => ({
          id: p.id,
          title:
            (
              p.properties?.title?.title ||
              p.properties?.Name?.title ||
              p.title ||
              []
            )
              .map((x: any) => x.plain_text || x.text?.content || "")
              .join("") || "Untitled page",
          status: "page",
          detail: "Notion",
          url: p.url,
          at: p.last_edited_time,
        }));
      } else if (c.kind === "calcom") {
        const r = await get(
          "https://api.cal.com/v2/bookings?status=upcoming",
          undefined,
          { "cal-api-version": "2024-08-13" },
        );
        const list = Array.isArray(r.data) ? r.data : r.data?.bookings || [];
        items = list.slice(0, 15).map((p: any) => ({
          id: String(p.uid || p.id),
          title: p.title || "Booking",
          status: p.status || "upcoming",
          detail: p.start || p.startTime || "",
          url: p.uid ? `https://app.cal.com/bookings/upcoming` : undefined,
        }));
      } else if (c.kind === "resend") {
        const r = await get("https://api.resend.com/emails?limit=15");
        items = (r.data || []).map((e: any) => ({
          id: e.id,
          title: e.subject || "Email",
          detail: "Delivery status",
          status: e.last_event || "sent",
          at: e.created_at,
          url: `https://resend.com/emails/${e.id}`,
        }));
      } else {
        const r = await get("https://api.stripe.com/v1/charges?limit=15");
        items = (r.data || []).map((p: any) => ({
          id: p.id,
          title: formatAmount(p.amount, p.currency),
          detail: p.description || "Payment",
          status: p.status,
          url: `https://dashboard.stripe.com/payments/${p.payment_intent || p.id}`,
        }));
      }
      reading.items = items.slice(0, 30).map((item) => ({
        ...item,
        title: String(item.title).slice(0, 300),
        detail: String(item.detail || "").slice(0, 500),
      }));
      const previous = this.data.state.readings.find((r) => r.id === id);
      if (
        previous?.status === "ready" &&
        this.data.state.connections.some(
          (x) =>
            x.id === id &&
            x.enabled &&
            x.background &&
            x.url === c.url &&
            x.kind === c.kind,
        )
      ) {
        const change = reading.items.find(
          (item) =>
            !previous.items.some(
              (old) => old.id === item.id && old.status === item.status,
            ),
        );
        if (change)
          this.notify(`${c.name}: ${change.title} · ${change.status}`);
      }
    } catch (error) {
      reading = {
        ...reading,
        status: "error",
        items: this.data.state.readings.find((r) => r.id === id)?.items || [],
        error: (error as Error).message,
      };
      delay = Math.max(
        delay,
        (error as any).retryAt ? (error as any).retryAt - Date.now() : 60000,
      );
      if ((error as any).retryAt)
        this.retryUntil.set(id, (error as any).retryAt);
    }
    const current = this.data.state.connections.find((x) => x.id === id);
    if (
      this.disposed ||
      !current ||
      !current.enabled ||
      current.url !== c.url ||
      current.kind !== c.kind
    )
      return reading;
    this.data.state.readings = [
      ...this.data.state.readings.filter((r) => r.id !== id),
      reading,
    ];
    this.data.save();
    this.changed();
    if (current.background) this.schedule(current, delay);
    return reading;
  }
  dispose() {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
export function formatAmount(amount: number, currency: string) {
  const formatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency: String(currency).toUpperCase(),
  });
  return formatter.format(
    amount / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2),
  );
}
