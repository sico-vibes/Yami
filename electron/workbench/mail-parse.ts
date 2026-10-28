// Reads caught mail (RFC 5322 with MIME parts) into what the inbox shows:
// headers, a plain-text body and attachment names. HTML is turned into text,
// so no remote content or script from a caught message ever loads.

export type ParsedMail = {
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  attachments: { name: string; size: number }[];
};

type Part = { headers: Record<string, string>; body: string };

function splitPart(raw: string): Part {
  const at = raw.search(/\r?\n\r?\n/);
  const head = at < 0 ? raw : raw.slice(0, at);
  const body = at < 0 ? "" : raw.slice(at).replace(/^\r?\n\r?\n/, "");
  const headers: Record<string, string> = {};
  // Folded header lines start with whitespace and continue the one above.
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0)
      headers[line.slice(0, colon).trim().toLowerCase()] = line
        .slice(colon + 1)
        .trim();
  }
  return { headers, body };
}

const param = (value: string, name: string) =>
  new RegExp(`${name}\\*?=(?:"([^"]*)"|([^;\\s]*))`, "i")
    .exec(value)
    ?.slice(1)
    .find((v) => v !== undefined) || "";

function bytesToText(bytes: Uint8Array, charset: string) {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function latin1Bytes(text: string) {
  return Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
}

function quotedPrintable(text: string) {
  const soft = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i++) {
    const hex = soft.slice(i + 1, i + 3);
    if (soft[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else bytes.push(soft.charCodeAt(i) & 0xff);
  }
  return Uint8Array.from(bytes);
}

function decodeBody(part: Part) {
  const encoding = (
    part.headers["content-transfer-encoding"] || ""
  ).toLowerCase();
  const charset = param(part.headers["content-type"] || "", "charset");
  const bytes =
    encoding === "base64"
      ? Uint8Array.from(Buffer.from(part.body.replace(/\s+/g, ""), "base64"))
      : encoding === "quoted-printable"
        ? quotedPrintable(part.body)
        : latin1Bytes(part.body);
  return { bytes, text: bytesToText(bytes, charset) };
}

/** =?charset?B|Q?...?= words in headers. */
export function decodeWords(value: string) {
  return value
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset, kind, data) => {
      const bytes =
        kind.toUpperCase() === "B"
          ? Uint8Array.from(Buffer.from(data, "base64"))
          : quotedPrintable(data.replace(/_/g, " "));
      return bytesToText(bytes, charset);
    });
}

/** Visible text of an HTML body; tags, styles and scripts are dropped. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseMail(raw: string): ParsedMail {
  const top = splitPart(raw);
  let plain = "",
    html = "";
  const attachments: ParsedMail["attachments"] = [];
  const walk = (part: Part, depth: number) => {
    const type = (part.headers["content-type"] || "text/plain").toLowerCase();
    const disposition = part.headers["content-disposition"] || "";
    const boundary = param(part.headers["content-type"] || "", "boundary");
    if (type.startsWith("multipart/") && boundary && depth < 8) {
      const pieces = part.body.split("--" + boundary);
      for (const piece of pieces.slice(1)) {
        if (piece.startsWith("--")) break;
        walk(splitPart(piece.replace(/^\r?\n/, "")), depth + 1);
      }
      return;
    }
    const name = decodeWords(
      param(disposition, "filename") ||
        param(part.headers["content-type"] || "", "name"),
    );
    if (
      /^attachment/i.test(disposition) ||
      (name && !type.startsWith("text/"))
    ) {
      attachments.push({
        name: name || "attachment",
        size: decodeBody(part).bytes.length,
      });
      return;
    }
    if (type.startsWith("text/html")) html ||= decodeBody(part).text;
    else if (type.startsWith("text/")) plain ||= decodeBody(part).text;
  };
  walk(top, 0);
  return {
    from: decodeWords(top.headers.from || ""),
    to: decodeWords(top.headers.to || ""),
    subject: decodeWords(top.headers.subject || "(no subject)"),
    date: top.headers.date || "",
    text: (plain || htmlToText(html)).trim().slice(0, 200_000),
    attachments,
  };
}
