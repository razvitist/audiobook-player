import * as React from "react";
import { FilePlus2, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/store/useLibrary";

// `webkitdirectory` is a non-standard attribute React doesn't type.
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export function ImportControls({ compact = false }: { compact?: boolean }) {
  const importFiles = useLibrary((s) => s.importFiles);
  const [busy, setBusy] = React.useState(false);
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);

  const handle = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    try {
      await importFiles(list);
    } finally {
      setBusy(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  };

  return (
    <div className={compact ? "flex gap-1" : "flex flex-col gap-2 sm:flex-row"}>
      <input
        ref={filesRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.m4b,.aac,.ogg,.opus,.wav,.flac"
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      <input
        ref={folderRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      <Button
        variant={compact ? "ghost" : "default"}
        size={compact ? "icon-sm" : "default"}
        className={compact ? undefined : "flex-1"}
        disabled={busy}
        onClick={() => filesRef.current?.click()}
        title="Import audio files"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FilePlus2 className="h-4 w-4" />
        )}
        {!compact && <span>Add files</span>}
      </Button>
      <Button
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "icon-sm" : "default"}
        className={compact ? undefined : "flex-1"}
        disabled={busy}
        onClick={() => folderRef.current?.click()}
        title="Import a folder"
      >
        <FolderPlus className="h-4 w-4" />
        {!compact && <span>Add folder</span>}
      </Button>
    </div>
  );
}
