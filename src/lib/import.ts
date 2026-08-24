import type { Book, Track } from "@/types";
import { readTags } from "@/lib/metadata";
import { buildChapters } from "@/lib/chapters";
import { parseMp4Chapters, isMp4File } from "@/lib/mp4Chapters";

const AUDIO_EXT = [
  "mp3", "m4a", "m4b", "aac", "ogg", "oga", "opus",
  "wav", "flac", "webm", "mp4",
];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

const isAudio = (f: File) =>
  AUDIO_EXT.includes(ext(f.name)) || f.type.startsWith("audio/");
const isImage = (f: File) =>
  IMAGE_EXT.includes(ext(f.name)) || f.type.startsWith("image/");

/** Natural ordering so "Chapter 2" sorts before "Chapter 10". */
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** A file's containing folder from webkitRelativePath, or "" for loose files. */
function folderOf(f: File): string {
  const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!rel) return "";
  const parts = rel.split("/");
  parts.pop(); // drop file name
  return parts.join("/");
}

/** Prettify a folder/file title: replace separators, trim noise. */
function prettify(raw: string): string {
  return raw
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ParsedImport {
  book: Book;
  /** track id -> original File, to be persisted as a blob. */
  blobs: Map<string, File>;
  /** Cover image file to persist under book.coverKey, if any. */
  coverBlob?: File;
}

/**
 * Turn a selection of files into one or more books.
 *
 * - Folder imports group by the deepest common folder: each folder that
 *   directly contains audio becomes a book, with its files as ordered tracks.
 * - Loose-file imports (no folder info) collapse into a single book.
 */
export async function parseImport(fileList: FileList | File[]): Promise<ParsedImport[]> {
  const files = Array.from(fileList);
  const audio = files.filter(isAudio);
  const images = files.filter(isImage);
  if (audio.length === 0) return [];

  // Group audio files by their containing folder.
  const groups = new Map<string, File[]>();
  for (const f of audio) {
    const key = folderOf(f);
    const arr = groups.get(key) ?? [];
    arr.push(f);
    groups.set(key, arr);
  }

  const results: ParsedImport[] = [];

  for (const [folder, groupFiles] of groups) {
    const sorted = groupFiles.sort((a, b) => naturalCompare(a.name, b.name));
    const blobs = new Map<string, File>();

    const tracks: Track[] = sorted.map((f) => {
      const id = uid();
      blobs.set(id, f);
      return {
        id,
        name: prettify(stripExt(f.name)),
        fileName: f.name,
        mimeType: f.type || `audio/${ext(f.name)}`,
        size: f.size,
      };
    });

    // Read embedded tags from the first file for author + cover fallback.
    const tags = await readTags(sorted[0]);

    // Embedded chapters: for a single-file audiobook, prefer our robust MP4
    // parser (handles .m4b regardless of atom order), then fall back to any
    // chapters music-metadata surfaced (e.g. ID3 CHAP for MP3).
    let embeddedChapters = tags?.chapters;
    if (sorted.length === 1) {
      if (isMp4File(sorted[0])) {
        const mp4Chapters = await parseMp4Chapters(sorted[0]);
        if (mp4Chapters && mp4Chapters.length) embeddedChapters = mp4Chapters;
      }
    }

    // Cover art: prefer an image file in the folder, else the embedded artwork.
    const folderImages = images.filter((img) => folderOf(img) === folder);
    const coverBlob =
      folderImages.find((i) => /cover|folder|front|art/i.test(i.name)) ??
      folderImages[0] ??
      tags?.cover;

    const folderName = folder.split("/").pop() ?? "";
    const title =
      (folderName && prettify(folderName)) ||
      tags?.album ||
      (audio.length === 1 && tags?.title) ||
      (audio.length === 1 ? prettify(stripExt(sorted[0].name)) : "Imported audiobook");

    const bookId = uid();
    const book: Book = {
      id: bookId,
      title,
      author: tags?.artist,
      tracks,
      chapters: buildChapters(tracks, embeddedChapters),
      addedAt: Date.now(),
      currentTrackIndex: 0,
      positions: {},
      coverKey: coverBlob ? `cover:${bookId}` : undefined,
    };

    results.push({ book, blobs, coverBlob });
  }

  return results;
}
