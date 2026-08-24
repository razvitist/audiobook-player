import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Book } from "@/types";
import { parseImport } from "@/lib/import";
import { buildChapters } from "@/lib/chapters";
import { putBlob, getBlob, deleteBlob } from "@/lib/db";

interface LibraryState {
  books: Book[];
  currentBookId: string | null;

  // Persisted player preferences.
  volume: number;
  playbackRate: number;
  muted: boolean;

  // Transient playback state (driven by the <audio> element).
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  sleepTimerEndsAt: number | null;
  sleepAtChapterEnd: boolean;
  /** Seek target to apply right after the next track finishes loading. */
  pendingSeek: number | null;

  // Import / library management.
  importFiles: (files: FileList | File[]) => Promise<number>;
  removeBook: (bookId: string) => Promise<void>;
  openBook: (bookId: string) => void;
  hydrate: () => Promise<void>;

  // Navigation within the current book.
  setTrackIndex: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // Progress + preferences.
  savePosition: (trackId: string, seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  setPlaybackRate: (r: number) => void;

  // Setters used by the audio engine.
  setPlaying: (playing: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setTrackDuration: (trackId: string, d: number) => void;
  setPendingSeek: (seconds: number | null) => void;

  // Sleep timer.
  setSleepTimer: (minutesFromNow: number | null) => void;
  setSleepChapterEnd: (enabled: boolean) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      currentBookId: null,
      volume: 1,
      playbackRate: 1,
      muted: false,
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      sleepTimerEndsAt: null,
      sleepAtChapterEnd: false,
      pendingSeek: null,

      importFiles: async (files) => {
        const parsed = await parseImport(files);
        for (const { book, blobs, coverBlob } of parsed) {
          for (const [trackId, file] of blobs) {
            await putBlob(trackId, file);
          }
          if (coverBlob && book.coverKey) {
            await putBlob(book.coverKey, coverBlob);
            book.cover = URL.createObjectURL(coverBlob);
          }
        }
        const newBooks = parsed.map((p) => p.book);
        set((s) => ({ books: [...newBooks, ...s.books] }));
        // Auto-open the first freshly imported book if nothing is playing.
        if (!get().currentBookId && newBooks[0]) {
          set({ currentBookId: newBooks[0].id });
        }
        return newBooks.length;
      },

      removeBook: async (bookId) => {
        const book = get().books.find((b) => b.id === bookId);
        if (book) {
          for (const t of book.tracks) await deleteBlob(t.id);
          if (book.coverKey) await deleteBlob(book.coverKey);
          if (book.cover) URL.revokeObjectURL(book.cover);
        }
        set((s) => ({
          books: s.books.filter((b) => b.id !== bookId),
          currentBookId: s.currentBookId === bookId ? null : s.currentBookId,
          isPlaying: s.currentBookId === bookId ? false : s.isPlaying,
        }));
      },

      openBook: (bookId) => {
        if (get().currentBookId === bookId) return;
        set({ currentBookId: bookId, currentTime: 0, duration: 0, pendingSeek: null });
      },

      hydrate: async () => {
        // 1) Backfill chapters for books persisted before chapter support.
        set((s) => ({
          books: s.books.map((b) =>
            b.chapters && b.chapters.length
              ? b
              : { ...b, chapters: buildChapters(b.tracks) },
          ),
        }));
        // 2) Rebuild cover object-URLs from IndexedDB after a reload.
        const updates: Record<string, string> = {};
        for (const book of get().books) {
          if (book.coverKey && !book.cover) {
            const blob = await getBlob(book.coverKey);
            if (blob) updates[book.id] = URL.createObjectURL(blob);
          }
        }
        if (Object.keys(updates).length) {
          set((s) => ({
            books: s.books.map((b) =>
              updates[b.id] ? { ...b, cover: updates[b.id] } : b,
            ),
          }));
        }
      },

      setTrackIndex: (index) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === s.currentBookId
              ? { ...b, currentTrackIndex: clamp(index, 0, b.tracks.length - 1) }
              : b,
          ),
          currentTime: 0,
          duration: 0,
        }));
      },

      nextTrack: () => {
        const book = currentBook(get());
        if (!book) return;
        if (book.currentTrackIndex < book.tracks.length - 1) {
          get().setTrackIndex(book.currentTrackIndex + 1);
        } else {
          set({ isPlaying: false });
        }
      },

      prevTrack: () => {
        const book = currentBook(get());
        if (!book) return;
        get().setTrackIndex(Math.max(0, book.currentTrackIndex - 1));
      },

      savePosition: (trackId, seconds) => {
        set((s) => ({
          books: s.books.map((b) =>
            b.id === s.currentBookId
              ? { ...b, positions: { ...b.positions, [trackId]: seconds } }
              : b,
          ),
        }));
      },

      setVolume: (v) => set({ volume: clamp(v, 0, 1), muted: v === 0 ? get().muted : false }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
      setPlaybackRate: (r) => set({ playbackRate: r }),

      setPlaying: (playing) => set({ isPlaying: playing }),
      setBuffering: (buffering) => set({ isBuffering: buffering }),
      setCurrentTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),
      setPendingSeek: (seconds) => set({ pendingSeek: seconds }),

      setTrackDuration: (trackId, d) => {
        set((s) => ({
          books: s.books.map((b) => ({
            ...b,
            tracks: b.tracks.map((t) =>
              t.id === trackId && !t.duration ? { ...t, duration: d } : t,
            ),
          })),
        }));
      },

      setSleepTimer: (minutesFromNow) =>
        set({
          sleepTimerEndsAt:
            minutesFromNow == null ? null : Date.now() + minutesFromNow * 60_000,
          sleepAtChapterEnd: false,
        }),

      setSleepChapterEnd: (enabled) =>
        set({ sleepAtChapterEnd: enabled, sleepTimerEndsAt: null }),
    }),
    {
      name: "audiobook-player:library",
      storage: createJSONStorage(() => localStorage),
      // Only persist metadata + preferences. Blobs live in IndexedDB, and the
      // runtime `cover` object-URLs / transient playback state are excluded.
      partialize: (s) => ({
        books: s.books.map(({ cover: _cover, ...rest }) => rest),
        currentBookId: s.currentBookId,
        volume: s.volume,
        playbackRate: s.playbackRate,
        muted: s.muted,
      }),
    },
  ),
);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function currentBook(s: LibraryState): Book | undefined {
  return s.books.find((b) => b.id === s.currentBookId);
}

export function useCurrentBook(): Book | undefined {
  return useLibrary((s) => s.books.find((b) => b.id === s.currentBookId));
}
