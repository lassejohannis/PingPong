import { Readable } from "stream";
import { createInflate } from "zlib";
import { Buffer } from "buffer";

/**
 * Extract text from XML files inside a ZIP archive (PPTX, DOCX).
 * Strips all XML tags and returns plain text.
 */
export async function extractXmlText(
  zipBuffer: Buffer,
  filePattern: RegExp
): Promise<string> {
  const entries = parseZipEntries(zipBuffer);
  const texts: string[] = [];

  for (const entry of entries) {
    if (!filePattern.test(entry.name)) continue;

    const xmlContent = await decompressEntry(zipBuffer, entry);
    // Strip XML tags, decode entities, normalize whitespace
    const text = xmlContent
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text) texts.push(text);
  }

  return texts.join("\n\n");
}

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  dataOffset: number;
}

function parseZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];

  // Find End of Central Directory record
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return entries;

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const cdEntries = buffer.readUInt16LE(eocdOffset + 10);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf-8", offset + 46, offset + 46 + nameLength);

    // Calculate actual data offset from local header
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;

    entries.push({ name, compressedSize, uncompressedSize, compressionMethod, dataOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function decompressEntry(buffer: Buffer, entry: ZipEntry): Promise<string> {
  const raw = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return Promise.resolve(raw.toString("utf-8"));
  }

  // Deflated
  return new Promise((resolve, reject) => {
    const inflate = createInflate({ finishFlush: 2 }); // Z_SYNC_FLUSH
    const chunks: Buffer[] = [];

    inflate.on("data", (chunk: Buffer) => chunks.push(chunk));
    inflate.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    inflate.on("error", reject);

    const readable = new Readable();
    readable.push(raw);
    readable.push(null);
    readable.pipe(inflate);
  });
}
