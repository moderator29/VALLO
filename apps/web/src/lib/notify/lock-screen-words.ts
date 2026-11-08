/**
 * LOCK SCREEN WORDS (TODO 5.1).
 *
 * A notification on a lock screen is two lines: the title and the body.
 * The title is the what ("Booking confirmed"), the body is the where and when
 * ("Victoria Island, 3 nights"). Both are short, punchy, English only.
 *
 * Callers build their InAppNotice title/body through these helpers, so every
 * push, lock screen, banner and notification row says the same thing in the
 * same voice. The helpers are opt-in: existing callers that already have good
 * titles keep them, and new callers reach for a helper here.
 */

export type LockScreenWords = { title: string; body: string };

/** Truncate to a safe lock screen length (iOS shows about 110 chars total). */
function cap(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/** Join non-empty parts with a separator. */
function join(parts: (string | null | undefined)[], sep = ", "): string {
  return parts.filter(Boolean).join(sep);
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export function bookingConfirmed(place: string, dates?: string): LockScreenWords {
  return { title: "Booking confirmed", body: cap(join([place, dates]), 90) };
}

export function bookingCancelled(place: string, by?: string): LockScreenWords {
  return {
    title: "Booking cancelled",
    body: cap(join([place, by ? `by ${by}` : null]), 90),
  };
}

export function bookingRequest(place: string, guest?: string): LockScreenWords {
  return {
    title: "New booking request",
    body: cap(join([place, guest]), 90),
  };
}

export function bookingReminder(place: string, when?: string): LockScreenWords {
  return {
    title: "Upcoming stay",
    body: cap(join([place, when]), 90),
  };
}

export function checkInReady(place: string): LockScreenWords {
  return { title: "Check-in details ready", body: cap(place, 90) };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function newMessage(from: string, preview?: string): LockScreenWords {
  return {
    title: `Message from ${cap(from, 40)}`,
    body: cap(preview ?? "", 90),
  };
}

export function missedCall(from: string): LockScreenWords {
  return {
    title: `Missed call from ${cap(from, 40)}`,
    body: "Tap to call back or send a message",
  };
}

// ---------------------------------------------------------------------------
// Wallet and payments
// ---------------------------------------------------------------------------

export function paymentReceived(amount: string, from?: string): LockScreenWords {
  return {
    title: "Payment received",
    body: cap(join([amount, from ? `from ${from}` : null]), 90),
  };
}

export function payoutSent(amount: string, to?: string): LockScreenWords {
  return {
    title: "Payout sent",
    body: cap(join([amount, to ? `to ${to}` : null]), 90),
  };
}

export function cardSaved(): LockScreenWords {
  return {
    title: "Card saved to your account",
    body: "Your payment method is ready to use",
  };
}

export function cardRemoved(): LockScreenWords {
  return {
    title: "Card removed",
    body: "The card has been removed from your account",
  };
}

export function defaultCardChanged(): LockScreenWords {
  return {
    title: "Default card changed",
    body: "Your default payment method has been updated",
  };
}

export function bankAccountAdded(): LockScreenWords {
  return {
    title: "Bank account added",
    body: "Your bank account is ready for payouts",
  };
}

export function bankAccountRemoved(): LockScreenWords {
  return {
    title: "Bank account removed",
    body: "The bank account has been removed from your profile",
  };
}

export function payoutAccountChanged(): LockScreenWords {
  return {
    title: "Payout account changed",
    body: "Your default payout account has been updated",
  };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function listingApproved(title: string): LockScreenWords {
  return { title: "Listing approved", body: cap(title, 90) };
}

export function listingLive(title: string): LockScreenWords {
  return { title: "Your listing is live", body: cap(title, 90) };
}

export function listingNotApproved(title: string): LockScreenWords {
  return { title: "Listing not approved", body: cap(title, 90) };
}

export function listingNeedsChanges(title: string, reason?: string): LockScreenWords {
  return {
    title: "Listing needs changes",
    body: cap(join([title, reason], " - "), 90),
  };
}

export function listingPassedReview(title: string): LockScreenWords {
  return { title: "Listing passed review", body: cap(title, 90) };
}

// ---------------------------------------------------------------------------
// Agent and business
// ---------------------------------------------------------------------------

export function agentApproved(name?: string): LockScreenWords {
  return {
    title: "Application approved",
    body: cap(name ? `Welcome, ${name}` : "You are now a verified agent", 90),
  };
}

export function agentRejected(reason?: string): LockScreenWords {
  return {
    title: "Application not approved",
    body: cap(reason ?? "Please review the feedback and try again", 90),
  };
}

export function businessApproved(name: string): LockScreenWords {
  return { title: "Business approved", body: cap(name, 90) };
}

export function propertyLive(title: string): LockScreenWords {
  return { title: "Your property is live", body: cap(title, 90) };
}

export function venueLive(title: string): LockScreenWords {
  return { title: "Your venue is live", body: cap(title, 90) };
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export function newFollower(name: string): LockScreenWords {
  return { title: `${cap(name, 40)} started following you`, body: "Tap to see their profile" };
}

export function newReview(from: string, stars?: number): LockScreenWords {
  const starText = stars ? `${"★".repeat(stars)}${"☆".repeat(5 - stars)}` : null;
  return {
    title: `New review from ${cap(from, 40)}`,
    body: cap(starText ?? "See what they said", 90),
  };
}

// ---------------------------------------------------------------------------
// System and support
// ---------------------------------------------------------------------------

export function systemNotice(title: string, body?: string): LockScreenWords {
  return { title: cap(title, 50), body: cap(body ?? "", 90) };
}

export function supportReply(): LockScreenWords {
  return { title: "Reply from Vallo Support", body: "Tap to continue the conversation" };
}

// ---------------------------------------------------------------------------
// Vallo Roommates (8 November 2026): the same sentences the SQL writes
// (`roommates_2_engine.sql`), capped for a lock screen.
// ---------------------------------------------------------------------------

export function roommateInterest(from: string, note?: string | null): LockScreenWords {
  return { title: cap(`${from} is interested in sharing a home`, 50), body: cap(note || "Open Roommates to answer", 90) };
}

export function roommateAccepted(from: string): LockScreenWords {
  return { title: cap(`${from} accepted. You are connected`, 50), body: "Start a chat when you are ready" };
}

export function roommateGroupInvite(from: string, group: string): LockScreenWords {
  return { title: cap(`${from} invited you to ${group}`, 50), body: "Open the group to accept or decline" };
}

export function roommateJoinRequest(from: string, group: string): LockScreenWords {
  return { title: cap(`${from} asked to join ${group}`, 50), body: "Open the group to answer" };
}

export function roommateViewingRequest(from: string, when?: string | null): LockScreenWords {
  return { title: cap(`${from} asked to view your room`, 50), body: cap(when || "Open Roommates to answer", 90) };
}

export function roommateSearchMatch(label: string, title: string): LockScreenWords {
  return { title: cap(`A new post matches "${label}"`, 50), body: cap(title, 90) };
}

// ---------------------------------------------------------------------------
// Trust and Safety and Circle
// ---------------------------------------------------------------------------

export function safetyMessage(body: string): LockScreenWords {
  return { title: "A message from Vallo Trust and Safety", body: cap(body, 90) };
}

export function reportOutcome(): LockScreenWords {
  return { title: "We looked into your report", body: "Tap to see the outcome" };
}

export function circleReply(from: string, title: string): LockScreenWords {
  return { title: cap(`${from} replied in Circle`, 50), body: cap(title, 90) };
}

export function circleMention(from: string, title: string): LockScreenWords {
  return { title: cap(`${from} mentioned you`, 50), body: cap(title, 90) };
}

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

/** When no specific helper fits, at least cap and clean the words. */
export function generic(title: string, body: string): LockScreenWords {
  return { title: cap(title, 50), body: cap(body, 90) };
}

/**
 * THE PUSH PATH'S READER (8 November 2026): a notification row as the
 * database wrote it, turned into the lock-screen words of the helper that
 * fits it, or null when none does (the push keeps the row's own words). Used
 * by `lib/push/policy.ts` for English lock screens.
 */
export function lockScreenWordsFor(n: { title: string; body: string | null; href?: string | null }): LockScreenWords | null {
  const title = n.title.trim();
  const body = (n.body ?? "").trim();
  const href = n.href ?? "";
  let m: RegExpExecArray | null;
  if ((m = /^(.+) is interested in sharing a home$/i.exec(title))) return roommateInterest(m[1]!, body || null);
  if ((m = /^(.+) accepted\. You are connected$/i.exec(title))) return roommateAccepted(m[1]!);
  if (href.startsWith("/roommates") && (m = /^(.+) invited you to (.+)$/i.exec(title))) return roommateGroupInvite(m[1]!, m[2]!);
  if (href.startsWith("/roommates") && (m = /^(.+) asked to join (.+)$/i.exec(title))) return roommateJoinRequest(m[1]!, m[2]!);
  if ((m = /^(.+) asked to view your room$/i.exec(title))) return roommateViewingRequest(m[1]!, body || null);
  if ((m = /^A new post matches "(.+)"$/i.exec(title))) return roommateSearchMatch(m[1]!, body);
  if (/^a message from vallo trust and safety$/i.test(title)) return safetyMessage(body);
  if (/^we looked into your report$/i.test(title)) return reportOutcome();
  if (href.startsWith("/circle/") && (m = /^@?(\S+) (?:replied|answered): (.*)$/i.exec(body))) return circleReply(`@${m[1]!.replace(/^@/, "")}`, m[2]!);
  if (href.startsWith("/circle/") && (m = /^@?(\S+) mentioned you: (.*)$/i.exec(body))) return circleMention(`@${m[1]!.replace(/^@/, "")}`, m[2]!);
  return null;
}
