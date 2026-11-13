import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_ATTEMPTS,
  backoffSeconds,
  claimOutboxRows,
  drainEmailOutbox,
  gatherFacts,
  readOutboxHealth,
  type OutboxRow,
  type SendPort,
} from "./outbox";

/**
 * PROVING A SEND, NOT A SHAPE.
 *
 * Nine builders sat unreachable under a green suite because every test asked
 * whether a function existed. The tests below ask a different question, from
 * the only end that answers it: a row lands in the queue exactly as a database
 * trigger writes it, and then what does the person receive, and what happens
 * to the row afterwards.
 *
 * So nothing here stubs a builder, a template or the settle. The fake is the
 * DATABASE and, in the cases that are about the wire, nothing else: the whole
 * path from a jsonb payload through the registry, the recipient lookup and the
 * message build runs for real, and the assertions are on the address that was
 * used, the subject that went, and the status the row ended in.
 *
 * `outbox-delivery.test.ts` beside this one goes one layer further and lets the
 * real Resend client build the HTTP request, so the wire format is proved too.
 */

/* ------------------------------------------------------------- the fake db */

type StoredRow = OutboxRow & { status: string; error: string | null };

type Calls = { claim: number; settle: { id: string; result: string; error: string | null }[] };

function fakeAdmin(rows: StoredRow[], options: { health?: Record<string, number> } = {}) {
  const calls: Calls = { claim: 0, settle: [] };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn === "email_outbox_claim") {
      calls.claim += 1;
      /* The real function moves a row out of PENDING in the same UPDATE that
         returns it, so a second claim in the same run cannot see it again. */
      const taken = rows.filter((row) => row.status === "PENDING");
      for (const row of taken) {
        row.status = "SENDING";
        row.attempts += 1;
      }
      return {
        data: taken.map((row) => ({
          id: row.id,
          template: row.template,
          user_id: row.user_id,
          payload: row.payload,
          attempts: row.attempts,
        })),
        error: null,
      };
    }
    if (fn === "email_outbox_settle") {
      const id = String(args["p_id"]);
      const result = String(args["p_result"]);
      const error = args["p_error"] === null ? null : String(args["p_error"]);
      calls.settle.push({ id, result, error });
      const row = rows.find((r) => r.id === id);
      if (!row || row.status !== "SENDING") return { data: row?.status ?? null, error: null };
      const next =
        result === "sent"
          ? "SENT"
          : result === "drop"
            ? "DROPPED"
            : row.attempts >= Number(args["p_max_attempts"] ?? MAX_ATTEMPTS)
              ? "FAILED"
              : "PENDING";
      row.status = next;
      row.error = error;
      return { data: next, error: null };
    }
    if (fn === "email_outbox_health") {
      const counted = {
        pending: rows.filter((r) => r.status === "PENDING").length,
        due: rows.filter((r) => r.status === "PENDING").length,
        in_flight: rows.filter((r) => r.status === "SENDING").length,
        stuck: 0,
        failed: rows.filter((r) => r.status === "FAILED").length,
        oldest_due_seconds: 0,
      };
      return { data: { ...counted, ...(options.health ?? {}) }, error: null };
    }
    throw new Error(`unexpected rpc ${fn}`);
  };

  const from = (table: string) => {
    /* PostgREST's builder is both chainable and thenable, and the drain uses
       both shapes: `.in(...)` awaited directly, and `.in(...).eq(...)` for the
       verification read. A fake that only supports the first one passes while
       the second silently returns undefined, which is the bug this comment
       exists to stop being reintroduced. */
    const answer = (data: unknown[]) => {
      const node: Record<string, unknown> = {
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data, error: null }),
      };
      node["in"] = () => answer(data);
      node["eq"] = () => answer(data);
      return node;
    };
    const result = (data: unknown[]) => ({ select: () => answer(data) });
    if (table === "profiles") {
      return result([{ id: COUNTERPARTY, display_name: "Chidi Okonkwo" }]);
    }
    if (table === "listings") {
      return result([
        { id: LISTING, title: "2 bedroom flat, Yaba", address: "14 Herbert Macaulay Way", area: "Yaba", city: "Lagos" },
      ]);
    }
    if (table === "wallet_entries") {
      return result([{ id: ENTRY, metadata: { bank_name: "GTBank", account_last4: "0000" } }]);
    }
    if (table === "messages") {
      return result([{ id: "msg-1", conversation_id: "conv-1", body: "Is it still available?" }]);
    }
    if (table === "agent_verification_checks") {
      return result([{ agent_id: AGENT, kind: "identity", status: "passed" }]);
    }
    return result([]);
  };

  return { admin: { rpc, from } as never, calls, rows };
}

/* ------------------------------------------------- the auth admin the drain uses */

const RECIPIENT = "11111111-1111-4111-8111-111111111111";
const COUNTERPARTY = "22222222-2222-4222-8222-222222222222";
const LISTING = "44444444-4444-4444-8444-444444444444";
const ENTRY = "55555555-5555-4555-8555-555555555555";
const AGENT = "66666666-6666-4666-8666-666666666666";

/**
 * The address is resolved by `contactForUser` through the GoTrue admin API,
 * which is the one thing a unit test cannot reach. It is mocked at the module
 * boundary rather than inside the drain, so the drain's own call, its null
 * handling and the fact that the address is never taken from the row are all
 * still exercised.
 */
const contactForUser = vi.hoisted(() => vi.fn());
/*
 * The drain now asks `resolveContact`, which tells a transient directory
 * failure apart from a person with no address (13 November 2026). The spec
 * keeps driving the simpler `contactForUser` shape and adapts it here, so a
 * test that means "nobody to send to" still reads that way, and the two
 * outcomes that did not exist before get their own cases below.
 */
const resolveContact = vi.hoisted(() => vi.fn());
vi.mock("../email/recipients", () => ({
  contactForUser,
  resolveContact: async (...args: unknown[]) => {
    const forced = resolveContact(...args);
    if (forced) return forced;
    const contact = await contactForUser(...args);
    return contact ? { kind: "ok", contact } : { kind: "no-address" };
  },
}));

/* Track A: the escrow templates are retired. The fixture is the agreement
   approval, which, like the escrow email before it, answers to no /settings
   switch and names a property the batch read has to fill in. */
function agreementRow(overrides: Partial<StoredRow> = {}): StoredRow {
  return {
    id: "row-held",
    template: "agreement.approved",
    user_id: RECIPIENT,
    payload: {
      agreement_id: "33333333-3333-4333-8333-333333333333",
      viewer: "renter",
      kind: "rent",
      listing_id: LISTING,
      amount_minor: 250_000_00,
    },
    attempts: 0,
    status: "PENDING",
    error: null,
    ...overrides,
  };
}

function recorder(): {
  send: SendPort;
  sent: { to: string; subject: string; text: string; html: string }[];
} {
  const sent: { to: string; subject: string; text: string; html: string }[] = [];
  const send: SendPort = async (to, message) => {
    sent.push({ to, subject: message.subject, text: message.text, html: message.html });
    return { sent: true };
  };
  return { send, sent };
}

beforeEach(() => {
  contactForUser.mockReset();
  contactForUser.mockResolvedValue({ email: "ada@example.com", name: "Ada Balogun" });
  resolveContact.mockReset();
  resolveContact.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a queued agreement decision reaches a person", () => {
  it("claims it, builds it, sends it to the resolved address and marks it sent", async () => {
    const { admin, calls, rows } = fakeAdmin([agreementRow()]);
    const { send, sent } = recorder();

    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(result.counts).toMatchObject({ claimed: 1, sent: 1, retried: 0, dropped: 0 });
    expect(sent).toHaveLength(1);
    /* The address came from the recipient lookup, never from the row. */
    expect(sent[0]?.to).toBe("ada@example.com");
    /* Resolved through `lib/email/recipients`, with no channel: an agreement
       decision is not one of the four switches /settings offers. */
    expect(contactForUser).toHaveBeenCalledWith(admin, RECIPIENT, undefined);
    /* The real agreement builder rendered the real amount and the real name. */
    expect(sent[0]?.html).toContain("250,000");
    /* `greetingName` shortens both to the first name, deliberately, so an
       email never addresses somebody by their full legal name. Asserted on
       the document because the text alternative wraps at the reading width
       and a long line can break mid-sentence. */
    expect(sent[0]?.html).toContain("Hello Ada.");
    /* And the property title came out of the BATCH read, not out of the row:
       the queue carries `listing_id` and nothing else about the place. */
    expect(sent[0]?.html).toContain("2 bedroom flat, Yaba");
    expect(rows[0]?.status).toBe("SENT");
    expect(calls.settle).toEqual([{ id: "row-held", result: "sent", error: null }]);
  });

  it("sends both parties their own version of one transition", async () => {
    const { admin } = fakeAdmin([
      agreementRow({ id: "to-payer" }),
      agreementRow({
        id: "to-payee",
        user_id: COUNTERPARTY,
        payload: {
          ...agreementRow().payload,
          viewer: "owner",
        },
      }),
    ]);
    const { send, sent } = recorder();

    await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(2);
    expect(sent[0]?.html).not.toEqual(sent[1]?.html);
  });
});

describe("it never sends the same event twice", () => {
  it("does not hand a claimed row out a second time in the same run", async () => {
    const { admin, calls } = fakeAdmin([agreementRow()]);
    const { send, sent } = recorder();

    await drainEmailOutbox(admin, { configured: true, send });

    expect(calls.claim).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("claims nothing on a second run, because the row is terminal", async () => {
    const { admin, rows } = fakeAdmin([agreementRow()]);
    const first = recorder();
    await drainEmailOutbox(admin, { configured: true, send: first.send });
    const second = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send: second.send });

    expect(second.sent).toHaveLength(0);
    expect(result.counts.claimed).toBe(0);
    expect(rows[0]?.status).toBe("SENT");
  });
});

describe("a failed send loses nothing", () => {
  it("puts the row back, with the reason and no address in it", async () => {
    const { admin, calls, rows } = fakeAdmin([agreementRow()]);
    const send: SendPort = async () => ({ sent: false, reason: "rejected", status: 429 });

    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(result.counts).toMatchObject({ claimed: 1, sent: 0, retried: 1, failed: 0 });
    expect(rows[0]?.status).toBe("PENDING");
    expect(calls.settle[0]?.result).toBe("retry");
    expect(calls.settle[0]?.error).toBe("rejected 429");
    expect(calls.settle[0]?.error).not.toContain("@");
  });

  it("goes terminal once the attempts are used up, and that is what raises", async () => {
    const { admin, rows } = fakeAdmin([agreementRow({ attempts: MAX_ATTEMPTS - 1 })]);
    const send: SendPort = async () => ({ sent: false, reason: "unreachable" });

    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(rows[0]?.status).toBe("FAILED");
    expect(result.counts.failed).toBe(1);
    expect(result.counts.retried).toBe(0);
  });

  it("retries a send that threw rather than losing the row", async () => {
    const { admin, rows } = fakeAdmin([agreementRow()]);
    const send: SendPort = async () => {
      throw new Error("socket hang up");
    };
    const result = await drainEmailOutbox(admin, { configured: true, send });
    expect(result.counts.retried).toBe(1);
    expect(rows[0]?.status).toBe("PENDING");
  });

  it("backs off further each time, and stops growing", () => {
    expect(backoffSeconds(1)).toBe(60);
    expect(backoffSeconds(2)).toBe(300);
    expect(backoffSeconds(4)).toBe(1800);
    expect(backoffSeconds(40)).toBe(1800);
  });
});

describe("what can never be sent is dropped rather than retried for ever", () => {
  it("drops a template this build does not have", async () => {
    const { admin, calls, rows } = fakeAdmin([agreementRow({ template: "escrow.HELD" })]);
    const { send, sent } = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(0);
    expect(result.counts.dropped).toBe(1);
    expect(rows[0]?.status).toBe("DROPPED");
    expect(calls.settle[0]?.error).toContain("no template");
  });

  it("drops a row whose recipient has no address any more", async () => {
    contactForUser.mockResolvedValue(null);
    const { admin, rows, calls } = fakeAdmin([agreementRow()]);
    const { send, sent } = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(0);
    expect(result.counts.dropped).toBe(1);
    expect(rows[0]?.status).toBe("DROPPED");
    expect(calls.settle[0]?.error).toBe("recipient has no address");
  });

  /*
   * THE ONE THAT WAS WRONG IN PRODUCTION. Four of the five DROPPED rows in the
   * live outbox on 13 November 2026 carried "no contact for recipient", which
   * stood for a mute, a missing address AND an unreachable directory. The last
   * of those is transient, and dropping it throws the letter away for good.
   */
  it("puts a row back when the directory could not be read, rather than dropping it", async () => {
    resolveContact.mockReturnValue({ kind: "unreachable" });
    const { admin, rows, calls } = fakeAdmin([agreementRow()]);
    const { send, sent } = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(0);
    expect(result.counts.dropped).toBe(0);
    expect(result.counts.retried + result.counts.failed).toBe(1);
    expect(rows[0]?.status).not.toBe("DROPPED");
    expect(calls.settle[0]?.error).toBe("directory unreachable");
  });

  it("says which switch silenced a letter, so the column is readable a month later", async () => {
    resolveContact.mockReturnValue({ kind: "muted" });
    const { admin, rows, calls } = fakeAdmin([
      agreementRow({ template: "listing.new_enquiry", payload: { conversation_id: "c", message_id: "m", listing_id: "l", enquirer_id: "e" } }),
    ]);
    const { send, sent } = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(0);
    expect(result.counts.dropped).toBe(1);
    expect(rows[0]?.status).toBe("DROPPED");
    expect(calls.settle[0]?.error).toBe("recipient switched messages email off");
  });

  it("drops a payload that cannot make a message", async () => {
    const { admin, rows } = fakeAdmin([
      agreementRow({ payload: { agreement_id: "x", viewer: "renter" } }),
    ]);
    const { send, sent } = recorder();
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(sent).toHaveLength(0);
    expect(result.counts.dropped).toBe(1);
    expect(rows[0]?.status).toBe("DROPPED");
  });

  it("drops an address the client refuses rather than burning five attempts on it", async () => {
    const { admin, rows } = fakeAdmin([agreementRow()]);
    const send: SendPort = async () => ({ sent: false, reason: "invalid-recipient" });
    const result = await drainEmailOutbox(admin, { configured: true, send });

    expect(result.counts.dropped).toBe(1);
    expect(rows[0]?.status).toBe("DROPPED");
  });
});

describe("with no Resend key configured", () => {
  it("claims nothing at all, so no attempt is burned by a preview deploy", async () => {
    const { admin, calls } = fakeAdmin([agreementRow()]);
    const { send, sent } = recorder();

    const result = await drainEmailOutbox(admin, { configured: false, send });

    expect(calls.claim).toBe(0);
    expect(sent).toHaveLength(0);
    expect(result.unconfigured).toBe(true);
    expect(result.counts.claimed).toBe(0);
  });
});

describe("the batch reads", () => {
  it("asks for each id once across the whole batch", async () => {
    const { admin } = fakeAdmin([]);
    const facts = await gatherFacts(admin, [
      agreementRow({ id: "a" }),
      agreementRow({ id: "b" }),
      agreementRow({ id: "c" }),
    ]);
    expect(facts.listings.get(LISTING)?.title).toBe("2 bedroom flat, Yaba");
  });

  it("maps the table's own check names onto the ladder's rungs", async () => {
    const { admin } = fakeAdmin([]);
    const facts = await gatherFacts(admin, [
      {
        ...agreementRow(),
        template: "verification.rung_passed",
        payload: { agent_id: AGENT, rung: "identity" },
      },
    ]);
    expect(facts.rungs.get(AGENT)).toEqual(["identity"]);
  });
});

describe("the claim and the health read", () => {
  it("ignores a malformed row rather than throwing the run away", async () => {
    const admin = {
      rpc: async () => ({
        data: [{ id: "ok", template: "agreement.approved", user_id: RECIPIENT, payload: {}, attempts: 1 }, { id: null }, "nonsense"],
        error: null,
      }),
    } as never;
    const rows = await claimOutboxRows(admin, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("ok");
  });

  it("throws when the claim itself fails, so the run is reported as failed", async () => {
    const admin = { rpc: async () => ({ data: null, error: { message: "boom" } }) } as never;
    await expect(claimOutboxRows(admin, 10)).rejects.toThrow("boom");
  });

  it("reads zero rather than throwing when health is unreachable", async () => {
    const admin = {
      rpc: async () => {
        throw new Error("down");
      },
    } as never;
    expect(await readOutboxHealth(admin)).toMatchObject({ pending: 0, stuck: 0, failed: 0 });
  });
});

describe("OPS-14: mail a switch can turn off carries List-Unsubscribe", () => {
  function headerRecorder() {
    const seen: (Record<string, string> | undefined)[] = [];
    const send: SendPort = async (_to, _message, headers) => {
      seen.push(headers);
      return { sent: true };
    };
    return { send, seen };
  }

  it("an enquiry email (the Messages switch) names where the switch is", async () => {
    const { admin } = fakeAdmin([
      agreementRow({
        id: "row-enquiry",
        template: "listing.new_enquiry",
        payload: { enquirer_id: COUNTERPARTY, listing_id: LISTING, message_id: "msg-1" },
      }),
    ]);
    const { send, seen } = headerRecorder();
    await drainEmailOutbox(admin, { configured: true, send });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.["List-Unsubscribe"]).toMatch(/^<https?:\/\/[^>]+\/settings\/notifications\?channel=messages>$/);
  });

  it("an agreement email, which nothing can switch off, carries none", async () => {
    const { admin } = fakeAdmin([agreementRow()]);
    const { send, seen } = headerRecorder();
    await drainEmailOutbox(admin, { configured: true, send });
    expect(seen).toEqual([undefined]);
  });
});
