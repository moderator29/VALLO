import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initial } from "./initial";

/** UI-10: an avatar's letter is a whole character, never half a surrogate pair. */
describe("the initial on an avatar", () => {
  it("takes a whole emoji, flag or accented letter", () => {
    expect(initial("👩🏾‍💻 Ada")).toBe("👩🏾‍💻");
    expect(initial("🇳🇬 Lagos")).toBe("🇳🇬");
    expect(initial("ọmọ")).toBe("Ọ");
    expect(initial("  ada")).toBe("A");
  });

  it("never returns a lone surrogate", () => {
    expect(initial("😀x")).not.toMatch(/^[\uD800-\uDBFF]$/);
  });

  it("falls back on an empty name", () => {
    expect(initial("")).toBe("?");
    expect(initial(null, "V")).toBe("V");
  });

  it("is what the people-facing avatars use", () => {
    const files = [
      "app/(app)/u/page.tsx",
      "components/app/identity/IdentityHeader.tsx",
      /* The story tile moved its face into StoryRingItem (feed v2, 13 October). */
      "components/social/story/StoryRingItem.tsx",
      "components/messages/VerifiedAvatar.tsx",
      /* The header avatar left the shell in Track M; the face in the drawer
         head is the shell's one avatar now. */
      "components/app/AppRail.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), "src", file), "utf8");
      expect(text, file).toContain("initial(");
    }
  });
});

describe("a long name stays inside the people card (UI-10)", () => {
  it("lets the name row shrink and wrap", () => {
    const css = readFileSync(join(process.cwd(), "src/app/social-feed.css"), "utf8");
    const at = css.indexOf("  .nf-people__name > :first-child {");
    expect(at).toBeGreaterThan(-1);
    /* `break-word`, not `anywhere` (13 November 2026). Both let a single long
       word break so it never runs past the card, which is what UI-10 asked
       for. But `anywhere` also counts toward the min-content width: it told
       the flex row that one letter was wide enough, the name column shrank to
       about 70px beside the two actions, and "Joseph Agboola" ran down the
       card as "Josep / h / Agbool / a". `break-word` keeps the column's
       min-content at the longest word, so a name wraps between its words. */
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule).toContain("overflow-wrap: break-word");
    expect(rule).not.toContain("overflow-wrap: anywhere");
    expect(css.slice(css.indexOf("  .nf-people__name {"), at)).toContain("min-inline-size: 0");
  });
});
