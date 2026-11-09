"use client";

/**
 * VOICE NOTES RECORDED WITH NO SIGNAL (Platform Grade 1, P1.3 follow-up).
 *
 * A voice note held and released on a dead connection is not thrown away and
 * is not called failed: it is kept on this device and sends by itself when
 * the connection is back, the way a typed message waits in the outbox
 * (`lib/offline/outbox.ts`, V-40). The typed outbox stores JSON; a voice note
 * is a file, so it waits here, in IndexedDB, with what `attachVoice` needs.
 *
 * It survives a reload: the thread asks for its own waiting notes when it
 * opens, draws them as "waiting" and sends them once online. Each is removed
 * the moment the server has recorded it. Everything is best effort: without
 * IndexedDB (a private window, a blocked store) the note still waits in
 * memory for as long as the thread is open, and nothing here ever throws.
 */

const DB = "nf_voice_outbox";
const STORE = "notes";

export type WaitingVoice = {
  /** The bubble's own id (`local-...`). */
  id: string;
  conversationId: string;
  blob: Blob;
  contentType: string;
  ext: string;
  durationMs: number;
  peaks: number[] | null;
  replyToId: string | null;
  createdAt: string;
  /** Set once the file has landed in the bucket, so it is not uploaded twice. */
  path?: string;
};

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(request ? (request.result as T) : null);
      };
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
      tx.onabort = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/** Keeps (or updates) a waiting note. */
export async function keepVoice(note: WaitingVoice): Promise<void> {
  await run("readwrite", (store) => store.put(note));
}

/** Forgets a note once the server has it (or the person removed it). */
export async function forgetVoice(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
}

/** This conversation's waiting notes, oldest first. */
export async function waitingVoices(conversationId: string): Promise<WaitingVoice[]> {
  const all = (await run<WaitingVoice[]>("readonly", (store) => store.getAll())) ?? [];
  return all
    .filter((n) => n && n.conversationId === conversationId && n.blob instanceof Blob)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
