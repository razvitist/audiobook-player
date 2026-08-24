import { parseBlob, type IAudioMetadata, type IChapter } from "music-metadata";
import type { EmbeddedChapter } from "@/lib/mp4Chapters";

export type { EmbeddedChapter };

export interface TrackTags {
  title?: string;
  artist?: string;
  album?: string;
  /** Embedded cover art, if present. */
  cover?: File;
  /** Embedded chapter markers (e.g. from ID3 CHAP frames), in seconds. */
  chapters?: EmbeddedChapter[];
}

/** Convert a music-metadata chapter (sample/timescale based) into seconds. */
function toSeconds(ch: IChapter, sampleRate?: number): EmbeddedChapter {
  const scale = ch.timeScale;
  const start =
    scale != null
      ? ch.start / scale
      : ch.sampleOffset != null && sampleRate
        ? ch.sampleOffset / sampleRate
        : ch.start;
  const end =
    ch.end == null ? undefined : scale != null ? ch.end / scale : ch.end;
  return { title: ch.title, start, end };
}

/**
 * Read embedded tags (title / artist / album / cover art) from an audio file.
 *
 * Note: MP4/M4B chapters are handled separately by `parseMp4Chapters` because
 * music-metadata's MP4 chapter support is unreliable (and can throw). We keep
 * its `format.chapters` only for formats where it works well, like ID3 CHAP.
 */
export async function readTags(file: File): Promise<TrackTags | null> {
  let meta: IAudioMetadata;
  try {
    meta = await parseBlob(file, { duration: false });
  } catch {
    return null;
  }
  const { common, format } = meta;
  const pic = common.picture?.[0];
  const cover = pic
    ? new File([pic.data as BlobPart], "cover", {
        type: pic.format || "image/jpeg",
      })
    : undefined;

  const chapters = format.chapters
    ?.map((c) => toSeconds(c, format.sampleRate))
    .filter((c) => Number.isFinite(c.start));

  return {
    title: common.title || undefined,
    artist: common.albumartist || common.artist || undefined,
    album: common.album || undefined,
    cover,
    chapters: chapters?.length ? chapters : undefined,
  };
}
