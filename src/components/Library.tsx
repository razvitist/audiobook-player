import { Trash2, ListMusic } from "lucide-react";
import { useLibrary } from "@/store/useLibrary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookCover } from "@/components/BookCover";
import { ImportControls } from "@/components/ImportControls";
import { bookProgress } from "@/lib/progress";
import { formatDurationLong } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Library() {
  const books = useLibrary((s) => s.books);
  const currentBookId = useLibrary((s) => s.currentBookId);
  const openBook = useLibrary((s) => s.openBook);
  const removeBook = useLibrary((s) => s.removeBook);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <ListMusic className="h-5 w-5 shrink-0 text-primary" />
          <h2 className="truncate text-sm font-semibold tracking-tight">Your library</h2>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {books.length}
          </span>
        </div>
        <ImportControls compact />
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2 pb-4">
          {books.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No audiobooks yet. Use{" "}
              <span className="font-medium text-foreground">Add files</span> or{" "}
              <span className="font-medium text-foreground">Add folder</span> —
              or drag them here — to get started.
            </p>
          )}

          {books.map((book) => {
            const active = book.id === currentBookId;
            const { fraction } = bookProgress(book);
            const totalDuration = book.tracks.reduce(
              (a, t) => a + (t.duration ?? 0),
              0,
            );
            const meta = [
              book.author,
              `${book.tracks.length} chapter${book.tracks.length === 1 ? "" : "s"}`,
              totalDuration > 0 ? formatDurationLong(totalDuration) : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={book.id}
                role="button"
                tabIndex={0}
                onClick={() => openBook(book.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openBook(book.id);
                  }
                }}
                className={cn(
                  "group relative flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-accent" : "hover:bg-accent/60",
                )}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md shadow-sm ring-1 ring-border">
                  <BookCover title={book.title} cover={book.cover} rounded="rounded-md" />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      active && "text-foreground",
                    )}
                    title={book.title}
                  >
                    {book.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={meta}>
                    {meta}
                  </p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.round(fraction * 100)}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove "${book.title}" from your library?`))
                      void removeBook(book.id);
                  }}
                  className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 max-lg:opacity-100"
                  title="Remove audiobook"
                  aria-label={`Remove ${book.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <ImportControls />
      </div>
    </div>
  );
}
