import type { BrowserClient } from "@/lib/supabase/load-client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { isOffline } from "@/lib/offline/connectivity";

/**
 * THE ONE PLACE A PHOTOGRAPH LEAVES THE PHONE.
 *
 * `supabase.storage.upload` is a single `fetch` with no timeout, no progress
 * and no way to stop it. On a weak connection it can sit forever, and the
 * composer that awaited it sat on "Publishing" forever with it. This speaks to
 * the same storage endpoint with XMLHttpRequest, which gives what a poor
 * connection needs: upload progress, a stall deadline, a way to cancel, and a
 * fast, honest answer when the phone is offline.
 *
 * A request that makes no progress for STALL_MS is abandoned and tried again
 * (ATTEMPTS in all, with a growing pause), so a mast handover or a dead socket
 * costs seconds, not the whole post. The person's session token is read from
 * the local session (no network round trip), and the bucket's own policies are
 * still the thing that decides who may write where.
 */

export const UPLOAD_STALL_MS = 20_000;
const ATTEMPTS = 3;

export type UploadFailure = "offline" | "signed-out" | "refused" | "timeout" | "failed";
export type UploadResult = { ok: true } | { ok: false; reason: UploadFailure; status?: number };

export type UploadInput = {
  supabase: BrowserClient;
  bucket: string;
  path: string;
  body: Blob;
  contentType: string;
  /**
   * A signed upload token (`createSignedUploadUrl`), for a bucket the member
   * may not write to directly (inspection and claim evidence). The request is
   * then the signed PUT the Supabase client makes, and needs no session.
   */
  signedToken?: string;
  /** 0 to 1, over the bytes sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function once(url: string, token: string | null, input: UploadInput): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let stall = 0;
    let settled = false;
    const settle = (result: UploadResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(stall);
      input.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    /* Each sign of life pushes the deadline out; silence is what is timed. */
    const arm = () => {
      window.clearTimeout(stall);
      stall = window.setTimeout(() => {
        xhr.abort();
        settle({ ok: false, reason: "timeout" });
      }, UPLOAD_STALL_MS);
    };
    const onAbort = () => {
      xhr.abort();
      settle({ ok: false, reason: "failed" });
    };

    const signed = Boolean(input.signedToken);
    xhr.open(signed ? "PUT" : "POST", url);
    /* A signed upload has no session; the client then sends the public key as
       the bearer, as the storage client does. */
    xhr.setRequestHeader("Authorization", `Bearer ${token ?? SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "false");
    if (!signed) {
      xhr.setRequestHeader("Content-Type", input.contentType);
      xhr.setRequestHeader("Cache-Control", "max-age=3600");
    }
    xhr.upload.onprogress = (event) => {
      arm();
      if (event.lengthComputable && event.total > 0) input.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.(1);
        settle({ ok: true });
      } else if (xhr.status === 401 || xhr.status === 403) {
        settle({ ok: false, reason: "refused", status: xhr.status });
      } else {
        settle({ ok: false, reason: "failed", status: xhr.status });
      }
    };
    xhr.onerror = () => settle({ ok: false, reason: "failed" });
    xhr.onabort = () => settle({ ok: false, reason: "failed" });
    if (input.signal?.aborted) return onAbort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    arm();
    if (signed) {
      /* The form the storage client sends for a signed upload: the file under
         an empty field name, and the cache lifetime. The browser sets the
         multipart boundary itself. */
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", input.body, (input.body as File).name ?? "upload");
      xhr.send(form);
    } else {
      xhr.send(input.body);
    }
  });
}

export async function uploadToStorage(input: UploadInput): Promise<UploadResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  let token: string | null = null;
  /* A signed upload carries its own authority, so it needs no session. */
  if (!input.signedToken) {
    try {
      const { data } = await input.supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      token = null;
    }
    if (!token) return { ok: false, reason: "signed-out" };
  }

  const encoded = input.path.split("/").map(encodeURIComponent).join("/");
  const url = input.signedToken
    ? `${SUPABASE_URL}/storage/v1/object/upload/sign/${encodeURIComponent(input.bucket)}/${encoded}?token=${encodeURIComponent(input.signedToken)}`
    : `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(input.bucket)}/${encoded}`;

  let last: UploadResult = { ok: false, reason: "failed" };
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (input.signal?.aborted) break;
    last = await once(url, token, input);
    if (last.ok) return last;
    /* A refusal will not change on a second try; a 409 means this exact object
       already landed on an earlier attempt whose answer was lost. */
    if (last.reason === "refused" || last.reason === "signed-out") return last;
    if (last.status === 409) return { ok: true };
    if (last.status && last.status >= 400 && last.status < 500) return last;
    if (isOffline()) return { ok: false, reason: "offline" };
    await pause(800 * 2 ** attempt);
  }
  return last;
}

/**
 * A server action that cannot hang its caller. A promise that has not settled
 * by `ms` rejects, so the composer says "not sent" and keeps the writing.
 */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Words for each way an upload can end, for the composers that show a line. */
export function uploadFailureText(reason: UploadFailure): string {
  switch (reason) {
    case "offline":
      return "You are offline. Your picture is kept here. Reconnect and tap Publish again.";
    case "signed-out":
      return "Your session has ended. Sign in again, then publish.";
    case "refused":
      return "Vallo would not take that picture. Try a different one.";
    case "timeout":
      return "The connection is too weak to finish the upload. Your picture is kept. Try again when the signal is better.";
    default:
      return "The picture did not upload. Your words and picture are kept. Try again.";
  }
}
