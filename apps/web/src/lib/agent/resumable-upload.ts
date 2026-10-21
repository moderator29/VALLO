/**
 * A resumable upload, because a hundred megabytes on a Nigerian mobile connection
 * will not survive a single POST.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS EXISTS FOR, WITH THE ARITHMETIC.
 *
 * A walkthrough is capped at 100MB. On a typical Nigerian mobile uplink of
 * roughly two megabits that is about seven minutes of uninterrupted upload. Seven
 * minutes is longer than a lift, longer than a handover between masts, and
 * longer than most people will hold a phone still. `supabase.storage.upload` is
 * ONE request with no chunking, no resume and no retry: the connection drops at
 * minute six and the whole thing starts again, if the person has not already
 * given up. That is not a rare case on this market, it is the ordinary one.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS.
 *
 * The TUS 1.0.0 resumable protocol, spoken directly to Supabase Storage's
 * `/storage/v1/upload/resumable` endpoint with `fetch`. Three verbs:
 *
 *   POST   creates the upload and answers with a URL that names it.
 *   PATCH  sends one chunk at a byte offset and answers with the new offset.
 *   HEAD   asks the server how much it actually holds, which is how a resume
 *          after a dropped connection knows where to start.
 *
 * WHY NOT `tus-js-client`. It is the obvious answer and it is a dependency
 * added to a tree eight people are working in, for about a hundred and fifty
 * lines we need exact control over: the chunk size Supabase demands, the
 * progress the UI reports, and where the resume token is kept. The protocol is
 * small and stable and this is all of it.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS THAT ARE NOT OPTIONAL AND ARE EASY TO GET WRONG.
 *
 * 1. THE CHUNK IS EXACTLY 6MB, EVERY TIME BUT THE LAST. Supabase's storage
 *    layer requires it and answers 400 otherwise. It is not a tuning knob.
 *
 * 2. THE UPLOAD URL IS KEPT, AND KEPT ON THE DEVICE. A resume within one page
 *    life is easy. The case worth building for is the phone that lost signal,
 *    locked, and came back ten minutes later: the tab has been reloaded and
 *    everything in memory is gone. So the URL is written to `localStorage`
 *    against a key made from the listing, the file name, its size and its last
 *    modified time, which together identify one file well enough that resuming
 *    the wrong one is not a thing that can happen.
 *
 * 3. EVERY READ AND WRITE OF THAT STORE IS WRAPPED. Private browsing, a
 *    cleared site and a blocked cookie jar all throw on access rather than
 *    returning null, and an upload that cannot start because storage is
 *    disabled would be a bizarre failure to explain to somebody.
 *
 * ---------------------------------------------------------------------------
 * THE ONE THING THAT WOULD BREAK THIS SILENTLY, NAMED SO IT IS LOOKED AT
 * FIRST RATHER THAN LAST.
 *
 * The whole protocol depends on the browser being ALLOWED TO READ two
 * response headers across an origin: `Location` on the create, and
 * `Upload-Offset` on every chunk. A cross-origin response hides every header
 * that is not in its `Access-Control-Expose-Headers`, and a hidden header
 * reads as `null` rather than as an error. Supabase Storage exposes both,
 * which is how every TUS client works against it, and if this ever starts
 * reporting "the upload could not be started" on a request that returned 201,
 * that is the first thing to check and not the last. The CSP is not the
 * suspect: `connect-src` already names the Supabase origin (`lib/security/csp.ts`).
 */

const TUS_VERSION = "1.0.0";

/** Supabase requires this exactly. It is not a tuning knob. */
const CHUNK_BYTES = 6 * 1024 * 1024;

/** How many times one chunk is retried before the upload reports a stall. */
const CHUNK_ATTEMPTS = 3;

/** Growing waits between attempts, so a mast handover has time to finish. */
const BACKOFF_MS = [1_000, 4_000];

export type UploadProgress = {
  /** Bytes the server has confirmed it holds. */
  uploaded: number;
  total: number;
};

export type ResumableUploadResult =
  | { ok: true; path: string }
  | { ok: false; reason: "cancelled" | "refused" | "network"; message: string };

export type ResumableUploadInput = {
  file: File;
  bucket: string;
  /** The object path inside the bucket. */
  path: string;
  supabaseUrl: string;
  /** The signed-in caller's access token. Storage RLS decides the rest. */
  accessToken: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/**
 * Upload a file, resuming whatever is already on the server.
 *
 * Never throws for an ordinary failure: a refusal, a lost connection and a
 * cancellation are all results, because all three are things the person on the
 * screen has to be told in words.
 */
export async function resumableUpload(
  input: ResumableUploadInput,
): Promise<ResumableUploadResult> {
  const { file, bucket, path, supabaseUrl, accessToken, onProgress, signal } = input;
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
  const key = resumeKey(bucket, path, file);

  const headers = (extra: Record<string, string>): Record<string, string> => ({
    authorization: `Bearer ${accessToken}`,
    "tus-resumable": TUS_VERSION,
    ...extra,
  });

  try {
    /* A URL we already hold means an upload that was interrupted. Ask the
       server what it actually has rather than trusting our own last count:
       the final PATCH may have landed after the connection looked dead. */
    let uploadUrl = readResume(key);
    let offset = 0;

    if (uploadUrl) {
      const held = await serverOffset(uploadUrl, headers, signal);
      if (held === null) {
        /* The server has forgotten it (they expire). Start again cleanly. */
        forgetResume(key);
        uploadUrl = null;
      } else {
        offset = held;
      }
    }

    if (!uploadUrl) {
      const created = await fetch(endpoint, {
        method: "POST",
        headers: headers({
          "upload-length": String(file.size),
          "upload-metadata": tusMetadata({
            bucketName: bucket,
            objectName: path,
            contentType: file.type,
            /* An hour. A walkthrough is re-fetched by a reviewer and then by
               everybody who opens the listing, so it is worth caching. */
            cacheControl: "3600",
          }),
        }),
        ...(signal ? { signal } : {}),
      });
      if (!created.ok) return refusal(created.status);
      const location = created.headers.get("location");
      if (!location) {
        return {
          ok: false,
          reason: "network",
          message: "The upload could not be started. Try again in a moment.",
        };
      }
      uploadUrl = new URL(location, endpoint).toString();
      rememberResume(key, uploadUrl);
      offset = 0;
    }

    onProgress?.({ uploaded: offset, total: file.size });

    while (offset < file.size) {
      if (signal?.aborted) return cancelled();
      const end = Math.min(offset + CHUNK_BYTES, file.size);
      const chunk = file.slice(offset, end);

      const next = await patchChunk(uploadUrl, offset, chunk, headers, signal);
      if (next.state === "cancelled") return cancelled();
      if (next.state === "refused") {
        forgetResume(key);
        return refusal(next.status);
      }
      if (next.state === "stalled") {
        /* The bytes already on the server stay there and the resume key stays
           with them, so pressing the control again carries on rather than
           starting from zero. That is the whole point of the exercise. */
        return {
          ok: false,
          reason: "network",
          message:
            "The connection dropped. Nothing was lost: press upload again and it carries on from where it stopped.",
        };
      }

      offset = next.offset;
      onProgress?.({ uploaded: offset, total: file.size });
    }

    forgetResume(key);
    return { ok: true, path };
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      return cancelled();
    }
    return {
      ok: false,
      reason: "network",
      message:
        "The connection dropped. Nothing was lost: press upload again and it carries on from where it stopped.",
    };
  }
}

type ChunkOutcome =
  | { state: "ok"; offset: number }
  | { state: "refused"; status: number }
  | { state: "stalled" }
  | { state: "cancelled" };

/** One chunk, with a few attempts, because one dropped packet is not a failure. */
async function patchChunk(
  uploadUrl: string,
  offset: number,
  chunk: Blob,
  headers: (extra: Record<string, string>) => Record<string, string>,
  signal: AbortSignal | undefined,
): Promise<ChunkOutcome> {
  for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) return { state: "cancelled" };
    try {
      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: headers({
          "content-type": "application/offset+octet-stream",
          "upload-offset": String(offset),
        }),
        body: chunk,
        ...(signal ? { signal } : {}),
      });

      if (response.status === 204 || response.status === 200) {
        const header = response.headers.get("upload-offset");
        const next = header === null ? NaN : Number(header);
        /* Trust the server's number over our own arithmetic: it is the only
           one that knows what it wrote. */
        return { state: "ok", offset: Number.isFinite(next) ? next : offset + chunk.size };
      }

      /* 409 is "your offset is wrong", which happens when a previous PATCH
         landed after we gave up on it. Asking again is the fix, and the loop
         above re-reads the offset on the next pass. */
      if (response.status === 409) {
        const held = await serverOffset(uploadUrl, headers, signal);
        if (held !== null) return { state: "ok", offset: held };
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 409) {
        return { state: "refused", status: response.status };
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        return { state: "cancelled" };
      }
    }

    const wait = BACKOFF_MS[attempt];
    if (wait !== undefined) await sleep(wait, signal);
  }
  return { state: "stalled" };
}

/** What the server says it holds, or null when it has forgotten the upload. */
async function serverOffset(
  uploadUrl: string,
  headers: (extra: Record<string, string>) => Record<string, string>,
  signal: AbortSignal | undefined,
): Promise<number | null> {
  try {
    const response = await fetch(uploadUrl, {
      method: "HEAD",
      headers: headers({}),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return null;
    const header = response.headers.get("upload-offset");
    const offset = header === null ? NaN : Number(header);
    return Number.isFinite(offset) ? offset : null;
  } catch {
    return null;
  }
}

/** TUS metadata: comma separated `key base64(value)` pairs. */
function tusMetadata(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key} ${base64(value)}`)
    .join(",");
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * One file, identified well enough that a resume cannot pick up the wrong one.
 *
 * Name alone is not enough: people really do have three files called
 * `IMG_0042.mov`. Name plus size plus last modified plus the destination is.
 */
function resumeKey(bucket: string, path: string, file: File): string {
  return `nf_upload:${bucket}:${path}:${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * THE SAME FILE GOES TO THE SAME PATH, so a second press really resumes.
 *
 * The resume key above names the destination path, and the wizard used to
 * mint a fresh random path for every attempt, so "press upload again and it
 * carries on" started from zero every time. This keeps the path chosen for
 * one file (by its name, size and last modified time) on the device, under a
 * scope that names the bucket and the listing folder, until the upload is
 * done with. A stored path outside `prefix` is never reused.
 */
export function stableUploadPath(scope: string, prefix: string, file: File, fresh: () => string): string {
  const key = pathKey(scope, file);
  const held = readResume(key);
  if (held && held.startsWith(prefix) && !held.slice(prefix.length).includes("/")) return held;
  const path = fresh();
  rememberResume(key, path);
  return path;
}

/** The upload is finished with (attached, refused or stopped): forget its path. */
export function forgetUploadPath(scope: string, file: File): void {
  forgetResume(pathKey(scope, file));
}

function pathKey(scope: string, file: File): string {
  return `nf_upload_path:${scope}:${file.name}:${file.size}:${file.lastModified}`;
}

function readResume(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function rememberResume(key: string, url: string): void {
  try {
    window.localStorage.setItem(key, url);
  } catch {
    /* Private browsing. The upload still works; it just cannot survive a
       reload, which is a smaller loss than refusing to start. */
  }
}

function forgetResume(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to clean up. */
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function cancelled(): ResumableUploadResult {
  return { ok: false, reason: "cancelled", message: "Upload stopped." };
}

function refusal(status: number): ResumableUploadResult {
  return {
    ok: false,
    reason: "refused",
    message:
      status === 413
        ? "That file is too large for the bucket. Record a shorter clip, or export it at a lower resolution."
        : "The upload was refused. Check the file and try again.",
  };
}
