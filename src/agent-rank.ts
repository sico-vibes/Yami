import type { AgentSession } from "./workbench-types";

// Which agent sessions the island shows, most urgent first: one waiting for
// you, then a recent error, then ones working or thinking. Finished and idle
// sessions are not "active", so the island stops cycling when work ends.
const order: Partial<Record<AgentSession["phase"], number>> = {
  waiting: 0,
  error: 1,
  working: 2,
  thinking: 2,
};
/** An error stays in the island this long unless it is dismissed sooner. */
export const errorShownFor = 15 * 60_000;

export function activeAgents(sessions: AgentSession[], now = Date.now()) {
  return sessions
    .filter(
      (s) =>
        order[s.phase] !== undefined &&
        (s.phase !== "error" || now - s.at < errorShownFor),
    )
    .sort((a, b) => order[a.phase]! - order[b.phase]! || b.at - a.at);
}
