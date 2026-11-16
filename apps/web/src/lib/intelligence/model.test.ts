import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyModelAnswer, askModel, clearModelCache, modelSwitchedOff, parseModelAnswer, shouldAskModel } from "./model";
import { understand } from "./understand";

const TODAY = "2026-11-16";
const ENV = { ANTHROPIC_API_KEY: "test-key" };
const LONG = "somewhere quiet for my mum close to her church nothing too dear please";

function reply(text: string, init: { ok?: boolean; stop?: string } = {}) {
  return vi.fn(async () => ({
    ok: init.ok ?? true,
    json: async () => ({ stop_reason: init.stop ?? "end_turn", content: [{ type: "text", text }] }),
  })) as unknown as typeof fetch;
}

beforeEach(() => clearModelCache());

describe("when the model is asked", () => {
  it("only for a long query the rules mostly could not read", () => {
    const long = understand(LONG, { now: new Date("2026-11-16T10:00:00Z") });
    expect(shouldAskModel(long.understood, long.hints)).toBe(true);
    const short = understand("flats in yaba");
    expect(shouldAskModel(short.understood, short.hints)).toBe(false);
    const parsed = understand("2 bedroom apartment in lekki under 5m with pool");
    expect(shouldAskModel(parsed.understood, parsed.hints)).toBe(false);
  });

  it("never with the switch off or no key", () => {
    expect(modelSwitchedOff({ VALLO_INTELLIGENCE_MODEL: "off", ANTHROPIC_API_KEY: "k" })).toBe(true);
    expect(modelSwitchedOff({})).toBe(true);
    expect(modelSwitchedOff(ENV)).toBe(false);
  });

  it("does not call out at all when switched off", async () => {
    const fetch = reply('{"patch":{"kind":"stay"}}');
    expect(await askModel(LONG, TODAY, { fetch, env: { VALLO_INTELLIGENCE_MODEL: "off", ANTHROPIC_API_KEY: "k" } })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("what the model may say", () => {
  it("a patch, checked against the closed lists", () => {
    const answer = parseModelAnswer('{"patch":{"kind":"property","place":"Surulere","bedrooms":2,"amenities":["pool"],"maxPrice":3000000}}', TODAY);
    expect(answer).toEqual({ patch: { kind: "property", place: "Surulere, Lagos", bedrooms: 2, amenities: ["pool"], maxPrice: 3_000_000 } });
  });

  it("drops a place that is not on the list and a date in the past", () => {
    const answer = parseModelAnswer('{"patch":{"place":"Atlantis","checkIn":"2020-01-01","checkOut":"2020-01-02","guests":2}}', TODAY);
    expect(answer).toEqual({ patch: { guests: 2 } });
  });

  it("refuses an unknown field, an unknown amenity or prose", () => {
    expect(parseModelAnswer('{"patch":{"results":[1,2]}}', TODAY)).toBeNull();
    expect(parseModelAnswer('{"patch":{"amenities":["helipad"]}}', TODAY)).toBeNull();
    expect(parseModelAnswer("Here are some lovely flats!", TODAY)).toBeNull();
  });

  it("a clarifying question with tap answers", () => {
    const answer = parseModelAnswer(
      '{"clarify":{"question":"Do you want to rent or buy?","options":[{"label":"Rent","patch":{"intent":"rent"}},{"label":"Buy","patch":{"intent":"buy"}}]}}',
      TODAY,
    );
    expect(answer && "clarify" in answer && answer.clarify.options.map((o) => o.label)).toEqual(["Rent", "Buy"]);
  });

  it("is merged as a patch and marked as read by the model", () => {
    const u = understand(LONG).understood;
    const merged = applyModelAnswer(u, { patch: { kind: "stay", place: "Surulere, Lagos" } });
    expect(merged).toMatchObject({ kind: "stay", place: "Surulere, Lagos", via: "model", raw: u.raw });
    expect(merged.text).toBeUndefined();
    expect(applyModelAnswer(u, null)).toBe(u);
  });
});

describe("asking", () => {
  it("sends only the words, and caches the answer by the normalised words", async () => {
    const fetch = reply('{"patch":{"kind":"property","place":"Surulere"}}');
    const first = await askModel(LONG, TODAY, { fetch, env: ENV });
    expect(first).toEqual({ patch: { kind: "property", place: "Surulere, Lagos" } });
    const second = await askModel(`  ${LONG.toUpperCase()} `, TODAY, { fetch, env: ENV });
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0]![1].body);
    expect(body.messages).toEqual([{ role: "user", content: LONG }]);
    expect(JSON.stringify(body)).not.toMatch(/user_id|session|cookie/i);
  });

  it("falls back silently on an error, a refusal or a timeout, and does not keep a failure", async () => {
    expect(await askModel(LONG, TODAY, { fetch: reply("", { ok: false }), env: ENV })).toBeNull();
    expect(await askModel(LONG, TODAY, { fetch: reply('{"patch":{"kind":"stay"}}', { stop: "refusal" }), env: ENV })).toBeNull();
    const slow = vi.fn((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))),
    ) as unknown as typeof fetch;
    const started = Date.now();
    expect(await askModel(`${LONG} again`, TODAY, { fetch: slow, env: ENV, timeoutMs: 50 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    const later = reply('{"patch":{"kind":"stay"}}');
    expect(await askModel(`${LONG} again`, TODAY, { fetch: later, env: ENV })).toEqual({ patch: { kind: "stay" } });
  });
});
