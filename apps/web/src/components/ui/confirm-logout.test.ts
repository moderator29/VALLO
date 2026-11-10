import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

const en = getDictionary("en");
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * Logging out asks first. A stray tap on Log out used to end the session with
 * no second chance; both places that offer it now open a confirmation, and the
 * button itself only opens it.
 */
const SRC = join(__dirname, "..", "..");
const read = (path: string) => withoutComments(readFileSync(join(SRC, path), "utf8"));

describe("log out asks before it signs out", () => {
  for (const [name, path, trigger] of [
    ["the settings hub", "app/(app)/settings/SettingsHub.tsx", "hub-logout"],
    ["the account section", "app/(app)/settings/AccountSection.tsx", "account-signout"],
  ] as const) {
    it(`${name}: the row opens the question and the sheet runs the sign out`, () => {
      const source = read(path);
      expect(source).toContain("ConfirmSheet");
      expect(source).toMatch(new RegExp(`onClick=\\{\\(\\) => setAsking\\(true\\)\\}[\\s\\S]{0,120}testId="${trigger}"`));
      expect(source).toContain("onConfirm={leave}");
    });
  }

  it("has the words for the question and for Cancel, in both places", () => {
    for (const block of [en.settings.hub, en.settings.account]) {
      expect(block.logOutTitle).toMatch(/log out/i);
      expect(block.logOutLine.length).toBeGreaterThan(10);
      expect(block.logOutLineAs).toContain("{email}");
      expect(block.logOutCancel).toBe("Cancel");
    }
  });

  it("makes Cancel the easy button: it is the secondary, full-width one beside the danger action", () => {
    const source = read("components/ui/ConfirmSheet.tsx");
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('variant="dangerQuiet"');
  });
});
