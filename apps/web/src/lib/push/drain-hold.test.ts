import { describe, expect, it, vi } from "vitest";

/**
 * A ROW HELD BY QUIET HOURS DOES NOT SPEND AN ATTEMPT.
 *
 * The drain's hold branch said, in its own comment, that `attempts` is
 * deliberately not incremented, because being asleep is not a failed attempt
 * and must not count towards giving up. The branch is correct on its own: it
 * writes no `attempts` at all.
 *
 * The increment is not in that branch. It is upstream in `claimDue`, which
 * raises the count on every row it takes, before anything has looked at the
 * row, because the drain reads that count to decide backoff and to decide
 * when to give up. So a row that quiet hours put back to sleep kept the
 * attempt the claim had spent on it, and a row held more than three times
 * reached MAX_QUEUE_ATTEMPTS and was given up on with no push ever having
 * been sent for it.
 *
 * The hold branch hands the attempt back. This test watches the UPDATE that
 * puts the row back to sleep.
 */

vi.mock("./transport/webpush", () => ({ sendWebPush: async () => ({ outcome: "accepted" as const, status: 201 }) }));
vi.mock("./transport/fcm", () => ({ sendFcm: async () => ({ outcome: "accepted" as const, status: 200 }) }));
vi.mock("./transport/apns", () => ({ sendApns: async () => ({ outcome: "accepted" as const, status: 201 }) }));
/* Web push is the transport that needs nobody, so it is the one a test can
   switch on. Placeholders, never a key. */
vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "not-a-key");
vi.stubEnv("VAPID_PRIVATE_KEY", "not-a-key");

const { pushDrain } = await import("./drain");

const QUEUE_ID = "66666666-6666-4666-8666-666666666666";
const NOTE_ID = "77777777-7777-4777-8777-777777777777";
const USER_ID = "88888888-8888-4888-8888-888888888888";

type Update = { table: string; patch: Record<string, unknown> };

/**
 * Enough of the database for one run: one queued row, already attempted
 * twice, for somebody whose quiet hours cover the whole day.
 */
function sleepingQueue(updates: Update[], attempts: number) {
  const builder = (table: string) => {
    let patch: Record<string, unknown> | null = null;
    let columns = "";
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.update = (next: Record<string, unknown>) => {
      patch = next;
      return chain;
    };
    chain.select = (cols?: string) => {
      if (typeof cols === "string") columns = cols;
      return chain;
    };
    chain.in = self;
    chain.eq = self;
    chain.lt = self;
    chain.lte = self;
    chain.gt = self;
    chain.is = self;
    chain.order = self;
    chain.limit = self;
    chain.upsert = async () => ({ data: null, error: null });
    chain.maybeSingle = async () => ({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let data: unknown = [];
      if (patch) {
        updates.push({ table, patch });
        /* The claim answers with the row it moved, carrying the new count. */
        data =
          patch.state === "sending"
            ? [
                {
                  id: QUEUE_ID,
                  notification_id: NOTE_ID,
                  user_id: USER_ID,
                  /* Well past the end of the quiet window, or the hold would be a
                     slow suppression and the drain would settle it instead. */
                  expires_at: new Date(Date.now() + 72 * 36e5).toISOString(),
                  attempts: patch.attempts,
                },
              ]
            : [];
      } else if (table === "push_queue") {
        data = columns.includes("attempts") ? [{ id: QUEUE_ID, attempts }] : [];
      } else if (table === "notifications") {
        data = [
          {
            id: NOTE_ID,
            kind: "social",
            title: "Somebody replied",
            body: "Open to read it.",
            href: null,
            created_at: new Date().toISOString(),
          },
        ];
      } else if (table === "profiles") {
        data = [
          {
            id: USER_ID,
            settings: {
              notifications: {
                quiet_hours: { enabled: true, from: "00:00", to: "23:58", timezone: "Africa/Lagos" },
              },
            },
          },
        ];
      }
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return chain;
  };
  return { from: (table: string) => builder(table) } as never;
}

describe("a push the recipient's quiet hours put back to sleep", () => {
  it("hands back the attempt the claim spent on it", async () => {
    const updates: Update[] = [];
    const verdict = await pushDrain(sleepingQueue(updates, 2));

    expect(verdict.counts.held).toBe(1);
    const claim = updates.find((u) => u.patch.state === "sending");
    const hold = updates.find((u) => u.patch.state === "held");
    /* The claim spent the third attempt, and the hold gave it back, so the
       row is waiting for its window with the two it arrived with. */
    expect(claim?.patch.attempts).toBe(3);
    expect(hold).toBeDefined();
    expect(hold?.patch.attempts).toBe(2);
  });

  it("never writes a negative count, whatever the row arrived with", async () => {
    const updates: Update[] = [];
    await pushDrain(sleepingQueue(updates, 0));
    const hold = updates.find((u) => u.patch.state === "held");
    expect(hold?.patch.attempts).toBe(0);
  });
});
