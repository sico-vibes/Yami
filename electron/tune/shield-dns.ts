// DNS messages for the network shield (RFC 1035): just enough to read the
// question of a query and to answer it locally. Everything Yami does not
// answer itself is forwarded unchanged.

export type Question = {
  id: number;
  /** Lower-case name without the trailing dot. */
  name: string;
  type: number;
  /** Offset just after the question, where answers begin. */
  end: number;
  /** Largest UDP answer the asker accepts (EDNS), at least 512. */
  udpSize: number;
};

export const typeName: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  64: "SVCB",
  65: "HTTPS",
};

/** The single question of a standard query, or undefined for anything else. */
export function readQuestion(msg: Buffer): Question | undefined {
  if (msg.length < 17) return undefined;
  const flags = msg.readUInt16BE(2);
  // A response, or an opcode other than QUERY.
  if (flags & 0x8000 || (flags >> 11) & 0xf) return undefined;
  if (msg.readUInt16BE(4) !== 1) return undefined;
  const labels: string[] = [];
  let at = 12;
  for (;;) {
    if (at >= msg.length) return undefined;
    const len = msg[at];
    if (len === 0) {
      at++;
      break;
    }
    // Compression never appears in a question we accept.
    if (len > 63 || at + 1 + len > msg.length) return undefined;
    labels.push(msg.toString("latin1", at + 1, at + 1 + len));
    at += 1 + len;
    if (labels.length > 127) return undefined;
  }
  if (at + 4 > msg.length) return undefined;
  const type = msg.readUInt16BE(at);
  const end = at + 4;
  let udpSize = 512;
  // An OPT record in the additional section carries the EDNS size.
  if (msg.readUInt16BE(6) === 0 && msg.readUInt16BE(8) === 0) {
    let p = end;
    for (let i = 0; i < msg.readUInt16BE(10) && p + 11 <= msg.length; i++) {
      if (msg[p] !== 0) break;
      const rtype = msg.readUInt16BE(p + 1);
      if (rtype === 41) udpSize = Math.max(512, msg.readUInt16BE(p + 3));
      p += 11 + msg.readUInt16BE(p + 9);
    }
  }
  return {
    id: msg.readUInt16BE(0),
    name: labels.join(".").toLowerCase(),
    type,
    end,
    udpSize,
  };
}

/** A reply with only the header and question; rcode 0 = no error. */
function header(query: Buffer, q: Question, rcode: number, answers: number) {
  const out = Buffer.alloc(q.end);
  query.copy(out, 0, 0, q.end);
  // QR, the asker's opcode and RD, RA, and the result code.
  out.writeUInt16BE(0x8080 | (query.readUInt16BE(2) & 0x7900) | rcode, 2);
  out.writeUInt16BE(1, 4);
  out.writeUInt16BE(answers, 6);
  out.writeUInt16BE(0, 8);
  out.writeUInt16BE(0, 10);
  return out;
}

/**
 * The answer for a blocked name: 0.0.0.0 or :: for address lookups, so apps
 * fail at once instead of retrying, and an empty answer for other types.
 */
export function blockedReply(query: Buffer, q: Question) {
  const size = q.type === 1 ? 4 : q.type === 28 ? 16 : 0;
  const head = header(query, q, 0, size ? 1 : 0);
  if (!size) return head;
  const answer = Buffer.alloc(12 + size);
  answer.writeUInt16BE(0xc00c, 0); // the name in the question
  answer.writeUInt16BE(q.type, 2);
  answer.writeUInt16BE(1, 4); // IN
  answer.writeUInt32BE(60, 6);
  answer.writeUInt16BE(size, 10);
  return Buffer.concat([head, answer]);
}

export const failReply = (query: Buffer, q: Question) => header(query, q, 2, 0);
export const missingReply = (query: Buffer, q: Question) =>
  header(query, q, 3, 0);

/** An upstream answer for the asker: its own id, cut to its UDP size. */
export function relay(
  answer: Buffer,
  query: Buffer,
  q: Question,
  udp: boolean,
) {
  const out = Buffer.from(answer);
  out.writeUInt16BE(q.id, 0);
  if (!udp || out.length <= q.udpSize) return out;
  // Too big for UDP: the truncated flag makes the asker retry over TCP.
  const cut = header(query, q, out.readUInt16BE(2) & 0xf, 0);
  cut.writeUInt16BE(cut.readUInt16BE(2) | 0x0200, 2);
  return cut;
}

const privateReverse =
  /(^|\.)(10|127|(1[6-9]|2\d|3[01])\.172|168\.192|254\.169)\.in-addr\.arpa$/;

/**
 * Names that only mean something on this network. They never go to a public
 * resolver; Windows finds them itself by other means.
 */
export function localOnly(name: string) {
  return (
    !name.includes(".") ||
    /\.(local|lan|home|internal|localdomain|home\.arpa)$/.test(name) ||
    privateReverse.test(name) ||
    name === "localhost" ||
    name.endsWith(".localhost")
  );
}
