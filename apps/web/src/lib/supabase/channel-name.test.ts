import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ownChannelName } from "./channel-name";

/**
 * The notification bell crashed on a phone (6 November 2026) with "cannot add
 * `postgres_changes` callbacks ... after `subscribe()`": the browser client
 * hands back an existing channel when the same name is asked for again, and a
 * screen visited twice quickly asked before the first had been removed.
 */
describe("ownChannelName", () => {
  it("never gives the same name twice, and keeps the readable base", () => {
    const names = new Set(Array.from({ length: 500 }, () => ownChannelName("notifications-abc")));
    expect(names.size).toBe(500);
    for (const name of names) expect(name.startsWith("notifications-abc:")).toBe(true);
  });
});

/**
 * A channel that listens to the DATABASE must have a name of its own. A channel
 * matched BY NAME between people (typing, calls) is the exception and is listed
 * here on purpose; anything new has to choose a side.
 */
const SHARED_NAME_CHANNELS = [
  "typing-${conversationId}",
  "typing-${id}",
  "call-${callId}",
  "call-invites-${userId}",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

describe("every realtime channel", () => {
  it("either has its own name or is one of the shared-name broadcast channels", () => {
    const root = join(__dirname, "..", "..");
    const offenders: string[] = [];
    for (const file of [...sourceFiles(join(root, "lib")), ...sourceFiles(join(root, "components")), ...sourceFiles(join(root, "app"))]) {
      if (file.endsWith("channel-name.ts")) continue; // its own comment names the call
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\.channel\(\s*([^)]*)/g)) {
        const arg = match[1] ?? "";
        if (arg.includes("ownChannelName(")) continue;
        if (SHARED_NAME_CHANNELS.some((shared) => arg.includes(shared))) continue;
        offenders.push(`${file.replace(root, "src")}: .channel(${arg.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
