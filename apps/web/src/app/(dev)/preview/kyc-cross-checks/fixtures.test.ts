import { describe, expect, it } from "vitest";

import { countFindings } from "@/lib/identity/cross-check/signals";
import { CLEAN_SUBJECT, DOWN_SUBJECT, STOP_SUBJECT, cleanReport, downReport, stopReport } from "./fixtures";

/**
 * The preview's three people, as the real read answers for them: one clean,
 * one with a Stop, one whose checks could not run. Invented data only.
 */
async function findingsOf(report: ReturnType<typeof cleanReport>) {
  const answer = await report;
  if (answer.state !== "ok") throw new Error("expected findings");
  return answer.findings;
}

describe("the cross-checks preview fixtures", () => {
  it("the clean person has nothing but fine lines", async () => {
    const findings = await findingsOf(cleanReport());
    expect(countFindings(findings)).toMatchObject({ stop: 0, look: 0, notRun: 0 });
    expect(findings.length).toBeGreaterThan(5);
  });

  it("the stop person has the ID number on another account and an editing mark", async () => {
    const findings = await findingsOf(stopReport());
    expect(findings[0]!.level).toBe("stop");
    expect(findings.find((f) => f.key === "id_number.shared")).toMatchObject({ level: "stop", title: "This ID number is on 1 other account" });
    expect(findings.find((f) => f.key === "file.front.editor")).toMatchObject({ level: "look", title: "The front image was saved by an editing app (Photoshop)" });
    expect(findings.find((f) => f.key === "file.selfie.screenshot")!.level).toBe("look");
    expect(findings.find((f) => f.key === "file.same")!.level).toBe("stop");
  });

  it("the third person's checks could not run, each said in its own line", async () => {
    const findings = await findingsOf(downReport());
    const notRun = findings.filter((f) => f.notRun).map((f) => f.key).sort();
    expect(notRun).toEqual(["account.phone", "account.refused", "file.back.read", "file.same", "id_number.shared", "picture.similar"]);
    expect(countFindings(findings).stop).toBe(0);
  });

  it("names nobody real: every person is marked as an example and every id is a made-up pattern", () => {
    for (const subject of [CLEAN_SUBJECT, STOP_SUBJECT, DOWN_SUBJECT]) {
      expect(subject.displayName).toMatch(/\(example\)$/);
      expect(subject.userId).toMatch(/^00000000-0000-4000-8000-0000000000[a-f0-9]{2}$/);
    }
  });
});
