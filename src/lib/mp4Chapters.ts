/**
 * Robust MP4/M4B chapter extraction.
 *
 * `music-metadata` only scans MP4 chapters when the `moov` atom happens to
 * precede `mdat`, and even then trips over common chapter-track layouts. Real
 * `.m4b` audiobooks put `moov` at either end, so we parse the boxes ourselves
 * using random-access Blob reads:
 *
 *   1. Scan the top-level boxes (cheap header reads) to locate `moov`.
 *   2. Read the whole `moov` into memory and walk its tracks.
 *   3. Find the QuickTime chapter text-track referenced by the audio track's
 *      `tref/chap`, read its sample tables, and pull the chapter titles + times
 *      out of `mdat` (small, targeted reads).
 *
 * Falls back to Nero-style `chpl` chapters when present. Any failure returns
 * null so the caller can degrade gracefully.
 */

export interface EmbeddedChapter {
  title: string;
  start: number;
  end?: number;
}

const MP4_EXT = ["m4b", "m4a", "mp4", "m4p", "m4v"];

export function isMp4File(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MP4_EXT.includes(ext) || /mp4|m4a|m4b/.test(file.type);
}

const TXT = new TextDecoder("utf-8");
const boxType = (v: DataView, o: number) =>
  String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));

interface BoxRef {
  type: string;
  /** Offset of the box header (from the start of the buffer). */
  start: number;
  /** Offset of the box payload. */
  dataStart: number;
  /** Offset just past the box. */
  end: number;
}

/** Iterate the child boxes contained in [start, end) of an in-memory buffer. */
function* boxes(view: DataView, start: number, end: number): Generator<BoxRef> {
  let o = start;
  while (o + 8 <= end) {
    let size = view.getUint32(o);
    const type = boxType(view, o + 4);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit largesize
      size = Number(view.getBigUint64(o + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < headerSize || o + size > end) break;
    yield { type, start: o, dataStart: o + headerSize, end: o + size };
    o += size;
  }
}

function firstBox(view: DataView, start: number, end: number, type: string): BoxRef | null {
  for (const b of boxes(view, start, end)) if (b.type === type) return b;
  return null;
}

/** Locate a top-level box in the file with cheap 16-byte header reads. */
async function findTopLevelBox(
  file: Blob,
  type: string,
): Promise<{ offset: number; size: number; dataStart: number } | null> {
  let offset = 0;
  const total = file.size;
  while (offset + 8 <= total) {
    const head = new DataView(await file.slice(offset, offset + 16).arrayBuffer());
    let size = head.getUint32(0);
    const t = boxType(head, 4);
    let headerSize = 8;
    if (size === 1) {
      size = Number(head.getBigUint64(8));
      headerSize = 16;
    } else if (size === 0) {
      size = total - offset;
    }
    if (size < headerSize) return null;
    if (t === type) return { offset, size, dataStart: offset + headerSize };
    offset += size;
  }
  return null;
}

interface TrackTables {
  trackId: number;
  handler?: string;
  chapRefs: number[];
  timescale: number;
  stts: { count: number; delta: number }[];
  stsc: { firstChunk: number; samplesPerChunk: number }[];
  chunkOffsets: number[];
  sampleSizes: number[];
}

function parseTrack(view: DataView, trak: BoxRef): TrackTables | null {
  const tkhd = firstBox(view, trak.dataStart, trak.end, "tkhd");
  const mdia = firstBox(view, trak.dataStart, trak.end, "mdia");
  if (!tkhd || !mdia) return null;

  const tkhdVer = view.getUint8(tkhd.dataStart);
  const trackId =
    tkhdVer === 1
      ? view.getUint32(tkhd.dataStart + 4 + 8 + 8)
      : view.getUint32(tkhd.dataStart + 4 + 4 + 4);

  const track: TrackTables = {
    trackId,
    chapRefs: [],
    timescale: 0,
    stts: [],
    stsc: [],
    chunkOffsets: [],
    sampleSizes: [],
  };

  // tref/chap: chapter track references
  const tref = firstBox(view, trak.dataStart, trak.end, "tref");
  if (tref) {
    const chap = firstBox(view, tref.dataStart, tref.end, "chap");
    if (chap) {
      for (let o = chap.dataStart; o + 4 <= chap.end; o += 4) {
        track.chapRefs.push(view.getUint32(o));
      }
    }
  }

  const mdhd = firstBox(view, mdia.dataStart, mdia.end, "mdhd");
  if (mdhd) {
    const ver = view.getUint8(mdhd.dataStart);
    track.timescale =
      ver === 1
        ? view.getUint32(mdhd.dataStart + 4 + 8 + 8)
        : view.getUint32(mdhd.dataStart + 4 + 4 + 4);
  }

  const hdlr = firstBox(view, mdia.dataStart, mdia.end, "hdlr");
  if (hdlr) track.handler = boxType(view, hdlr.dataStart + 8);

  const minf = firstBox(view, mdia.dataStart, mdia.end, "minf");
  const stbl = minf && firstBox(view, minf.dataStart, minf.end, "stbl");
  if (!stbl) return track;

  const stts = firstBox(view, stbl.dataStart, stbl.end, "stts");
  if (stts) {
    const n = view.getUint32(stts.dataStart + 4);
    let o = stts.dataStart + 8;
    for (let i = 0; i < n; i++, o += 8) {
      track.stts.push({ count: view.getUint32(o), delta: view.getUint32(o + 4) });
    }
  }

  const stsc = firstBox(view, stbl.dataStart, stbl.end, "stsc");
  if (stsc) {
    const n = view.getUint32(stsc.dataStart + 4);
    let o = stsc.dataStart + 8;
    for (let i = 0; i < n; i++, o += 12) {
      track.stsc.push({
        firstChunk: view.getUint32(o),
        samplesPerChunk: view.getUint32(o + 4),
      });
    }
  }

  const stco = firstBox(view, stbl.dataStart, stbl.end, "stco");
  const co64 = firstBox(view, stbl.dataStart, stbl.end, "co64");
  if (stco) {
    const n = view.getUint32(stco.dataStart + 4);
    let o = stco.dataStart + 8;
    for (let i = 0; i < n; i++, o += 4) track.chunkOffsets.push(view.getUint32(o));
  } else if (co64) {
    const n = view.getUint32(co64.dataStart + 4);
    let o = co64.dataStart + 8;
    for (let i = 0; i < n; i++, o += 8) track.chunkOffsets.push(Number(view.getBigUint64(o)));
  }

  const stsz = firstBox(view, stbl.dataStart, stbl.end, "stsz");
  if (stsz) {
    const uniform = view.getUint32(stsz.dataStart + 4);
    const count = view.getUint32(stsz.dataStart + 8);
    if (uniform > 0) {
      track.sampleSizes = new Array(count).fill(uniform);
    } else {
      let o = stsz.dataStart + 12;
      for (let i = 0; i < count; i++, o += 4) track.sampleSizes.push(view.getUint32(o));
    }
  }

  return track;
}

/** Absolute file offset of every sample, using the chunk/sample tables. */
function sampleOffsets(track: TrackTables): number[] {
  const numChunks = track.chunkOffsets.length;
  const perChunk = new Array<number>(numChunks).fill(0);
  for (let i = 0; i < track.stsc.length; i++) {
    const start = track.stsc[i].firstChunk;
    const end = i + 1 < track.stsc.length ? track.stsc[i + 1].firstChunk : numChunks + 1;
    for (let c = start; c < end; c++) if (c - 1 < numChunks) perChunk[c - 1] = track.stsc[i].samplesPerChunk;
  }
  const offsets: number[] = [];
  let sample = 0;
  for (let c = 0; c < numChunks; c++) {
    let off = track.chunkOffsets[c];
    for (let s = 0; s < perChunk[c]; s++) {
      offsets.push(off);
      off += track.sampleSizes[sample] ?? 0;
      sample++;
    }
  }
  return offsets;
}

/** Per-sample start time in seconds, from the time-to-sample table. */
function sampleStarts(track: TrackTables): number[] {
  const starts: number[] = [];
  const scale = track.timescale || 1000;
  let t = 0;
  for (const e of track.stts) {
    for (let i = 0; i < e.count; i++) {
      starts.push(t / scale);
      t += e.delta;
    }
  }
  return starts;
}

function decodeTitle(buf: ArrayBuffer, offset: number): string {
  const view = new DataView(buf, offset);
  const len = view.getUint16(0);
  const bytes = new Uint8Array(buf, offset + 2, Math.min(len, buf.byteLength - offset - 2));
  if (bytes.length >= 2 && ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0xff && bytes[1] === 0xfe))) {
    const le = bytes[0] === 0xff;
    return new TextDecoder(le ? "utf-16le" : "utf-16be").decode(bytes.subarray(2));
  }
  return TXT.decode(bytes);
}

function parseNeroChapters(view: DataView, moov: BoxRef): EmbeddedChapter[] | null {
  const udta = firstBox(view, moov.dataStart, moov.end, "udta");
  if (!udta) return null;
  const chpl = firstBox(view, udta.dataStart, udta.end, "chpl");
  if (!chpl) return null;
  // version(1) flags(3) reserved(1) count(1|4)
  let o = chpl.dataStart + 4;
  const version = view.getUint8(chpl.dataStart);
  o += 1; // reserved
  let count: number;
  if (version === 1) {
    count = view.getUint32(o);
    o += 4;
  } else {
    count = view.getUint8(o);
    o += 1;
  }
  const chapters: EmbeddedChapter[] = [];
  for (let i = 0; i < count && o + 9 <= chpl.end; i++) {
    const start = Number(view.getBigUint64(o)) / 10_000_000; // 100ns units
    o += 8;
    const titleLen = view.getUint8(o);
    o += 1;
    const bytes = new Uint8Array(view.buffer, view.byteOffset + o, titleLen);
    chapters.push({ title: TXT.decode(bytes).trim(), start });
    o += titleLen;
  }
  return chapters.length ? withEnds(chapters) : null;
}

function withEnds(chapters: EmbeddedChapter[]): EmbeddedChapter[] {
  return chapters
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c, i, arr) => ({ ...c, end: arr[i + 1]?.start }));
}

export async function parseMp4Chapters(file: Blob): Promise<EmbeddedChapter[] | null> {
  try {
    const moovLoc = await findTopLevelBox(file, "moov");
    if (!moovLoc) return null;
    const moovBuf = await file
      .slice(moovLoc.offset, moovLoc.offset + moovLoc.size)
      .arrayBuffer();
    const view = new DataView(moovBuf);
    // The read starts at the moov header, so treat the buffer as one box.
    const moov: BoxRef = {
      type: "moov",
      start: 0,
      dataStart: moovLoc.dataStart - moovLoc.offset,
      end: moovLoc.size,
    };

    const tracks: TrackTables[] = [];
    for (const trak of boxes(view, moov.dataStart, moov.end)) {
      if (trak.type !== "trak") continue;
      const t = parseTrack(view, trak);
      if (t) tracks.push(t);
    }

    // Prefer the QuickTime chapter text-track referenced via tref/chap.
    const refIds = new Set<number>();
    for (const t of tracks) t.chapRefs.forEach((id) => refIds.add(id));
    let chapterTrack =
      tracks.find((t) => refIds.has(t.trackId)) ??
      tracks.find((t) => t.handler === "text" || t.handler === "sbtl");

    if (chapterTrack && chapterTrack.chunkOffsets.length && chapterTrack.sampleSizes.length) {
      const offsets = sampleOffsets(chapterTrack);
      const starts = sampleStarts(chapterTrack);
      const count = Math.min(offsets.length, chapterTrack.sampleSizes.length);
      if (count > 0) {
        // Read the (small) span covering all chapter samples in one go.
        let min = Infinity;
        let max = 0;
        for (let i = 0; i < count; i++) {
          min = Math.min(min, offsets[i]);
          max = Math.max(max, offsets[i] + chapterTrack.sampleSizes[i]);
        }
        const buf = await file.slice(min, max).arrayBuffer();
        const chapters: EmbeddedChapter[] = [];
        for (let i = 0; i < count; i++) {
          const rel = offsets[i] - min;
          if (rel + 2 > buf.byteLength) continue;
          const title = decodeTitle(buf, rel).trim();
          chapters.push({ title: title || `Chapter ${i + 1}`, start: starts[i] ?? 0 });
        }
        if (chapters.length) return withEnds(chapters);
      }
    }

    // Fallback: Nero chpl list.
    return parseNeroChapters(view, moov);
  } catch {
    return null;
  }
}
