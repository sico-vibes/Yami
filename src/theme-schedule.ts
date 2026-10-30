// Light and dark on a schedule: which theme fits a moment, and when the next
// switch is due. Times are "HH:MM" in local time.

const minutes = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error("Use a time like 07:30.");
  return Number(m[1]) * 60 + Number(m[2]);
};

/** True when `now` falls in the dark part of the day. */
export function darkAt(now: Date, lightAt: string, darkFrom: string) {
  const t = now.getHours() * 60 + now.getMinutes();
  const light = minutes(lightAt),
    dark = minutes(darkFrom);
  if (light === dark) return false;
  // Dark from evening until morning, or the other way round.
  return light < dark ? t >= dark || t < light : t >= dark && t < light;
}

/** The next moment the theme changes, and to what. */
export function nextSwitch(now: Date, lightAt: string, darkFrom: string) {
  const at = (hhmm: string) => {
    const d = new Date(now);
    const m = minutes(hhmm);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  };
  const toLight = at(lightAt),
    toDark = at(darkFrom);
  return toDark < toLight
    ? { at: toDark, dark: true }
    : { at: toLight, dark: false };
}
