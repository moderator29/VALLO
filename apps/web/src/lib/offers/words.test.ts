import { describe, expect, it } from "vitest";
import {
  AGREED_IS_NOT_SALE,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  DOCUMENT_STATE_DETAIL,
  DOCUMENT_STATE_WORD,
  doorSentence,
  eventWord,
  mandateLine,
  offerChip,
  turnSentence,
  documentChip,
} from "./words";
import type { DoorStatus, DocumentState } from "./types";

describe("offerChip", () => {
  it("says Awaiting you only on the viewer's move", () => {
    expect(offerChip({ state: "open", turn: "seller", viewerSide: "seller" })).toEqual({ chip: "pending", word: "Awaiting you" });
    expect(offerChip({ state: "open", turn: "seller", viewerSide: "buyer" }).word).toBe("With the seller");
  });
  it("never calls an agreed offer sold", () => {
    expect(offerChip({ state: "agreed", turn: null, viewerSide: "buyer" }).word).toBe("Terms agreed");
  });
  it("gives every state a word", () => {
    for (const state of ["open", "agreed", "declined", "withdrawn", "expired", "cancelled"] as const) {
      expect(offerChip({ state, turn: "buyer", viewerSide: "buyer" }).word.length).toBeGreaterThan(2);
    }
  });
});

describe("turnSentence", () => {
  it("answers whose turn it is", () => {
    expect(turnSentence({ state: "open", turn: "buyer", viewerSide: "buyer" })).toBe("It is your move.");
    expect(turnSentence({ state: "open", turn: "seller", viewerSide: "buyer" })).toBe("Waiting for the seller.");
    expect(turnSentence({ state: "declined", turn: null, viewerSide: "buyer" })).toContain("closed");
  });
});

describe("documents", () => {
  const states: DocumentState[] = ["requested", "uploaded", "under_review", "approved", "rejected", "more_information"];
  it("has six distinct words and none says verified", () => {
    const words = states.map((s) => DOCUMENT_STATE_WORD[s]);
    expect(new Set(words).size).toBe(6);
    for (const s of states) {
      expect(DOCUMENT_STATE_WORD[s].toLowerCase()).not.toContain("verified");
      expect(DOCUMENT_STATE_DETAIL[s].toLowerCase()).not.toMatch(/\bverified\b/);
    }
  });
  it("gives every state a chip and every category a label", () => {
    for (const s of states) expect(documentChip(s)).toBeTruthy();
    for (const c of DOCUMENT_CATEGORIES) expect(DOCUMENT_CATEGORY_LABEL[c]).toBeTruthy();
  });
});

describe("doors", () => {
  it("has a sentence for every status", () => {
    const all: DoorStatus[] = ["ok", "not_found", "not_signed_in", "not_eligible", "listing_unavailable", "offers_off", "own_listing", "no_mandate", "bad_amount", "amount_too_large", "price_changed", "already_open", "rate_limited", "locked", "expired", "superseded", "wrong_turn", "not_a_party", "version_changed", "idempotent_replay"];
    for (const s of all) expect(doorSentence(s)).toMatch(/\.$/);
  });
});

describe("standing sentences", () => {
  it("says an agreed offer is not a sale", () => {
    expect(AGREED_IS_NOT_SALE).toContain("not a sale");
    expect(AGREED_IS_NOT_SALE).toContain("solicitors");
  });
  it("states a mandate only when held, with the dates it has", () => {
    const fmt = (iso: string) => iso;
    expect(mandateLine(false, null, null, fmt)).toBeNull();
    expect(mandateLine(true, "2026-09-14", "2027-09-13", fmt)).toBe("This agent holds a signed sale mandate from the owner, reviewed on 2026-09-14, expiring 2027-09-13.");
    expect(mandateLine(true, null, null, fmt)).toBe("This agent holds a signed sale mandate from the owner.");
  });
  it("humanises an unknown event", () => {
    expect(eventWord("countered")).toBe("Counteroffer proposed");
    expect(eventWord("some_new_thing")).toBe("Some new thing");
  });
});
