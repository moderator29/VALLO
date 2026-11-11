import { describe, expect, it, vi } from "vitest";

/**
 * RULE 4 AT THE HEAD OF THE DRAIN, HELD TO ITS WORD.
 *
 * `private.push_reap_stale_claims` hands a dead drain's queue rows back after
 * ten minutes. That is only safe if a device this drain has already been sent
 * to can be recognised, and the drain's own header says the recogniser is a
 * delivery row still in `sending`. The table carries that state and its check
 * constraint (`push_deliveries_read_the_reply`) exempts exactly that state
 * from needing a provider status, so the row has to be written BEFORE the
 * transport is called. Written only afterwards, a worker that died in the
 * push service's call left no row, the reaper gave the queue row back, and
 * the same person was sent the same notification twice.
 */

const sent = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("./transport/webpush", () => ({
  sendWebPush: async () => {
    sent.calls.push("transport");
    return { outcome: "accepted" as const, status: 201 };
  },
}));
vi.mock("./transport/fcm", () => ({ sendFcm: async () => ({ outcome: "accepted" as const, status: 200 }) }));
vi.mock("./transport/apns", () => ({ sendApns: async () => ({ outcome: "accepted" as const, status: 201 }) }));

const { deliverOne } = await import("./drain");

type Row = Record<string, unknown>;

/** A client that records what order the drain writes and sends in. */
function fakeClient(deliveries: Row[]) {
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.in = self;
    chain.update = self;
    chain.maybeSingle = async () => ({ data: null, error: null });
    chain.upsert = async (row: Row) => {
      if (table === "push_deliveries") {
        sent.calls.push(`delivery:${String(row.state)}`);
        deliveries.push(row);
      }
      return { data: null, error: null };
    };
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  };
  return { from: (table: string) => builder(table) } as never;
}

const TARGET = {
  id: "11111111-1111-4111-8111-111111111111",
  platform: "web" as const,
  token: "t",
  p256dh: "p",
  auth: "a",
  deviceRef: "device-1",
};

const PAYLOAD = { title: "A stay is confirmed", body: "Your dates are held.", href: "/bookings", tag: "booking", urgent: true };

describe("deliverOne records the attempt before it calls the push service", () => {
  it("writes a sending delivery row first, then the reply", async () => {
    sent.calls = [];
    const deliveries: Row[] = [];
    const counts = { devices_accepted: 0, devices_failed: 0, tokens_retired: 0 } as never;
    const outcome = await deliverOne(fakeClient(deliveries), "22222222-2222-4222-8222-222222222222", [TARGET], PAYLOAD, counts, []);
    expect(outcome).toBe("delivered");
    /* The order is the whole point: a row claiming the device, then the push
       service, then the reply over the same unique key. */
    expect(sent.calls).toEqual(["delivery:sending", "transport", "delivery:sent"]);
    expect(deliveries[0]).toMatchObject({ state: "sending", token_id: TARGET.id, attempts: 1 });
    expect(deliveries[0]).not.toHaveProperty("provider_status");
    expect(deliveries[1]).toMatchObject({ state: "sent", provider_status: 201, attempts: 1 });
  });
});
