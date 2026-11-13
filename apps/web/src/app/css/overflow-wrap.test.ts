import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO NEW `overflow-wrap: anywhere` OR `break-all` (13 November 2026).
 *
 * Both let a long word break at any letter, and both COUNT toward an element's
 * min-content width: they tell the browser that one letter is wide enough. A
 * text column beside a fixed-width sibling (a name beside two buttons, a title
 * beside a figure, a label beside a value) then shrinks to that one letter, and
 * "Joseph Agboola" runs down the card as "Josep / h / Agbool / a". The audit
 * of 13 November found that on the people row, the saved row, the list rows
 * and the cards. `overflow-wrap: break-word` breaks the same long word in the
 * same place when nothing else fits, and is NOT counted in min-content, so the
 * column keeps its room. It is the platform's default; with `min-inline-size:
 * 0` on the flex or grid child where a column could still overflow.
 *
 * The exceptions are single unbreakable tokens that must wrap inside a box
 * sized by something else: a web address in a bubble, a reference code, an
 * email address in a narrow cell, a stack trace, a code token in a docs
 * paragraph. Each stays `anywhere` and is listed below with its reason and
 * its count, so a new use anywhere else fails here, a new use in a listed
 * file fails here (the count moves), and a use that has gone fails here too
 * (the entry is stale and goes). `break-all` is the same thing with uglier
 * breaks and is never used outside email HTML, which has no `overflow-wrap`.
 *
 * Comments are stripped before counting, so a comment that explains the
 * choice (as every listed line carries) does not count.
 *
 * The browser proof is `components/locale-fit/letter-columns.dom.test.tsx`.
 */
const SRC = join(__dirname, "..", "..");
const SELF = join(SRC, "app", "css", "overflow-wrap.test.ts");

type Allowed = { count: number; why: string };

const ALLOWED: Record<string, Allowed> = {
  /* ---- references, codes, ids and hashes: one token, must wrap in its box */
  "app/admin/money/_desk/desk.css": { count: 1, why: "the payment reference (.nf-md-ref)" },
  "app/agent/listings/[listingId]/board/board.css": { count: 1, why: "the listing code (.nf-board__code)" },
  "app/css/chargebacks.css": { count: 1, why: "the dispute reference (.nf-cb-ref)" },
  "app/css/money-layer.css": { count: 1, why: "the payment reference (.nf-ref dd)" },
  "app/css/system.css": { count: 1, why: "the failure reference support asks for (.nf-system__ref)" },
  "components/ui/copy-button.css": { count: 1, why: "the copied value, a link or a code (.nf-copy-value__text)" },
  "components/app/ResultSheet.tsx": { count: 1, why: "the reference under a result" },
  "app/admin/arrangements/ArrangementsDesk.tsx": { count: 1, why: "the arrangement reference" },
  "app/admin/compliance/_lanes/StrLane.tsx": { count: 1, why: "the case references" },
  "app/admin/payments/LookupPanel.tsx": { count: 1, why: "the looked-up id" },
  "app/admin/payments/page.tsx": { count: 2, why: "a user id and a reference in table cells" },
  "app/admin/bookings/reservations/ReservationCard.tsx": { count: 1, why: "the reservation reference" },
  "app/admin/chargebacks/ChargebackCase.tsx": { count: 1, why: "the dispute reference as the page head" },
  "app/admin/chargebacks/BookingChargebacks.tsx": { count: 1, why: "the dispute reference in a cell" },
  "app/admin/alerts/AlertCards.tsx": { count: 2, why: "the alert's references" },
  "components/app/payments/crypto/CryptoPayOption.tsx": { count: 1, why: "the crypto amount, one long token" },
  "components/app/payments/crypto/CryptoPaymentStatus.tsx": { count: 2, why: "an address and a transaction hash" },
  "app/admin/audit/AuditList.tsx": { count: 1, why: "the audit payload's keys and values" },
  "app/css/admin.css": { count: 1, why: "the crash stack trace (.nf-crash__stack pre)" },
  /* ---- web addresses, links and paths */
  "app/css/price-check.css": { count: 1, why: "the share address (.nf-pc-share__url)" },
  "components/app/referral/rewards.css": { count: 1, why: "the invite link (.nf-rewards-invite__link)" },
  "components/ui/ExternalLinkSheet.tsx": { count: 1, why: "the destination address the sheet names" },
  "components/app/doors/SafetyShareControl.tsx": { count: 1, why: "the share link" },
  "components/app/deal-room/DealMessages.tsx": { count: 1, why: "a web address pasted into a bubble" },
  "app/admin/marketing/page.tsx": { count: 1, why: "the tracked link" },
  "app/admin/marketing/MarketingControls.tsx": { count: 1, why: "the built link" },
  "app/admin/doc-feedback/DocFeedbackView.tsx": { count: 1, why: "the page path" },
  "app/agent/listings/[listingId]/status/StatusShare.tsx": { count: 1, why: "the share link" },
  "app/(dev)/preview/p5/invite/page.tsx": { count: 1, why: "the invite link" },
  "app/(app)/settings/invite/InviteShare.tsx": { count: 1, why: "the invite link" },
  "app/(app)/settings/invite/page.tsx": { count: 1, why: "the invite link" },
  /* ---- email addresses in narrow boxes */
  "app/settings-rows.css": { count: 1, why: "the member's email on the hub card (.nf-hub-profile__email)" },
  "app/(site)/contact/page.tsx": { count: 1, why: "the contact email address" },
  /* ---- code tokens and table cells in the docs */
  "app/css/docs-kit.css": { count: 1, why: "a code token in a docs paragraph" },
  "components/docs/docs-kit.css": { count: 2, why: "a code token, and a table cell that must not widen the table" },
  /* ---- email HTML has no overflow-wrap: break-all is its only tool */
  "lib/email/render.ts": { count: 2, why: "email HTML: a reference cell and a link line" },
  /* ---- other writers' sheets (13 November 2026): the change is proposed in
     the SWEEP hand-off, and the count moves here when they take it */
  "app/css/chrome.css": { count: 3, why: "NATIVE2 owns the shell sheet: .nf-ph-large__sub, .nf-confirm__title and .nf-confirm__value should be break-word" },
  "app/css/threads.css": { count: 5, why: "MEDIA owns messages: .nf-bubble keeps anywhere (a web address in a bubble); the chat card title, fact value, quote and hint should be break-word" },
  "app/css/messages-g1.css": { count: 1, why: "MEDIA owns messages: a web address in a bubble (.nf-bubble__link)" },
  "app/(app)/messages/Inbox.tsx": { count: 1, why: "MEDIA owns messages: the inbox row's listing title should be break-words" },
  "app/admin/analytics/listings/ListingStatsDesk.tsx": { count: 1, why: "STATS owns listing stats: the row's title link should be break-words" },
};

const SKIP_DIRS = new Set(["node_modules", ".next"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (/\.(css|tsx?)$/.test(entry.name) && path !== SELF) out.push(path);
  }
  return out;
}

/* Block comments (CSS and JSX alike) and whole-line `//` comments go; an
   inline `//` stays, because "https://" is one. A test's own assertion that a
   rule does NOT carry `anywhere` names it without using it, and goes too. */
const strip = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^.*not\.toContain\(.*$/gm, "");

const PATTERN = /overflow-wrap:\s*anywhere|\bbreak-all\b/g;

describe("overflow-wrap: anywhere and break-all", () => {
  const found = new Map<string, number>();
  for (const file of sources(SRC)) {
    const n = (strip(readFileSync(file, "utf8")).match(PATTERN) ?? []).length;
    if (n) found.set(relative(SRC, file), n);
  }

  it("appear only where a single token must wrap inside a fixed box, each with its reason", () => {
    const offenders: string[] = [];
    for (const [file, n] of found) {
      const allowed = ALLOWED[file];
      if (!allowed) offenders.push(`${file}: ${n} use(s) not in the allow-list; use overflow-wrap: break-word (break-words), with min-inline-size: 0 on the flex or grid child`);
      else if (allowed.count !== n) offenders.push(`${file}: ${n} use(s), the allow-list says ${allowed.count} (${allowed.why})`);
    }
    expect(offenders).toEqual([]);
  });

  it("has no stale allow-list entry", () => {
    const stale = Object.keys(ALLOWED).filter((file) => !found.has(file));
    expect(stale).toEqual([]);
  });

  it("every allow-list entry says why", () => {
    for (const [file, allowed] of Object.entries(ALLOWED)) expect(allowed.why.length, file).toBeGreaterThan(8);
  });
});
