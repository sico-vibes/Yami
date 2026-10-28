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

// Profiles saved before first-run setup existed already chose their features,
// so they skip "Choose your Yami". A brand-new profile has no saved settings.
export function setupDoneForExisting<T extends { setupDone?: boolean }>(
  settings: T | undefined,
): T | undefined {
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    return settings;
  return settings.setupDone === undefined
    ? { ...settings, setupDone: true }
    : settings;
}
