import { describe, expect, it } from "vitest";
import { fourAnswers, hasOpenQuestion, nextRecordableStage, parseTab, stageLabelFor, trackFor } from "./model";
import { ROOM_AGREED_BUYER, ROOM_BUYER_COUNTER, ROOM_BUYER_WAITING, ROOM_DECLINED, FIXTURE_NOW_MS } from "@/lib/offers/fixtures";

describe("deal room model", () => {
  it("calls the first stage Seller reviewing until something is countered", () => {
    expect(stageLabelFor("negotiating", 1)).toBe("Seller reviewing");
    expect(stageLabelFor("negotiating", 2)).toBe("Negotiation");
  });
  it("advances the tracker on the recorded stage, not on time", () => {
    const steps = trackFor(ROOM_AGREED_BUYER);
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current", "upcoming", "upcoming", "upcoming"]);
  });
  it("stops the tracker where an offer ended", () => {
    const steps = trackFor(ROOM_DECLINED);
    expect(steps.some((s) => s.state === "failed" && s.note === "Declined")).toBe(true);
  });
  it("answers the four questions, and states a deadline only when there is one", () => {
    const withDeadline = fourAnswers(ROOM_BUYER_COUNTER, FIXTURE_NOW_MS);
    expect(withDeadline.deadline).toContain("expires on 14 Nov 2026");
    const none = fourAnswers(ROOM_BUYER_WAITING, FIXTURE_NOW_MS);
    expect(none.deadline).toBe("No deadline has been set on this offer.");
    expect(none.turn).toContain("Waiting for the seller");
  });
  it("walks the recorded stages after agreement", () => {
    expect(nextRecordableStage("agreed")).toBe("due_diligence");
    expect(nextRecordableStage("closing")).toBe("completed");
    expect(nextRecordableStage("completed")).toBeNull();
    expect(nextRecordableStage("negotiating")).toBeNull();
  });
  it("parses a tab and falls back to overview", () => {
    expect(parseTab("documents")).toBe("documents");
    expect(parseTab("nonsense")).toBe("overview");
    expect(parseTab(undefined)).toBe("overview");
  });
  it("finds an unanswered question", () => {
    expect(hasOpenQuestion(ROOM_BUYER_WAITING)).toBe(false);
  });
});
