import http2 from "node:http2";

// DNS over HTTPS (RFC 8484) for the network shield, over HTTP/2: Quad9 does
// not answer HTTP/1.1, and one kept connection is cheaper than one per
// lookup. The connection closes after a minute without lookups.

export type Doh = (url: string, query: Buffer) => Promise<Buffer>;

export function createDoh(idle = 60_000): Doh & { close(): void } {
  let session: http2.ClientHttp2Session | undefined,
    origin = "";
  const connect = (url: URL) => {
    if (
      session &&
      !session.closed &&
      !session.destroyed &&
      origin === url.origin
    )
      return session;
    session?.close();
    origin = url.origin;
    const s = http2.connect(url.origin);
    s.on("error", () => {});
    s.setTimeout(idle, () => s.close());
    s.on("close", () => {
      if (session === s) session = undefined;
    });
    session = s;
    return s;
  };
  const doh = (url: string, query: Buffer) =>
    new Promise<Buffer>((resolve, reject) => {
      const target = new URL(url);
      const req = connect(target).request({
        ":method": "POST",
        ":path": target.pathname,
        "content-type": "application/dns-message",
        accept: "application/dns-message",
        "content-length": query.length,
      });
      const chunks: Buffer[] = [];
      let status = 0,
        size = 0;
      req.setTimeout(4000, () => req.close(http2.constants.NGHTTP2_CANCEL));
      req.on("response", (h) => (status = Number(h[":status"])));
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > 65_535) req.close(http2.constants.NGHTTP2_CANCEL);
        else chunks.push(c);
      });
      req.on("end", () =>
        status === 200 && size <= 65_535
          ? resolve(Buffer.concat(chunks))
          : reject(new Error(`The resolver answered ${status || "nothing"}.`)),
      );
      req.on("close", () => reject(new Error("The lookup was cancelled.")));
      req.on("error", reject);
      req.end(query);
    });
  return Object.assign(doh, { close: () => session?.close() });
}
