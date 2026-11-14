import { registerPlugin } from "@capacitor/core";

/**
 * VALLO'S OWN SHELL PLUGIN (build 1.0.2, NATIVE_BUILD_QUEUE items 5, 6, 7).
 *
 * Built into the app itself rather than shipped as a package:
 * `ios/App/App/ValloShell.swift` and
 * `android/app/src/main/java/com/vallospaces/app/ValloShellPlugin.java`.
 * Imported only from `boot.ts` behind the native gate, so the website never
 * loads `@capacitor/core` for it.
 *
 * A binary from before 1.0.2 has no such plugin: every call rejects with
 * "not implemented", and every caller treats that as "nothing to do".
 *
 * THE TRAP (lib/ui/feedback.ts): the object returned here is a thenable
 * proxy. It is a module constant and is never returned from an async
 * function, or `await` would call its `then` as a plugin method.
 */

/** A crash of the native shell itself, written on the way down and read on the next launch. */
export type NativeCrash = {
  /** "NSException", "SIGSEGV", "java.lang.IllegalStateException", "WebViewRenderProcessGone"... */
  name: string;
  message: string;
  stack: string;
  /** The binary's own version, e.g. "1.0.2 (14)". */
  release: string;
  /** When it happened, ms since the epoch. */
  at: number;
};

export type ValloShellPlugin = {
  /** Cover the app switcher picture (iOS) or the Recents thumbnail (Android 13+). */
  setPrivacyCover(options: { on: boolean }): Promise<void>;
  /** The crash written on the last run, once; null when the last run ended cleanly. */
  takeCrashReport(): Promise<{ report: NativeCrash | null }>;
  /** Android: the page's current path, kept for renderer recovery. iOS: answered and ignored. */
  notePath(options: { path: string }): Promise<void>;
  /** The page has painted: the launch mark may hand over to it. */
  handoff(): Promise<void>;
  /** Present from the build that draws no opening of its own: the page's opening is the only one. */
  pageOpens(): Promise<void>;
};

export const ValloShell = registerPlugin<ValloShellPlugin>("ValloShell");
