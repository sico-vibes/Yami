import { crc32, deflateRawSync, gunzipSync, gzipSync, inflateRawSync } from "node:zlib";

export type ArchiveEntry = { name: string; data: Buffer };

function safeName(name: string) {
  const cleaned = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !cleaned ||
    cleaned.startsWith("/") ||
    /^[A-Za-z]:/.test(cleaned) ||
    cleaned.split("/").includes("..")
  )
    throw new Error("The archive contains an unsafe path.");
  return cleaned;
}

export function packZip(entries: ArchiveEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(safeName(entry.name));
    const data = deflateRawSync(entry.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(entry.data) >>> 0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(entry.data) >>> 0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function unpackZip(buffer: Buffer): ArchiveEntry[] {
  let end = -1;
  const start = Math.max(0, buffer.length - 66_000);
  for (let index = buffer.length - 22; index >= start; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("That zip file is not readable.");
  const count = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries: ArchiveEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("That zip file is not readable.");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localAt = buffer.readUInt32LE(cursor + 42);
    const name = safeName(buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength));
    const localName = buffer.readUInt16LE(localAt + 26);
    const localExtra = buffer.readUInt16LE(localAt + 28);
    const dataAt = localAt + 30 + localName + localExtra;
    const raw = buffer.subarray(dataAt, dataAt + compressed);
    const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw new Error("That zip uses a compression method Yami cannot read.");
    if (!name.endsWith("/")) entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function octal(buffer: Buffer, offset: number, length: number) {
  const text = buffer.toString("utf8", offset, offset + length).replace(/\0.*$/, "").trim();
  return text ? parseInt(text, 8) : 0;
}

export function packTar(entries: ArchiveEntry[]) {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const name = safeName(entry.name);
    const header = Buffer.alloc(512);
    header.write(name.slice(0, 100), 0, "utf8");
    header.write(0o644.toString(8).padStart(6, "0"), 100, "utf8");
    header.write("\0", 106, "utf8");
    header.write("000000\0", 108, "utf8");
    header.write("000000\0", 116, "utf8");
    header.write(entry.data.length.toString(8).padStart(11, "0"), 124, "utf8");
    header.write("\0", 135, "utf8");
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0"), 136, "utf8");
    header.write("\0", 147, "utf8");
    header.fill(0x20, 148, 156);
    header[156] = 48;
    header.write("ustar\0", 257, "binary");
    header.write("00", 263, "binary");
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(sum.toString(8).padStart(6, "0"), 148, "utf8");
    header[154] = 0;
    header[155] = 0x20;
    chunks.push(header, entry.data, Buffer.alloc((512 - (entry.data.length % 512)) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

export function unpackTar(buffer: Buffer): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const shortName = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const name = safeName(prefix ? `${prefix}/${shortName}` : shortName);
    const size = octal(header, 124, 12);
    const kind = header[156];
    const data = Buffer.from(buffer.subarray(offset + 512, offset + 512 + size));
    if ((kind === 0 || kind === 48) && !name.endsWith("/")) entries.push({ name, data });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export const packGzip = (buffer: Buffer) => gzipSync(buffer);
export const unpackGzip = (buffer: Buffer) => gunzipSync(buffer);
