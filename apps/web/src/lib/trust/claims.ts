/**
 * THE CLAIMS RULE, EXECUTABLE (V-02).
 *
 * A word that promises something ("verified", "checked", "secure", "safe",
 * "guaranteed", "encrypted", "protected", "insured") may appear in copy a
 * person reads only when a mechanism in this codebase makes it true. Every
 * such use is either
 *
 *   - BACKED: it matches an entry below, and the entry names the mechanism
 *     (a column, a policy, a provider, a guard) that makes it true; or
 *   - NOT A CLAIM: a negation ("not protected by us", "we have not checked"),
 *     or the word in its everyday sense ("once you have checked out").
 *
 * Anything else fails `claims.test.ts`, which runs in `npm run lint` and before
 * `npm run build`. Adding a claim means adding its mechanism here, in the same
 * change, where a reviewer can read both.
 *
 * WHEN IT STOPS A BUILD. Because the check is in `prebuild`, a hotfix that
 * adds a sentence with one of these words will not build until the claim is
 * backed. The remedy is one line: add `{ phrase: /the exact words/i,
 * mechanism: "what makes it true" }` to BACKED_CLAIMS below (or reword the
 * sentence). The failure message prints the file, line and sentence. Do not
 * remove the check from `prebuild` to get a build out; a false claim shipped
 * is the thing it exists to stop.
 *
 * The check runs under vitest, so `prebuild` needs the web app's
 * devDependencies installed (a production-only install cannot build).
 *
 * Scope: the app's copy, the four locale catalogues and the English modules
 * they are assembled from (packages/i18n/src/locales/*.en.ts), the auth email templates
 * in supabase/templates, the native shell's offline page and the iOS and
 * Android native strings.
 *
 * Client-safe: plain data and pure functions.
 */

/** The promising words. A hyphen or a dot next to the word means it is part of
    an identifier or a class name (`safe-area`, `nf-badge--verified`,
    `listing.verified`), not a word a person reads. */
export const CLAIM_WORD =
  /(?<![\p{L}\p{N}_.-])(verified|guaranteed?|guarantees|secure|securely|safe|safely|encrypted|checked|protected|insured|instant|instantly)(?![\p{L}\p{N}_-])/giu;

export type BackedClaim = {
  /** Matches the claim in context; everything it matches is accepted. */
  phrase: RegExp;
  /** What makes it true. Named so a reviewer can go and look. */
  mechanism: string;
  /**
   * Set only on a sentence already deleted on the release branch by another
   * change, so this branch's copy of it does not fail here in the meantime.
   * Such an entry is exempt from the "must still match something" check.
   */
  pendingRemoval?: string;
  /**
   * The one file (repository-relative, forward slashes) the entry is accepted
   * in. A scoped entry backs its sentence there and nowhere else, so a new
   * sentence with the same words in any other file is still a claim to back.
   * `unbackedClaim` called without a file applies no scoped entry.
   */
  onlyIn?: string;
};

/** Where the money sentences live (D50: every protected-rail sentence is here). */
export const MONEY_COPY_FILE = "apps/web/src/lib/money/copy.ts";

const AGENT_KYC =
  "agent_verification_checks rungs decided by an admin on the KYC desk, published as agent_badges.verified; a listing is verified only when !is_demo and its agent holds the badge (lib/listings/supabase-repository.ts)";
const AGENT_APPROVAL =
  "agents rows are written only by admins (policy agents_manage_admin): a lister exists only after a person approved the application";
const LISTING_REVIEW =
  "admin listing review queue (lib/admin/actions.ts) and the owner write guard listings_00_guard_owner_write: a member cannot publish a listing";
const PAYSTACK = "Paystack's hosted checkout: card details are entered on Paystack's page, never on Vallo";
const SUPPLY_CHECKS = "supply verification rows written from the admin supply desk (lib/supply/roles.ts)";

export const BACKED_CLAIMS: readonly BackedClaim[] = [
  /* The verified mark and the words around it. */
  { phrase: /^(?:a )?verified(?: vallo)?(?: agent| owner| host| account| listing)?(?: only)?\.?$/i, mechanism: AGENT_KYC },
  { phrase: /\b(?:identity|address|payout|fully) verified\b/i, mechanism: AGENT_KYC },
  { phrase: /\bverified (?:tick|mark|badge|agent|owner|host|listing|person|stays? by)\b/i, mechanism: AGENT_KYC },
  { phrase: /\bverified(?: is about a person| and third party| means)\b/i, mechanism: AGENT_KYC },
  { phrase: /\b(?:what (?:does )?verified mean|how are agents verified|you are verified|verified:\s*\$\{)/i, mechanism: AGENT_KYC },
  { phrase: /\bcannot be verified yet\b/i, mechanism: AGENT_KYC },
  { phrase: /^checked by a person$/i, mechanism: AGENT_KYC },
  { phrase: /\bthe name vallo checked\b/i, mechanism: AGENT_KYC },
  { phrase: /\bchecked the record on\b|\b(?:registration|mandate) checked\b/i, mechanism: SUPPLY_CHECKS },
  { phrase: /\bhow far the person behind a listing has been checked\b|\beach person is checked on their own\b|\bchecked harder than owners\b/i, mechanism: SUPPLY_CHECKS },
  { phrase: /^address checked$/i, mechanism: "listings.address_verified_at, stamped by an admin (the owner write guard stops a lister writing it)" },
  { phrase: /\bchecked before (?:the listing goes|it went|going) live\b|\bsubmissions waiting to be checked\b/i, mechanism: LISTING_REVIEW },
  { phrase: /\bchecked against the parts\b/i, mechanism: "the move-in total is compared with the sum of its parts in lib/listings (stated vs computed)" },

  /* Payments. */
  { phrase: /\bsecure (?:payment|paystack|card) (?:page|window)\b|\bsecure page in naira\b/i, mechanism: PAYSTACK },
  { phrase: /\bto secure (?:them|it|your)\b/i, mechanism: "the verb 'to secure' (to reserve dates), not a security claim" },

  /* Data protection, in the privacy policy and the docs. */
  { phrase: /\bprotected with row level security\b/i, mechanism: "row level security on public.profiles (profiles_update_own / profiles_select_own)" },
  { phrase: /\bencrypted in transit\b|\bencryption in transit\b/i, mechanism: "HTTPS only with HSTS on www.vallospaces.com; Supabase over TLS" },
  { phrase: /\bhow it is protected\b|\bkeep (?:it|the service) (?:working and )?secure\b|\bused to keep it working and secure\b/i, mechanism: "the privacy policy's own section on protection (encryption in transit, RLS, hashed passwords, licensed payment providers)" },

  /* Everyday senses of "checked". */
  { phrase: /\bchecked out\b/i, mechanism: "a stay's check-out, not a trust claim" },
  { phrase: /^Have you checked in\?$|^Yes, I've checked in$/, onlyIn: MONEY_COPY_FILE, mechanism: "a stay's check-in, asked of the guest on the protected payment milestone (spec screen 6), not a trust claim" },
  { phrase: /\brooms checked\b|^\s+checked$|\bthings that can be checked\b/i, mechanism: "the member's own inspection checklist and evidence, not a platform claim" },
  { phrase: /\bchecked many times\b|\bhave checked that (?:payment|movement)\b|\bhave checked several accounts\b|\bcould not be checked\b|\buntil you have checked\b/i, mechanism: "payment status polling against the provider, not a trust claim" },
  { phrase: /\bwhat you already checked\b|\breservation is checked against\b|\buntil it is checked\b/i, mechanism: "a process description, not a claim about a listing or a person" },
  { phrase: /\bwhether a purchase is safe\b/i, mechanism: "advice (title decides), not a claim" },
  { phrase: /\bwhat a stay is protected by instead\b/i, mechanism: "a heading over the cancellation policy text on /safety" },

  { phrase: /\bwhether the lister is verified\b|\bcalling everyone verified\b|^,\s*verified$|^tier \{tier\} of 4, verified$/i, mechanism: `${AGENT_KYC}; a business's ", verified" is businesses.verified, which only staff can set (the DB-01 guard)` },
  { phrase: /\bchecked (?:badge|lister)\b|^verified:\s*$|^checked$|^a person checked\.?$|\bchecked against the uploaded document\b/i, mechanism: AGENT_KYC },
  { phrase: /\bprepare that (?:photo|picture) safely\b/i, mechanism: "the client-side re-encode before upload (strips metadata); a process, not a claim" },
  { phrase: /\brather than checked in passing\b|\bwhile it is checked\b|\brooms are checked\b/i, mechanism: "a process description (a database constraint; a report being read; the member's own checklist)" },
  /* The Vallo Guarantee (Track A, 25 September 2026): a product name, not a
     promise that money is guaranteed. What backs it is a real reserve and a
     reviewed, capped claim, both enforced in the database. */
  {
    phrase: /\bguarantee\b/i,
    mechanism:
      "public.guarantee_reserve_entries (append-only ledger funded by the split at settle_booking_charge) and public.admin_decide_guarantee_claim, which caps each claim by the amount paid and the reserve balance under an advisory lock; scope and window in public.money_policy",
  },
  /* The protected rail (D50): "protected" names a payment a licensed
     partner holds in escrow until the payer confirms. Every such sentence
     lives in lib/money/copy.ts (RAIL_COPY.protected, PROTECTED_*, the money
     centre's Protected figure) and is drawn only where the server reads the
     rail as working: protectedRailLive() in lib/money/rail-live.ts (13 October
     2026, replacing the constant PROTECTED_RAIL_LIVE), which is true only
     while a Payluk key is configured for the deployment (live key in
     production only), PAYMENTS_KILL_PAYLUK is not set and payments_payluk_on
     is on. "Held" is recorded only from the partner's own report (its signed
     webhook or a read-back): provider_arrangement_observe refuses any state
     but "asked" or "unknown" from Vallo itself. The dev previews that draw it
     are fixtures.
     A9: the entry read `\bprotected payments?\b` unanchored, which backed
     "protected payment" in any sentence on any surface while the rail is not
     live. It now backs the three copy.ts sentences, whole, in copy.ts only. */
  {
    phrase:
      /^Your payment is protected through Vallo's transaction infrastructure\.$|^Protected$|^Held in protected payments until each one's release condition is met\. Not yours to withdraw yet\.$/,
    onlyIn: MONEY_COPY_FILE,
    mechanism:
      "the protected rail: funds held by the licensed provider's escrow until release (docs/payments/VALLO_FINANCIAL_LAYER.md); a payment reads as held only after the provider reports it (signed webhook or read-back, public.provider_arrangement_observe); surfaces gated on the server by protectedRailLive() in apps/web/src/lib/money/rail-live.ts (Payluk key configured for the deployment, PAYMENTS_KILL_PAYLUK not set, payments_payluk_on on)",
  },
  /* The protected rail's screens (EscrowPay, 10 November 2026): the same
     claim as above, for the new provider. Each sentence names the transfer
     rail or a state the provider confirmed, and is drawn only by
     components/money/protected-rail, which picks its screen from the recorded
     state (lib/money/protected-journey.ts), never from the browser. No live
     page mounts it: the rail is switched off (payments_escrowpay_on, fail
     closed, lib/payments/providers/escrowpay/switch.ts), the client sends
     nothing while the API is undocumented (DOCUMENTED false), and every
     category is disabled (public.protected_payment_categories). Whole
     sentences, copy.ts only. */
  {
    phrase:
      /^Protected bank transfer$|^Continue with protected transfer$|^Your payment is protected\.$|^Protected transaction amount$/,
    onlyIn: MONEY_COPY_FILE,
    mechanism:
      "the new protected rail (lib/payments/providers/escrowpay): funds held by the custodian bank named in lib/money/protected-wording.ts under the provider's agreement until release; the screens draw 'protected' only on a provider-confirmed state recorded in provider_arrangements; switched off by payments_escrowpay_on (fail closed), DOCUMENTED false in lib/payments/providers/escrowpay/client.ts, and every category disabled in public.protected_payment_categories",
  },
  /* The protected rail's trust page, failure states and receipt (10
     November 2026), the same claim as the entry above, for the explainer at
     /docs/how-protection-works (PROTECTED_HOW in copy.ts). Each sentence
     describes the rail as it works once open, beside PROTECTED_NOT_OPEN,
     which the page draws first: protected payment is not open, and nothing
     is paid this way today. Whole sentences or a sentence's opening words,
     copy.ts only. */
  {
    phrase:
      /^A protected payment is a bank transfer that a licensed bank holds under your agreement until the handover you agreed has happened\.|^When protected payment opens, the money you transfer goes to a designated account at a licensed bank\.|^How a protected payment moves$|^A protected payment, from agreement to release$|^Only now does the payment read as protected, with the bank named on screen\.$|^The states of a protected payment$|^Protected bank transfer, from a Nigerian account$/,
    onlyIn: MONEY_COPY_FILE,
    mechanism:
      "the new protected rail's explainer: funds held by the custodian bank named in lib/money/protected-wording.ts under the provider's agreement until release; 'protected' is drawn on a payment only on a provider-confirmed state recorded in provider_arrangements (lib/money/protected-journey.ts); the page states first that the rail is not open (PROTECTED_NOT_OPEN), and the rail is switched off by payments_escrowpay_on (fail closed) with DOCUMENTED false in lib/payments/providers/escrowpay/client.ts",
  },
  { phrase: /^; Secure$/, mechanism: "the Secure attribute of the theme cookie (lib/theme/theme-client.ts), an HTTP cookie flag, not copy" },

  /* "Instant" (29 September): the word promises speed, so it is a claim word
     now. Instant book is a listing setting, the boolean the lister turns on,
     and the words below only ever name that setting; the assistant's "I
     answer instantly" is its own reply, drawn from local notes with no
     queue in front of it. Anything else "instant" (notifications, payouts,
     approvals) has to name its mechanism here first. */
  {
    phrase: /^instant(?: book)?(?: available| only| against a request)?\.?$|\binstant book only\b|^instant book is available on this listing, so your dates confirm as soon as you reserve\.$/i,
    mechanism: "listings.instant_book (supabase/migrations/20260728152229_listings_core.sql), set by the lister; with it on a guest pays without waiting for the lister to accept",
  },
  { phrase: /\bI answer instantly\b/i, mechanism: "the support assistant answers from its local notes (lib/support/faq.ts) in the same request; anything beyond them goes to the human team, who reply by email" },

  /* The English locale modules (6 October). These sentences live in
     packages/i18n/src/locales/*.en.ts, which the sweep did not read until
     now: en.ts spreads the modules in, so their copy was never a literal in
     any file the check opened. Each entry below was read against its
     mechanism before it was added; anything that could not be backed is in
     KNOWN_UNBACKED_PENDING_REWORD instead, never here. */

  /* V-87 dated credentials (trust-visible.en.ts proof strip, its explainer and
     the staff desk's form). Only a member of staff writes one, a check older
     than a year is not shown, and a CAC directorship row is accepted only
     from the identity aggregator, so no CAC sentence renders today. */
  {
    phrase: /\bchecked on the (?:LASRERA|ESVARBON) register\b|\bchecked with the CAC\b|\bchecked this registration against the public register\b|\bcredential checked on the public register\b/i,
    mechanism:
      "public.credentials written only through public.record_credential (staff, guarded, audited), read through public.listing_credentials with the date; checks older than a year are not returned (supabase/migrations/20260928224407_v87_lasrera_esvarbon_and_cac_as_dated_credentials.sql)",
  },
  /* trust-doors.en.ts, the public "Is this a Vallo agent?" door. */
  {
    phrase: /\bidentity checked by vallo on \{date\}/i,
    mechanism:
      "private.identity_checked_at: the latest reviewed_at of an APPROVED identity row in agent_documents; app/(site)/check/CheckForm.tsx prints the sentence only when that date exists",
  },
  /* experience-account.en.ts, headings on the passport evidence page and the
     verification path. Each sits over a record, never instead of one. */
  {
    phrase: /^how it was checked$|^what was checked$|^what will be checked$/i,
    mechanism:
      "headings: 'What was checked' heads only a rung whose state is passed and 'What will be checked' one still ahead (components/verification/VerificationPath.tsx); the passport evidence pages that also used them were removed with the Vallo passport (13 Oct 2026)",
  },
  /* passportV2 (the Vallo passport, 13 October 2026): the verification line.
     Its level is read, never decided, in the database. */
  {
    phrase: /^identity checked by a person at vallo\.$/i,
    mechanism:
      "the passport's verification line is public.person_badge (private.badge_tier_for) returned by public.passport_read (supabase/migrations/20261013172017_pass02_vallo_passport_read.sql); 'gold' needs agent_badges.verified or businesses.verified, derived from rungs a named member of staff passed on the KYC desk (agent_verification_checks); an owner can hide the line but cannot set it, and 'Member' (none) makes no claim",
  },
  /* front-door.en.ts briefs (V-95). */
  {
    phrase: /\bverified listers (?:who have homes|with homes|only)\b/i,
    mechanism:
      "private.is_verified_lister (approved, verification_tier >= 1, not an example row) gates briefs_for_me and the answer function, which raises 42501 'verified listers only' (supabase/migrations/20260924110055_v95_the_brief_answered_only_with_a_listing.sql)",
  },
  /* landlord.en.ts, an owner inviting agents to pitch (V-42). */
  {
    phrase: /\bverified agents (?:who already list in|to pitch)\b|\bonly verified agents see these\b/i,
    mechanism:
      "private.my_verified_agent (verified or verification_tier > 0, trading, not an example row) gates the invitations an agent can read and the pitch function (supabase/migrations/20260924104919_an_owner_sees_their_units_and_agents_pitch_on_their_record.sql)",
  },
  /* trust-visible.en.ts, the card over an account number in a thread (V-04). */
  {
    phrase: /\bbelongs to the verified lister\b/i,
    mechanism:
      "lib/messages/account-check.ts: the card says 'belongs' only on outcome match, the provider-resolved holder name against the names Vallo verified for that lister; with no verified name on record it prints nothing (no_verified_name)",
  },
  /* host-workspace.en.ts, the start of a host application. */
  {
    phrase: /\bthe badge only ever means a human was checked\b/i,
    mechanism: `catalogue_entries.verified for an accommodation is first party, not is_demo, and its owning agent carries the verified badge (lib/stays/types.ts, the M9 triggers): ${AGENT_KYC}`,
  },
  /* experience-admin.en.ts, the business desk's line in the staff palette. */
  {
    phrase: /\bwhat each has been checked for\b/i,
    mechanism: "the host ladder's rungs (identity, registration, payout, on site), each decided by a reviewer on the admin business desk (lib/admin/business-ladder.ts, private.business_tier)",
  },
  /* compliance*.en.ts: staff desks, where "checked" is the reviewer's own
     work or the event that queued a screening. */
  {
    phrase: /\bwhat you checked (?:and what it showed|\(date of birth)|^identity checked$/i,
    mechanism:
      "staff copy on the compliance desks: the reviewer's own note of what they checked, and the sanctions screening trigger 'identity' that a write to agent_verification_checks queues (supabase/migrations/20260929010407_scuml_8_sanctions_screening_on_live_tables.sql)",
  },
  /* Process descriptions, not a claim about a listing or a person. */
  {
    phrase: /\bwhile a change to your account is checked\b|^checked just now, against \{origin\}$/i,
    mechanism:
      "a process: an account hold placed while staff review a change (lib/security/account-hold.ts, not-me-copy.ts), and the store readiness checks run on request against the live platform (app/admin/operations/StorePanel.tsx)",
  },
  /* Everyday senses: the member's own action, never Vallo's verdict. */
  {
    phrase: /\byou have checked a lot of numbers\b|\bwhere you checked\b|\bsays you checked in\b/i,
    mechanism: "the member's own action: lookups on the agent door (a rate limit), the area the member priced (price-check), and the safety share's I'm done tap (check in)",
  },
  {
    phrase: /\bthe person you told knows you are safe\b/i,
    mechanism:
      "the member's own signal: the safety share records only that they tapped I'm done and when (trust-doors safetyShare.pageDone); Vallo asserts nothing about anybody's safety",
  },

  /* Vallo Roommates (8 November 2026). Every badge names one check and is
     written only by the server: a school email is confirmed by a six digit
     code sent to that address (lib/features/roommates/actions.ts
     startSchoolEmailCheck / confirmSchoolEmail, service role, hashed code,
     five tries, fifteen minutes); a student ID, NYSC letter or work letter is
     decided by a person on the verification desk (admin_roommate_decide_verification,
     kyc_review or trust_safety only); a room post is "checked by Vallo" only
     when staff set roommate_listings.verified_at (admin_roommate_act verify),
     and an edit to its price, place or authority clears it again. */
  {
    phrase: /\b(?:student id|corps member|workplace|school email) checked\b/i,
    mechanism: "roommate_verifications rows set to verified only by the verification desk or the emailed code (service role)",
    onlyIn: "packages/i18n/src/locales/roommates.en.ts",
  },
  {
    phrase: /\b(?:listing )?checked by vallo\b/i,
    mechanism: "roommate_listings.verified_at, written only by staff through admin_roommate_act, cleared by any later edit of price, place or authority",
    onlyIn: "packages/i18n/src/locales/roommates.en.ts",
  },
  {
    phrase: /\b(?:badges? says? what was checked|others see that it was checked)\b/i,
    mechanism: "each roommate badge is one named roommate_verifications kind; the badge copy names that kind",
    onlyIn: "packages/i18n/src/locales/roommates.en.ts",
  },
  /* Vallo Circle: an opportunity is held for a person to release
     (posts_circle trigger: circle_type opportunity sets status HELD,
     20261107210200_features_circle_1_core.sql); a professional's mark is the
     agent verification badge. */
  {
    phrase: /\bevery one is checked before it shows\b/i,
    mechanism: "Circle opportunity posts are inserted HELD by the posts_circle trigger and shown only after a moderator releases them",
    onlyIn: "packages/i18n/src/locales/circle.en.ts",
  },
  { phrase: /^checked by vallo$/i, mechanism: AGENT_KYC, onlyIn: "packages/i18n/src/locales/circle.en.ts" },
  /* An audience choice in privacy settings, not a promise about anybody. */
  { phrase: /^verified people$/i, mechanism: AGENT_KYC, onlyIn: "packages/i18n/src/locales/en.ts" },
  /* A hotel front desk's own marks on a reservation, not a check of anyone. */
  {
    phrase: /^checked (?:in|out)$/i,
    mechanism: "the host's front desk mark on the reservation (FrontDeskPanel), a status, not a verification",
    onlyIn: "apps/web/src/components/host/dashboard/FrontDeskPanel.tsx",
  },

  /* Sentences deleted on the release branch by another change. */
  { phrase: /^secure and fast$/i, mechanism: "none", pendingRemoval: "STORE-06, fix/a4 b36e00e2 (already integrated)" },
];

/**
 * KNOWN UNBACKED CLAIMS, WAITING ON THEIR OWNER TO REWORD (temporary).
 *
 * A sentence here is NOT backed: nothing in the codebase makes it true. It is
 * listed, rather than left failing, only because it sits in a locale module
 * whose owner is not the person who found it, and the gate has to stay green
 * while the owner rewords it. The sweep accepts an entry only in the one file
 * it names and only for the sentence it matches; `claims.test.ts` fails the
 * moment an entry stops matching (the owner reworded: delete the entry), and
 * the list is meant to reach empty. Never add a sentence here to dodge a claim
 * in copy you own: reword it, or back it in BACKED_CLAIMS with its mechanism.
 */
export type PendingReword = {
  /** Matches the unbacked sentence, and only it. */
  phrase: RegExp;
  /** The module, relative to the repository root. */
  file: string;
  /** Who rewords it. */
  owner: string;
  /** Why it is unbacked. */
  reason: string;
  /** A wording that says only what is true. */
  proposed: string;
};

export const KNOWN_UNBACKED_PENDING_REWORD: readonly PendingReword[] = [];

/**
 * "Checked" said of a PERSON'S identity BY A PERSON: a sentence that has
 * "checked", a human actor (a person, by hand, someone at Vallo, our team,
 * real people, we) and an identity subject (ID, identity, documents, the
 * agent, the lister). Backed by the KYC desk and agent approval. A machine
 * doing the checking ("through a processor") is not a human actor, so a
 * sentence that says so is not accepted here.
 */
export const HUMAN_ID_CHECK_MECHANISM = `${AGENT_KYC}; ${AGENT_APPROVAL}`;
const HUMAN_ACTOR =
  /\b(?:a person|by hand|someone at vallo|somebody at vallo|a person here|a person at vallo|our team|real people|a human|we(?: have)?|a named member)\b/i;
const ID_SUBJECT = /\b(?:ID|identity|identification|documents?|agents?|listers?|NIN|the person)\b/i;
function humanIdCheck(sentence: string): boolean {
  return /\bchecked\b/i.test(sentence) && HUMAN_ACTOR.test(sentence) && ID_SUBJECT.test(sentence) && !/\bprocessor\b/i.test(sentence);
}

/** A negation in the same sentence makes the word a disclaimer, not a claim. */
const NEGATED =
  /\b(?:not|never|no|nobody|cannot|can't|isn't|aren't|wasn't|haven't|hasn't|without|nothing)\b[^.!?]{0,60}\b(?:verified|guaranteed?|guarantees|secure|safe|encrypted|checked|protected|insured|instant|instantly)\b|\b(?:verified|guaranteed?|checked|protected|insured|safe)\b[^.!?]{0,12}\b(?:yet|not)\b/gi;

/**
 * The first claim word in `text` that nothing backs, or null.
 * `${...}` expressions inside a template are code, not copy, and are ignored.
 */
export function unbackedClaim(text: string, file?: string): string | null {
  let copy = text.replace(/\$\{[^{}]*\}/g, " ");
  for (const claim of BACKED_CLAIMS) {
    if (claim.onlyIn !== undefined && claim.onlyIn !== file) continue;
    copy = copy.replace(new RegExp(claim.phrase.source, claim.phrase.flags.includes("g") ? claim.phrase.flags : `${claim.phrase.flags}g`), " ");
  }
  copy = copy
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => (humanIdCheck(sentence) ? sentence.replace(/\bchecked\b/gi, " ") : sentence))
    .join(" ");
  copy = copy.replace(NEGATED, " ");
  const found = new RegExp(CLAIM_WORD.source, CLAIM_WORD.flags).exec(copy);
  return found ? found[1] ?? found[0] : null;
}

/** Whether an allowlist entry still matches the given copy (for stale checks). */
export function claimMatches(claim: BackedClaim, text: string, file?: string): boolean {
  if (claim.onlyIn !== undefined && claim.onlyIn !== file) return false;
  return claim.phrase.test(text.replace(/\$\{[^{}]*\}/g, " "));
}
