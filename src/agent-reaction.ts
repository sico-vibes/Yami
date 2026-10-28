// Which short spirit reaction an agent's change deserves, if any. Each
// change reacts once: the same session at the same moment is ignored.

export const reactionMs = 1600;

const byPhase: Record<string, string> = {
  finished: "cheer",
  error: "worried",
  waiting: "alert",
};

export function agentReaction(
  latest: { id: string; phase: string; at: number } | undefined,
  seen: string | undefined,
) {
  if (!latest) return { reaction: "", key: seen };
  const key = `${latest.id}:${latest.phase}:${latest.at}`;
  if (key === seen) return { reaction: "", key };
  // The first event after the island opens only sets the baseline.
  return {
    reaction: seen === undefined ? "" : byPhase[latest.phase] || "",
    key,
  };
}
