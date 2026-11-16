import Link from "next/link";
import { DocCallout, DocCrossLink } from "@/components/docs/DocArticle";
import { DocFlow } from "@/components/docs/DocFlow";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { plural } from "@vallo/i18n/core";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 17: ONBOARDING A MEMBER (the founder, 15 November 2026).
 *
 * The other side of chapter 16: what a person does from the moment they press
 * Sign up to their first booking, what they see at each step, what Vallo asks
 * them for and when, and what staff can see and do about each part of it.
 *
 * Read on 15 November 2026 from the flows themselves: the welcome stage and
 * the first runs (`app/welcome`, `app/first-run`,
 * `components/app/feature-onboarding/first-runs.ts`), the sign up and sign in
 * routes under `app/(auth)`, the profile and settings routes, the phone gate
 * (`lib/phone-otp/core.ts` and `gate.ts`, whose rule is quoted here), the
 * stays and table flows, and the member documents in `app/(site)/docs`.
 * On 16 November 2026 VALLO Intelligence was added from its own code
 * (`app/(app)/intelligence`, `components/app/intelligence`, `lib/intelligence`)
 * and its four ways in.
 */

/**
 * "10 other currencies", counted the way every counted phrase on Vallo is.
 *
 * The number is written here rather than read from `lib/currency`, because
 * nothing under `app/admin` may import the currency guide: admin is a money
 * surface and the rule that keeps a converted figure off one is absolute
 * (`lib/currency/money-surfaces.test.ts`). This is prose about the product,
 * not a price, so the figure is stated and `manual.test.ts` holds it to
 * `FOREIGN_CURRENCIES.length`: add a currency and that test fails until this
 * moves with it.
 */
const OTHER_CURRENCY_COUNT = 10;

const OTHER_CURRENCIES = plural(OTHER_CURRENCY_COUNT, {
  one: "{count} other currency",
  other: "{count} other currencies",
});

const ASKS: DocTableRow[] = [
  { id: "sign-up", cells: { when: "To sign up", asks: "An email address and a password, or a Google account. Apple appears where it is switched on. Nothing else." } },
  { id: "browse", cells: { when: "To look, search, save and compare", asks: "Nothing. They need an account to see inside Vallo, and must be 18 or over." } },
  { id: "message", cells: { when: "To message a lister, ask to view, review or report", asks: "Nothing beyond the account. A member is never asked who they are to talk to somebody." } },
  { id: "pay", cells: { when: "At their first payment", asks: "A phone number, confirmed with a code. This is the first moment Vallo asks for one." } },
  { id: "list", cells: { when: "Before a first listing is published", asks: "A confirmed phone number, and then the lister's own papers. Chapter 16 is that whole road." } },
  { id: "rent-id", cells: { when: "Before the first payment of a rental of five months or more", asks: "Their identity, read by a person. A stay never asks a guest for identity." } },
  { id: "abroad", cells: { when: "A member outside Nigeria", asks: "No phone at all, while no code can reach a number outside Nigeria. Nothing else about their account is different." } },
];

const FIRST_BOOKING: DocTableRow[] = [
  {
    id: "stay",
    cells: {
      kind: "A hotel room, a shortlet or a serviced apartment",
      how: "Pick the dates and the party, read every charge at the door, then pay by card inside Vallo. A hotel room is paid when they book. A shortlet is paid when the host accepts, or at once where the host chose that for the listing. One of four cancellation policies is fixed on the booking as it is paid. From check-in they are asked whether the place is as listed, and a no reaches a person at Vallo.",
    },
  },
  {
    id: "table",
    cells: {
      kind: "A restaurant table",
      how: "Free, up to 90 days ahead, for up to 50 people. The restaurant confirms or declines. The booking carries a check-in code, its own conversation with the restaurant, and reminders the evening before and two hours before. The bill is paid at the restaurant. Only a diner who was seated can review.",
    },
  },
  {
    id: "visit",
    cells: {
      kind: "A viewing of a property",
      how: "Booked from the listing, in person or by live video from the property. Free: Vallo charges no inspection fee. Afterwards the member fills in an inspection report of eight rooms and areas, with notes and photographs.",
    },
  },
  {
    id: "rent",
    cells: {
      kind: "A rental",
      how: "They view, inspect, and both sides confirm the same written agreement, drawn from the listing's own figures and the inspection report. Paying the rent through Vallo is not open, so nothing is charged on Vallo at the end of it. Say that plainly rather than letting somebody wait for a payment screen.",
    },
  },
  {
    id: "buy",
    cells: {
      kind: "A home for sale",
      how: "They can make a written offer: what they propose to pay, how they plan to pay and when they would like to complete. The seller accepts, declines, counters or asks a question, and each version is kept. It costs nothing and commits them to nothing. Vallo takes no part of a purchase price at any stage and asks for no deposit.",
    },
  },
];

export const ONBOARDING_A_MEMBER: ManualBody = {
  intro: (
    <p>
      What a new member does, sees and is asked for, from sign up to their first booking. Read it before you answer
      anybody who says they are stuck at the beginning, and before you tell a member what Vallo needs from them: it
      asks for less than most people expect, and the order matters.
    </p>
  ),
  glance: [
    "An account is free. An email address and a password, or Google, and they must be 18 or over.",
    "Looking, saving, messaging, asking to view, reviewing and reporting ask for nothing but the account.",
    "A phone number is asked for at the first payment, and before a first listing is published. Nowhere else.",
    "A member outside Nigeria is not asked for a phone at all while codes cannot be sent out of the country. Nothing blocks them.",
    "Naira is the price. Other currencies are a reading guide beside it, never what anybody pays.",
    "Marketing messages are off until a member turns them on.",
    "A member who cannot find something starts in VALLO Intelligence: the menu, the + Create sheet, Home, or Ctrl K on a computer.",
    "Never tell one member anything about another. Use a reference or a count.",
  ],
  sections: [
    {
      id: "sign-up",
      title: "Sign up, and getting back in",
      body: (
        <>
          <DocFlow
            label="From a stranger to a member"
            steps={[
              { icon: "compass", title: "Get started", outcome: "Four slides, once per device or account, and skippable: the two sides, what a mark means, talk first and pay on Vallo, and the ending." },
              { icon: "user", title: "Sign up", href: "/sign-up", outcome: "Email and a password, or Google. Apple where it is switched on." },
              { icon: "mail", title: "Open the email", outcome: "With email, they confirm from the message we send. The account is then ready." },
              { icon: "user-pen", title: "Their profile", href: "/profile", outcome: "Name, phone number, photograph, state and local government, and what they do." },
              { icon: "house", title: "Looking", href: "/search", outcome: "Search, VALLO Intelligence, the map, saved places, compare, the assistant, Around, Circle and Roommates." },
            ]}
          />
          <ul role="list">
            <li>
              <strong>Signing back in</strong> happens the way they signed up. A Google account has no password, which
              is the single most common cause of &quot;my password does not work&quot;: check how the account was made
              before anything else.
            </li>
            <li>
              <strong>A forgotten password</strong> is a link sent by email. If they have lost the email address
              itself, that is account recovery, and it is a desk, not a reset.
            </li>
            <li>
              <strong>Tapping something that needs an account</strong> while signed out brings them back to that same
              thing after they sign in. If a member says they were thrown back to the home page, that is worth a
              ticket.
            </li>
            <li>
              <strong>A handle</strong> is optional: three to twenty lowercase letters, digits or underscores, starting
              with a letter. It gives them a public page, and they choose what shows on it under Privacy.
            </li>
          </ul>
          <h3 className="nf-h4">Finding things: VALLO Intelligence</h3>
          <p>
            Once they are in, the quickest way to anything is{" "}
            <Link href="/intelligence" className={A}>
              VALLO Intelligence
            </Link>
            , one search across homes, stays, restaurants, roommates, people, communities, help and their own records.
            Show a new member the four ways in: VALLO Intelligence near the top of the menu, the row directly below
            Post to story in the + Create sheet, the Search everything VALLO bar on Home, and Ctrl K (Cmd K on a Mac)
            on a computer.
          </p>
          <ul role="list">
            <li>
              They type it the way they would say it: &quot;2 bedroom in Yaba under 2m&quot;, &quot;hotels in Abuja this
              weekend&quot;, &quot;change my email&quot;. Nicknames such as VI, Lekki ph 1, PH and FCT are understood.
            </li>
            <li>
              What search took from the words shows as chips under Search understood. A wrong chip is removed with a
              tap. A misspelling is offered as a question, never changed behind their back.
            </li>
            <li>
              Start with a mood gives them a first search without typing, and the microphone lets them speak one where
              their browser can turn speech into words. Nothing is searched until they press Search.
            </li>
            <li>
              The Yours tab finds their own saved homes, offers, bookings, conversations and saved searches, read
              through their own account. Their recent searches are theirs alone, and they can remove them.
            </li>
            <li>
              A result that says Example listing. Not available. is an example, not a place they can book.
            </li>
          </ul>
          <DocCallout tone="note" title="The first run of one feature">
            Some parts of the product introduce themselves the first time a member opens them: hosting, agent mode,
            verification, agreements, invites, the passport, analytics, the tenancy file, a portfolio and paid
            promotion. It is shown once, it can be skipped, and skipping lands on the feature itself rather than
            nowhere.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-vallo-asks-and-when",
      title: "What Vallo asks for, and exactly when",
      body: (
        <>
          <p>
            This table is the answer to half the questions support gets in the first week of somebody&apos;s account.
            Read the middle column out as it stands.
          </p>
          <DocTable
            caption="What a member is asked for at each moment"
            columns={[
              { key: "when", label: "When" },
              { key: "asks", label: "What Vallo asks for" },
            ]}
            rows={ASKS}
          />
          <p>
            The reason the phone is asked for at money and at a listing, and nowhere else, is that a working Nigerian
            number is tied to a registered identity, which makes it worth something exactly where somebody could lose
            money. A phone number is not an identity document and Vallo never treats it as one.
          </p>
        </>
      ),
    },
    {
      id: "settings-they-will-ask-about",
      title: "The settings they will ask you about",
      body: (
        <ul role="list">
          <li>
            <strong>Language.</strong> English, Yoruba, Hausa and Igbo, across the whole product.
          </li>
          <li>
            <strong>Appearance.</strong> Light, dark or whatever the phone is set to, and how much the app moves.
          </li>
          <li>
            <strong>Notifications.</strong> Bookings, messages, payments and agreements, and separately ideas and
            offers. Marketing is off until a member turns it on. Never turn it on for them.
          </li>
          <li>
            <strong>Prices in another currency.</strong> Naira is the price of record: every listing is priced in naira
            and every payment is charged in naira. Beside the naira figure, a member can read an approximate guide in{" "}
            {OTHER_CURRENCIES}, worked out from a published rate that is refreshed twice a day. It never appears on a
            money screen: not a checkout, a receipt, a refund or an agreement. If a member asks you to charge them in
            pounds, the answer is no, and the reason is that a domestic price in Nigeria is a naira price.
          </li>
          <li>
            <strong>Privacy.</strong> Hiding their activity, a data saver, blocked people, and what their public page
            shows.
          </li>
          <li>
            <strong>Their data.</strong> They can ask for a copy or delete the account. Deleting is theirs to do and
            the reason they give is read as a rate, never as a name, on the account deletions desk.
          </li>
        </ul>
      ),
    },
    {
      id: "to-their-first-booking",
      title: "To their first booking",
      body: (
        <>
          <DocTable
            caption="The first thing a member books, and how each one works"
            columns={[
              { key: "kind", label: "What they are booking" },
              { key: "how", label: "How it goes" },
            ]}
            rows={FIRST_BOOKING}
          />
          <p>
            Whatever they book, three things are true and worth saying: they pay exactly the price on the listing with
            nothing added by Vallo, every payment for a deal happens inside Vallo, and a refund due to them goes back
            to the card or account they paid with, which banks usually show within 5 to 10 working days.
          </p>
          <DocCrossLink href="/admin/manual/product-guide">Chapter 15, for the whole product feature by feature</DocCrossLink>
        </>
      ),
    },
    {
      id: "what-a-new-member-asks",
      title: "What a new member asks, and what to say",
      body: (
        <ul role="list">
          <li>
            <strong>&quot;Why do I need an account to look?&quot;</strong> Because every listing belongs to a real
            person who was reviewed, and messaging, booking and reviewing have to belong to somebody too. It is free,
            and there are tools that need no account at all: the move-in cost calculator, the area pages and the
            checker for an advert or a receipt seen elsewhere.
          </li>
          <li>
            <strong>&quot;Is there a fee for me?&quot;</strong> No. Nothing to join, to look, to message, to view or to
            book. Vallo earns on a paid deal, out of the lister&apos;s or host&apos;s share.
          </li>
          <li>
            <strong>&quot;Do I pay to inspect?&quot;</strong> No. Vallo charges no inspection fee. If an owner or agent
            asks for one, that is a private arrangement, it is not a Vallo charge, and they can report it.
          </li>
          <li>
            <strong>&quot;Can I pay my rent here?&quot;</strong> Not today. They can view, inspect and agree terms now,
            and nothing has been charged. Do not give a date.
          </li>
          <li>
            <strong>&quot;How do I know the listing is real?&quot;</strong> A person at Vallo read the lister and the
            listing before it went up, the listing says what has been looked at and what has not, and the way to keep
            that worth anything is to keep the conversation and the payment inside Vallo.
          </li>
          <li>
            <strong>&quot;I cannot find what I am looking for.&quot;</strong> Point them to VALLO Intelligence and ask
            them to type it the way they would say it. Then ask them to read the Search understood chips and remove any
            that are wrong. If it still finds nothing, Vallo may not have it yet. Say so, and do not promise it will.
          </li>
          <li>
            <strong>&quot;Can Vallo see what I search for?&quot;</strong> Their recent searches are kept for them alone,
            and they can remove them. For Vallo&apos;s own figures a search is kept without their account id or address,
            and no desk shows what one member searched.
          </li>
          <li>
            <strong>&quot;I live abroad. Can I use it?&quot;</strong> Yes. Nothing blocks a member outside Nigeria, and
            they are not asked for a phone number while codes cannot be sent out of the country. A lister still needs a
            Nigerian bank account to be paid.
          </li>
        </ul>
      ),
    },
    {
      id: "what-staff-can-do",
      title: "What staff can see and do about a member",
      body: (
        <>
          <ul role="list">
            <li>
              <Link href="/admin/people" className={A}>People</Link>: one member&apos;s account, listings, bookings, payments and cases in one file.
            </li>
            <li>
              <Link href="/admin/lookup" className={A}>Lookup</Link>: find a member by name, email, phone or a reference they quote.
            </li>
            <li>
              <Link href="/admin/account-recovery" className={A}>Account recovery</Link>: somebody locked out of the email address on their account.
            </li>
            <li>
              <Link href="/admin/support" className={A}>Support</Link>: what they wrote in, which lane it is in and what it is promised by.
            </li>
            <li>
              <Link href="/admin/standing" className={A}>Standing</Link>: their marks and strikes, and what each one means.
            </li>
            <li>
              <Link href="/admin/account-deletions" className={A}>Account deletions</Link>: why members leave, as rates over time and never as names.
            </li>
          </ul>
          <DocCallout tone="warning" title="What you do not do">
            You do not change a member&apos;s email or password for them, confirm a phone number on their behalf, turn
            marketing on for them, or tell one member anything about another. No desk shows what a member searched
            for, so never say you can see it. Every file you open and every decision
            you make is written to the audit log with your name.
          </DocCallout>
          <p>
            The member&apos;s own version of this chapter is{" "}
            <Link href="/docs/getting-started" className={A}>
              Your account and workspaces
            </Link>
            , with{" "}
            <Link href="/docs/settings" className={A}>
              Settings
            </Link>
            ,{" "}
            <Link href="/docs/finding-a-place" className={A}>
              Finding a place
            </Link>{" "}
            and{" "}
            <Link href="/docs/booking-a-stay" className={A}>
              Booking a stay
            </Link>
            . Send the link rather than retyping it.
          </p>
        </>
      ),
    },
  ],
};
