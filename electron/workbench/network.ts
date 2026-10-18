export function serverUrl(value: string, allowLocal = true) {
  const url = new URL(value);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    [...url.searchParams.keys()].some((key) =>
      /key|token|secret|password/i.test(key),
    )
  )
    throw new Error(
      "Put credentials in the credential field, not the server URL.",
    );
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(allowLocal && local && url.protocol === "http:"))
  )
    throw new Error(
      "Use HTTPS, or HTTP for a server on this PC. Keep credentials out of the URL.",
    );
  return url;
}
export async function boundedText(response: Response, max = 2097152) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  let bytes = 0,
    text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > max)
        throw new Error("The server response exceeded its limit.");
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export async function requestJson(
  url: string,
  key: string,
  options: RequestInit = {},
  customHeaders: Record<string, string> = {},
) {
  serverUrl(url);
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    headers: {
      Accept: "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...customHeaders,
    },
    signal: options.signal || AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? "This credential was rejected. Reconnect the account."
        : response.status === 403
          ? "The credential does not have access to this resource."
          : response.status === 429
            ? "The server requested a refresh pause."
            : `The server returned HTTP ${response.status}.`,
    ) as Error & { retryAt?: number };
    if (response.status === 429) {
      const retry = response.headers.get("retry-after") || "60";
      error.retryAt = /^\d+$/.test(retry)
        ? Date.now() + Math.max(60, Number(retry)) * 1000
        : Math.max(Date.now() + 60000, Date.parse(retry) || 0);
    }
    await response.body?.cancel();
    throw error;
  }
  return JSON.parse(await boundedText(response));
}
