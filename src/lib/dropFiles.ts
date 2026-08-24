/**
 * Collect all files from a drop, descending into any dropped directories.
 * Uses the non-standard webkitGetAsEntry API (widely supported in browsers)
 * and preserves each file's relative path so folder grouping still works.
 */
interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
  file?: (cb: (f: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      cb: (entries: FileSystemEntryLike[]) => void,
      err: (e: unknown) => void,
    ) => void;
  };
}

function readFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file?.(
      (file) => {
        // Attach the folder path so import.ts can group by folder.
        Object.defineProperty(file, "webkitRelativePath", {
          value: entry.fullPath.replace(/^\//, ""),
          configurable: true,
        });
        resolve(file);
      },
      (e) => reject(e),
    );
  });
}

function readDir(entry: FileSystemEntryLike): Promise<File[]> {
  const reader = entry.createReader?.();
  if (!reader) return Promise.resolve([]);
  return new Promise((resolve) => {
    const all: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          const nested = await Promise.all(all.map(walk));
          resolve(nested.flat());
        } else {
          all.push(...entries);
          readBatch(); // readEntries only returns a batch at a time
        }
      }, () => resolve([]));
    };
    readBatch();
  });
}

async function walk(entry: FileSystemEntryLike): Promise<File[]> {
  if (entry.isFile) return [await readFile(entry)];
  if (entry.isDirectory) return readDir(entry);
  return [];
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items).filter((i) => i.kind === "file");
  const entries = items
    .map((i) => i.webkitGetAsEntry() as unknown as FileSystemEntryLike | null)
    .filter((e): e is FileSystemEntryLike => e !== null);

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map(walk));
    return nested.flat();
  }
  // Fallback: plain files with no directory support.
  return Array.from(dt.files);
}
