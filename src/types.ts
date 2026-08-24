export interface Track {
  id: string;
  /** Display name (usually derived from the file name, sans extension). */
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** Duration in seconds; filled in lazily once the audio metadata loads. */
  duration?: number;
}

/**
 * A navigable chapter. It points at a track (audio file) and a time range
 * within it — so a multi-file book has one chapter per file, while a single
 * `.m4b` with embedded markers has many chapters that share one file.
 */
export interface Chapter {
  id: string;
  title: string;
  /** Index into Book.tracks of the file this chapter lives in. */
  trackIndex: number;
  /** Start offset within the file, in seconds. */
  start: number;
  /** End offset within the file, in seconds (when known). */
  end?: number;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  tracks: Track[];
  /** Ordered chapters spanning the whole book. */
  chapters: Chapter[];
  addedAt: number;
  /** Index of the track (file) currently loaded in the audio element. */
  currentTrackIndex: number;
  /** Playback position (seconds) per track id, so resume is exact. */
  positions: Record<string, number>;
  /** IndexedDB key for the cover blob (persisted). */
  coverKey?: string;
  /** Runtime object-URL for the cover image; not persisted, rebuilt on load. */
  cover?: string;
}
