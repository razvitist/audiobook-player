import { createStore, get, set, del, keys } from "idb-keyval";

/**
 * Local audio files are large, so we keep the actual Blob data in IndexedDB
 * (keyed by track id) instead of localStorage. Book metadata + playback
 * progress live in localStorage and are small. This lets the library survive
 * reloads without the user re-importing anything.
 */
const audioStore = createStore("audiobook-player", "audio-blobs");

export async function putBlob(id: string, blob: Blob): Promise<void> {
  await set(id, blob, audioStore);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, audioStore);
}

export async function deleteBlob(id: string): Promise<void> {
  await del(id, audioStore);
}

export async function allBlobKeys(): Promise<string[]> {
  return (await keys(audioStore)) as string[];
}
