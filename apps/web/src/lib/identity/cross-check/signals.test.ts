import { describe, expect, it } from "vitest";

import {
  CROSS_CHECK_SUMMARY,
  couldNotRun,
  countFindings,
  finding,
  levelWord,
  mergeFindings,
  notAvailableYet,
  orderFindings,
  otherAccounts,
} from "./signals";

describe("a cross-check finding", () => {
  it("carries a key, a level, a title and one sentence, and links only when there are some", () => {
    expect(finding("a", "ok", "Fine", "Nothing found.")).toEqual({ key: "a", level: "ok", title: "Fine", detail: "Nothing found." });
    expect(finding("a", "stop", "T", "D", [])).not.toHaveProperty("links");
    expect(finding("a", "stop", "T", "D", [{ href: "/admin/people/x", label: "Open" }]).links).toHaveLength(1);
  });

  it("says in words that a rule could not run, and never reads as nothing found", () => {
    const failed = couldNotRun("file.same", "the same file on another account");
    expect(failed.title).toBe("This check could not run: the same file on another account");
    expect(failed.notRun).toBe(true);
    expect(failed.level).not.toBe("ok");
    expect(levelWord(failed)).toBe("Not run");
    const waiting = notAvailableYet("file.same", "the same file on another account");
    expect(waiting.title).toMatch(/^Not available yet: /);
    expect(waiting.notRun).toBe(true);
  });

  it("orders stop first, then look, then what could not run, then fine, keeping the order within each", () => {
    const list = [
      finding("ok1", "ok", "", ""),
      couldNotRun("nr", "x"),
      finding("look1", "look", "", ""),
      finding("stop1", "stop", "", ""),
      finding("ok2", "ok", "", ""),
      finding("look2", "look", "", ""),
      finding("stop2", "stop", "", ""),
    ];
    expect(orderFindings(list).map((f) => f.key)).toEqual(["stop1", "stop2", "look1", "look2", "nr", "ok1", "ok2"]);
    /* The input is not reordered in place. */
    expect(list[0]!.key).toBe("ok1");
  });

  it("lets a later finding replace an earlier one with the same key", () => {
    const merged = mergeFindings([finding("a", "ok", "old", ""), finding("b", "ok", "b", "")], [finding("a", "stop", "new", "")]);
    expect(merged.map((f) => [f.key, f.title])).toEqual([
      ["a", "new"],
      ["b", "b"],
    ]);
  });

  it("counts by level, with what could not run counted apart", () => {
    expect(countFindings([finding("a", "stop", "", ""), finding("b", "look", "", ""), couldNotRun("c", "x"), finding("d", "ok", "", "")])).toEqual({
      stop: 1,
      look: 1,
      ok: 1,
      notRun: 1,
    });
  });

  it("has a word for each level and counts other accounts in plain words", () => {
    expect(levelWord(finding("a", "stop", "", ""))).toBe("Stop");
    expect(levelWord(finding("a", "look", "", ""))).toBe("Look closer");
    expect(levelWord(finding("a", "ok", "", ""))).toBe("Fine");
    expect(otherAccounts(1)).toBe("1 other account");
    expect(otherAccounts(3)).toBe("3 other accounts");
  });

  it("states plainly that nothing here is proof, and what to do with a doubt", () => {
    expect(CROSS_CHECK_SUMMARY).toBe(
      "Nothing here proves the ID is genuine. These checks catch common forgeries and reused IDs. If anything says Stop, or you still doubt it, do not approve and do not tell the member: escalate.",
    );
  });
});
