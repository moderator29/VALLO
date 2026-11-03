/**
 * WHY A CALL FAILED, KEPT WHERE SUPPORT CAN READ IT (27 October 2026).
 *
 * A call that did not connect used to say "the call did not connect" and
 * nothing else: the catch blocks swallowed the cause, so a failure on a phone
 * could not be told from a denied microphone, a refused token, a blocked
 * WebSocket or a silent remote track. Every step of a call now writes one line
 * here: a short name and, on a failure, the error's own name and message.
 *
 * What is written is steps and error names only. Never a token, a room name,
 * a URL or a person's name: `errorSummary` strips anything that looks like a
 * token before it is kept. The last 80 lines live in memory and are read with
 * `window.__valloCallLog()` in a debug session, and each is also a console line
 * (`[call] step detail`) that a remote inspector of the WebView shows.
 *
 * Browser only, imports nothing, and never throws: a log must not end a call.
 */
export type CallLogEntry = { at: number; step: string; detail?: string };

const LIMIT = 80;
const lines: CallLogEntry[] = [];

/** An error as one short line, with anything token-shaped removed. */
export function errorSummary(error: unknown): string {
  let name = "Error";
  let message = "";
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown };
    if (typeof e.name === "string") name = e.name;
    if (typeof e.message === "string") message = e.message;
  } else if (typeof error === "string") {
    message = error;
  }
  const clean = message
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[token]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[id]")
    .replace(/wss?:\/\/\S+/gi, "[url]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .slice(0, 100);
  return clean ? `${name}: ${clean}` : name;
}

/** Record one step of a call. */
export function callLog(step: string, detail?: string): void {
  try {
    lines.push({ at: Date.now(), step, ...(detail ? { detail } : {}) });
    if (lines.length > LIMIT) lines.splice(0, lines.length - LIMIT);
    if (typeof window !== "undefined") {
      (window as unknown as { __valloCallLog?: () => CallLogEntry[] }).__valloCallLog = () => lines.slice();
    }
    // eslint-disable-next-line no-console -- the call log is meant to be read in a remote inspector
    console.info(`[call] ${step}${detail ? ` ${detail}` : ""}`);
  } catch {
    /* A log never ends a call. */
  }
}

/** The lines kept so far, oldest first. */
export function callLogLines(): CallLogEntry[] {
  return lines.slice();
}
