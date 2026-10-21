import "server-only";

import { createPrivateKey, sign as signWithKey } from "node:crypto";

import { FCM_PROJECT_ID_VAR, FCM_SERVICE_ACCOUNT_VAR, fcmStatus } from "../credentials";
import { replyFromStatus, type ProviderReply, type PushPayload, type PushTarget } from "../types";
import { actionsAsData } from "../actions";

/**
 * FIREBASE CLOUD MESSAGING, HTTP v1.
 *
 * ===========================================================================
 * THIS TRANSPORT CANNOT RUN TODAY AND THAT IS NOT A DEFECT IN IT.
 *
 * FCM needs a service account JSON from a Firebase project. Nobody but the
 * owner can create one: it needs a Google account and a project in a console.
 * So every function below is written, and `fcmStatus()` refuses at the door
 * with `no_credentials` rather than attempting anything. The day the JSON
 * lands in `FCM_SERVICE_ACCOUNT_JSON`, this works with no further code.
 *
 * THE SECOND HALF NOBODY REMEMBERS. The server credential is not enough for
 * Android. The same Firebase project also yields a `google-services` JSON
 * file, which has to be dropped into `android/app/` or the handset never
 * obtains a registration token to send to in the first place. A deployment
 * with the server key and without that file has a working sender and no
 * addresses, which looks like a delivery failure and is not one.
 *
 * The directory is named rather than the full path on purpose: that file does
 * not exist in this repository and is not meant to yet, so writing it as a
 * path with an extension would read as a live reference to something nobody
 * can open. See `packages/design-tokens/README.md`, "Writing about a file in
 * a comment".
 *
 * ===========================================================================
 * THE LEGACY API IS GONE. `fcm.googleapis.com/fcm/send` with a server key in
 * an `Authorization: key=...` header was turned off by Google in 2024. It is
 * still what most search results describe, and using it is a 404 that looks
 * like a dead token. This is the v1 API, which is OAuth2 and per-project.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

function base64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The service account, parsed once per process.
 *
 * Returns null rather than throwing, because a malformed JSON in an
 * environment variable must become a named alert on the desk and not an
 * exception inside the drain that stops every other transport too.
 */
export function readServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    /* Vercel's environment editor turns a pasted newline into the two
       characters backslash-n. A PEM with literal backslash-n in it fails to
       parse with a message about the key format that says nothing about the
       real cause, so it is repaired here rather than diagnosed forever. */
    const privateKey = parsed.private_key.includes("\\n")
      ? parsed.private_key.replace(/\\n/g, "\n")
      : parsed.private_key;
    return { client_email: parsed.client_email, private_key: privateKey, project_id: parsed.project_id };
  } catch {
    return null;
  }
}

/** Cached because it is valid for an hour and the drain runs every few minutes. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Exposed so a test can prove the cache is cleared rather than assumed. */
export function resetAccessTokenCache(): void {
  cachedToken = null;
}

/**
 * An OAuth2 access token, by the service account JWT grant.
 *
 * AND IT READS THE REPLY. A token endpoint that answers 400 because the
 * service account was disabled is the kind of failure that otherwise shows up
 * as "push stopped working" three weeks later.
 */
export async function fcmAccessToken(now: number = Date.now()): Promise<
  { ok: true; token: string } | { ok: false; status: number; error: string }
> {
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { ok: true, token: cachedToken.value };
  }

  const account = readServiceAccount((process.env[FCM_SERVICE_ACCOUNT_VAR] ?? "").trim());
  if (!account) return { ok: false, status: 0, error: "service_account_unreadable" };

  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(
    Buffer.from(
      JSON.stringify({
        iss: account.client_email,
        scope: SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    ),
  );
  const signingInput = `${header}.${claims}`;

  let assertion: string;
  try {
    const key = createPrivateKey(account.private_key);
    assertion = `${signingInput}.${base64Url(signWithKey("sha256", Buffer.from(signingInput, "ascii"), key))}`;
  } catch {
    return { ok: false, status: 0, error: "service_account_key_invalid" };
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      /* The body is read and DISCARDED. Google's error bodies quote the
         assertion back, and the assertion is signed with the private key. */
      void response.text().catch(() => "");
      return { ok: false, status: response.status, error: `token_${response.status}` };
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (typeof body.access_token !== "string") {
      return { ok: false, status: response.status, error: "token_missing" };
    }
    cachedToken = {
      value: body.access_token,
      expiresAt: now + (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000,
    };
    return { ok: true, token: body.access_token };
  } catch {
    return { ok: false, status: 0, error: "token_no_reply" };
  }
}

/**
 * Read FCM's error body far enough to tell a dead token from a bad day.
 *
 * FCM answers 404 for an unregistered token and also for a wrong project id,
 * which are opposite problems: one means retire this device, the other means
 * every device on this deployment is about to be retired for no reason. The
 * `UNREGISTERED` status in the body is the only thing that separates them, so
 * it is read, and nothing else from the body is kept.
 */
export function readFcmError(status: number, body: string): ProviderReply {
  let code = `http_${status}`;
  let tokenFieldRefused = false;
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        status?: string;
        details?: Array<{ errorCode?: string; fieldViolations?: Array<{ field?: string }> }>;
      };
    };
    const details = parsed.error?.details ?? [];
    const fromDetails = details.find((detail) => typeof detail.errorCode === "string")?.errorCode;
    const candidate = fromDetails ?? parsed.error?.status;
    /* Only an allow-list of known machine tokens is ever carried forward. A
       free-text message from a provider is a body, and bodies echo tokens. */
    if (typeof candidate === "string" && /^[A-Z_]{3,40}$/.test(candidate)) code = candidate;
    /* Which field a 400 refused: only `message.token` says the token itself
       is malformed. The field name is kept as a yes or no, never as text. */
    tokenFieldRefused = details.some((detail) =>
      (detail.fieldViolations ?? []).some((violation) => violation.field === "message.token"),
    );
  } catch {
    /* Not JSON. The status alone is the record. */
  }

  if (code === "UNREGISTERED") {
    return { outcome: "gone", status, error: code };
  }
  if (status === 404) {
    /* A 404 that does not say UNREGISTERED is a wrong project id or a wrong
       URL: every device on the deployment would get the same answer. It used
       to read as "gone" and retire them all (`isConfigurationFailure`). */
    return { outcome: "failed", status, error: "NOT_FOUND" };
  }
  if (code === "INVALID_ARGUMENT" && status === 400 && tokenFieldRefused) {
    /* A malformed registration token, which is dead in the same way. Any
       other INVALID_ARGUMENT is our message (a field, a size), and retiring
       every Android device for one bad payload would be the worst answer. */
    return { outcome: "gone", status, error: code };
  }
  return replyFromStatus(status, code);
}

/** Send to one Android device, and read what FCM said about it. */
export async function sendFcm(target: PushTarget, payload: PushPayload): Promise<ProviderReply> {
  if (!fcmStatus().configured) {
    return { outcome: "failed", status: 0, error: "no_credentials" };
  }

  const token = await fcmAccessToken();
  if (!token.ok) {
    return { outcome: "failed", status: token.status, error: token.error };
  }

  const projectId = (process.env[FCM_PROJECT_ID_VAR] ?? "").trim();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: target.token,
          notification: { title: payload.title, body: payload.body },
          /* Data values must be strings. A number here is a 400 that reads
             as a generic INVALID_ARGUMENT. */
          data: { href: payload.href, tag: payload.tag, actions: actionsAsData(payload.actions) },
          android: {
            priority: payload.urgent ? "HIGH" : "NORMAL",
            notification: {
              /* The channel must already exist on the handset or Android 8
                 and above drops the notification silently. It is created by
                 the shell; the name here has to match. */
              channel_id: "vallo_default",
              /* Android's own collapsing, so one conversation is one row in
                 the shade rather than eleven. */
              tag: payload.tag,
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const body = await response.text().catch(() => "");
    if (response.ok) {
      let messageId: string | undefined;
      try {
        const parsed = JSON.parse(body) as { name?: string };
        if (typeof parsed.name === "string") messageId = parsed.name;
      } catch {
        /* A 200 with an unreadable body is still a 200. */
      }
      return { outcome: "accepted", status: response.status, messageId };
    }
    return readFcmError(response.status, body);
  } catch {
    return { outcome: "failed", status: 0, error: "no_reply" };
  } finally {
    clearTimeout(timeout);
  }
}
