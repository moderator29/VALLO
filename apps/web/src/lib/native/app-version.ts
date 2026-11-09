/**
 * THE SHELL'S OWN VERSION, for the push registration (FEATURE_BACKLOG A2,
 * the Android large icon). `push_tokens.app_version` lets the server send the
 * richer Android notification only to a binary that can draw it (1.0.2 and
 * later, which carry Vallo's own messaging service). Read from the App
 * plugin; undefined on the website or when the plugin cannot answer.
 *
 * THE TRAP (lib/ui/feedback.ts): the plugin object is never returned from an
 * async function; only its answer is.
 */
export async function nativeAppVersion(): Promise<string | undefined> {
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return typeof info.version === "string" && info.version.length <= 40 ? info.version : undefined;
  } catch {
    return undefined;
  }
}

/** "1.0.2" against "1.0.10" as numbers, part by part. Unreadable is never at least. */
export function versionAtLeast(version: string | null | undefined, min: string): boolean {
  if (!version) return false;
  const parse = (v: string) => v.split(/[.\s(]/).slice(0, 3).map((p) => Number.parseInt(p, 10));
  const a = parse(version);
  const b = parse(min);
  if (a.some((n) => Number.isNaN(n))) return false;
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
