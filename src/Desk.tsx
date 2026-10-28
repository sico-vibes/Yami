import { lazy, Suspense, useState } from "react";
import { AsciiSkeleton } from "./AsciiSkeleton";
import type { State } from "./shared";
import { Plans } from "./Plans";

const Inbox = lazy(() => import("./feeds/Inbox"));

/** Desk: plans, plus the feeds inbox while that module is on. */
export function Desk({
  state,
  report,
}: {
  state: State;
  report: (message: string) => void;
}) {
  const [view, setView] = useState<"plans" | "inbox">("plans");
  if (!state.settings.feedsEnabled)
    return <Plans state={state} report={report} />;
  return (
    <>
      <div className="page-rail desk-rail" role="tablist" aria-label="Desk">
        {(
          [
            ["plans", "Plans"],
            ["inbox", "Inbox"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            className={view === id ? "selected" : ""}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "inbox" ? (
        <Suspense fallback={<AsciiSkeleton label="Opening Inbox…" />}>
          <Inbox report={report} />
        </Suspense>
      ) : (
        <Plans state={state} report={report} />
      )}
    </>
  );
}
