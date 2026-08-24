import type { Book, Chapter, Track } from "@/types";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Build the chapter list for a book from its tracks and any embedded chapter
 * markers found in a single-file import (e.g. an `.m4b`).
 */
export function buildChapters(
  tracks: Track[],
  embedded?: { title: string; start: number; end?: number }[],
): Chapter[] {
  if (tracks.length === 1 && embedded && embedded.length > 0) {
    return embedded
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((c, i) => ({
        id: uid(),
        title: c.title?.trim() || `Chapter ${i + 1}`,
        trackIndex: 0,
        start: Math.max(0, c.start),
        end: c.end,
      }));
  }
  // One chapter per file.
  return tracks.map((t, i) => ({
    id: uid(),
    title: t.name,
    trackIndex: i,
    start: 0,
  }));
}

/** Index of the chapter currently playing, given the loaded track + position. */
export function currentChapterIndex(book: Book, trackIndex: number, time: number): number {
  let best = -1;
  for (let i = 0; i < book.chapters.length; i++) {
    const ch = book.chapters[i];
    if (ch.trackIndex !== trackIndex) continue;
    if (ch.start <= time + 0.001) best = i;
    else if (best !== -1) break;
  }
  if (best !== -1) return best;
  // Fall back to the first chapter of the loaded track, else 0.
  const firstOfTrack = book.chapters.findIndex((c) => c.trackIndex === trackIndex);
  return firstOfTrack === -1 ? 0 : firstOfTrack;
}

/** Duration of a chapter in seconds, when it can be determined. */
export function chapterDuration(book: Book, index: number): number | undefined {
  const ch = book.chapters[index];
  if (!ch) return undefined;
  if (ch.end != null) return Math.max(0, ch.end - ch.start);
  const next = book.chapters[index + 1];
  if (next && next.trackIndex === ch.trackIndex) return next.start - ch.start;
  const track = book.tracks[ch.trackIndex];
  if (track?.duration != null) return Math.max(0, track.duration - ch.start);
  return undefined;
}
