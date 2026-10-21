import type { ReactNode } from "react";
import Link from "next/link";
import { formatMoney } from "@vallo/i18n/core";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { SUPPORT_HREF, SUPPORT_LABEL } from "@/lib/support-email";
import { FULL_REFUND_HOURS } from "@/lib/trust/cancellation";
import { MAX_MOVE_KOBO, MIN_MOVE_KOBO } from "@/lib/money/amount";
import {
  HELD_MONEY_NOT_US,
  NO_INSPECTION_FEE,
  NO_PAYMENT_BALANCE,
  OFF_PLATFORM_SENTENCE,
  RAIL_COPY,
  REFUND_NO_BALANCE,
  REFUND_ROUTE,
  REWARDS_BALANCE_SEPARATE,
} from "@/lib/money/copy";
import { REPORT_CATEGORY_COPY, REPORT_CATEGORY_ORDER } from "@/lib/reports/schema";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import { DELETE_CONFIRM_PHRASE, GRACE_WINDOW_DAYS } from "@/lib/account-deletion/constants";
import { COMPANY_FORMAL_NAME, COMPANY_REGISTERED_OFFICE } from "@/lib/legal/company";
import { AI_ASSISTANT, AROUND, GETTING_AROUND, LISTING_ON_VALLO, MESSAGES, PRICE_CHECK } from "./chapters-more";
import {
  BADGES_AND_VERIFICATION,
  HOSTING,
  QUICK_START,
  RESTAURANTS,
  VIEWINGS,
  WHAT_VALLO_COSTS,
} from "./chapters-guide";
import {
  ACCOUNT_AND_WORKSPACES,
  AGREEMENTS_AND_PAYING,
  BOOKING_A_STAY,
  FINDING_A_PLACE,
  FOR_AGENTS,
  FOR_OWNERS,
  REVIEWS,
  UNDERSTANDING_A_LISTING,
} from "./chapters-people";
import {
  CARD_MEANS,
  COMMISSION_FROM_SHARE,
  ESCROW_MEANS,
  ESCROW_PAUSED,
  ESCROW_OR_CARD,
  HOTEL_ROOM_BY_CARD,
  PAY_INSIDE_VALLO,
  PRICE_IS_THE_PRICE,
  SALE_IS_ESCROW,
  VALLO_NEVER_HOLDS,
  VIEWINGS_AND_LISTING_FREE,
} from "./facts";
import { DocsFlow } from "./DocsFlow";
import { DOC_GROUPS, chaptersByGroup, type DocChapterIndexEntry, type DocGroupId } from "./docs-groups";

/* The navigation lives in `docs-groups.ts` so the client rail can import it
   without this file's text; re-exported here for the server callers. */
export { DOC_GROUPS, chaptersByGroup };
export type { DocChapterIndexEntry, DocGroupId };

/**
 * The documentation, as data.
 *
 * Every chapter, every heading and every paragraph lives in these modules, so
 * the sidebar, the table of contents, the "on this page" rail, the prev and
 * next links, the help search and the pages themselves read the same list. A
 * documentation site whose navigation is written separately from its content
 * is a site that will tell somebody a chapter exists and then hand them a 404.
 *
 * THE HOUSE STYLE (13 October 2026, the docs track). One topic per chapter.
 * Headings say the task ("Book a viewing", not "Viewings, and how they
 * work"). Short plain sentences. Every chapter that describes a process ends
 * with what happens next. No internal names: no table, function, flag or
 * provider a member would not see.
 *
 * Numbers that already exist in the product are IMPORTED rather than typed
 * out. The founder's money rules are written once, in `facts.ts`.
 *
 * Nothing here describes a feature that does not exist. Every screen named is
 * a real route, and every rule stated is enforced in `apps/web/src/lib` or in
 * a migration under `supabase/migrations`. A rule decided but not yet built
 * is described as the rule, never as a screen.
 *
 * A retired chapter is removed here AND given a redirect in `next.config.ts`
 * to the closest current chapter (`docs-links.dom.test.tsx` holds both).
 */

export type DocSection = {
  /** Anchor id. Stable, because people link to headings. */
  id: string;
  heading: string;
  body: ReactNode;
};

export type DocChapter = {
  slug: string;
  /** Its place in the reading order, 1 upwards. Set from the order below. */
  number: number;
  title: string;
  /** One line, used on the card, in the sidebar and as the meta description. */
  summary: string;
  icon: BrandIconName;
  /** The sidebar group. Set from the order below. */
  group?: DocGroupId;
  sections: DocSection[];
};

/** How a link inside the prose is drawn. One class, every chapter. */
const A = "font-semibold text-[var(--nf-content-link)] hover:underline";

const MIN_MOVE = formatMoney(MIN_MOVE_KOBO);
const MAX_MOVE = formatMoney(MAX_MOVE_KOBO);

/* ------------------------------------------------------------ what it is */

const WHAT_VALLO_IS: DocChapter = {
  slug: "what-vallo-is",
  number: 0,
  title: "What Vallo is",
  summary:
    "A marketplace for homes, property, stays and restaurant tables across Nigeria. One account, two sides, and the rules that apply everywhere.",
  icon: "house-sparkle",
  sections: [
    {
      id: "the-short-version",
      heading: "The short version",
      body: (
        <>
          <p>
            Vallo is a marketplace for property, stays and restaurants in Nigeria. You can rent or
            buy a home, a shop, an office or land. You can book a hotel room, a shortlet or a
            serviced apartment. You can book a table at a restaurant.
          </p>
          <p>
            Owners, agents, firms, hotels, shortlet hosts and restaurants list on Vallo. A person at
            Vallo reviews each of them, and each listing, before it goes up.
          </p>
          <p>
            Vallo does not remove the agent. It removes the runaround: you see who you are dealing
            with and what you will pay before you call anybody.
          </p>
        </>
      ),
    },
    {
      id: "the-two-sides",
      heading: "Switch between Property and Stays",
      body: (
        <>
          <p>The app has two sides. One account works on both.</p>
          <ul role="list">
            <li>
              <strong>Property.</strong>{" "}
              <Link href="/search" className={A}>
                Search
              </Link>{" "}
              homes to rent or buy, shops, offices and land. A rent is priced per year, with the
              move-in total shown under it.
            </li>
            <li>
              <strong>Stays.</strong>{" "}
              <Link href="/stays" className={A}>
                Stays
              </Link>{" "}
              and{" "}
              <Link href="/restaurants" className={A}>
                Restaurants
              </Link>
              . A stay is priced per night, for your dates and your party.
            </li>
          </ul>
          <p>
            The switch is at the foot of the menu. It changes the words and the bottom bar. Your
            profile, inbox, saved places and{" "}
            <Link href="/bookings" className={A}>
              Plans
            </Link>{" "}
            stay the same.
          </p>
        </>
      ),
    },
    {
      id: "the-rules",
      heading: "The rules that apply everywhere",
      body: (
        <ul role="list">
          <li>Vallo is free to use. {VIEWINGS_AND_LISTING_FREE}</li>
          <li>{PRICE_IS_THE_PRICE}</li>
          <li>{COMMISSION_FROM_SHARE}</li>
          <li>{PAY_INSIDE_VALLO}</li>
          <li>{VALLO_NEVER_HOLDS}</li>
        </ul>
      ),
    },
    {
      id: "who-it-is-for",
      heading: "Who it is for",
      body: (
        <ul role="list">
          <li>
            <strong>Renters, buyers and guests.</strong> Start with{" "}
            <Link href="/docs/finding-a-place" className={A}>
              Search, filters and the map
            </Link>
            .
          </li>
          <li>
            <strong>Owners and landlords.</strong> Read{" "}
            <Link href="/docs/for-owners" className={A}>
              For owners and landlords
            </Link>
            .
          </li>
          <li>
            <strong>Agents and firms.</strong> Read{" "}
            <Link href="/docs/for-agents" className={A}>
              For agents and firms
            </Link>
            .
          </li>
          <li>
            <strong>Hotels, shortlets and serviced apartments.</strong> Read{" "}
            <Link href="/docs/hosting" className={A}>
              Hosting a hotel or shortlet
            </Link>
            .
          </li>
          <li>
            <strong>Restaurants.</strong> Read{" "}
            <Link href="/docs/restaurants" className={A}>
              Restaurants and tables
            </Link>
            .
          </li>
        </ul>
      ),
    },
    {
      id: "how-it-is-laid-out",
      heading: "Find your way around",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>The app.</strong> Home, Search, Stays, Restaurants, Saved, Plans, Agreements,
              Messages, the assistant, your profile and Settings.
            </li>
            <li>
              <strong>Your workspace.</strong> Where you list, host or answer enquiries, once you
              add one. See{" "}
              <Link href="/docs/getting-started#workspaces" className={A}>
                Add a workspace
              </Link>
              .
            </li>
            <li>
              <strong>Help.</strong> These docs, the{" "}
              <Link href="/help" className={A}>
                help centre
              </Link>
              , the{" "}
              <Link href="/safety" className={A}>
                safety centre
              </Link>{" "}
              and the{" "}
              <Link href="/terms" className={A}>
                Terms
              </Link>
              . Where these docs and a policy differ, the policy governs.
            </li>
          </ul>
          <p>Vallo works in English, Yorùbá, Hausa and Igbo. Change the language in Settings.</p>
          <p>
            Use Vallo in any web browser, or as the app for Android phones and iPhones, published
            through Google Play and the App Store. The app opens the same Vallo, with the same account.
            You must be 18 or over to make an account.
          </p>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------- paying on Vallo */

/*
 * HOW PAYING WORKS (replaces "Money and agreements", whose slug named the
 * retired Vallo Guarantee; `/docs/money-and-the-guarantee` and the older
 * `/docs/your-wallet` redirect here). The founder's rules of 13 October 2026:
 * every payment inside Vallo; Escrow (the default) or card for rent and
 * shortlets; a sale always escrow; a hotel room by card at once; Vallo never
 * holds the money. The ids `never-held`, `the-gate`, `the-fee`, `refunds`,
 * `for-listers`, `references` and `off-platform` are kept from the old
 * chapter so its links still land on the right heading.
 */
const PAYING_ON_VALLO: DocChapter = {
  slug: "paying-on-vallo",
  number: 0,
  title: "How paying works",
  summary:
    "Every payment happens inside Vallo. Escrow or card for rent and shortlets, escrow for a sale, card for a hotel room, and Vallo never holds the money.",
  icon: "shield-lock",
  sections: [
    {
      id: "pay-inside",
      heading: "Pay inside Vallo, every time",
      body: (
        <>
          <p>
            <strong>{PAY_INSIDE_VALLO}</strong>
          </p>
          <p>
            A payment made in Vallo leaves a reference on your booking or agreement. That reference is
            what support works from if something goes wrong. A transfer to somebody&rsquo;s own
            account leaves nothing to work from.
          </p>
          <p>
            Nobody on Vallo has a reason to send you an account number. If somebody does, stop and{" "}
            <Link href="/docs/trust-and-safety#reporting" className={A}>
              report them
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "which-way",
      heading: "See how each kind of deal is paid",
      body: (
        <ul role="list">
          <li>
            <strong>Rent.</strong> Escrow, selected for you, or Pay by card.
          </li>
          <li>
            <strong>Shortlets and serviced apartments.</strong> Escrow, selected for you, or Pay by
            card.
          </li>
          <li>
            <strong>A sale.</strong> Escrow only.
          </li>
          <li>
            <strong>A hotel room.</strong> By card, when you book, at the price shown.
          </li>
          <li>
            <strong>A restaurant table.</strong> Free to book. You pay your bill at the restaurant.
          </li>
          <li>
            <strong>A viewing.</strong> Never any money.
          </li>
        </ul>
      ),
    },
    {
      id: "escrow",
      heading: "Pay with Escrow",
      body: (
        <>
          <DocsFlow
            label="How an escrow payment moves"
            steps={[
              { object: "payment-sent", label: "You pay" },
              { object: "doc-lock", label: "A licensed partner holds it" },
              { object: "keys-handover", label: "The deal is confirmed" },
              { object: "bank-column", label: "Released to them" },
            ]}
          />
          <p>{ESCROW_OR_CARD}</p>
          <p>{ESCROW_MEANS}</p>
          <p>{RAIL_COPY.protected.refund}</p>
          <p>{SALE_IS_ESCROW}</p>
          <p>{ESCROW_PAUSED}</p>
        </>
      ),
    },
    {
      id: "card",
      heading: "Pay by card",
      body: (
        <>
          <p>{CARD_MEANS}</p>
          <p>
            You enter your card on the payment partner&rsquo;s own page, never on Vallo. Vallo never
            sees your full card number.
          </p>
          <p>{HOTEL_ROOM_BY_CARD}</p>
          <p>
            Tap Pay twice on a bad connection and you are charged once. A repeated attempt picks up the
            first one.
          </p>
        </>
      ),
    },
    {
      id: "the-gate",
      heading: "Know when payment opens",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Rent or a sale.</strong> After the viewing, the inspection report and the
              agreement. See{" "}
              <Link href="/docs/agreements-and-paying" className={A}>
                From viewing to keys
              </Link>
              .
            </li>
            <li>
              <strong>A shortlet.</strong> When the host accepts your booking, or at once when the
              listing is marked <strong>Instant book</strong>.
            </li>
            <li>
              <strong>A hotel room.</strong> At once, when you book.
            </li>
          </ul>
          <p>
            A card payment for an unusually large deal, or one where something changed recently, may wait
            for a person at Vallo to look first. You are told by email and in the app when it opens.
          </p>
        </>
      ),
    },
    {
      id: "never-held",
      heading: "Who holds the money",
      body: (
        <>
          <p>
            <strong>{VALLO_NEVER_HOLDS}</strong> Vallo records each payment and shows you where it
            stands.
          </p>
          {/* "Vallo keeps no balance in your name ... nothing to withdraw"
              was untrue beside the Rewards Balance (D51); the narrower true
              thing is lib/money/copy.ts's (A9, no-payment-balance.test.ts). */}
          <p>
            {NO_PAYMENT_BALANCE} {REWARDS_BALANCE_SEPARATE} {HELD_MONEY_NOT_US}
          </p>
        </>
      ),
    },
    {
      id: "the-fee",
      heading: "What you pay, and what Vallo takes",
      body: (
        <>
          <p>{PRICE_IS_THE_PRICE}</p>
          <p>{COMMISSION_FROM_SHARE}</p>
          <p>
            See{" "}
            <Link href="/docs/what-vallo-costs" className={A}>
              What Vallo costs
            </Link>{" "}
            for every fee.
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      heading: "Where a refund goes",
      body: (
        <p>
          {REFUND_ROUTE} {REFUND_NO_BALANCE} For when you get money back, see{" "}
          <Link href="/docs/refunds-and-cancellations" className={A}>
            Cancellations and refunds
          </Link>
          .
        </p>
      ),
    },
    {
      id: "for-listers",
      heading: "Get paid as an owner, agent or host",
      body: (
        <ul role="list">
          <li>Add a Nigerian bank account in your own name before anybody can pay you.</li>
          <li>Before you publish, Vallo shows you what you will receive after its commission.</li>
          <li>With Pay by card, your share goes to your bank account when the payment clears.</li>
          <li>With Escrow, your share is released when the deal is confirmed.</li>
          <li>Every payment and every refund appears on your earnings, line by line.</li>
        </ul>
      ),
    },
    {
      id: "references",
      heading: "Find a payment reference",
      body: (
        <p>
          Every payment and every refund has its own reference. Open it from the booking or the
          agreement, and quote it to support. One payment can be from {MIN_MOVE} to {MAX_MOVE}.
        </p>
      ),
    },
    {
      id: "off-platform",
      heading: "If someone asks you to pay outside Vallo",
      body: (
        <>
          <p>
            {OFF_PLATFORM_SENTENCE} Payments made outside Vallo are not covered.
          </p>
          <p>
            Say no, and report it. If you have already paid, read{" "}
            <Link href="/docs/trust-and-safety#already-sent-money" className={A}>
              If you already sent money
            </Link>
            .
          </p>
        </>
      ),
    },
  ],
};

/* -------------------------------------------------- refunds and cancelling */

const REFUNDS: DocChapter = {
  slug: "refunds-and-cancellations",
  number: 0,
  title: "Cancellations and refunds",
  summary:
    "How to cancel a stay, a table or a viewing, which cancellation policy applies, how to ask for a refund and when it reaches you.",
  icon: "calendar-clock",
  sections: [
    {
      id: "before-you-pay",
      heading: "Cancel before you pay",
      body: (
        <p>
          A booking you have not paid for costs nothing to cancel. Let it go from{" "}
          <Link href="/bookings" className={A}>
            Plans
          </Link>{" "}
          at any time. The nights open again for somebody else.
        </p>
      ),
    },
    {
      id: "which-policy",
      heading: "Check which cancellation policy applies",
      body: (
        <>
          <p>
            Every stay shows its cancellation policy before you book, and again at checkout. The
            policy is fixed on your booking when you pay, so it cannot change afterwards.
          </p>
          <p>
            <strong>Hotels, shortlets and serviced apartments run as a business</strong> pick one of
            four policies:
          </p>
          <ul role="list">
            <li>
              <strong>Flexible.</strong> Cancel at least 24 hours before check-in for a full refund.
              After that, no refund.
            </li>
            <li>
              <strong>Moderate.</strong> Cancel at least 5 days before check-in for a full refund.
              After that, half back.
            </li>
            <li>
              <strong>Firm.</strong> Cancel at least 30 days before check-in for a full refund, or at
              least 7 days before for half back. After that, no refund.
            </li>
            <li>
              <strong>Strict.</strong> Cancel at least 7 days before check-in for half back. After
              that, no refund.
            </li>
          </ul>
          <p>
            <strong>A stay listed by an owner or agent</strong> follows Vallo&rsquo;s standard
            schedule: full refund more than {FULL_REFUND_HOURS} hours before check-in, half back
            inside {FULL_REFUND_HOURS} hours, and none once check-in day has started. The full
            schedule is on the{" "}
            <Link href="/cancellations" className={A}>
              Cancellations
            </Link>{" "}
            page.
          </p>
          <p>
            Every deadline is counted in Lagos time from the stay&rsquo;s check-in time. A caution
            deposit is always returned under the rules listed with it, whatever the policy.
          </p>
        </>
      ),
    },
    {
      id: "ask-for-a-refund",
      heading: "Ask for a refund on a paid stay",
      body: (
        <ol role="list">
          <li>Open the booking from Plans.</li>
          <li>Ask for the booking to be cancelled and refunded.</li>
          <li>A person at Vallo decides it by the policy on your booking, and tells you the amount.</li>
          <li>The refund is started by the end of the fifth Nigerian business day after you asked.</li>
          <li>{REFUND_ROUTE}</li>
        </ol>
      ),
    },
    {
      id: "host-cancels",
      heading: "If the host cancels, or the place is not as listed",
      body: (
        <>
          <p>
            If the host cancels, you get everything back, whenever it happens. The policy does not
            apply to a cancellation you did not choose.
          </p>
          <p>
            If you cannot get in, or the place is not what was listed, do not cancel. Report it from
            the booking on the day, with photos. When you arrive, your booking asks you{" "}
            <em>Is it as listed?</em> from check-in time until three hours after. Answer no, give a
            reason and add a photo. A person at Vallo looks at it, and a place that was not as listed
            is refunded in full.
          </p>
        </>
      ),
    },
    {
      id: "escrow-refunds",
      heading: "Get back a payment held in escrow",
      body: <p>{RAIL_COPY.protected.refund}</p>,
    },
    {
      id: "tables-and-viewings",
      heading: "Cancel a table or a viewing",
      body: (
        <p>
          Nothing is paid for a table or a viewing, so there is nothing to refund. Cancel a table from
          the reservation, and a viewing from Plans. A restaurant may ask for some notice; its page
          says how much.
        </p>
      ),
    },
    {
      id: "refund-missing",
      heading: "If your refund has not arrived",
      body: (
        <p>
          The booking shows where the refund is. If your bank shows nothing ten working days after it
          was started,{" "}
          <Link href="/contact" className={A}>
            contact support
          </Link>{" "}
          with the booking reference.
        </p>
      ),
    },
  ],
};

/* ---------------------------------------------------------- trust, safety */

const TRUST_AND_SAFETY: DocChapter = {
  slug: "trust-and-safety",
  number: 0,
  title: "Avoiding scams and reporting",
  summary:
    "The few habits that keep you out of trouble, how to report a listing, a person or a post, and what happens after you do.",
  icon: "support-shield",
  sections: [
    {
      id: "pay-on-the-platform",
      heading: "Keep the deal on Vallo",
      body: (
        <ul role="list">
          <li>{PAY_INSIDE_VALLO}</li>
          <li>Keep messages on Vallo. A chat here is a record; a chat elsewhere is your word against theirs.</li>
          <li>
            Never send money to an account number someone gives you. Messages that look like account
            numbers are flagged to the Vallo team.
          </li>
          <li>
            {NO_INSPECTION_FEE} There is no holding fee or platform fee to pay anyone. Anybody presenting
            one as a Vallo charge is lying.
          </li>
        </ul>
      ),
    },
    {
      id: "at-a-viewing",
      heading: "Go to a viewing well prepared",
      body: (
        <ul role="list">
          <li>Go in daylight if you can, and tell somebody where you are going.</li>
          <li>Never hand over cash.</li>
          <li>Close the viewing on Vallo afterwards, so there is a record of what you saw and when.</li>
          <li>For a purchase, have your own lawyer look at the title before any money moves.</li>
        </ul>
      ),
    },
    {
      id: "reporting",
      heading: "Report a listing, a person or a post",
      body: (
        <>
          <p>Every listing, profile and post has a report option. Pick the reason that fits:</p>
          <ul role="list">
            {REPORT_CATEGORY_ORDER.map((code) => (
              <li key={code}>
                <strong>{REPORT_CATEGORY_COPY[code].label}.</strong> {REPORT_CATEGORY_COPY[code].hint}
              </li>
            ))}
          </ul>
          <p>
            Add what you saw in your own words. Reports about paying outside Vallo go to the front of
            the queue.
          </p>
        </>
      ),
    },
    {
      id: "what-happens-next",
      heading: "What happens after you report",
      body: (
        <ol role="list">
          <li>A person at Vallo reads it.</li>
          <li>A serious report can hide the listing while it is checked.</li>
          <li>An account can be stopped. The person is told why and what they can do about it.</li>
          <li>Every action is written to a record that cannot be edited or removed.</li>
        </ol>
      ),
    },
    {
      id: "already-sent-money",
      heading: "If you already sent money outside Vallo",
      body: (
        <ol role="list">
          <li>
            Call your bank first. Ask them to raise a dispute on the transfer. A fast report can let
            them hold the money in the receiving account.
          </li>
          <li>Report it to Vallo with the listing link, the account details and the messages.</li>
          <li>
            Vallo cannot recover money that never came through Vallo. It can remove the account and
            stop the same person reaching anybody else.
          </li>
        </ol>
      ),
    },
    {
      id: "appeal",
      heading: "Appeal a decision",
      body: (
        <>
          <p>
            If a post or a listing was taken down, an application refused or your account stopped, you
            can appeal. Reply to the notice, or write through{" "}
            <a href={SUPPORT_HREF} className={A}>
              {SUPPORT_LABEL}
            </a>
            , with what happened and why you think the decision was wrong.
          </p>
          <p>
            A person who did not make the first decision reads it. Appeals are answered{" "}
            {RESPONSE_COMMITMENTS.routine.label.toLowerCase()}. See{" "}
            <Link href="/standards#appeals" className={A}>
              Trust and safety standards
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "support",
      heading: "Contact support",
      body: (
        <>
          <p>
            Use{" "}
            <a href={SUPPORT_HREF} className={A}>
              {SUPPORT_LABEL}
            </a>
            , or the support chat in the app. A message to a person opens a ticket on your account, a
            person reads it, and the reply reaches you as a notification.
          </p>
          <p>
            A person replies within one business day. Reports about payment outside the platform are
            answered {RESPONSE_COMMITMENTS.urgent.label.toLowerCase()}. Write in English, Yorùbá, Hausa
            or Igbo, and the reply comes in the same language.
          </p>
          <p>
            Vallo is run by {COMPANY_FORMAL_NAME}, whose registered office is {COMPANY_REGISTERED_OFFICE}.
          </p>
        </>
      ),
    },
  ],
};

/* --------------------------------------------------------------- privacy */

const YOUR_DATA: DocChapter = {
  slug: "your-data-and-your-rights",
  number: 0,
  title: "Privacy and your data",
  summary:
    "What Vallo holds about you, who can see it, the rights the NDPA gives you, and how to delete your account.",
  icon: "doc-lock",
  sections: [
    {
      id: "what-we-hold",
      heading: "What Vallo holds",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Your account.</strong> Name, email, phone number, language, and your password
              stored only as a hash.
            </li>
            <li>
              <strong>What you do.</strong> Searches, saves, bookings, viewings, messages and reviews.
            </li>
            <li>
              <strong>Payments.</strong> References, amounts, refunds and agreements. Your card is
              handled by a licensed payment partner, and Vallo never holds your full card number.
            </li>
            <li>
              <strong>If you list or host.</strong> Your ID or NIN, business papers where they apply,
              any ownership document, and your payout account.
            </li>
            <li>
              <strong>Technical data.</strong> Device, browser and IP address, used to keep it working
              and secure.
            </li>
          </ul>
          <p>
            {COMPANY_FORMAL_NAME}, the company that runs Vallo, is responsible for this data under the
            Nigeria Data Protection Act 2023. Its registered office is {COMPANY_REGISTERED_OFFICE}.
          </p>
          <p>
            The full document is the{" "}
            <Link href="/privacy" className={A}>
              Privacy Policy
            </Link>
            . This page is the plain version. Where they differ, the policy governs.
          </p>
        </>
      ),
    },
    {
      id: "how-it-is-protected",
      heading: "Who can see what",
      body: (
        <ul role="list">
          <li>
            Your bookings, agreements, messages and settings are protected with row level security, so
            the database hands them only to you and to the people on the same deal.
          </li>
          <li>
            Gate details for a stay are shown only to the host, to Vallo staff, and to a guest with a
            confirmed booking.
          </li>
          <li>ID and ownership documents sit in a private store that only you and a reviewer can open.</li>
          <li>Data is encrypted in transit, and passwords are stored only as a hash.</li>
        </ul>
      ),
    },
    {
      id: "your-rights",
      heading: "Use your rights under the NDPA",
      body: (
        <>
          <p>The Nigeria Data Protection Act 2023 lets you:</p>
          <ul role="list">
            <li>ask for a copy of what Vallo holds about you;</li>
            <li>ask for anything wrong to be corrected;</li>
            <li>ask for data Vallo has no lawful reason to keep to be deleted;</li>
            <li>object to, or ask to limit, some processing;</li>
            <li>ask for your data in a portable format;</li>
            <li>withdraw consent where processing rests on it.</li>
          </ul>
          <p>
            Download a copy of your data yourself from Settings, under Privacy. For anything else, write
            through{" "}
            <a href={SUPPORT_HREF} className={A}>
              {SUPPORT_LABEL}
            </a>{" "}
            with Privacy as the subject. If the answer does not satisfy you, you can complain to the
            Nigeria Data Protection Commission.
          </p>
        </>
      ),
    },
    {
      id: "controls",
      heading: "Change what others see",
      body: (
        <ul role="list">
          <li>
            <strong>Hide my activity</strong> keeps your reviews and recent stays off your public page.
          </li>
          <li>
            <strong>Notification switches</strong> decide which emails reach you. Marketing is off
            until you turn it on.
          </li>
          <li>
            <strong>Data saver</strong> loads lighter images on a slow or metered connection.
          </li>
        </ul>
      ),
    },
    {
      id: "deleting",
      heading: "Delete your account",
      body: (
        <>
          <ol role="list">
            <li>Go to Settings, then Account, then Delete account.</li>
            <li>
              Finish or cancel anything still open, such as a booking or a published listing. The screen
              names it and links to it.
            </li>
            <li>
              Confirm it is you, then type <code>{DELETE_CONFIRM_PHRASE}</code> exactly, in capitals.
            </li>
            <li>
              You are signed out everywhere at once and nobody can reach your profile. Nothing is destroyed
              for {GRACE_WINDOW_DAYS} days, and the code we email you stops the deletion.
            </li>
            <li>
              After {GRACE_WINDOW_DAYS} days your profile, posts, saved places and uploaded files are
              destroyed, and we email you when it is done.
            </li>
          </ol>
          <p>
            What is kept: records of money that moved, for at least five years, because Nigerian
            anti-money-laundering law requires it, with your name, email address and phone number removed.
            Messages you sent stay in the other person&rsquo;s conversation, shown as from a deleted account.
            The full list is on{" "}
            <Link href="/delete-account" className={A}>
              Delete your account
            </Link>
            .
          </p>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------- troubleshooting */

const TROUBLESHOOTING: DocChapter = {
  slug: "troubleshooting",
  number: 0,
  title: "Troubleshooting",
  summary: "The things that go wrong, what they mean, and what to do about each one.",
  icon: "support-chat",
  sections: [
    {
      id: "cannot-sign-in",
      heading: "I cannot sign in",
      body: (
        <ul role="list">
          <li>
            <strong>The link expired or was used.</strong> Email links work once. Ask for a new one
            from{" "}
            <Link href="/sign-in" className={A}>
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/forgot-password" className={A}>
              Forgot password
            </Link>
            .
          </li>
          <li>
            <strong>I signed up with Google.</strong> That account has no password. Use the Google
            button.
          </li>
          <li>
            <strong>The Google button is missing.</strong> It only shows when it is connected. Use email
            meanwhile.
          </li>
        </ul>
      ),
    },
    {
      id: "dates-taken",
      heading: "Those dates were just taken",
      body: (
        <p>
          Somebody booked the same nights a moment before you. Nothing was charged. Pick other dates.
          Two people can never hold the same night.
        </p>
      ),
    },
    {
      id: "minimum-stay",
      heading: "The stay is too short, or the party too large",
      body: (
        <p>
          The host sets a minimum stay and a maximum party. The message names the number. Add nights or
          lower the party, or search again with the guest filter set.
        </p>
      ),
    },
    {
      id: "payment-will-not-open",
      heading: "Payment will not open",
      body: (
        <ul role="list">
          <li>For rent or a sale, both of you must confirm the agreement first.</li>
          <li>For a shortlet that is a request, the host must accept first.</li>
          <li>The lister may not have added a payout account yet. Message them.</li>
          <li>{ESCROW_PAUSED}</li>
        </ul>
      ),
    },
    {
      id: "payment-trouble",
      heading: "My payment did not go through",
      body: (
        <ul role="list">
          <li>
            <strong>The card was refused.</strong> Nothing was taken. Try again or use another card.
          </li>
          <li>
            <strong>Money left my account but the booking says unpaid.</strong> Open the booking again;
            the payment can land a moment later. If it still says unpaid, contact support with the
            reference.
          </li>
          <li>
            <strong>I tapped Pay twice.</strong> You were charged once.
          </li>
        </ul>
      ),
    },
    {
      id: "refund-missing",
      heading: "My refund has not arrived",
      body: (
        <p>
          {REFUND_ROUTE} If nothing has arrived after ten working days, contact support with the booking
          reference.
        </p>
      ),
    },
    {
      id: "no-gate-details",
      heading: "The gate details are not showing",
      body: (
        <p>
          They appear once your booking is confirmed. If it is confirmed and they are still missing, the
          host has not filled them in. Message the host, and report the listing if nobody answers.
        </p>
      ),
    },
    {
      id: "listing-problems",
      heading: "The place is not what was listed",
      body: (
        <p>
          Report it from the booking on the day and choose{" "}
          <em>{REPORT_CATEGORY_COPY.not_as_described.label}</em>. Take photos. See{" "}
          <Link href="/docs/refunds-and-cancellations#host-cancels" className={A}>
            If the place is not as listed
          </Link>
          .
        </p>
      ),
    },
    {
      id: "around-paused",
      heading: "Around says it is paused",
      body: (
        <p>
          Around is switched off while something is fixed. Nothing you posted or joined is lost, and the
          rest of Vallo keeps working.
        </p>
      ),
    },
    {
      id: "offline",
      heading: "Nothing is loading",
      body: (
        <p>
          Vallo keeps working on a weak connection and shows an offline screen when there is none. If an
          error stays, tell us what you were doing through{" "}
          <Link href="/contact" className={A}>
            the contact form
          </Link>
          .
        </p>
      ),
    },
    {
      id: "still-stuck",
      heading: "Still stuck",
      body: (
        <p>
          Search the{" "}
          <Link href="/help" className={A}>
            help centre
          </Link>
          , or{" "}
          <Link href="/contact" className={A}>
            contact support
          </Link>
          . A person replies within one business day. Include a reference if you have one.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------- the reading order */

/**
 * THE READING ORDER, by group. The numbers and the groups are assigned from
 * this list, so adding a chapter can never leave two chapters sharing a
 * number, and a chapter cannot sit outside a group.
 */
const ORDER: readonly { group: DocGroupId; chapters: DocChapter[] }[] = [
  { group: "start", chapters: [WHAT_VALLO_IS, QUICK_START, ACCOUNT_AND_WORKSPACES, GETTING_AROUND] },
  {
    group: "renting",
    chapters: [FINDING_A_PLACE, UNDERSTANDING_A_LISTING, VIEWINGS, AGREEMENTS_AND_PAYING, PRICE_CHECK],
  },
  { group: "stays", chapters: [BOOKING_A_STAY, RESTAURANTS] },
  { group: "money", chapters: [WHAT_VALLO_COSTS, PAYING_ON_VALLO, REFUNDS] },
  { group: "listing", chapters: [LISTING_ON_VALLO, FOR_OWNERS, FOR_AGENTS, HOSTING] },
  { group: "tools", chapters: [MESSAGES, AI_ASSISTANT, AROUND] },
  { group: "trust", chapters: [BADGES_AND_VERIFICATION, REVIEWS, TRUST_AND_SAFETY, YOUR_DATA, TROUBLESHOOTING] },
];

export const CHAPTERS: DocChapter[] = ORDER.flatMap(({ group, chapters }) =>
  chapters.map((chapter) => ({ ...chapter, group })),
).map((chapter, index) => ({ ...chapter, number: index + 1 }));

/* ------------------------------------------------------------------ index */

export const CHAPTER_INDEX: DocChapterIndexEntry[] = CHAPTERS.map((chapter) => ({
  slug: chapter.slug,
  number: chapter.number,
  title: chapter.title,
  summary: chapter.summary,
  icon: chapter.icon,
  group: chapter.group ?? "start",
}));

/** One chapter by its slug, or undefined so the route can answer with notFound. */
export function chapterBySlug(slug: string): DocChapter | undefined {
  return CHAPTERS.find((chapter) => chapter.slug === slug);
}

/** What comes before and after, for the foot of a chapter. Either can be null. */
export function chapterNeighbours(slug: string): {
  previous: DocChapterIndexEntry | null;
  next: DocChapterIndexEntry | null;
} {
  const at = CHAPTER_INDEX.findIndex((chapter) => chapter.slug === slug);
  if (at === -1) return { previous: null, next: null };
  return {
    previous: at > 0 ? (CHAPTER_INDEX[at - 1] ?? null) : null,
    next: at < CHAPTER_INDEX.length - 1 ? (CHAPTER_INDEX[at + 1] ?? null) : null,
  };
}
