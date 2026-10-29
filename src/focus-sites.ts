// The sites a focus session blocks, cleaned into plain domains.
export const defaultSites =
  "youtube.com, reddit.com, x.com, instagram.com, tiktok.com";

export function focusSites(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((s) =>
          s
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, ""),
        )
        .filter((s) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)),
    ),
  ].slice(0, 30);
}
