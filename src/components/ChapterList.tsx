import { Play } from "lucide-react";
import { useLibrary, useCurrentBook } from "@/store/useLibrary";
import { useAudio } from "@/audio/AudioProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTime } from "@/lib/format";
import { currentChapterIndex, chapterDuration } from "@/lib/chapters";
import { cn } from "@/lib/utils";

function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-0.5 origin-bottom rounded-full bg-primary animate-[equalize_0.9s_ease-in-out_infinite]"
          style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function ChapterList() {
  const book = useCurrentBook();
  const isPlaying = useLibrary((s) => s.isPlaying);
  const currentTime = useLibrary((s) => s.currentTime);
  const { goToChapter } = useAudio();

  if (!book) return null;

  const activeIndex = currentChapterIndex(book, book.currentTrackIndex, currentTime);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold">Chapters</h3>
        <span className="text-xs text-muted-foreground">{book.chapters.length}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1 rounded-lg border bg-card/40">
        <ul className="divide-y divide-border/60">
          {book.chapters.map((chapter, i) => {
            const active = i === activeIndex;
            const dur = chapterDuration(book, i);
            return (
              <li key={chapter.id}>
                <button
                  onClick={() => goToChapter(i)}
                  className={cn(
                    "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    active ? "bg-primary/10" : "hover:bg-accent/60",
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-xs tabular-nums text-muted-foreground">
                    {active && isPlaying ? (
                      <Equalizer />
                    ) : active ? (
                      <Play className="h-3.5 w-3.5 fill-primary text-primary" />
                    ) : (
                      <>
                        <span className="group-hover:hidden">{i + 1}</span>
                        <Play className="hidden h-3.5 w-3.5 group-hover:block" />
                      </>
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      active ? "font-medium text-foreground" : "text-foreground/90",
                    )}
                    title={chapter.title}
                  >
                    {chapter.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {dur ? formatTime(dur) : "—"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
