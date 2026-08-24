import * as React from "react";
import { useAudio } from "@/audio/AudioProvider";
import { useLibrary } from "@/store/useLibrary";

/** Global playback shortcuts, ignored while typing in inputs. */
export function useKeyboardShortcuts() {
  const { togglePlay, skip, nextChapter, prevChapter } = useAudio();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const store = useLibrary.getState();
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(e.shiftKey ? 60 : 30);
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(e.shiftKey ? -60 : -15);
          break;
        case "ArrowUp":
          e.preventDefault();
          store.setVolume(Math.min(1, store.volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          store.setVolume(Math.max(0, store.volume - 0.05));
          break;
        case "n":
        case "N":
          nextChapter();
          break;
        case "p":
        case "P":
          prevChapter();
          break;
        case "m":
        case "M":
          store.toggleMuted();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, skip, nextChapter, prevChapter]);
}
