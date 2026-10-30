import { useEffect, useState } from "react";
import { api, time } from "./api";
import type { State } from "./shared";
import { Icon } from "./ui";

type Line = { icon: string; text: string; tab?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Home: a short brief of the day from what Yami already holds: today's
 * plans, a public holiday, unread mail and the newest headlines. It reads
 * saved data: mail and feeds as last read, and the holiday list (fetched
 * once a year when holidays are on).
 */
export function DailyBrief({ state }: { state: State }) {
  const open = (tab: string) => void api("show", { tab }).catch(() => {});
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const out: Line[] = [];
      const now = new Date(),
        end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const today = state.tasks
        .filter((t) => t.enabled && t.status !== "done")
        .filter((t) => {
          const at = new Date(t.at);
          return (
            t.repeat === "daily" ||
            (t.repeat === "weekly" && at.getDay() === now.getDay()) ||
            (at >= now && at <= end)
          );
        })
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      if (today.length)
        out.push({
          icon: "calendar-check",
          text: `${today.length} ${today.length === 1 ? "plan" : "plans"} today · next: ${today[0].title} at ${time(today[0].at)}`,
          tab: "desk",
        });
      if (state.settings.holidaysEnabled) {
        const r = await api("holidays", { year: now.getFullYear() }).catch(
          () => null,
        );
        const h = r?.holidays.find((x: any) => x.date === dayKey(now));
        if (h) out.push({ icon: "confetti", text: `Today is ${h.name}` });
      }
      if (state.settings.feedsEnabled) {
        const mail = await api("feeds.mail").catch(() => []);
        const unread = mail.reduce(
          (n: number, a: any) => n + (a.glance?.unread || 0),
          0,
        );
        if (unread)
          out.push({
            icon: "envelope-simple",
            text: `${unread} unread ${unread === 1 ? "email" : "emails"}`,
            tab: "desk",
          });
        const feeds = await api("feeds.list").catch(() => null);
        const top = feeds?.items?.[0];
        if (top) out.push({ icon: "newspaper", text: top.title, tab: "desk" });
      }
      if (live) setLines(out.slice(0, 4));
    })();
    return () => {
      live = false;
    };
  }, [
    state.tasks,
    state.settings.holidaysEnabled,
    state.settings.feedsEnabled,
  ]);
  if (!lines.length) return null;
  return (
    <ul className="daily-brief" aria-label="Your day">
      {lines.map((l, i) => (
        <li key={i}>
          <button
            type="button"
            className="daily-line"
            disabled={!l.tab}
            onClick={() => l.tab && open(l.tab)}
          >
            <Icon name={l.icon} size={16} />
            <span>{l.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
