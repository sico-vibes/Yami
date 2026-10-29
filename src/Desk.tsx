import { lazy, Suspense, useState } from "react";
import { AsciiSkeleton } from "./AsciiSkeleton";
import type { State } from "./shared";
import { Plans } from "./Plans";

const Inbox = lazy(() => import("./feeds/Inbox"));
const Downloads = lazy(() =>
  import("./Downloads").then((m) => ({ default: m.Downloads })),
);

type View = "plans" | "inbox" | "downloads";

/** Desk: plans, downloads, and the feeds inbox while that module is on. */
export function Desk({
  state,
  report,
}: {
  state: State;
  report: (message: string) => void;
}) {
  const [view, setView] = useState<View>("plans");
  const views: [View, string][] = [
    ["plans", "Plans"],
    ...(state.settings.feedsEnabled
      ? ([["inbox", "Inbox"]] as [View, string][])
      : []),
    ["downloads", "Downloads"],
  ];
  const shown = views.some(([id]) => id === view) ? view : "plans";
  return (
    <>
      <div className="page-rail desk-rail" role="tablist" aria-label="Desk">
        {views.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={shown === id}
            className={shown === id ? "selected" : ""}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown === "inbox" ? (
        <Suspense fallback={<AsciiSkeleton label="Opening Inbox…" />}>
          <Inbox report={report} />
        </Suspense>
      ) : shown === "downloads" ? (
        <Suspense fallback={<AsciiSkeleton label="Opening Downloads…" />}>
          <Downloads report={report} />
        </Suspense>
      ) : (
        <Plans state={state} report={report} />
      )}
    </>
  );
}
