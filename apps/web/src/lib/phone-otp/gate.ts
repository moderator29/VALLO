import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDictionary } from "@vallo/i18n";
import { phoneGateRefusal, type PhoneGateRefusal } from "../actions/envelope";
import { getLocale } from "../locale";
import { countsAsOwnReport, failsClosed, phoneGateNeeded, type PhoneMoment } from "./core";
import { phoneConfirmationOn } from "./flag";
import { isQaTester } from "./qa";

/**
 * THE MOMENTS (V-50, and the FULL GATE ruling of 13 October 2026): does this
 * action need a confirmed phone first?
 *
 * Called on the server, after sign-in and before the write, by every action
 * that is one of the moments in `core.ts`: an inspection request or visit
 * slot, a review, a report, a message that opens a new conversation, a
 * booking or table reservation, the start of any payment, and publishing a
 * listing. Returns the refusal to hand straight back (the `required` words,
 * with `gate: "phone"` so the screen draws the button to Settings, Phone), or
 * null to carry on.
 *
 * In order, cheapest first:
 *   1. the flag. Off (or unreadable: it fails to off) and nothing is read.
 *   2. a confirmed phone of the member's own. Most callers stop here.
 *   3. a QA account (`isQaTester`, server-side from the session's user id).
 *      Testers are never asked, at any moment.
 *   4. whether this is the member's FIRST action of the kind.
 *
 * A FAILED READ. For the reputation moments, a message, a visit and a
 * booking it is "no need": this is friction, not a security wall, and
 * refusing somebody because a count blinked is the worse failure. For a
 * payment and a listing it follows the money gate's documented stance
 * (`lib/identity/phone-gate.ts`, FAILS CLOSED): the action is refused with
 * the try-again sentence (`readFailed`), never with "confirm your phone",
 * because the member may well have one.
 */

type Loose = SupabaseClient;

export type PhoneGateOptions = {
  /** The report's category: a danger report is never gated. */
  reportCategory?: string;
  /**
   * For `message`: the conversation the message goes into. A conversation
   * somebody else has already written in is a reply, never gated.
   */
  conversationId?: string;
};

/** A head count that THROWS on a failed read, so the caller's stance decides. */
async function headCount(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error("count failed");
  return count ?? 0;
}

function head(db: Loose, table: string, column = "id") {
  return db.from(table).select(column, { count: "exact", head: true });
}

/**
 * How many earlier actions of this kind the member has. Zero means this is
 * the first, which is the moment that asks.
 */
async function paidDepositsAndPlans(db: Loose): Promise<number> {
  const { data, error } = await (db as unknown as {
    rpc(fn: string): PromiseLike<{ data: unknown; error: unknown }>;
  }).rpc("my_paid_deposits_and_plans_count");
  if (error) throw new Error("paid count read failed");
  return typeof data === "number" ? data : 0;
}

async function priorCount(db: Loose, userId: string, moment: PhoneMoment, options: PhoneGateOptions): Promise<number> {
  switch (moment) {
    case "inspection":
      return headCount(head(db, "inspection_requests").eq("requester_id", userId));
    case "review": {
      /* A review is a stay review or a tenancy review (V-59), so both count. */
      const [stay, tenancy] = await Promise.all([
        headCount(head(db, "reviews").eq("author_id", userId)),
        headCount(
          db.from("tenancy_reviews").select("rent_payment_id", { count: "exact", head: true }).eq("tenant_id", userId),
        ).catch(() => 0),
      ]);
      return stay + tenancy;
    }
    case "report": {
      /* Only a report the member chose to write: danger reports and the
         reports V-05 files from a renter's answers do not use up the moment. */
      const { data, error } = await db.from("reports").select("category, reason").eq("reporter_id", userId).limit(50);
      if (error) throw new Error("reports read failed");
      const rows = Array.isArray(data) ? (data as { category: string | null; reason: string | null }[]) : [];
      return rows.filter(countsAsOwnReport).length;
    }
    case "message": {
      /* Their own earlier messages, and (when the thread is named) anything
         already written in it: a thread that has words in it is not new. */
      const [sent, inThread] = await Promise.all([
        headCount(head(db, "messages").eq("sender_id", userId)),
        options.conversationId
          ? headCount(head(db, "messages").eq("conversation_id", options.conversationId))
          : Promise.resolve(0),
      ]);
      return sent + inThread;
    }
    case "booking": {
      const [stays, tables] = await Promise.all([
        headCount(head(db, "bookings").eq("guest_id", userId)),
        headCount(head(db, "reservations").eq("guest_id", userId)),
      ]);
      return stays + tables;
    }
    case "payment": {
      /* A payment that went through, of any kind the member makes. A paid
         stay and a paid rent both leave the member's booking confirmed (a
         rent charge rides on a booking row of the tenant's), so an opened
         but unpaid charge never counts as a first payment made. */
      const counts = await Promise.all([
        headCount(head(db, "bookings").eq("guest_id", userId).in("status", ["CONFIRMED", "COMPLETED", "NO_SHOW"])),
        headCount(head(db, "crypto_payments").eq("payer_id", userId).not("settled_at", "is", null)),
        /* Paid table deposits and paid plans: tables a member cannot read
           directly, so the caller's own count comes from one definer function
           (29 October 2026: the direct read failed and the gate refused). */
        paidDepositsAndPlans(db),
      ]);
      return counts.reduce((a, b) => a + b, 0);
    }
    case "listing": {
      /* A listing or a venue the member has ever sent for publishing. */
      const [listings, venues] = await Promise.all([
        headCount(
          db
            .from("listings")
            .select("id, agents!listings_agent_id_fkey!inner(user_id)", { count: "exact", head: true })
            .eq("agents.user_id", userId)
            .not("submitted_at", "is", null),
        ),
        headCount(head(db, "businesses").eq("owner_id", userId).not("submitted_at", "is", null)),
      ]);
      return listings + venues;
    }
  }
}

type GateDeps = {
  flagOn(): Promise<boolean>;
  confirmed(userId: string): Promise<boolean>;
  qa(userId: string): Promise<boolean>;
  prior(userId: string): Promise<number>;
};

export type GateVerdict = { kind: "open" } | { kind: "required" } | { kind: "unknown" };

/**
 * The decision, with every read injected so each moment is proven with the
 * flag on and off, a tester, a confirmed member and a failed read
 * (`phone-gate.test.ts`).
 */
export async function decidePhoneGate(
  deps: GateDeps,
  userId: string,
  moment: PhoneMoment,
  options: PhoneGateOptions = {},
): Promise<GateVerdict> {
  if (!(await deps.flagOn())) return { kind: "open" };
  try {
    if (await deps.confirmed(userId)) return { kind: "open" };
    if (await deps.qa(userId)) return { kind: "open" };
    const needed = phoneGateNeeded({
      flagOn: true,
      confirmed: false,
      qa: false,
      priorCount: await deps.prior(userId),
      moment,
      ...(options.reportCategory ? { reportCategory: options.reportCategory } : {}),
    });
    return needed ? { kind: "required" } : { kind: "open" };
  } catch {
    /* The tester floor holds even here: a failed read never stops a QA account. */
    if (await deps.qa(userId).catch(() => false)) return { kind: "open" };
    return failsClosed(moment) ? { kind: "unknown" } : { kind: "open" };
  }
}

export async function phoneGateFor(
  supabase: unknown,
  userId: string,
  moment: PhoneMoment,
  reportCategoryOrOptions?: string | PhoneGateOptions,
): Promise<PhoneGateRefusal | null> {
  const options: PhoneGateOptions =
    typeof reportCategoryOrOptions === "string" ? { reportCategory: reportCategoryOrOptions } : (reportCategoryOrOptions ?? {});
  const db = supabase as Loose;
  const verdict = await decidePhoneGate(
    {
      flagOn: phoneConfirmationOn,
      confirmed: async (id) => {
        const { data, error } = await db.from("confirmed_phones").select("user_id").eq("user_id", id).maybeSingle();
        if (error) throw new Error("confirmed_phones read failed");
        return Boolean(data);
      },
      qa: isQaTester,
      prior: (id) => priorCount(db, id, moment, options),
    },
    userId,
    moment,
    options,
  );
  if (verdict.kind === "open") return null;
  const copy = getDictionary(await getLocale()).trustVisible.phone;
  return verdict.kind === "required" ? phoneGateRefusal(copy.required) : phoneGateRefusal(copy.readFailed, false);
}
