import * as React from "react";
import { useLibrary, currentBook } from "@/store/useLibrary";
import { getBlob } from "@/lib/db";
import { currentChapterIndex } from "@/lib/chapters";
import { useWakeLock } from "@/hooks/useWakeLock";

interface AudioController {
  audioRef: React.RefObject<HTMLAudioElement>;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  /** Seek to an absolute time (seconds) in the current track. */
  seekTo: (seconds: number) => void;
  /** Skip relative to the current position (seconds, may be negative). */
  skip: (delta: number) => void;
  /** Chapter navigation (works across files and within an .m4b). */
  nextChapter: () => void;
  prevChapter: () => void;
  goToChapter: (index: number) => void;
}

const AudioContext = React.createContext<AudioController | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAudio(): AudioController {
  const ctx = React.useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within <AudioProvider>");
  return ctx;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Select the id of the track that should currently be loaded. Changing book
  // or track re-runs the load effect below.
  const activeTrackId = useLibrary((s) => {
    const b = currentBook(s);
    return b?.tracks[b.currentTrackIndex]?.id ?? null;
  });

  const volume = useLibrary((s) => s.volume);
  const muted = useLibrary((s) => s.muted);
  const playbackRate = useLibrary((s) => s.playbackRate);

  // Keep the screen awake while audio is playing.
  const isPlaying = useLibrary((s) => s.isPlaying);
  useWakeLock(isPlaying);

  // --- Load the active track's blob and wire it into the single <audio>. ---
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeTrackId) {
      audio.removeAttribute("src");
      audio.load();
      useLibrary.getState().setBuffering(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      const blob = await getBlob(activeTrackId);
      if (cancelled || !audio) return;

      const state = useLibrary.getState();
      const book = currentBook(state);
      const saved = book?.positions[activeTrackId] ?? 0;
      const wantPlay = state.isPlaying;

      if (!blob) {
        // The stored audio is gone (e.g. site data was cleared).
        state.setBuffering(false);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      audio.load();
      state.setBuffering(true);

      const onLoaded = () => {
        if (cancelled) return;
        const st = useLibrary.getState();
        // A pending chapter seek wins over the saved resume position.
        const pending = st.pendingSeek;
        const target = pending != null ? pending : saved;
        if (pending != null) st.setPendingSeek(null);
        if (target > 0 && target < (audio.duration || Infinity)) {
          audio.currentTime = target;
        }
        st.setDuration(audio.duration || 0);
        st.setTrackDuration(activeTrackId, audio.duration || 0);
        if (wantPlay) void audio.play().catch(() => {});
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeTrackId]);

  // --- Keep element properties in sync with persisted preferences. ---
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // --- Element events -> store, plus periodic progress persistence. ---
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let lastSave = 0;

    const onPlay = () => useLibrary.getState().setPlaying(true);
    const onPause = () => useLibrary.getState().setPlaying(false);
    const onWaiting = () => useLibrary.getState().setBuffering(true);
    const onPlaying = () => useLibrary.getState().setBuffering(false);
    const onCanPlay = () => useLibrary.getState().setBuffering(false);
    const onError = () => useLibrary.getState().setBuffering(false);

    const onTime = () => {
      const t = audio.currentTime;
      const st = useLibrary.getState();
      st.setCurrentTime(t);

      // Sleep timer set to "end of chapter" and the chapter boundary is known
      // (embedded .m4b markers): stop right at the boundary.
      if (st.sleepAtChapterEnd) {
        const book = currentBook(st);
        if (book) {
          const idx = currentChapterIndex(book, book.currentTrackIndex, t);
          const end = book.chapters[idx]?.end;
          if (end != null && t >= end - 0.2) {
            audio.pause();
            st.setSleepChapterEnd(false);
          }
        }
      }

      const now = performance.now();
      if (now - lastSave > 4000 && activeTrackId) {
        lastSave = now;
        st.savePosition(activeTrackId, t);
      }
    };
    const onDuration = () =>
      useLibrary.getState().setDuration(audio.duration || 0);
    const onEnded = () => {
      const st = useLibrary.getState();
      if (activeTrackId) st.savePosition(activeTrackId, 0);
      if (st.sleepAtChapterEnd) {
        st.setSleepChapterEnd(false);
        st.setPlaying(false);
        return;
      }
      st.nextTrack();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [activeTrackId]);

  // --- Persist the exact position when leaving the page. ---
  React.useEffect(() => {
    const save = () => {
      const audio = audioRef.current;
      if (audio && activeTrackId && !audio.paused) {
        useLibrary.getState().savePosition(activeTrackId, audio.currentTime);
      }
    };
    window.addEventListener("beforeunload", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [activeTrackId]);

  // --- Sleep timer: pause when the deadline passes. ---
  const sleepTimerEndsAt = useLibrary((s) => s.sleepTimerEndsAt);
  React.useEffect(() => {
    if (!sleepTimerEndsAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= sleepTimerEndsAt) {
        audioRef.current?.pause();
        useLibrary.getState().setSleepTimer(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleepTimerEndsAt]);

  // --- Chapter navigation helpers (stable). ---
  const seekToChapter = React.useCallback((index: number, autoplay: boolean) => {
    const st = useLibrary.getState();
    const book = currentBook(st);
    const ch = book?.chapters[index];
    if (!book || !ch) return;
    if (ch.trackIndex === book.currentTrackIndex) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = ch.start;
        st.setCurrentTime(ch.start);
        if (autoplay) void audio.play().catch(() => {});
      }
    } else {
      st.setPendingSeek(ch.start);
      if (autoplay) st.setPlaying(true);
      st.setTrackIndex(ch.trackIndex);
    }
  }, []);

  const currentIdx = React.useCallback(() => {
    const st = useLibrary.getState();
    const book = currentBook(st);
    if (!book) return { book: null as typeof book | null, idx: 0 };
    const t = audioRef.current?.currentTime ?? st.currentTime;
    return { book, idx: currentChapterIndex(book, book.currentTrackIndex, t) };
  }, []);

  const nextChapter = React.useCallback(() => {
    const { book, idx } = currentIdx();
    if (!book) return;
    if (idx < book.chapters.length - 1) {
      seekToChapter(idx + 1, !audioRef.current?.paused);
    }
  }, [currentIdx, seekToChapter]);

  const prevChapter = React.useCallback(() => {
    const { book, idx } = currentIdx();
    if (!book) return;
    const ch = book.chapters[idx];
    const audio = audioRef.current;
    const t = audio?.currentTime ?? 0;
    // More than 2s in: restart the current chapter; otherwise go back one.
    if (ch && t - ch.start > 2) {
      seekToChapter(idx, !audio?.paused);
    } else if (idx > 0) {
      seekToChapter(idx - 1, !audio?.paused);
    } else {
      seekToChapter(0, !audio?.paused);
    }
  }, [currentIdx, seekToChapter]);

  const goToChapter = React.useCallback(
    (index: number) => seekToChapter(index, true),
    [seekToChapter],
  );

  // --- Media Session: OS media keys / lock-screen controls. ---
  const bookTitle = useLibrary((s) => currentBook(s)?.title);
  const bookAuthor = useLibrary((s) => currentBook(s)?.author);
  const cover = useLibrary((s) => currentBook(s)?.cover);
  React.useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!bookTitle) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: bookTitle,
      artist: bookAuthor || "Audiobook",
      album: bookTitle,
      artwork: cover ? [{ src: cover, sizes: "512x512" }] : [],
    });
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => audioRef.current?.play());
    ms.setActionHandler("pause", () => audioRef.current?.pause());
    ms.setActionHandler("seekbackward", () => {
      if (audioRef.current) audioRef.current.currentTime -= 15;
    });
    ms.setActionHandler("seekforward", () => {
      if (audioRef.current) audioRef.current.currentTime += 30;
    });
    ms.setActionHandler("previoustrack", prevChapter);
    ms.setActionHandler("nexttrack", nextChapter);
  }, [bookTitle, bookAuthor, cover, prevChapter, nextChapter]);

  const controller = React.useMemo<AudioController>(
    () => ({
      audioRef,
      play: () => void audioRef.current?.play().catch(() => {}),
      pause: () => audioRef.current?.pause(),
      togglePlay: () => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        if (audio.paused) void audio.play().catch(() => {});
        else audio.pause();
      },
      seekTo: (seconds) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
        useLibrary.getState().setCurrentTime(audio.currentTime);
      },
      skip: (delta) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(
          0,
          Math.min(audio.currentTime + delta, audio.duration || Infinity),
        );
        useLibrary.getState().setCurrentTime(audio.currentTime);
      },
      nextChapter,
      prevChapter,
      goToChapter,
    }),
    [nextChapter, prevChapter, goToChapter],
  );

  return (
    <AudioContext.Provider value={controller}>
      {children}
      {/* The single <audio> element that powers the whole player. */}
      <audio ref={audioRef} preload="metadata" />
    </AudioContext.Provider>
  );
}
