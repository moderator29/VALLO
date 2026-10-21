import { describe, expect, it } from "vitest";
import { LOCALES, PUSH_TEXT_REVIEW, PUSH_TEXT_RULES, localizePush, pushRuleFor, pushSummary } from "@vallo/i18n";
import { decide, planCollapse, type QueuedNotification } from "./policy";
import type { PushPayload } from "./types";

/**
 * A11: PUSH TEXT IN THE MEMBER'S LANGUAGE.
 *
 * The database writes every notification in English. The drain renders the
 * lock-screen text in the recipient's `profiles.settings.locale` from a
 * catalogue of machine drafts, all or nothing, with English as the fallback.
 * What is pinned: a known notification arrives in Hausa, Yoruba or Igbo with
 * the database's own facts carried across; an unknown one, or a known title
 * whose body has changed shape, arrives wholly in English; English and a
 * missing or unknown locale are untouched; every draft is recorded as a
 * draft; and the folded-backlog summary follows the language too.
 */

const NOW = new Date("2026-09-30T12:00:00Z");

function queued(title: string, body: string | null): QueuedNotification {
  return {
    queueId: "q1",
    userId: "u1",
    kind: "booking",
    title,
    body,
    href: "/bookings",
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 3_600_000),
  };
}

function sent(title: string, body: string | null, settings: unknown): PushPayload {
  const decision = decide({ notification: queued(title, body), settings, now: NOW });
  if (decision.action !== "send") throw new Error(`expected a send, got ${decision.action}`);
  return decision.payload;
}

describe("push text follows the recipient's language", () => {
  it("renders a known notification in Hausa, Yoruba and Igbo, keeping the database's facts", () => {
    const title = "Booking confirmed";
    const body = "Lekki Loft is confirmed for 04 Oct.";
    expect(sent(title, body, { locale: "ha" })).toMatchObject({
      title: "An tabbatar da ajiya",
      body: "An tabbatar da Lekki Loft don 04 Oct.",
    });
    expect(sent(title, body, { locale: "yo" }).body).toBe("A ti fìdí Lekki Loft múlẹ̀ fún 04 Oct.");
    expect(sent(title, body, { locale: "ig" }).body).toBe("Akwadoro Lekki Loft maka 04 Oct.");
  });

  it("keeps a member's own message word for word and translates only the title", () => {
    const payload = sent("New message", "are you guys up ?", { locale: "yo" });
    expect(payload).toMatchObject({ title: "Ìfiránṣẹ́ tuntun", body: "are you guys up ?" });
  });

  it("falls back to English for English, a missing locale and an unknown one", () => {
    const title = "Booking confirmed";
    const body = "Lekki Loft is confirmed for 04 Oct.";
    for (const settings of [{ locale: "en" }, {}, null, { locale: "fr" }]) {
      expect(sent(title, body, settings)).toMatchObject({ title, body });
    }
  });

  it("sends wholly English, never half and half, when the title is known and the body is not", () => {
    const payload = sent("Booking confirmed", "Something the catalogue has never seen.", { locale: "ha" });
    expect(payload).toMatchObject({ title: "Booking confirmed", body: "Something the catalogue has never seen." });
  });

  it("sends English for a notification the catalogue does not cover", () => {
    const payload = sent("Your owner registration is filed", "Filed as VL-AGT-10016.", { locale: "ig" });
    expect(payload.title).toBe("Your owner registration is filed");
  });

  it("tells the two 'Booking cancelled' notifications apart by their bodies", () => {
    expect(localizePush({ title: "Booking cancelled", body: "Lekki Loft has been cancelled." }, "ha").body).toBe(
      "An soke Lekki Loft.",
    );
    expect(
      localizePush({ title: "Booking cancelled", body: "Lekki Loft for 04 Oct was cancelled." }, "ha").body,
    ).toBe("An soke Lekki Loft na 04 Oct.");
  });

  it("never re-reads a filled-in fact as a placeholder", () => {
    const out = localizePush({ title: "New message", body: "see {b2} and {b1}" }, "ig");
    expect(out.body).toBe("see {b2} and {b1}");
  });

  it("folds a backlog under a summary in the member's language", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      queueId: `n${i}`,
      payload: { title: "t", body: "b", href: "/x", tag: "booking", urgent: false, quiet: false, actions: [] } as PushPayload,
      createdAt: new Date(NOW.getTime() + i * 1000),
    }));
    expect(planCollapse(candidates, "ha").send[0]!.payload.body).toBe(pushSummary(5, "ha"));
    expect(pushSummary(5, "ha")).toBe("Abubuwa 5 sun faru yayin da ba ka nan");
    expect(planCollapse(candidates).send[0]!.payload.body).toBe("5 things happened while you were away");
  });
});

describe("the push catalogue", () => {
  it("records every translated locale as a machine draft until a named speaker signs it off", () => {
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const entry = PUSH_TEXT_REVIEW[locale as "ha" | "yo" | "ig"];
      expect(entry, locale).toBeDefined();
      if (!entry) continue;
      if (entry.state === "machine-draft") expect(entry.drafted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(entry.reviewer.trim().length).toBeGreaterThan(0);
    }
  });

  it("has unique ids, anchored body patterns, and every placeholder backed by a capture", () => {
    const ids = PUSH_TEXT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of PUSH_TEXT_RULES) {
      if (!rule.body) continue;
      expect(rule.body.source.startsWith("^") && rule.body.source.endsWith("$"), rule.id).toBe(true);
      const groups = new RegExp(`${rule.body.source}|`).exec("")!.length - 1;
      for (const copy of Object.values(rule.copy)) {
        for (const m of copy.body.matchAll(/\{b(\d+)\}/g)) {
          expect(Number(m[1]), `${rule.id}: {b${m[1]}} has no capture`).toBeLessThanOrEqual(groups);
        }
        expect(copy.title.length, `${rule.id}: title over the lock-screen limit`).toBeLessThanOrEqual(40);
      }
    }
  });

  it("carries every fact the English body holds into every translation", () => {
    /* The other direction of the check above: a draft that leaves out {b2}
       drops an amount, a date or a name from the lock screen in silence. */
    const dropped: string[] = [];
    for (const rule of PUSH_TEXT_RULES) {
      if (!rule.body) continue;
      const groups = new RegExp(`${rule.body.source}|`).exec("")!.length - 1;
      for (const [locale, copy] of Object.entries(rule.copy)) {
        const used = new Set([...copy.body.matchAll(/\{b(\d+)\}/g)].map((m) => Number(m[1])));
        for (let n = 1; n <= groups; n += 1) if (!used.has(n)) dropped.push(`${rule.id} ${locale} {b${n}}`);
      }
    }
    expect(dropped, "a translation that leaves out a filled-in fact").toEqual([]);
  });

  it("matches the English exactly as the database writes it today", () => {
    const samples: Array<[string, string]> = [
      ["Booking request sent", "Your request for Lekki Loft is with the host."],
      ["New booking request", "Lekki Loft: 04 Oct to 07 Oct."],
      ["Stay complete", "Lekki Loft is recorded as complete. Thank you for staying."],
      ["Viewing booked", "2 bedroom flat, Yaba on Friday 02 Oct, 14:00. The lister is expecting you."],
      ["Viewing booked", "Ada booked Friday 02 Oct, 14:00 to see 2 bedroom flat, Yaba."],
      ["Inspection requested", "Ada wants to see the property on Friday 02 Oct, 14:00. Confirm, offer another time, or decline."],
      ["Another time offered", "The lister of the property can do Friday 02 Oct, 16:00 instead. Accept it, or reply in the thread."],
      ["Inspection complete", "Your visit to the property is recorded as done."],
      ["Your table is confirmed", "Vallo House Kitchen is expecting 4 guests on Sunday 20 Sep, 19:00."],
      ["Support replied", "Ticket VAL-SUP-69484 has a new reply."],
      ["New sign-in to Vallo", "iOS signed in to your account. Was this you? If not, open this and tap This was not me."],
      ["New follower", "@kida started following you."],
      ["New review", "A guest rated Lekki Loft 5 out of 5."],
      ["The host answered your review", "Your review of Lekki Loft has a reply."],
      ["Rent paid", "Lekki Loft: the move-in total is paid and recorded to the kobo."],
      [
        "Refund on its way",
        "NGN 25,000.00 for Lekki Loft is being returned to the card or account you paid with. Banks usually show it within 5 to 10 working days.",
      ],
      /* 13 October 2026: the notices written by migrations nt02 to nt05, as the
         probes in supabase/tests/probes read them back. */
      ["Payment received", "Lekki Loft: NGN 300,000.00 is paid. Your booking is confirmed."],
      [
        "Payment received",
        "Lekki Loft for 16 Oct to 19 Oct is paid. Your share, NGN 270,000.00, goes straight to the bank account on your payout details.",
      ],
      ["Payment received", "Lekki Loft for 16 Oct to 19 Oct is paid."],
      ["Check-in tomorrow", "Lekki Loft: you check in on Friday 16 Oct. Open your booking for the arrival details."],
      ["Check-in today", "Lekki Loft: check-in is today. Open your booking for the arrival details."],
      ["A guest arrives today", "Ada Obi arrives today at Lekki Loft."],
      ["Check-out today", "Lekki Loft: today is your check-out day. Open your booking if you need to message the host."],
      ["How was your stay?", "Tell other guests what it was like at Lekki Loft. It takes a minute."],
      ["How was your meal?", "Rate your table at Terra Kulture. It takes a minute and helps other diners choose."],
      [
        "Someone joined with your invite",
        "They need to finish a few steps, such as confirming a phone number, before the invite counts. We will tell you when it does.",
      ],
      ["Your invite counts", "NGN 1,000.00 is waiting out its review period. We will tell you when it is available."],
      ["Your referral reward is available", "NGN 1,000.00 is ready in Rewards."],
      ["Your payout is on its way", "NGN 2,500.00 was sent to your bank account ending 1234. Banks usually show it the same day."],
      ["Your payout arrived", "NGN 2,500.00 reached your bank account ending 1234."],
      [
        "Your payout did not go through",
        "NGN 2,500.00 did not reach your bank account ending 1234. The reward is still yours: open Rewards to try again, or contact support.",
      ],
      [
        "Your password was changed",
        "If this was you, there is nothing to do. If it was not, open Devices to sign out other devices, then reset your password.",
      ],
      ["Phone number confirmed", "The number ending 5678 is now confirmed on your account."],
      [
        "Both of you confirmed",
        "Lekki Loft is with Vallo for a check before payment opens. We will tell you the moment it is done.",
      ],
      ["Agreement cancelled", "The agreement for Lekki Loft was cancelled."],
    ];
    for (const [title, body] of samples) {
      expect(pushRuleFor({ title, body }), `${title}: ${body}`).not.toBeNull();
    }
  });

  it("translates the new payout words with the amount and the last four digits carried across", () => {
    const out = localizePush(
      { title: "Your payout arrived", body: "NGN 2,500.00 reached your bank account ending 1234." },
      "yo",
    );
    expect(out).toEqual({ title: "Owó rẹ ti dé", body: "NGN 2,500.00 ti dé àkọọ́lẹ̀ báńkì rẹ tó parí ní 1234." });
  });

  it("leaves a payout notice without a last four in English, whole, rather than half translated", () => {
    const english = { title: "Your payout arrived", body: "NGN 2,500.00 reached your bank account." };
    expect(localizePush(english, "ha")).toEqual(english);
  });
});
