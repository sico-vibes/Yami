import { net, protocol } from "electron";
import { HEADERS, streams } from "./radio-directory";

// Internet radio from Radio Browser (radio-browser.info), a free community
// station directory with no key. Searches go out from the main process;
// a station plays through yami-radio://, which streams only stations Yami
// listed, so the windows' content policy stays closed to other hosts.

export { Radio, type Station } from "./radio-directory";

export const radioScheme = {
  scheme: "yami-radio",
  privileges: { standard: true, secure: true, stream: true },
} as const;

/** Streams a listed station; anything else is refused. */
export function handleRadio() {
  protocol.handle("yami-radio", (request) => {
    const id = new URL(request.url).hostname;
    const url = streams.get(id);
    if (!url) return new Response("Unknown station", { status: 404 });
    return net.fetch(url, { headers: HEADERS });
  });
}
