/**
 * The browser's half of crash reporting: a POST to our own origin.
 *
 * ## Why the browser does not talk to the vendor directly
 *
 * Three reasons, and the first is the one that decided it:
 *
 * 1. **The DSN stays server side.** A browser transport needs a public DSN
 *    in the bundle, which means a second environment variable, a second
 *    thing to rotate and a public ingest endpoint anybody can post junk to
 *    under our project's name. Posting to our own route means `SENTRY_DSN`
 *    is read in exactly one place, on the server, and the browser never
 *    holds it.
 * 2. **One scrubber, not two.** Everything that leaves for the vendor goes
 *    through `lib/observability/scrub.ts` on the server. A direct browser
 *    transport would need the same allowlist shipped to the client, where it
 *    would drift, and where a bundle could be read to learn exactly what we
 *    filter.
 * 3. **The Content Security Policy stays shut.** A same-origin POST needs
 *    nothing added to `connect-src`, so crash reporting does not widen the
 *    policy that `lib/security/csp.ts` spent its length tightening.
 *
 * ## It is best effort and it says so
 *
 * `keepalive` lets the report survive the page being navigated away from or
 * closed, which is the common shape of a fatal client error. Every failure
 * is swallowed: this function is called from inside error boundaries, and a
 * reporter that throws inside an error boundary is an infinite loop.
 *
 * Nothing is printed here. The boundaries already `console.error` the real
 * error, and a second line about telemetry is noise on top of a crash.
 */

/** The same-origin intake. Same origin, so it needs nothing in connect-src. */
export const CLIENT_ERROR_PATH = "/api/client-error";

/** Bounds what one report can be, before it is even sent. */
const MAX_MESSAGE = 1_000;
const MAX_STACK = 4_000;

/**
 * The same error, from the same place, is reported once a minute.
 *
 * A render loop can throw hundreds of times a second, and without this the
 * first client crash would be a self-inflicted request flood on top of a
 * broken screen.
 */
const QUIET_MS = 60_000;
const recent = new Map<string, number>();

export type ClientErrorContext = {
  /** A machine token for the call site, e.g. "client.global_boundary". */
  kind: string;
  /** Next's error digest, when the boundary was handed one. */
  digest?: string;
  /** React's component stack, when there is one. */
  componentStack?: string;
};

export function reportClientError(error: unknown, context: ClientErrorContext): void {
  if (typeof window === "undefined") return;

  try {
    const asError = error instanceof Error ? error : null;
    const name = asError?.name ?? "Error";
    const message = (asError?.message ?? String(error)).slice(0, MAX_MESSAGE);
    const stack = asError?.stack?.slice(0, MAX_STACK);

    const key = `${context.kind}|${name}|${message}`;
    const now = Date.now();
    const seen = recent.get(key);
    if (seen !== undefined && now - seen < QUIET_MS) return;
    if (recent.size > 100) recent.clear();
    recent.set(key, now);

    /*
     * THE PATH IS NOT SENT. The browser has no route pattern, and a live
     * pathname names people: `/u/<handle>`, `/listing/<id>`, and every reset
     * and invite address carries its token in the query. Only the FIRST
     * segment goes, as `/<segment>/*`, which answers the question a report
     * is actually read for ("which area of the product broke") and names
     * nobody. The server treats even this as a value to redact.
     */
    const [, head = ""] = window.location.pathname.split("/");
    const area = /^[a-z0-9-]{0,32}$/i.test(head) ? `/${head}${head ? "/*" : ""}` : "/*";

    const body = JSON.stringify({
      kind: context.kind,
      name,
      message,
      stack,
      digest: context.digest,
      componentStack: context.componentStack?.slice(0, MAX_STACK),
      area,
      /* The crash log (7 November 2026) sorts by platform: inside the iOS
         or Android app, or a plain browser. No device model, no version. */
      platform: platformNow(),
      release: (process.env.NEXT_PUBLIC_BUILD_ID ?? "").slice(0, 40) || undefined,
    });

    void fetch(CLIENT_ERROR_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      // Best effort by design. See the header.
    });
  } catch {
    // Reporting must never be the second failure. See the header.
  }
}

/** "ios", "android" or "web": where this page is running. Never throws. */
function platformNow(): "ios" | "android" | "web" {
  try {
    const shell = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const name = shell?.getPlatform?.();
    return name === "ios" || name === "android" ? name : "web";
  } catch {
    return "web";
  }
}

let installed = false;

/**
 * Crashes that never reach a React error boundary: a throw in an event
 * handler, a timer or a promise nobody awaited. Before this the crash log
 * only ever heard about render crashes. Installed once, from `CrashListener`
 * in the root layout. Errors from other origins (extensions, a third party
 * script) arrive as a bare "Script error." with nothing to read and are
 * skipped.
 */
export function installGlobalCrashHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    if (!event.error && (!event.message || event.message === "Script error.")) return;
    reportClientError(event.error ?? new Error(event.message), { kind: "client.window" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    /* An aborted fetch is a person leaving a page, not a crash. */
    if (reason && typeof reason === "object" && (reason as { name?: unknown }).name === "AbortError") return;
    reportClientError(reason instanceof Error ? reason : new Error(String(reason ?? "Unhandled rejection")), { kind: "client.promise" });
  });
}
