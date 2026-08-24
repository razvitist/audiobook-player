import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Gauge,
  Moon,
  Loader2,
} from "lucide-react";
import { useLibrary, useCurrentBook } from "@/store/useLibrary";
import { useAudio } from "@/audio/AudioProvider";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookCover } from "@/components/BookCover";
import { ChapterList } from "@/components/ChapterList";
import { SeekBar } from "@/components/SeekBar";
import { formatTime } from "@/lib/format";
import { currentChapterIndex } from "@/lib/chapters";

const SPEEDS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const SLEEP_OPTIONS = [5, 10, 15, 30, 45, 60];

export function Player() {
  const book = useCurrentBook();
  const isPlaying = useLibrary((s) => s.isPlaying);
  const isBuffering = useLibrary((s) => s.isBuffering);
  const currentTime = useLibrary((s) => s.currentTime);
  const duration = useLibrary((s) => s.duration);
  const { togglePlay, skip, seekTo, nextChapter, prevChapter } = useAudio();

  if (!book) return <EmptyState />;

  const chapterIdx = currentChapterIndex(book, book.currentTrackIndex, currentTime);
  const chapter = book.chapters[chapterIdx];
  const hasAudio = book.tracks.length > 0;
  const atStart = chapterIdx <= 0;
  const atEnd = chapterIdx >= book.chapters.length - 1;

  return (
    <div className="flex h-full flex-col gap-5 p-5 sm:p-8">
      {/* Now playing header */}
      <div className="flex items-end gap-5">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl shadow-lg ring-1 ring-border sm:h-36 sm:w-36">
          <BookCover title={book.title} cover={book.cover} rounded="rounded-xl" />
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            Now playing
          </p>
          <h1
            className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl"
            title={book.title}
          >
            {book.title}
          </h1>
          {book.author && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground" title={book.author}>
              by {book.author}
            </p>
          )}
          <p className="mt-1 truncate text-sm text-muted-foreground" title={chapter?.title}>
            {chapter?.title ?? "—"}
            <span className="mx-1.5">·</span>
            Chapter {chapterIdx + 1} of {book.chapters.length}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <SeekBar value={currentTime} max={duration} onSeek={seekTo} disabled={!hasAudio} />
        <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        <IconBtn label="Previous chapter (P)" onClick={prevChapter} disabled={atStart}>
          <SkipBack className="h-5 w-5" />
        </IconBtn>
        <IconBtn label="Back 15s (←)" onClick={() => skip(-15)}>
          <RotateCcw className="h-5 w-5" />
          <span className="absolute text-[9px] font-bold">15</span>
        </IconBtn>
        <Button
          size="icon"
          onClick={togglePlay}
          className="h-16 w-16 rounded-full shadow-lg"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isBuffering ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 translate-x-0.5 fill-current" />
          )}
        </Button>
        <IconBtn label="Forward 30s (→)" onClick={() => skip(30)}>
          <RotateCw className="h-5 w-5" />
          <span className="absolute text-[9px] font-bold">30</span>
        </IconBtn>
        <IconBtn label="Next chapter (N)" onClick={nextChapter} disabled={atEnd}>
          <SkipForward className="h-5 w-5" />
        </IconBtn>
      </div>

      {/* Secondary controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VolumeControl />
        <div className="flex items-center gap-2">
          <SpeedControl />
          <SleepControl />
        </div>
      </div>

      {/* Chapters */}
      <ChapterList />
    </div>
  );
}

function IconBtn({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function VolumeControl() {
  const volume = useLibrary((s) => s.volume);
  const muted = useLibrary((s) => s.muted);
  const setVolume = useLibrary((s) => s.setVolume);
  const toggleMuted = useLibrary((s) => s.toggleMuted);
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex w-40 items-center gap-2">
      <Button variant="ghost" size="icon-sm" onClick={toggleMuted} aria-label="Mute">
        <Icon className="h-5 w-5" />
      </Button>
      <Slider
        value={[effective]}
        max={1}
        step={0.01}
        onValueChange={([v]) => setVolume(v)}
        aria-label="Volume"
      />
    </div>
  );
}

function SpeedControl() {
  const rate = useLibrary((s) => s.playbackRate);
  const setRate = useLibrary((s) => s.setPlaybackRate);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 tabular-nums">
          <Gauge className="h-4 w-4" />
          {rate}×
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[7rem]">
        <DropdownMenuLabel>Playback speed</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SPEEDS.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={rate === s}
            onCheckedChange={() => setRate(s)}
          >
            {s}×
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SleepControl() {
  const endsAt = useLibrary((s) => s.sleepTimerEndsAt);
  const chapterEnd = useLibrary((s) => s.sleepAtChapterEnd);
  const setSleepTimer = useLibrary((s) => s.setSleepTimer);
  const setChapterEnd = useLibrary((s) => s.setSleepChapterEnd);
  const active = endsAt != null || chapterEnd;

  const [remaining, setRemaining] = React.useState<string>("");
  React.useEffect(() => {
    if (!endsAt) return setRemaining("");
    const tick = () => {
      const ms = Math.max(0, endsAt - Date.now());
      setRemaining(formatTime(ms / 1000));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "default" : "outline"}
          size="sm"
          className="gap-1.5 tabular-nums"
        >
          <Moon className="h-4 w-4" />
          {endsAt ? remaining : chapterEnd ? "Chapter" : "Sleep"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sleep timer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SLEEP_OPTIONS.map((m) => (
          <DropdownMenuCheckboxItem
            key={m}
            checked={false}
            onCheckedChange={() => setSleepTimer(m)}
          >
            {m} minutes
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuCheckboxItem
          checked={chapterEnd}
          onCheckedChange={(v) => setChapterEnd(!!v)}
        >
          End of chapter
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={false}
          onCheckedChange={() => {
            setSleepTimer(null);
            setChapterEnd(false);
          }}
        >
          Off
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Play className="h-9 w-9 translate-x-0.5 fill-primary text-primary" />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Nothing playing yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Import an audiobook — a set of audio files or a whole folder — then pick
          it from your library to start listening. Everything stays on your device.
        </p>
      </div>
    </div>
  );
}
