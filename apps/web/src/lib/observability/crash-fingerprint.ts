/**
 * THE CRASH LOG'S IDENTITY OF A CRASH (Platform Grade 1, 7 November 2026).
 * Pure, so it is a unit test.
 *
 * Two reports are the same crash when they come from the same platform and
 * call site with the same error type and the same message once the parts
 * that vary between people are taken out: numbers, ids, quoted values. The
 * place (first path segment) is part of it, so one bug on two screens is two
 * rows an operator can tell apart.
 */
export type CrashSource = "web" | "ios" | "android" | "server";

const SOURCES: readonly CrashSource[] = ["web", "ios", "android", "server"];

export function crashSource(value: unknown): CrashSource {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value) ? (value as CrashSource) : "web";
}

/** The message with the parts that differ per person or per moment taken out. */
export function normaliseMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/"[^"]{0,200}"|'[^']{0,200}'/g, "\"\"")
    .replace(/\b[0-9a-f]{16,}\b/gi, ":hex")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function crashFingerprint(input: {
  source: CrashSource;
  kind: string;
  type: string;
  message: string;
  area?: string | null;
}): string {
  return [input.source, input.kind, input.type, normaliseMessage(input.message), input.area ?? ""].join("|").slice(0, 200);
}

/** The top of a stack, frame per line joined, short enough to read on a phone. */
export function stackTop(stack: string | null | undefined, frames = 5): string | null {
  if (!stack) return null;
  const lines = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, frames + 1);
  return lines.length > 0 ? lines.join("\n").slice(0, 1200) : null;
}
