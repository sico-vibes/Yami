// A small, built-in list of common ad and tracker domains for the Yami
// Browser. Requests to these hosts, or any of their subdomains, are cancelled
// before they leave the PC. It is deliberately short and conservative: a
// full filter list (EasyList and friends) is not shipped.

export const blockedDomains = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "adservice.google.com",
  "connect.facebook.net",
  "analytics.tiktok.com",
  "ads.linkedin.com",
  "bat.bing.com",
  "scorecardresearch.com",
  "quantserve.com",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "taboola.com",
  "outbrain.com",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "casalemedia.com",
  "amazon-adsystem.com",
  "moatads.com",
  "adsrvr.org",
  "hotjar.com",
  "mixpanel.com",
  "segment.io",
  "fullstory.com",
  "newrelic.com",
  "nr-data.net",
  "chartbeat.com",
  "yieldmo.com",
  "smartadserver.com",
  "zedo.com",
  "advertising.com",
];

const set = new Set(blockedDomains);

/** True when the host is a listed domain or one of its subdomains. */
export function isBlockedHost(host: string) {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".");
  for (let i = 0; i < parts.length - 1; i++)
    if (set.has(parts.slice(i).join("."))) return true;
  return false;
}
