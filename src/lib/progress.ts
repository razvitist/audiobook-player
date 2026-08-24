import type { Book } from "@/types";

/**
 * Estimate how far through a book the listener is. Uses real durations when
 * known, and falls back to a chapter-count estimate before metadata loads.
 */
export function bookProgress(book: Book): { fraction: number; knownTotal: number } {
  const durations = book.tracks.map((t) => t.duration ?? 0);
  const knownTotal = durations.reduce((a, b) => a + b, 0);
  const idx = book.currentTrackIndex;

  if (knownTotal > 0) {
    let elapsed = 0;
    for (let i = 0; i < idx; i++) elapsed += durations[i];
    const currentId = book.tracks[idx]?.id;
    elapsed += currentId ? (book.positions[currentId] ?? 0) : 0;
    return { fraction: Math.min(1, elapsed / knownTotal), knownTotal };
  }

  const total = book.tracks.length || 1;
  return { fraction: idx / total, knownTotal: 0 };
}
