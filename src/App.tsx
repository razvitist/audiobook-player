import * as React from "react";
import { Headphones, Library as LibraryIcon, X, Upload } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AudioProvider } from "@/audio/AudioProvider";
import { Library } from "@/components/Library";
import { Player } from "@/components/Player";
import { useLibrary } from "@/store/useLibrary";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { filesFromDataTransfer } from "@/lib/dropFiles";
import { cn } from "@/lib/utils";

function Shell() {
  useKeyboardShortcuts();
  const hydrate = useLibrary((s) => s.hydrate);
  const importFiles = useLibrary((s) => s.importFiles);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const dragDepth = React.useRef(0);

  // Backfill chapters + rebuild cover object-URLs from IndexedDB after a reload.
  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Close the mobile sidebar once a book is chosen.
  React.useEffect(() => {
    if (currentBookId) setSidebarOpen(false);
  }, [currentBookId]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = await filesFromDataTransfer(e.dataTransfer);
    if (files.length) await importFiles(files);
  };

  return (
    <div
      className="app-aurora flex h-full flex-col"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/40 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Headphones className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Audiobook Player</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle library"
        >
          <LibraryIcon className="h-5 w-5" />
        </Button>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-30 w-[min(88vw,20rem)] border-r border-border/60 bg-background/80 backdrop-blur-xl transition-transform lg:static lg:z-auto lg:translate-x-0 lg:bg-background/30",
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-end p-2 lg:hidden">
            <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="h-[calc(100%-3rem)] lg:h-full">
            <Library />
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main player */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto h-full max-w-3xl">
            <Player />
          </div>
        </main>
      </div>

      {/* Drag & drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-card px-12 py-10 text-center shadow-2xl">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Drop to import</p>
            <p className="text-sm text-muted-foreground">
              Audio files or a folder of chapters
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <AudioProvider>
        <Shell />
      </AudioProvider>
    </TooltipProvider>
  );
}
