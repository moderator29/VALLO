import { isPrivateScreen } from "./privacy-cover-rule";

/**
 * THE APP SWITCHER COVER, THE PAGE'S HALF (NATIVE_BUILD_QUEUE item 5).
 *
 * The page says whether the screen now showing is private; the shell keeps
 * the answer and covers the window when the app leaves the screen. Two
 * sources, either is enough:
 *
 *   the path   `notePrivacyPath` from `NativeRuntime` on every navigation,
 *              judged by `isPrivateScreen` (privacy-cover-rule.ts)
 *   a hold     `holdPrivacyCover()` from a component that shows money or an
 *              identity document somewhere the path rule cannot see (a sheet
 *              over an ordinary page); it returns its release
 *
 * PLUGIN-FREE, like `status-bar-hold.ts`: the native runtime installs the sink
 * (`setPrivacySink`) only inside the shell, so on the website these calls
 * change a number and nothing else. Only a change is sent.
 */

let privatePath = false;
let holds = 0;
let sent: boolean | null = null;
let sink: ((on: boolean) => void) | null = null;

function flush(): void {
  const on = privatePath || holds > 0;
  if (on === sent || !sink) return;
  sent = on;
  try {
    sink(on);
  } catch {
    /* An older binary without the cover: the switcher shows the screen, as before. */
  }
}

let pathSink: ((path: string) => void) | null = null;

/** The screen now showing. Called by NativeRuntime on every navigation. */
export function notePrivacyPath(pathname: string): void {
  privatePath = isPrivateScreen(pathname);
  flush();
  /* Job 7: the Android shell keeps the path, so a renderer the system stops
     for memory reopens on this page (MainActivity, renderer recovery). */
  try {
    pathSink?.(pathname);
  } catch {
    /* An older binary: nothing keeps the path, and nothing breaks. */
  }
}

/** The shell's path keeper, installed by the native runtime; null takes it away. */
export function setPathSink(next: ((path: string) => void) | null): void {
  pathSink = next;
}

/** Cover the app switcher while this is held. Returns the release (idempotent). */
export function holdPrivacyCover(): () => void {
  holds += 1;
  flush();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    flush();
  };
}

/** The shell's half, installed by the native runtime; null takes it away. */
export function setPrivacySink(next: ((on: boolean) => void) | null): void {
  sink = next;
  sent = null;
  flush();
}

/** What the shell was last told; for tests. */
export function privacyCoverWanted(): boolean {
  return privatePath || holds > 0;
}
