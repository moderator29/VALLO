import { describe, expect, it } from "vitest";
import { deliveryStates, type DeliveryInput } from "./delivery";

const mine = (id: string, extra: Partial<DeliveryInput> = {}): DeliveryInput => ({ id, mine: true, ...extra });
const theirs = (id: string, extra: Partial<DeliveryInput> = {}): DeliveryInput => ({ id, mine: false, ...extra });

describe("deliveryStates", () => {
  it("is sent for a settled message nobody has answered", () => {
    expect(deliveryStates([mine("a")]).get("a")).toBe("sent");
  });

  it("is delivered when the row says so, and read when read_at says so", () => {
    const s = deliveryStates([mine("a", { delivered: true }), mine("b", { delivered: true, read: true })]);
    expect(s.get("a")).toBe("delivered");
    expect(s.get("b")).toBe("read");
  });

  it("counts a reply as read for every earlier message of mine, and only those", () => {
    const s = deliveryStates([mine("a"), mine("b"), theirs("x"), mine("c")]);
    expect(s.get("a")).toBe("read");
    expect(s.get("b")).toBe("read");
    expect(s.get("c")).toBe("sent");
  });

  it("draws no state for a bubble on its way, a call marker, or their messages", () => {
    const s = deliveryStates([
      mine("a", { state: "sending" }),
      mine("b", { call: { callId: "c" } }),
      theirs("x"),
    ]);
    expect(s.size).toBe(0);
  });

  it("does not take a call marker or an unsent bubble from them as a reply", () => {
    const s = deliveryStates([mine("a"), theirs("m", { call: {} }), theirs("n", { state: "sending" })]);
    expect(s.get("a")).toBe("sent");
  });
});
