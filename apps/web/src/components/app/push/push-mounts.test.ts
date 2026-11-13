import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE GATE ON WHERE NOTIFICATIONS ARE ASKED FOR (the founder, 13 November
 * 2026: "Unified once allowed ... no other buttons everywhere").
 *
 * One ask at the end of first run, one switch on Settings > Notifications.
 * The in-flow asks (a published listing, a booking request, an active
 * conversation) were removed; this fails the suite if one comes back.
 */

const SRC = join(__dirname, "..", "..", "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      sourceFiles(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).split(sep).join("/"),
  source: readFileSync(path, "utf8"),
}));

const FIRST_RUN = "components/app/welcome/FirstRun.tsx";
const SETTINGS_DIR = "app/(app)/settings/notifications/";

function whereSourceMatches(pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(file.source)).map((file) => file.path).sort();
}

describe("the one ask and the one switch", () => {
  it("mounts PushPrompt only in first run and on Settings > Notifications", () => {
    const mounts = whereSourceMatches(/<PushPrompt[\s/>]/);
    expect(mounts).toContain(FIRST_RUN);
    for (const path of mounts) {
      expect(path === FIRST_RUN || path.startsWith(SETTINGS_DIR), `PushPrompt mounted in ${path}`).toBe(true);
    }
  });

  it("mounts the master switch only on Settings > Notifications (and its dev preview)", () => {
    const mounts = whereSourceMatches(/<PushSetting[\s/>]/);
    expect(mounts).toContain(`${SETTINGS_DIR}page.tsx`);
    for (const path of mounts) {
      expect(path.startsWith(SETTINGS_DIR) || path.startsWith("app/(dev)/"), `PushSetting mounted in ${path}`).toBe(true);
    }
  });

  it("reaches the system prompt only through the unified turn on", () => {
    /* `enrol` asks the system; only `turn-on.ts` calls it from a tap. */
    const enrolImporters = whereSourceMatches(
      /import\s*\{[^}]*\benrol\b[^}]*\}\s*from\s*["'](?:\.\/enrol|@\/components\/app\/push\/enrol)["']/,
    );
    expect(enrolImporters).toEqual(["components/app/push/turn-on.ts"]);
    const turnOnCallers = whereSourceMatches(/\bturnOnNotifications\(\)/).filter(
      (path) => path !== "components/app/push/turn-on.ts",
    );
    expect(turnOnCallers).toEqual(["components/app/push/PushPrompt.tsx", "components/app/push/PushSetting.tsx"]);
  });

  it("carries none of the removed in-flow moments", () => {
    const removed = /moment=["'](?:listing_published|booking_requested|conversation_active|settings_opened)["']/;
    expect(whereSourceMatches(removed)).toEqual([]);
  });
});
