// Upgrades saved state from earlier builds without touching chats, keys or
// other settings. Safe to run on every start.
export function migrateState<
  T extends { owned?: string[]; settings?: { soul?: string } },
>(state: T): T {
  if (state.settings?.soul === "hitodama") state.settings.soul = "yami";
  if (Array.isArray(state.owned))
    state.owned = [
      ...new Set(state.owned.map((id) => (id === "hitodama" ? "yami" : id))),
    ];
  return state;
}
