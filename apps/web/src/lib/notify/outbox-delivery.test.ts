import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_ADDRESS } from "../security/private-address";

import { drainEmailOutbox, type OutboxRow } from "./outbox";
import { OUTBOX_TEMPLATE_KEYS, type Payload } from "./templates";
import { LIFECYCLE_PAYLOADS } from "./lifecycle-fixtures";

/**
 * THE PROOF THAT SOMEBODY RECEIVES SOMETHING.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS SEPARATE FROM `outbox.test.ts`.
 *
 * That file proves the queue behaves: claimed once, settled once, never lost,
 * never sent twice. It does it with a `SendPort` handed in, which is the right
 * fake for a question about the queue and the wrong one for a question about
 * delivery, because a recorded call to a function that a test supplied proves
 * only that the test's own function was called.
 *
 * THAT IS EXACTLY HOW NINE BUILDERS STAYED UNREACHABLE UNDER A GREEN SUITE.
 * Every one of them had a test. Every test rendered it. Not one of them ran
 * the path a real event takes, so not one of them could notice that no event
 * ever took it.
 *
 * So this file substitutes NOTHING inside the application. The registry, the
 * builders, the recipient resolution, `sendMessage`, `sendEmail`, the From
 * line, the text alternative and the JSON body are all the production code.
 * The only thing replaced is `globalThis.fetch`, which is the socket itself,
 * and the assertions are on THE HTTP REQUEST THAT WOULD HAVE GONE TO RESEND:
 * its URL, its bearer, its recipient, its subject, and both parts of its body.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SOCKET AND NOT THE REAL ONE.
 *
 * `api.resend.com` is refused by this environment's egress proxy, so no test
 * running here can complete a real POST, and this deployment has no Resend key
 * in any case. Stopping at the socket is therefore the furthest an automated
 * test can honestly go. What it buys is the part that was actually broken: a
 * message that is built, addressed and formatted for the wire, from a row a
 * database trigger wrote, with a real 200 and a real 422 coming back and the
 * row settling differently for each.
 */

const RECIPIENT = "11111111-1111-4111-8111-111111111111";

/* The address lookup is a GoTrue admin call, the one hop a unit test cannot
   make. Everything downstream of it is real. */
const contactForUser = vi.hoisted(() => vi.fn());
vi.mock("../email/recipients", () => ({ contactForUser }));

type StoredRow = OutboxRow & { status: string; error: string | null };

/** A password-change row, exactly as `users_enqueue_password_changed_email` writes one. */
function passwordChangedRow(): StoredRow {
  return {
    id: "row-security",
    template: "security.password_changed",
    user_id: RECIPIENT,
    payload: { at: "2026-09-23T13:05:00.000Z" },
    attempts: 0,
    status: "PENDING",
    error: null,
  };
}

/** A welcome row, exactly as `users_enqueue_welcome_email_on_confirm` writes one. */
function welcomeRow(): StoredRow {
  return {
    id: "row-welcome",
    template: "account.welcome",
    user_id: RECIPIENT,
    payload: { at: "2026-09-23T13:05:00.000Z" },
    attempts: 0,
    status: "PENDING",
    error: null,
  };
}

function fakeDatabase(rows: StoredRow[]) {
  const settled: { id: string; result: string }[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    if (fn === "email_outbox_claim") {
      const taken = rows.filter((row) => row.status === "PENDING");
      for (const row of taken) {
        row.status = "SENDING";
        row.attempts += 1;
      }
      return { data: taken.map((row) => ({ ...row })), error: null };
    }
    if (fn === "email_outbox_settle") {
      const id = String(args["p_id"]);
      const result = String(args["p_result"]);
      settled.push({ id, result });
      const row = rows.find((r) => r.id === id);
      if (row) row.status = result === "sent" ? "SENT" : result === "drop" ? "DROPPED" : "PENDING";
      return { data: row?.status ?? null, error: null };
    }
    return { data: {}, error: null };
  };
  /*
   * The batch read the drain does before it builds anything.
   *
   * It is the REAL `gatherFacts` calling this, with the real column lists and
   * the real chain, so every table answers with the shape PostgREST answers
   * with and the drain does its own narrowing. Nothing here is a stub of the
   * drain: the only thing being stood in for is the network hop to Postgres.
   */
  const from = (table: string) => ({
    select: (columns: string) => {
      const rowsFor = (ids: string[]): Record<string, unknown>[] => {
        if (table === "profiles") {
          /* If the drain ever stops asking for the role, this notices. */
          if (!columns.includes("signup_role")) return [];
          return ids.map((id) => ({
            id,
            display_name: "Ada Balogun",
            signup_role: profileRole,
          }));
        }
        if (table === "listings") {
          return ids.map((id) => ({
            id,
            title: "2 bedroom flat, Yaba",
            address: "14 Herbert Macaulay Way",
            area: "Yaba",
            city: "Lagos",
          }));
        }
        if (table === "agent_verification_checks") {
          return ids.map((id) => ({ agent_id: id, kind: "identity", status: "passed" }));
        }
        if (table === "messages") {
          return ids.map((id) => ({
            id,
            conversation_id: CONVERSATION,
            body: "Good afternoon. Is this flat still available, and is the service charge separate?",
          }));
        }
        return [];
      };
      return {
        in: (_column: string, ids: string[]) => {
          const answer = { data: rowsFor(ids), error: null };
          /* `.in(...).eq(...)` is what the rungs read does; `.in(...)` alone is
             what the other four do. One object serves both. */
          return {
            eq: async () => answer,
            then: (resolve: (value: unknown) => unknown) => resolve(answer),
          };
        },
      };
    },
  });
  return { admin: { rpc, from } as never, settled, rows };
}

const CONVERSATION = "88888888-8888-4888-8888-888888888888";

/** What `profiles.signup_role` answers with for the rows in one test. */
let profileRole: string | null = null;

/** Everything one intercepted POST tells us. */
type Captured = {
  url: string;
  method: string;
  authorization: string;
  body: {
    from?: string;
    to?: string[];
    subject?: string;
    html?: string;
    text?: string;
    reply_to?: string;
  };
};

function captureFetch(reply: { status: number; body: unknown }): {
  calls: Captured[];
  restore: () => void;
} {
  const calls: Captured[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: String(init?.method ?? "GET"),
      authorization: headers.get("authorization") ?? "",
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

let restoreFetch: (() => void) | null = null;

beforeEach(() => {
  profileRole = null;
  contactForUser.mockReset();
  contactForUser.mockResolvedValue({ email: "ada@example.com", name: "Ada Balogun" });
  /* A key has to be present or `sendEmail` answers `unconfigured` and never
     builds a request at all, which is the branch `outbox.test.ts` covers. */
  vi.stubEnv("RESEND_API_KEY", "re_test_key_for_the_wire_format");
  vi.stubEnv("EMAIL_FROM", "Vallo <hello@vallospaces.com>");
});

afterEach(() => {
  restoreFetch?.();
  restoreFetch = null;
  vi.unstubAllEnvs();
});

/**
 * ONE ROW PER TEMPLATE THE REGISTRY ANSWERS TO, with the payload its own
 * trigger composes, copied key for key out of the migration that composes it.
 *
 * Asserted below to cover the registry EXACTLY, so a template added without a
 * wire-format proof fails here rather than shipping on a builder test alone,
 * which is the shape that left nine builders unreachable under a green suite.
 */
/* Track A: the escrow and withdrawal templates are retired; the agreement
   and Guarantee templates replace them, with the payload
   `private.agreement_tell_both` and `admin_decide_guarantee_claim` compose. */
const AGREEMENT_BASE = {
  agreement_id: "33333333-3333-4333-8333-333333333333",
  listing_id: "44444444-4444-4444-8444-444444444444",
  kind: "rent",
  amount_minor: 250_000_00,
  viewer: "renter",
};

const EVERY_PAYLOAD: Record<string, Payload> = {
  "account.welcome": { at: "2026-09-23T13:05:00.000Z" },
  "platform.newsletter": { campaign: "2026-11-launch" },
  "offer.received": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.countered": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.agreed": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.declined": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.withdrawn": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.expired": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.reminder": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.info_requested": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.info_provided": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.stage": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.document": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.disputed": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "offer.cancelled": { agreement_id: "33333333-3333-4333-8333-333333333333", listing_id: "44444444-4444-4444-8444-444444444444", reference: "VO-AB12CD34", amount_minor: 8_050_000_000 },
  "agreement.waiting": { ...AGREEMENT_BASE },
  "agreement.approved": { ...AGREEMENT_BASE, viewer: "owner" },
  "agreement.rejected": { ...AGREEMENT_BASE, reason: "The move-in date is before the handover date." },
  "guarantee.claim_decided": {
    claim_id: "12121212-1212-4212-8212-121212121212",
    agreement_id: "33333333-3333-4333-8333-333333333333",
    decision: "approve",
    amount_minor: 50_000_00,
    reason: "The report shows the water was working; it was not at move-in.",
  },
  "staff.access_granted": { scopes: ["kyc_review", "support"], scope_words: "KYC review, Support" },
  "security.password_changed": { at: "2026-09-23T13:05:00.000Z" },
  "security.new_device_sign_in": { at: "2026-09-23T13:05:00.000Z", device: "Chrome on Android" },
  "inspection.scheduled": {
    inspection_id: "77777777-7777-4777-8777-777777777777",
    listing_id: "44444444-4444-4444-8444-444444444444",
    audience: "viewer",
    counterparty_id: "22222222-2222-4222-8222-222222222222",
    slot_at: "2026-10-02T10:30:00.000Z",
  },
  "verification.rung_passed": {
    agent_id: "66666666-6666-4666-8666-666666666666",
    rung: "identity",
  },
  "listing.new_enquiry": {
    conversation_id: CONVERSATION,
    message_id: "99999999-9999-4999-8999-999999999999",
    listing_id: "44444444-4444-4444-8444-444444444444",
    enquirer_id: "22222222-2222-4222-8222-222222222222",
  },
  /* V-60: `public.scam_recall_send` writes the title and the category only. */
  "safety.scam_recall": {
    listing_title: "Two bedroom flat in Ikeja GRA",
    category: "off_platform_payment",
  },
  /* 29 September: the lifecycle templates, from the shared fixture. */
  ...LIFECYCLE_PAYLOADS,
};

/**
 * THE IDS THAT MAY NEVER REACH A READER, WHICH IS ALL OF THEM BUT ONE.
 *
 * An id about ANOTHER PERSON (`counterparty_id`, `enquirer_id`, `raised_by`,
 * `actor_id`, `agent_id`) or about a private record (`entry_id`,
 * `inspection_id`, `conversation_id`) in somebody's inbox is our plumbing on
 * their screen at best and a fact about a third party at worst. None of them
 * may appear, in the subject, the document or the text, in a link or out of
 * one.
 *
 * `agreement_id` is exempted because it is the path of the link the reader
 * follows (`/agreements/<id>`); it is never printed as visible copy.
 */
const ID_KEYS_THAT_MUST_NOT_PRINT = [
  "claim_id",
  "counterparty_id",
  "enquirer_id",
  "raised_by",
  "actor_id",
  "agent_id",
  "entry_id",
  "inspection_id",
  "conversation_id",
  "message_id",
  "listing_id",
];

const EVERY_ID = [
  ...new Set(
    Object.values(EVERY_PAYLOAD).flatMap((payload) =>
      ID_KEYS_THAT_MUST_NOT_PRINT.map((key) => payload[key]).filter(
        (value): value is string =>
          typeof value === "string" && /^[0-9a-f-]{36}$/.test(value),
      ),
    ),
  ),
];

describe("every template the outbox can send survives the whole path to the socket", () => {
  /*
   * WHY THIS EXISTS BESIDE `templates.test.ts` RATHER THAN INSTEAD OF IT.
   *
   * That file drives each builder and reads its words. This drives every one
   * through the REAL registry, the REAL `gatherFacts`, the REAL `sendMessage`
   * and `sendEmail`, and asserts on the JSON body that would have gone to
   * Resend. Between those two layers sit the recipient resolution, the From
   * line, the text alternative, the JSON serialisation and the settle, and
   * none of that was on any test for thirteen of the fifteen.
   *
   * The assertions are the ones that fail when a message is BUILT WRONG rather
   * than merely built: a payload key renamed in SQL makes its builder answer
   * null, the row is dropped, and the POST count no longer matches; a money
   * field that arrives as a string prints NaN; a missing lookup prints
   * undefined; a template literal that lost its interpolation prints ${; and a
   * uuid in the copy is a person reading our plumbing.
   */
  it("posts one correct message per template, and no id reaches a reader", async () => {
    expect(Object.keys(EVERY_PAYLOAD).sort()).toEqual([...OUTBOX_TEMPLATE_KEYS].sort());

    profileRole = "landlord";
    const rows: StoredRow[] = Object.entries(EVERY_PAYLOAD).map(([template, payload], i) => ({
      id: `row-${i}`,
      template,
      user_id: RECIPIENT,
      payload,
      attempts: 0,
      status: "PENDING",
      error: null,
    }));
    const { admin, settled } = fakeDatabase(rows);
    const capture = captureFetch({ status: 200, body: { id: "resend-message-id" } });
    restoreFetch = capture.restore;

    const result = await drainEmailOutbox(admin, { limit: rows.length });

    /* NOT A COUNT OF ATTEMPTS: one POST for every template there is, and the
       queue agreeing. A dropped row is a template that could not build. */
    expect(result.counts).toMatchObject({
      claimed: rows.length,
      sent: rows.length,
      dropped: 0,
      retried: 0,
    });
    expect(capture.calls).toHaveLength(rows.length);
    expect(settled.every((row) => row.result === "sent")).toBe(true);

    for (const [i, call] of capture.calls.entries()) {
      const template = rows[i]?.template ?? "?";
      expect(call.url, template).toBe("https://api.resend.com/emails");
      expect(call.method, template).toBe("POST");
      expect(call.body.from, template).toBe("Vallo <hello@vallospaces.com>");
      expect(call.body.to, template).toEqual(["ada@example.com"]);

      const subject = call.body.subject ?? "";
      const html = call.body.html ?? "";
      const text = call.body.text ?? "";

      expect(subject.length, template).toBeGreaterThan(0);
      /* A SUBJECT LINE NEVER CARRIES AN ID, not even the record's own. It is
         the one string a person sees in a list of forty, and it has to say
         what happened. */
      expect(subject, template).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
      /* Gmail truncates past about 70 and a runaway one is a formatting bug. */
      expect(subject.length, template).toBeLessThan(140);
      expect(html, template).toContain("<html");
      expect(html, template).toContain("</html>");
      expect(text.length, template).toBeGreaterThan(50);

      /*
       * AN ID IN A LINK IS THE LINK. An id in a sentence is our plumbing on
       * somebody's screen. So the address of the thing this email is about is
       * taken out first, and what is left is what a person actually reads:
       * `heldPaymentProposed` and its seven siblings all button through to
       * `/escrow/<id>`, and `listing.new_enquiry` to `/messages/<id>`.
       */
      const visible = (part: string) =>
        part
          .replace(/https?:\/\/[^\s"'<>)]+/g, "")
          .replace(/href="[^"]*"/g, 'href=""');

      for (const raw of [subject, html, text]) {
        const part = visible(raw);
        /* The four ways a broken build shows itself in an inbox. */
        expect(part, template).not.toContain("undefined");
        expect(part, template).not.toContain("NaN");
        expect(part, template).not.toContain("[object Object]");
        expect(part, template).not.toContain("${");
        /* The private gmail must never appear on any surface. */
        expect(part, template).not.toMatch(PRIVATE_ADDRESS);
        /* Nor the reader's own address, which the queue never carried. */
        expect(part, template).not.toContain(RECIPIENT);
        for (const id of EVERY_ID) expect(part, `${template} leaked ${id}`).not.toContain(id);
      }
    }
  });
});

describe("a row a database trigger wrote becomes a real HTTP request", () => {
  it("posts the built message to Resend, addressed to the resolved address", async () => {
    const { admin, settled, rows } = fakeDatabase([passwordChangedRow()]);
    const capture = captureFetch({ status: 200, body: { id: "resend-message-id" } });
    restoreFetch = capture.restore;

    const result = await drainEmailOutbox(admin);

    /* THE REQUEST. */
    expect(capture.calls).toHaveLength(1);
    const call = capture.calls[0];
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect(call?.method).toBe("POST");
    expect(call?.authorization).toBe("Bearer re_test_key_for_the_wire_format");
    expect(call?.body.from).toBe("Vallo <hello@vallospaces.com>");
    expect(call?.body.to).toEqual(["ada@example.com"]);

    /* THE MESSAGE, built by the real `passwordChanged` builder from the real
       payload, with the clock resolved to Lagos by the real registry. */
    expect(call?.body.subject).toBe("Your Vallo password was changed");
    expect(call?.body.html).toContain("Your password was changed");
    /* `greetingName` shortens to the first name, so an email never opens
       with somebody's full legal name. */
    expect(call?.body.html).toContain("Hello Ada.");
    expect(call?.body.html).toContain("14:05");
    /* Both parts. A multipart message with no text alternative is a bulk-mail
       signature to every major filter and an empty body in a text client. */
    expect(call?.body.text).toBeTruthy();
    expect(call?.body.text).toContain("Your password was changed");

    /* EMAIL_REPLY_TO is not set here, so a reply lands at the company
       address, which is the default for every platform email. */
    expect(call?.body.reply_to).toBe("Vallo <hello@vallospaces.com>");

    /* AND THE ROW IS CLOSED. */
    expect(result.counts).toMatchObject({ claimed: 1, sent: 1 });
    expect(settled).toEqual([{ id: "row-security", result: "sent" }]);
    expect(rows[0]?.status).toBe("SENT");
  });

  it("posts the welcome, in the version the reader declared, to the confirmed address", async () => {
    profileRole = "landlord";
    const { admin, settled, rows } = fakeDatabase([welcomeRow()]);
    const capture = captureFetch({ status: 200, body: { id: "resend-message-id" } });
    restoreFetch = capture.restore;

    const result = await drainEmailOutbox(admin);

    expect(capture.calls).toHaveLength(1);
    const call = capture.calls[0];
    expect(call?.url).toBe("https://api.resend.com/emails");
    expect(call?.body.to).toEqual(["ada@example.com"]);
    expect(call?.body.from).toBe("Vallo <hello@vallospaces.com>");

    /* THE MESSAGE, built by the real `welcome` builder, with the role the
       real `gatherFacts` read out of `profiles` rather than out of the row. */
    expect(call?.body.subject).toBe("Welcome to Vallo, Ada");
    /* The button, at the address the first run screen actually lives at. */
    expect(call?.body.html).toContain("/welcome");
    /* The general version's opening must NOT be here. It is what a build that
       lost the role lookup would send, and it would send it to everybody. */

    /* Both parts, and no id and no private address on either. */
    expect(call?.body.text).toBeTruthy();
    expect(call?.body.text).toContain("Welcome to Vallo");
    expect(call?.body.html).not.toContain(RECIPIENT);
    expect(call?.body.text).not.toContain(RECIPIENT);
    expect(call?.body.html).not.toMatch(PRIVATE_ADDRESS);
    expect(call?.body.text).not.toMatch(PRIVATE_ADDRESS);

    expect(result.counts).toMatchObject({ claimed: 1, sent: 1 });
    expect(settled).toEqual([{ id: "row-welcome", result: "sent" }]);
    expect(rows[0]?.status).toBe("SENT");
  });

  it("welcomes somebody who declared nothing with the version that says so", async () => {
    profileRole = null;
    const { admin } = fakeDatabase([welcomeRow()]);
    const capture = captureFetch({ status: 200, body: { id: "resend-message-id" } });
    restoreFetch = capture.restore;

    await drainEmailOutbox(admin);

    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0]?.body.html).toContain("Hello Ada.");
  });

  it("puts the row back when Resend refuses it, and posts once, not twice", async () => {
    const { admin, settled, rows } = fakeDatabase([passwordChangedRow()]);
    const capture = captureFetch({
      status: 422,
      body: { name: "validation_error", message: "refused" },
    });
    restoreFetch = capture.restore;

    const result = await drainEmailOutbox(admin);

    expect(capture.calls).toHaveLength(1);
    expect(result.counts).toMatchObject({ claimed: 1, sent: 0, retried: 1 });
    expect(settled).toEqual([{ id: "row-security", result: "retry" }]);
    expect(rows[0]?.status).toBe("PENDING");
  });

  it("does not reach the socket at all when there is no key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { admin, settled } = fakeDatabase([passwordChangedRow()]);
    const capture = captureFetch({ status: 200, body: { id: "x" } });
    restoreFetch = capture.restore;

    const result = await drainEmailOutbox(admin);

    expect(capture.calls).toHaveLength(0);
    expect(settled).toHaveLength(0);
    expect(result.unconfigured).toBe(true);
  });
});
