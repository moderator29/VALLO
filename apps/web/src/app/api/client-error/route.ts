import { NextResponse } from "next/server";

import { recordAlert } from "@/lib/alerts";
import { reportError } from "@/lib/observability/report";
import { scrubError } from "@/lib/observability/scrub";
import { recordCrash } from "@/lib/observability/crash-log";
import { crashSource } from "@/lib/observability/crash-fingerprint";
import { consume, ipFromHeaders, subjectForIp } from "@/lib/security/rate-limit";

/**
 * Where the browser posts a crash, and the only way a client error reaches
 * the reporter.
 *
 * It exists so that `SENTRY_DSN` never leaves the server and so that every
 * outbound report, from either side of the product, passes through the one
 * scrubber in `lib/observability/scrub.ts`. `lib/observability/client.ts`
 * explains the choice from the browser's end.
 *
 * ## This is an unauthenticated POST endpoint, so it is deliberately tiny
 *
 * Exactly the shape `api/csp-report` settled on, for exactly the same
 * reason: a crash is reported by the browser of somebody who may not be
 * signed in, often on the very screen that failed, so it cannot require a
 * session. The mitigations are shape rather than authentication.
 *
 * - **It stores nothing.** No table, no row, no growth.
 * - **The body is capped** and anything larger is dropped unread.
 * - **Only five fields are read**, each bounded, and the rest of the body is
 *   ignored. A caller cannot choose what appears in a report beyond a known
 *   shape, and the scrubber redacts even that.
 * - **Identical reports are throttled**, in this route and again in the
 *   reporter, so one render loop is one report.
 * - **Nothing is logged.** The raw body never reaches a log line, which is
 *   what keeps rule 16 true for a payload we did not write.
 *
 * It answers 204 to everything, including malformed input and an
 * unconfigured reporter. There is no legitimate caller to help by returning
 * an error, and a reporting endpoint that argues with the browser gets
 * retried.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reports above this are dropped unread. A real one is a few kilobytes. */
const MAX_BODY_BYTES = 24_576;

/** Longest any single field may be. */
const MAX_FIELD = 4_000;

/** How long the same error from the same area stays quiet in this process. */
const QUIET_MS = 60_000;

/** Ceiling on the throttle map, mirroring `api/csp-report`'s bounded map. */
const MAX_QUIET_KEYS = 500;

const lastSeen = new Map<string, number>();

function prune(now: number): void {
  for (const [key, at] of lastSeen) {
    if (now - at >= QUIET_MS) lastSeen.delete(key);
  }
  if (lastSeen.size <= MAX_QUIET_KEYS) return;
  let overflow = lastSeen.size - MAX_QUIET_KEYS;
  for (const key of lastSeen.keys()) {
    lastSeen.delete(key);
    overflow -= 1;
    if (overflow <= 0) break;
  }
}

function field(value: unknown, max = MAX_FIELD): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function POST(request: Request): Promise<NextResponse> {
  const acknowledged = new NextResponse(null, { status: 204 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return acknowledged;

  let payload: unknown;
  try {
    const raw = await request.text();
    // Checked again after reading, because content-length can lie or be
    // absent under chunked encoding.
    if (raw.length > MAX_BODY_BYTES) return acknowledged;
    payload = JSON.parse(raw);
  } catch {
    return acknowledged;
  }
  if (typeof payload !== "object" || payload === null) return acknowledged;
  const record = payload as Record<string, unknown>;

  const name = field(record.name, 80) || "Error";
  const message = field(record.message, 1_000);
  const stack = field(record.stack);
  const kind = field(record.kind, 80) || "client.error";
  const area = field(record.area, 80) || "/*";

  const key = `${kind}|${name}|${message.slice(0, 120)}|${area}`;
  const now = Date.now();
  const previous = lastSeen.get(key);
  if (previous !== undefined && now - previous < QUIET_MS) return acknowledged;
  if (lastSeen.size >= MAX_QUIET_KEYS) prune(now);
  lastSeen.set(key, now);

  /* SEC-17: the quiet window above is per message, so varying the message
     walked straight past it. Thirty reports per address per ten minutes is
     more than a crashing page sends and caps what a script can pour into
     the error sink. The caller still gets its 204 either way. */
  const verdict = await consume({
    bucket: "client_error",
    subject: subjectForIp(ipFromHeaders(request.headers)),
    limit: 30,
    windowSeconds: 600,
  });
  if (!verdict.allowed) return acknowledged;

  // Rebuilt as an Error so the reporter sees the same shape it sees on the
  // server, and so the scrubber runs over the message and the stack rather
  // than over a bag of strings it would have to trust.
  const error = new Error(message);
  error.name = name;
  error.stack = stack.length > 0 ? stack : undefined;

  await reportError({
    error,
    level: "error",
    context: {
      kind,
      runtime: "browser",
      // The first path segment only, and redacted again by the scrubber.
      routePath: area,
      digest: field(record.digest, 80) || undefined,
      componentStack: field(record.componentStack) || undefined,
    },
  });

  /* THE CRASH LOG (7 November 2026): one counted row per distinct crash,
     by platform, read at /admin/crashes. The alert below stays only as the
     fallback for a report the crash log could not take (its table not
     there yet), so nothing is lost while the SQL waits to be applied. */
  const logged = await recordCrash({
    error,
    source: crashSource(field(record.platform, 16)),
    kind,
    area,
    release: field(record.release, 40) || null,
    ref: field(record.digest, 80) || null,
  });
  if (logged) return acknowledged;

  /* A READABLE COPY ON THE ADMIN DESK (5 November 2026). With no SENTRY_DSN a
     browser crash left only a reference on the person's screen and nothing the
     team could read: the notification bell crashed on a founder's phone and the
     cause could not be found. The scrubbed type, message and the top of the
     stack are kept as an alert, found by the reference the screen showed.
     Best effort, like everything here: a failure changes nothing for the caller. */
  try {
    const clean = scrubError(error);
    const top = (clean.stack ?? "").split("\n").slice(0, 4).join(" | ");
    await recordAlert({
      kind: "client.error",
      severity: "warning",
      detail: {
        type: clean.type,
        text: clean.value.slice(0, 300),
        stack_top: top.slice(0, 600),
        where: area,
        ref: field(record.digest, 80) || null,
      },
      subjectId: field(record.digest, 80) || undefined,
      subjectKind: "client_error",
    });
  } catch {
    // Nothing further to do: the report above already went to the reporter.
  }

  return acknowledged;
}
