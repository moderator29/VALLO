import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";

const en = getDictionary("en");
import { confirmDeletionSchema } from "./schema";
import { DELETE_CONFIRM_PHRASE, DELETION_REASONS } from "./constants";

const base = { confirmPhrase: DELETE_CONFIRM_PHRASE, password: "a password" };

describe("the deletion confirmation, with a reason", () => {
  it("accepts every reason on the closed list", () => {
    for (const reason of DELETION_REASONS) {
      expect(confirmDeletionSchema.safeParse({ ...base, reason }).success).toBe(true);
    }
  });

  it("refuses a reason that is not on the list, so free text can never reach the audit line", () => {
    expect(confirmDeletionSchema.safeParse({ ...base, reason: "my own words about the app" }).success).toBe(false);
    expect(confirmDeletionSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
  });

  it("still works for a caller that sends no reason", () => {
    const parsed = confirmDeletionSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("has words for every reason, so no option shows a blank", () => {
    const words = en.settings.delete.reasons as Record<string, string>;
    for (const reason of DELETION_REASONS) {
      expect(words[reason]?.length ?? 0).toBeGreaterThan(3);
    }
    expect(Object.keys(words).sort()).toEqual([...DELETION_REASONS].sort());
  });

  it("keeps the thirty-day window the copy promises", async () => {
    const { GRACE_WINDOW_DAYS } = await import("./constants");
    expect(GRACE_WINDOW_DAYS).toBe(30);
  });
});

describe("the optional note", () => {
  it("accepts up to 500 characters and trims", () => {
    const parsed = confirmDeletionSchema.safeParse({ ...base, reasonNote: `  ${"a".repeat(500)}  ` });
    expect(parsed.success).toBe(true);
  });
  it("refuses 501 characters", () => {
    expect(confirmDeletionSchema.safeParse({ ...base, reasonNote: "a".repeat(501) }).success).toBe(false);
  });
});
