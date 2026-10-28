// Address bar rules for the Yami Browser: web addresses, !bangs and search.
// Only http and https pages ever load; everything else becomes a search.

export const newTab = "yami://new";

const bangs: Record<string, string> = {
  g: "https://www.google.com/search?q=",
  ddg: "https://duckduckgo.com/?q=",
  b: "https://www.bing.com/search?q=",
  w: "https://en.wikipedia.org/w/index.php?search=",
  yt: "https://www.youtube.com/results?search_query=",
  gh: "https://github.com/search?q=",
  npm: "https://www.npmjs.com/search?q=",
  r: "https://www.reddit.com/search/?q=",
  mdn: "https://developer.mozilla.org/search?q=",
};
export const bangList = Object.keys(bangs);

export const defaultSearch = "https://duckduckgo.com/?q=";

/** Only web pages load in the Yami Browser. */
export function webOnly(url: string) {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

/** What to load for what was typed: an address, a bang, or a search. */
export function resolveInput(input: string, search = defaultSearch) {
  const text = input.trim();
  if (!text) return newTab;
  const bang = /(?:^|\s)!([a-z]+)(?:\s|$)/i.exec(text);
  if (bang && bangs[bang[1].toLowerCase()]) {
    const query = text.replace(bang[0], " ").trim();
    return bangs[bang[1].toLowerCase()] + encodeURIComponent(query);
  }
  if (/^https?:\/\//i.test(text))
    return webOnly(text)
      ? new URL(text).href
      : search + encodeURIComponent(text);
  // A bare host such as example.com or localhost:5173 (no spaces).
  if (
    !/\s/.test(text) &&
    (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text) ||
      /^localhost(:\d+)?(\/.*)?$/i.test(text))
  ) {
    const url = (/^localhost/i.test(text) ? "http://" : "https://") + text;
    if (webOnly(url)) return new URL(url).href;
  }
  return search + encodeURIComponent(text);
}
