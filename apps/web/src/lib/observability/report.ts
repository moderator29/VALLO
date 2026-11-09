import "server-only";

import { recordCrash } from "./crash-log";
import { scrubContext, scrubError, type AllowedContextKey } from "./scrub";

/**
 * Crash and error reporting: the one door, and the only thing that reads
 * `SENTRY_DSN`.
 *
 * Until this file existed the product was about to enter two app stores with
 * no crash reporting at all. Neither store gives you the crash data back, so
 * the first real user's crash would have been invisible for ever: the only
 * signal would have been a one-star review describing a screen we cannot
 * reproduce.
 *
 * ## Why a direct transport and NOT `@sentry/nextjs`
 *
 * This was decided rather than defaulted, and the reasons are in the order
 * they weighed:
 *
 * 1. **Rule 16 is absolute and the SDK's defaults are the opposite of it.**
 *    `@sentry/nextjs` auto-instruments fetch, the router and the request
 *    pipeline, and attaches request data, headers, cookies and breadcrumbs
 *    of every network call by default. `sendDefaultPii` is off by default,
 *    but that switch does not cover breadcrumb bodies, and the surface that
 *    would have to be audited is the whole SDK rather than one function. A
 *    transport that can only ever send an explicitly built object cannot
 *    leak a field nobody thought about.
 * 2. **The dependency is not free in the sense that matters.** It pulls
 *    roughly forty packages and a webpack plugin, it rewrites `next.config`,
 *    and its source-map upload step wants an auth token and an org, which is
 *    account setup and CI credentials this build has not got.
 * 3. **The envelope endpoint is a documented, stable HTTP API.** What we
 *    need from it is one POST. The SDK's value is the parts we are
 *    deliberately not using: automatic instrumentation and breadcrumbs.
 * 4. **No lockfile entry, so nothing to install.** `@sentry/nextjs` is not
 *    in `package-lock.json` and is not vendored in this sandbox, so adding
 *    it would have been an install this environment cannot prove.
 *
 * The cost is stated honestly: no breadcrumbs, no automatic performance
 * tracing, no release health, and stack traces arrive minified because
 * nothing uploads source maps. The digest and the route pattern are what tie
 * a report back to a deployment. If the founder later wants symbolication,
 * that is a source-map upload step, not a reason to adopt the SDK's default
 * data collection.
 *
 * ## Absent means absent
 *
 * With no `SENTRY_DSN` every call returns `{ sent: false }` and prints
 * nothing. Not a warning, not a hint, not once per boot. A development
 * console that cries about unconfigured telemetry on every error is a
 * console people stop reading, and this module's whole job is to not be the
 * reason a real line is missed.
 *
 * There is no fallback service, no second vendor and no hardcoded DSN. The
 * DSN itself is never printed: a parse failure reports the token
 * `sentry_dsn_unparseable` and not the value that failed.
 *
 * ## It cannot fail the thing it is reporting on
 *
 * Every path returns rather than throws, exactly as `lib/alerts/record.ts`
 * does and for the same reason: the caller is already in a failure, and a
 * reporter that throws turns one broken screen into two.
 */

export type ReportContext = Partial<Record<AllowedContextKey, unknown>>;

export type ReportOutcome =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "throttled" | "transport_failed" | "sentry_dsn_unparseable" };

/** How long an identical error stays quiet, so one hot loop is one report. */
const QUIET_MS = 60_000;

/** Ceiling on the dedup map, mirroring `api/csp-report`'s bounded map. */
const MAX_QUIET_KEYS = 500;

/** A crash report must never hold a request open. */
const TIMEOUT_MS = 2_000;

const lastSent = new Map<string, number>();

type Dsn = { host: string; projectId: string; publicKey: string };

let dsnCache: { raw: string; parsed: Dsn | null } | null = null;

/**
 * Parse `https://<publicKey>@<host>/<projectId>`.
 *
 * Returns null rather than throwing, and the caller never prints the input.
 * Cached on the raw string so a misconfigured deployment parses once rather
 * than on every error in a crash loop.
 */
function parseDsn(raw: string): Dsn | null {
  if (dsnCache && dsnCache.raw === raw) return dsnCache.parsed;
  let parsed: Dsn | null = null;
  try {
    const url = new URL(raw);
    const projectId = url.pathname.replace(/^\/+/, "").split("/").pop() ?? "";
    if (url.username.length > 0 && url.hostname.length > 0 && projectId.length > 0) {
      parsed = { host: url.host, projectId, publicKey: url.username };
    }
  } catch {
    parsed = null;
  }
  dsnCache = { raw, parsed };
  return parsed;
}

function dsn(): Dsn | null {
  const raw = (process.env.SENTRY_DSN ?? "").trim();
  if (raw.length === 0) return null;
  return parseDsn(raw);
}

/** Whether anything is configured at all. Exported for the intake route. */
export function isReportingConfigured(): boolean {
  return dsn() !== null;
}

/**
 * Sentry wants 32 lower-case hex characters with no dashes.
 *
 * `crypto.randomUUID` is in the Node and edge runtimes both; the fallback is
 * only reached in an exotic runtime and is still unique enough for an id
 * whose only job is to be different from the last one.
 */
function eventId(): string {
  try {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}

function prune(now: number): void {
  for (const [key, at] of lastSent) {
    if (now - at > QUIET_MS) lastSent.delete(key);
  }
  if (lastSent.size <= MAX_QUIET_KEYS) return;
  for (const key of lastSent.keys()) {
    if (lastSent.size <= MAX_QUIET_KEYS) break;
    lastSent.delete(key);
  }
}

/**
 * The deployment this came from.
 *
 * `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` are set by the platform and hold
 * no personal data. Nothing else about the machine is sent: `server_name` is
 * deliberately omitted because on a self-hosted runner a hostname can name a
 * person.
 */
function environmentName(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function releaseName(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha && sha.length > 0 ? sha.slice(0, 12) : undefined;
}

export type ReportInput = {
  error: unknown;
  /** Machine tokens only. Everything outside the allowlist is dropped. */
  context?: ReportContext;
  level?: "error" | "fatal" | "warning";
};

/**
 * Build the exact JSON that will be sent, scrubbed.
 *
 * Exported so the test can assert on the finished payload rather than on the
 * scrubber alone. The point of the test is that nothing personal survives
 * the WHOLE pipeline, including the fields this function adds.
 */
export function buildEvent(input: ReportInput): Record<string, unknown> {
  const scrubbed = scrubError(input.error);
  const tags = scrubContext(input.context as Record<string, unknown> | undefined);

  return {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: input.level ?? "error",
    logger: "vallo",
    environment: environmentName(),
    ...(releaseName() ? { release: releaseName() } : {}),
    exception: {
      values: [
        {
          type: scrubbed.type,
          value: scrubbed.value,
          ...(scrubbed.stack ? { stacktrace: { frames: [], raw: scrubbed.stack } } : {}),
        },
      ],
    },
    // Both bags are the SAME scrubbed object. Sentry indexes tags and shows
    // extra, and there is deliberately no second, looser channel: if a value
    // is not fit to be a tag it is not fit to be sent.
    tags,
    extra: tags,
  };
}

/**
 * Report one error. Returns, never throws, never blocks for long.
 *
 * The await is deliberate rather than fire-and-forget: on a serverless
 * runtime the process can be frozen the moment the response is written, and
 * an un-awaited POST is a report that usually never leaves. The two-second
 * timeout is what keeps that from costing the reader anything.
 */
export async function reportError(input: ReportInput): Promise<ReportOutcome> {
  /* THE CRASH LOG (7 November 2026): a server or edge error is written to
     Vallo's own table as well, read at /admin/crashes. A browser report is
     written by its intake route (`/api/client-error`), which knows the
     platform, so it is not written twice here. */
  const context = (input.context ?? {}) as Record<string, unknown>;
  const kind = context.kind;
  /* An alert's own page (`alert.*`) already has its desk at /admin/alerts. */
  if (context.runtime !== "browser" && !(typeof kind === "string" && kind.startsWith("alert."))) {
    const route = context.routePath;
    await recordCrash({
      error: input.error,
      source: "server",
      kind: typeof kind === "string" ? kind : "server.error",
      area: typeof route === "string" ? route : null,
      release: releaseName() ?? null,
      ref: null,
    });
  }

  const target = dsn();
  if (target === null) {
    // Configured absent, or configured wrong. Either way: silence. The
    // distinction is returned for a caller that wants it, and printed by
    // nobody.
    return { sent: false, reason: (process.env.SENTRY_DSN ?? "").trim().length === 0 ? "not_configured" : "sentry_dsn_unparseable" };
  }

  const event = buildEvent(input);

  const exception = event.exception as { values: { type: string; value: string }[] };
  const first = exception.values[0];
  const key = `${first?.type ?? ""}|${first?.value ?? ""}|${String((event.tags as Record<string, unknown>).routePath ?? "")}`;
  const now = Date.now();
  const seen = lastSent.get(key);
  if (seen !== undefined && now - seen < QUIET_MS) return { sent: false, reason: "throttled" };
  lastSent.set(key, now);
  prune(now);

  // The store is a newline-delimited envelope: a header, an item header and
  // the item. Auth travels in the query string, which is the documented form
  // and keeps the key out of any header a proxy might log.
  const body = [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");

  const endpoint = `https://${target.host}/api/${target.projectId}/envelope/?sentry_key=${encodeURIComponent(target.publicKey)}&sentry_version=7`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? { sent: true } : { sent: false, reason: "transport_failed" };
  } catch {
    // Deliberately silent. The endpoint being unreachable is not news the
    // person staring at the broken screen needs, and printing here would put
    // the DSN's host in a log on every failure.
    return { sent: false, reason: "transport_failed" };
  }
}
