// The icon and words for a met.no weather symbol, shared by Today and the
// desk widget.
export function weatherLook(code = "") {
  const night = code.endsWith("_night"),
    base = code.replace(/_(day|night|polartwilight)$/, "");
  const icon = /thunder/.test(base)
    ? "cloud-lightning"
    : /snow|sleet/.test(base)
      ? "snowflake"
      : /rain|drizzle/.test(base)
        ? "cloud-rain"
        : /fog/.test(base)
          ? "cloud-fog"
          : base === "cloudy"
            ? "cloud"
            : base === "clearsky"
              ? night
                ? "moon-stars"
                : "sun"
              : night
                ? "cloud-moon"
                : "cloud-sun";
  const label = base
    .replace(/heavy|light/, (m) => m + " ")
    .replace(/partly|clear/, (m) => m + " ")
    .replace(/showers|and/, (m) => " " + m + " ")
    .replace(/\s+/g, " ")
    .trim();
  return { icon, label: label ? label[0].toUpperCase() + label.slice(1) : "" };
}
