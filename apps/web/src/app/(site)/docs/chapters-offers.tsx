import Link from "next/link";
import { DocButtons } from "@/components/docs/DocButton";
import { DocCallout } from "@/components/docs/DocCallout";
import { DocTable, type DocTone } from "@/components/docs/DocTable";
import { FeeCalculatorSection } from "@/components/docs/FeeCalculatorSection";
import { StepGuide } from "@/components/docs/StepGuide";
import { differenceOf, formatPct, nairaFull } from "@/lib/offers/format";
import {
  AGREED_IS_NOT_SALE,
  CASH_INTENTION,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  DOCUMENT_NOT_VERIFIED,
  DOCUMENT_STATE_DETAIL,
  DOCUMENT_STATE_WORD,
  NOT_A_LENDER,
  NOTHING_CHARGED,
  NO_MONEY_TAKEN,
  OTHER_COSTS_NOT_ITEMISED,
  PAYMENT_DETAIL,
  PAYMENT_LABEL,
  STAGE_DETAIL,
  STAGE_LABEL,
  TITLE_NOT_VERIFIED,
  WHAT_HAPPENS_NEXT_BUYER,
  doorSentence,
} from "@/lib/offers/words";
import { DEAL_STAGES, type DocumentState } from "@/lib/offers/types";
import { CONTACT_EMAIL } from "@/lib/docs/contact";
import type { DocChapter } from "./chapters";

/**
 * THE OFFERS DOCUMENTATION (Agent DOCS, 11 November 2026; OFFERS_AND_DEAL_ROOM.md
 * section 12). Eight of the nine pages the feature owes; the ninth, the staff
 * manual page for the Offers and Deals desk, is behind the console in
 * `app/admin/handbook`.
 *
 * Every sentence about a state, a stage, a document or a refusal is IMPORTED
 * from `lib/offers/words.ts`, the module the screens draw their words from, so
 * these pages cannot drift from what the product says. The worked example's
 * arithmetic is `lib/offers/format.ts`'s own (`differenceOf`, `nairaFull`).
 *
 * What these pages must never say (section 7 of the handoff), kept as a
 * checklist for the next editor: an accepted offer is not a sale; Vallo takes
 * no money for a purchase; uploaded, under review and approved are different
 * and none is "verified title"; Cash is an intention, not checked funds; Vallo
 * is not a lender; there is no verification badge on a document.
 */

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";
const UPDATED = "2026-11-11";

/* ------------------------------------------------------ how offers work */

export const HOW_OFFERS_WORK: DocChapter = {
  slug: "how-offers-work",
  number: 0,
  title: "How offers work on Vallo",
  summary: "What an offer is and is not, what happens after you send one, and what Vallo does and does not do.",
  icon: "doc-review",
  updated: UPDATED,
  glance: [
    "An offer is a written proposal to buy a home, kept as a record. Nothing is charged.",
    "Every change to the terms is a new version. Nothing is overwritten.",
    AGREED_IS_NOT_SALE,
    NO_MONEY_TAKEN,
  ],
  actions: ["make-offer", "open-offers", "start-verification"],
  related: [
    { href: "/docs/making-an-offer", label: "How to make an offer" },
    { href: "/docs/offer-fees", label: "Fees and what you will pay" },
  ],
  sections: [
    {
      id: "what-it-is",
      heading: "What an offer is",
      body: (
        <>
          <p>
            On a home that is for sale, <strong>Make an offer</strong> lets you tell the seller in writing what you
            propose to pay, how you plan to pay, and when you would like to complete. The seller can accept it, decline
            it, answer with a counteroffer, or ask you a question. {NOTHING_CHARGED}
          </p>
          <p>
            Offers are for homes for sale. A home to rent follows the rental journey: a viewing, an inspection report
            and an agreement (see <Link href="/docs/agreements-and-paying" className={A}>From viewing to keys</Link>).
          </p>
        </>
      ),
    },
    {
      id: "what-it-is-not",
      heading: "What an offer is not",
      body: (
        <>
          <ul>
            <li>It is not a payment, a deposit or a reservation. {NO_MONEY_TAKEN}</li>
            <li>
              It is not a contract and not a sale. {AGREED_IS_NOT_SALE}
            </li>
            <li>It does not take the home off the market. A home can have more than one offer on it.</li>
            <li>It is not a loan. {NOT_A_LENDER}</li>
          </ul>
          <DocCallout kind="warning" title="Check the title yourself">
            <p>{TITLE_NOT_VERIFIED}</p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "after-you-send",
      heading: "What happens after you send one",
      body: (
        <ol>
          {WHAT_HAPPENS_NEXT_BUYER.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ),
    },
    {
      id: "stages",
      heading: "The stages of a deal",
      body: (
        <>
          <p>
            The Deal Room shows a progress tracker. A stage moves on only when someone <em>records</em> it. It never
            moves because time has passed.
          </p>
          <DocTable
            caption="The stages of a deal in the Deal Room"
            headLabel="Stage"
            columns={[
              { key: "state", label: "Where it stands" },
              { key: "means", label: "What it means" },
            ]}
            rows={DEAL_STAGES.map((stage) => ({
              head: STAGE_LABEL[stage],
              cells: {
                state: {
                  state: stage === "completed" ? "Recorded" : stage === "agreed" ? "Terms agreed" : "In progress",
                  tone: (stage === "completed" || stage === "agreed" ? "success" : "info") as DocTone,
                },
                means: STAGE_DETAIL[stage],
              },
            }))}
          />
          <p>
            An offer can also end: declined by the seller, withdrawn by the buyer, expired, or cancelled. An offer that
            has ended cannot be accepted.
          </p>
        </>
      ),
    },
    {
      id: "vallo-does",
      heading: "What Vallo does and does not do",
      body: (
        <DocTable
          caption="What Vallo does and does not do on an offer"
          headLabel="Vallo"
          columns={[{ key: "yes", label: "Does it?" }, { key: "note", label: "In plain words" }]}
          rows={[
            { head: "Keeps the record", cells: { yes: { yes: true }, note: "Every version, who proposed it and when, and every action." } },
            { head: "Checks who you are", cells: { yes: { yes: true, word: "Where required" }, note: "The requirements on the offer screen, such as identity, age and phone." } },
            { head: "Shows an agent's sale mandate", cells: { yes: { yes: true, word: "When on record" }, note: "A line saying whether the agent holds a signed sale mandate from the owner." } },
            { head: "Takes money for the purchase", cells: { yes: { yes: false }, note: NO_MONEY_TAKEN } },
            { head: "Verifies the title", cells: { yes: { yes: false }, note: TITLE_NOT_VERIFIED } },
            { head: "Checks your funds", cells: { yes: { yes: false }, note: CASH_INTENTION } },
            { head: "Lends or arranges a mortgage", cells: { yes: { yes: false }, note: NOT_A_LENDER } },
            { head: "Completes the sale", cells: { yes: { yes: false }, note: "The parties complete the transfer between themselves, with their own solicitors." } },
          ]}
        />
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <>
          <ul>
            <li>Someone asks you to pay a deposit to hold the home. Vallo never asks for one. Do not pay, and use Raise a concern in the Deal Room.</li>
            <li>The agent has no signed sale mandate on record. Offers are closed on that home until there is one.</li>
            <li>
              Anything that looks wrong: write to <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.
            </li>
          </ul>
        </>
      ),
    },
  ],
};

/* ------------------------------------------------------ making an offer */

export const MAKING_AN_OFFER: DocChapter = {
  slug: "making-an-offer",
  number: 0,
  title: "How to make an offer",
  summary: "From a home you like to a sent offer: the requirements, the amount, how you plan to pay, and the review.",
  icon: "doc-review",
  updated: UPDATED,
  glance: [
    "You need to finish the requirements shown on the offer screen. Each one has a button that fixes it and brings you back.",
    "Leave the amount blank to offer the asking price. The figure is shown before you send.",
    "Cash, Mortgage or Instalment is what you tell the seller. Vallo does not check it and takes no payment.",
    "You can withdraw an open offer later.",
  ],
  actions: ["make-offer", "start-verification", "open-offers"],
  related: [
    { href: "/docs/how-offers-work", label: "How offers work" },
    { href: "/docs/counteroffers-and-negotiation", label: "Counteroffers" },
  ],
  sections: [
    {
      id: "steps",
      heading: "Step by step",
      body: (
        <StepGuide
          label="Making an offer"
          before={[
            "Your account, signed in",
            "The requirements the offer screen lists for you (they can differ by property)",
            "The figure you want to offer, or the decision to offer the asking price",
            "How you plan to pay: Cash, Mortgage or Instalment",
            "Optional: a closing date you would like to propose, and a note for the seller",
          ]}
          steps={[
            {
              title: "Open the home and choose Make an offer",
              body: (
                <p>
                  On a home for sale, the action area has <strong>Make an offer</strong> next to Contact the agent,
                  Schedule an inspection, Save and Share. You cannot make an offer on your own listing or on a home that
                  is not open to offers.
                </p>
              ),
              actions: <DocButtons items={["make-offer"]} />,
            },
            {
              title: "Check the requirements",
              body: (
                <p>
                  The first screen, <strong>Your offer</strong>, starts with <strong>Before you offer</strong>: each
                  requirement is marked Done, Required, In progress or Needs review. A requirement you can fix has a
                  button (Fix or Continue) that goes into Vallo verification. When you finish, you come back to your
                  offer with what you had typed still there. Until every requirement is met, the form is visible but
                  Send is off, and the screen says why.
                </p>
              ),
              shot: { key: "making-an-offer/01-requirements", alt: "The offer screen listing each requirement and whether it is done" },
              actions: <DocButtons items={["start-verification"]} />,
            },
            {
              title: "Set the amount, a date and a note",
              body: (
                <>
                  <p>
                    Type your offer, or leave it blank to offer the asking price. Either way the figure you are offering
                    is shown, with how far it is from the asking price, as an amount and a percentage. {OTHER_COSTS_NOT_ITEMISED}
                  </p>
                  <p>
                    You can propose a closing date (it is a proposal; the seller may suggest another) and add a note of up
                    to 600 characters.
                  </p>
                </>
              ),
              shot: { key: "making-an-offer/02-amount", alt: "The amount field showing the figure and its difference from the asking price" },
            },
            {
              title: "Say how you plan to pay",
              body: (
                <>
                  <p>Vallo does not check this and takes no payment. It is what you tell the seller.</p>
                  <DocTable
                    caption="The three payment choices"
                    headLabel="Choice"
                    columns={[{ key: "what", label: "What it tells the seller" }]}
                    rows={(["cash", "mortgage", "instalment"] as const).map((key) => ({
                      head: PAYMENT_LABEL[key],
                      cells: { what: PAYMENT_DETAIL[key] },
                    }))}
                  />
                  <p>
                    Mortgage and Instalment ask a little more: the part you pay yourself or a deposit, and for an
                    instalment the number of months. {NOT_A_LENDER}
                  </p>
                </>
              ),
              shot: { key: "making-an-offer/03-payment", alt: "The three payment choices: Cash, Mortgage and Instalment" },
            },
            {
              title: "Review and send",
              body: (
                <p>
                  The last screen sums it up: the property, the payment choice, the closing date, your note, and the
                  asking price with any costs the listing really carries. Look it over once, then <strong>Send offer</strong>.
                  Sending twice on a poor connection sends it once.
                </p>
              ),
              shot: { key: "making-an-offer/04-review", alt: "The review screen with the offer figure, the asking price and the Send offer button" },
            },
            {
              title: "After you send",
              body: (
                <p>
                  A confirmation page gives you the offer reference, the property, your figure, how you plan to pay, the
                  date, who has the offer now and what happens next, with two buttons: View Deal Room and Back to the
                  property. The seller is told. The offer sits in <strong>My offers</strong>.
                </p>
              ),
              shot: { key: "making-an-offer/05-confirmation", alt: "The confirmation page with the offer reference and two buttons" },
              actions: <DocButtons items={["open-offers"]} />,
            },
          ]}
        />
      ),
    },
    {
      id: "wrong",
      heading: "What can go wrong",
      body: (
        <>
          <p>Each of these is the sentence the screen shows.</p>
          <DocTable
            caption="Why an offer cannot be sent, in the words the screen uses"
            headLabel="When"
            columns={[{ key: "says", label: "The screen says" }]}
            rows={[
              { head: "A requirement is not done", cells: { says: doorSentence("not_eligible") } },
              { head: "The home is not taking offers", cells: { says: `${doorSentence("listing_unavailable")} Or: ${doorSentence("offers_off")}` } },
              { head: "It is your own listing", cells: { says: doorSentence("own_listing") } },
              { head: "The agent has no sale mandate", cells: { says: doorSentence("no_mandate") } },
              { head: "The amount is blank in the wrong way", cells: { says: doorSentence("bad_amount") } },
              { head: "The asking price moved", cells: { says: doorSentence("price_changed") } },
              { head: "You already have an open offer", cells: { says: doorSentence("already_open") } },
              { head: "You sent several quickly", cells: { says: doorSentence("rate_limited") } },
            ]}
          />
        </>
      ),
    },
  ],
};

/* ----------------------------------------------------- receiving offers */

export const RECEIVING_OFFERS: DocChapter = {
  slug: "receiving-offers",
  number: 0,
  title: "Receiving and answering offers",
  summary: "For sellers and agents: where offers arrive, what you can see, and the four ways to answer.",
  icon: "doc-review",
  updated: UPDATED,
  glance: [
    "Offers received are on the Received tab of My offers, each with the figure, the asking price and the difference.",
    "You can accept, decline, counter, or ask the buyer a question.",
    "You see the buyer's eligibility outcome, never an ID number, a document or a date of birth.",
    "An agent can only act on a home they hold a sale mandate for.",
  ],
  actions: ["open-offers-received", "open-deal-room"],
  related: [
    { href: "/docs/counteroffers-and-negotiation", label: "Counteroffers" },
    { href: "/docs/the-deal-room", label: "The Deal Room" },
  ],
  sections: [
    {
      id: "where",
      heading: "Where offers arrive",
      body: (
        <p>
          <strong>My offers</strong> has two tabs, Made and Received, each with its true
          count. Each offer is a card: the property, the buyer&apos;s display name, the offer, the asking price and the
          difference between them, how they plan to pay, any proposed closing date, when it arrived, and a marker if it
          is unread. A chip says in words whose move it is. Open one to open its Deal Room.
        </p>
      ),
    },
    {
      id: "private",
      heading: "What you see, and what you never see",
      body: (
        <>
          <p>
            You see whether the buyer meets the requirements. You never see an identity number, an image of a document,
            or a date of birth.
          </p>
          <p>
            An agent&apos;s page shows whether the agent holds a signed sale mandate from the owner. If a sale agent has no
            signed mandate on record, offers on that home are closed.
          </p>
        </>
      ),
    },
    {
      id: "answers",
      heading: "The four answers",
      body: (
        <DocTable
          caption="The four ways a seller can answer an offer"
          headLabel="Answer"
          columns={[{ key: "what", label: "What it does" }]}
          rows={[
            { head: "Accept", icon: "circle-check", cells: { what: "Agrees these exact terms. It asks you to confirm and shows the terms being accepted. This is not yet a sale." } },
            { head: "Counteroffer", icon: "repost-loop", cells: { what: "Proposes new terms. Your proposal becomes a new version. The buyer's offer is not edited." } },
            { head: "Request more information", icon: "chat-bubble", cells: { what: "Asks the buyer a question before you decide. They answer in the room." } },
            { head: "Decline", icon: "circle-x", cells: { what: "Closes the offer. You may give a reason, and the buyer reads it." } },
          ]}
        />
      ),
    },
    {
      id: "accepting",
      heading: "What accepting does and does not do",
      body: (
        <>
          <p>
            Accepting records who accepted, when, and which version. The offer then reads <strong>Terms agreed</strong>.
          </p>
          <DocCallout kind="warning" title="Accepted is not sold">
            <p>
              {AGREED_IS_NOT_SALE} Accepting does not take money, and it does not mark the property sold. Whether the
              property stays listed follows a configured rule, and its history is kept.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "more-than-one",
      heading: "More than one offer",
      body: (
        <p>
          A home can have several offers. Each has its own Deal Room and its own versions. Accepting one version is safe
          even if two people try at once: only one acceptance can stand, and a version that has been replaced or has
          expired cannot be accepted.
        </p>
      ),
    },
  ],
};

/* ---------------------------------------------------------- counteroffers */

const ASKING = 8_500_000_000;
const FIRST = 7_800_000_000;
const COUNTER = 8_200_000_000;
const AGREED = 8_050_000_000;

function diffText(offer: number): string {
  const d = differenceOf(offer, ASKING);
  return `${nairaFull(d.absMinor)} ${d.direction === "below" ? "below" : d.direction === "above" ? "above" : "at"} asking (${formatPct(d.pct)})`;
}

export const COUNTEROFFERS: DocChapter = {
  slug: "counteroffers-and-negotiation",
  number: 0,
  title: "Counteroffers and negotiation",
  summary: "How versions work, who can accept what, and a worked example with real figures.",
  icon: "doc-review",
  updated: UPDATED,
  glance: [
    "A counteroffer is a new version. The earlier ones stay, in order.",
    "Each side confirms a specific version. Terms are agreed when both have confirmed the same one.",
    "A replaced or expired version can never be accepted.",
    "Terms agreed is not a sale.",
  ],
  actions: ["open-offers", "open-offers-received"],
  related: [
    { href: "/docs/receiving-offers", label: "Receiving offers" },
    { href: "/docs/the-deal-room", label: "The Deal Room" },
  ],
  sections: [
    {
      id: "versions",
      heading: "Every proposal is a version",
      body: (
        <p>
          Offer, counteroffer, counter to the counter: each is its own version, with the figure, the payment choice, the
          proposed closing date and a note. The Negotiation section of the Deal Room lists them in order, says what
          changed from the one before and who proposed it, and shows which version each side has confirmed. Nothing is
          overwritten, so no one can later claim different terms were agreed.
        </p>
      ),
    },
    {
      id: "example",
      heading: "A worked example",
      body: (
        <>
          <p>
            A home is listed at <strong>{nairaFull(ASKING)}</strong>. The figures below are an example, using the same
            arithmetic the product uses: the difference is the offer minus the asking price, and the percentage is of the
            asking price.
          </p>
          <DocTable
            caption="A negotiation from offer to agreed terms"
            headLabel="Version"
            columns={[
              { key: "who", label: "Proposed by" },
              { key: "figure", label: "Figure" },
              { key: "vs", label: "Against asking" },
            ]}
            rows={[
              { head: "1. Offer", cells: { who: "Buyer", figure: nairaFull(FIRST), vs: diffText(FIRST) } },
              { head: "2. Counteroffer", cells: { who: "Seller", figure: nairaFull(COUNTER), vs: diffText(COUNTER) } },
              { head: "3. Counter to the counter", cells: { who: "Buyer", figure: nairaFull(AGREED), vs: diffText(AGREED) } },
              { head: "Terms agreed", cells: { who: "Seller confirms version 3", figure: nairaFull(AGREED), vs: diffText(AGREED) } },
            ]}
          />
          <p>
            In this example the buyer moved from {nairaFull(FIRST)} to {nairaFull(AGREED)}, a rise of{" "}
            {nairaFull(AGREED - FIRST)} ({formatPct(differenceOf(AGREED, FIRST).pct)} of their first offer). The
            seller moved from the asking price down by {nairaFull(ASKING - AGREED)}. The agreed figure is{" "}
            {diffText(AGREED)}.
          </p>
          <DocCallout kind="note" title="An example, not advice">
            <p>
              These figures are made up to show the arithmetic. They are not a guide to what a home will sell for.
            </p>
          </DocCallout>
          <p>
            Terms agreed means the figure is recorded as agreed. {AGREED_IS_NOT_SALE} No money moves through Vallo.
          </p>
        </>
      ),
    },
    {
      id: "whose-turn",
      heading: "Whose turn it is",
      body: (
        <p>
          Every offer says whose move it is: <strong>Awaiting you</strong> when it is yours, <strong>With the seller</strong>{" "}
          or <strong>With the buyer</strong> when you are waiting. If it is not your move, the screen says so rather than
          letting you act.
        </p>
      ),
    },
    {
      id: "changes",
      heading: "When the terms change under you",
      body: (
        <ul>
          <li>{doorSentence("superseded")}</li>
          <li>{doorSentence("version_changed")}</li>
          <li>{doorSentence("expired")}</li>
          <li>{doorSentence("locked")}</li>
        </ul>
      ),
    },
    {
      id: "withdraw",
      heading: "Withdrawing",
      body: (
        <p>
          A buyer can withdraw an open offer from the Deal Room. It ends the offer, and you can offer again later.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------------ deal room */

export const DEAL_ROOM: DocChapter = {
  slug: "the-deal-room",
  number: 0,
  title: "The Deal Room explained",
  summary: "Every section of the room where an offer lives, from the first version to the end of the deal.",
  icon: "doc-review",
  updated: UPDATED,
  glance: [
    "Each offer has one Deal Room, for the buyer and the seller. It is a view of the offer, not a separate record.",
    "Six sections: Overview, Negotiation, Messages, Inspection, Documents and Activity.",
    "At every moment it answers four questions: what has happened, what is waiting, whose turn it is, and whether there is a deadline.",
    "There is one obvious next action as a button.",
  ],
  actions: ["open-deal-room", "open-offers"],
  related: [
    { href: "/docs/offer-inspections-and-checks", label: "Inspections and due diligence" },
    { href: "/docs/offer-documents", label: "Documents" },
  ],
  sections: [
    {
      id: "top",
      heading: "The header and the tracker",
      body: (
        <p>
          The top shows the property, the two sides, the offer reference and the state as a chip with a word. Under it,
          the progress tracker shows the stages in order. A stage moves on only when someone records it. The quiet
          buttons are <strong>Withdraw offer</strong> (buyer, while open) and <strong>Raise a concern</strong>.
        </p>
      ),
    },
    {
      id: "sections",
      heading: "The six sections",
      body: (
        <DocTable
          caption="The sections of the Deal Room"
          headLabel="Section"
          columns={[{ key: "what", label: "What is in it" }]}
          rows={[
            { head: "Overview", icon: "grid", cells: { what: "The current terms, the asking price, who must act next, the deadline if there is one, and the one next action as a button." } },
            { head: "Negotiation", icon: "repost-loop", cells: { what: "Every version in order, what changed, who proposed it, and which version each side has confirmed." } },
            { head: "Messages", icon: "chat-bubble", cells: { what: "The conversation about this offer, in place. It is the same conversation as in Messages, not a second inbox." } },
            { head: "Inspection", icon: "calendar-check", cells: { what: "Schedule or open the inspection, and the dated report with photographs once it exists." } },
            { head: "Documents", icon: "file-text", cells: { what: "The checklist and the private vault. See Documents." } },
            { head: "Activity", icon: "history", cells: { what: "The full timeline of who did what and when." } },
          ]}
        />
      ),
    },
    {
      id: "deadline",
      heading: "Deadlines",
      body: (
        <p>
          A deadline is shown only when the offer really has one. If it does not, the room says &quot;No deadline has been
          set on this offer.&quot; An expired offer says so, with the date.
        </p>
      ),
    },
    {
      id: "record",
      heading: "Recording progress",
      body: (
        <>
          <p>After terms are agreed, the next-step button changes with the stage:</p>
          <ul>
            <li>Start inspection and due diligence</li>
            <li>Move on to documentation</li>
            <li>Move on to closing</li>
            <li>Record completion</li>
          </ul>
          <p>
            Recording a stage is a record that you and the other side say it has happened. {STAGE_DETAIL.completed}
          </p>
        </>
      ),
    },
    {
      id: "concern",
      heading: "Raise a concern",
      body: (
        <>
          <p>If something is wrong, Raise a concern opens a short form. You choose what it is about:</p>
          <ul>
            <li>The property or the terms were misrepresented</li>
            <li>The seller or agent may have no right to sell</li>
            <li>I am being pressed to pay outside Vallo</li>
            <li>Something else</li>
          </ul>
          <p>
            The other side is told that a concern was raised and that Vallo will look at it. Raising a concern does not change the agreed terms.
          </p>
        </>
      ),
    },
  ],
};

/* ---------------------------------------------- inspections and checks */

export const OFFER_INSPECTIONS: DocChapter = {
  slug: "offer-inspections-and-checks",
  number: 0,
  title: "Inspections and due diligence",
  summary: "How to inspect a home from the Deal Room, and what to check before you commit.",
  icon: "listing-review",
  updated: UPDATED,
  glance: [
    "You can propose an inspection at any point. It does not commit either side to the offer.",
    "The inspection report records eight items with dated photographs. It is a record of what was seen.",
    "Vallo does not verify title. Check the documents with your own solicitor.",
  ],
  actions: ["open-deal-room", "start-verification"],
  related: [
    { href: "/docs/viewings", label: "Viewings" },
    { href: "/docs/offer-documents", label: "Documents" },
  ],
  sections: [
    {
      id: "inspect",
      heading: "Inspecting from the Deal Room",
      body: (
        <>
          <p>
            Open the Inspection section. If none has been scheduled you will see <strong>Schedule an inspection</strong>;
            if one exists, <strong>Open the inspection</strong>. It uses the same inspection process as any viewing on Vallo.
            Read <Link href="/docs/viewings" className={A}>Viewings</Link> for how it works and how to stay safe.
          </p>
        </>
      ),
    },
    {
      id: "report",
      heading: "The inspection report",
      body: (
        <p>
          Once an inspection is completed, the eight-item report with photographs appears in the room. It is dated. It
          is a record of what was seen on the day, not a survey and not a check of title.
        </p>
      ),
    },
    {
      id: "due-diligence",
      heading: "What due diligence means here",
      body: (
        <>
          <p>
            Due diligence is the checking you do before you commit: that the seller has the right to sell, that the
            documents are real and say what you were told, and that the property is as described. Vallo gives you a place
            to ask for documents and see what has been uploaded and reviewed. It does not do the checking for you.
          </p>
          <DocCallout kind="warning" title="Use your own solicitor">
            <p>{TITLE_NOT_VERIFIED}</p>
          </DocCallout>
          <ul>
            <li>Ask for the documents in the checklist (see Documents) before you agree anything final.</li>
            <li>Have your solicitor read them and search the records. Vallo is not a law firm and does not give legal advice.</li>
            <li>Use the Raise a concern button if the seller or agent presses you to pay outside Vallo.</li>
          </ul>
        </>
      ),
    },
  ],
};

/* --------------------------------------------------------- documents */

const STATES: DocumentState[] = ["requested", "uploaded", "under_review", "approved", "rejected", "more_information"];
const STATE_TONE: Record<DocumentState, DocTone> = {
  requested: "neutral",
  uploaded: "warning",
  under_review: "info",
  approved: "success",
  rejected: "danger",
  more_information: "warning",
};

export const OFFER_DOCUMENTS: DocChapter = {
  slug: "offer-documents",
  number: 0,
  title: "Documents: what to ask for",
  summary: "The checklist, what each state means, and what Vallo has and has not checked.",
  icon: "doc-lock",
  updated: UPDATED,
  glance: [
    DOCUMENT_NOT_VERIFIED,
    "Documents are kept privately and opened through a short-lived link, and every open is logged.",
    "A reviewer approving a document is not a check of title.",
  ],
  actions: ["open-deal-room"],
  related: [
    { href: "/docs/the-deal-room", label: "The Deal Room" },
    { href: "/docs/offer-inspections-and-checks", label: "Inspections and due diligence" },
  ],
  sections: [
    {
      id: "checklist",
      heading: "What to ask for",
      body: (
        <>
          <p>
            Either side can <strong>Request a document</strong> from the Documents section. These are the categories on
            the checklist:
          </p>
          <ul>
            {DOCUMENT_CATEGORIES.map((category) => (
              <li key={category}>{DOCUMENT_CATEGORY_LABEL[category]}</li>
            ))}
          </ul>
          <p>
            Which ones matter depends on the property and the kind of title. Your solicitor will tell you which you need.
          </p>
        </>
      ),
    },
    {
      id: "states",
      heading: "Uploaded, under review, approved",
      body: (
        <>
          <p>
            These are different things, and the screen shows which one applies. Each document also shows who uploaded
            it, when, the version, and who reviewed it.
          </p>
          <DocTable
            caption="The states a document in the Deal Room can be in"
            headLabel="State"
            columns={[
              { key: "pill", label: "Shown as" },
              { key: "means", label: "What it means" },
            ]}
            rows={STATES.map((state) => ({
              head: DOCUMENT_STATE_WORD[state],
              cells: {
                pill: { state: DOCUMENT_STATE_WORD[state], tone: STATE_TONE[state] },
                means: DOCUMENT_STATE_DETAIL[state],
              },
            }))}
          />
        </>
      ),
    },
    {
      id: "not-checked",
      heading: "What Vallo has and has not checked",
      body: (
        <DocTable
          caption="What Vallo has and has not checked about documents"
          headLabel="Question"
          columns={[{ key: "answer", label: "Answer" }, { key: "note", label: "In plain words" }]}
          rows={[
            { head: "Was it uploaded?", cells: { answer: { yes: true }, note: "The record shows who uploaded it and when." } },
            { head: "Did a reviewer look at it?", cells: { answer: { yes: true, word: "Only if it says so" }, note: "Under review and Approved are states a person set." } },
            { head: "Is the title good?", cells: { answer: { yes: false, word: "Not checked" }, note: TITLE_NOT_VERIFIED } },
            { head: "Is the document genuine?", cells: { answer: { yes: false, word: "Not checked" }, note: "Approved means a reviewer accepted it for the file. It is not a finding that it is genuine." } },
          ]}
        />
      ),
    },
    {
      id: "privacy",
      heading: "Who can see them",
      body: (
        <p>
          Files go to private storage and open only through a short-lived signed address. They are visible to the two
          sides and to staff who are allowed to see them, and every open is logged. They are never a public address.
        </p>
      ),
    },
  ],
};

/* ------------------------------------------------------------ fees */

export const OFFER_FEES: DocChapter = {
  slug: "offer-fees",
  number: 0,
  title: "Fees and what you will actually pay",
  summary: "What making and agreeing an offer costs on Vallo, which costs go to someone else, and what Vallo cannot tell you.",
  icon: "naira-coins",
  updated: UPDATED,
  glance: [
    "Making an offer costs nothing. Agreeing terms costs nothing.",
    NO_MONEY_TAKEN,
    "Other costs of buying a home are paid directly to other people, and Vallo shows them only where the listing really carries them.",
    "The calculator below reads the current rates. It does not guess.",
  ],
  actions: ["make-offer", "open-offers"],
  related: [
    { href: "/docs/what-vallo-costs", label: "What Vallo costs" },
    { href: "/docs/how-offers-work", label: "How offers work" },
  ],
  sections: [
    {
      id: "vallo",
      heading: "What Vallo charges a buyer",
      body: (
        <>
          <p>
            Nothing, for an offer. {NOTHING_CHARGED} Vallo does not receive any part of the purchase price, and does not
            ask for a deposit, a commitment fee or a payment to secure a property.
          </p>
          <p>
            The asking price on a listing is the price. Vallo does not add a fee to it.
          </p>
        </>
      ),
    },
    {
      id: "others",
      heading: "Costs that go to someone else",
      body: (
        <>
          <p>
            Buying a home in Nigeria usually brings other costs, paid directly to other people: for example a solicitor,
            a surveyor, government fees and taxes, and an agent&apos;s commission where one is agreed. Vallo does not collect
            these and does not set them.
          </p>
          <p>
            Where a listing carries real cost data, the offer screen shows each line and says whether it is confirmed,
            estimated, optional or paid directly to a third party. It shows a total only when every part of the total is
            real. Where the cost data is not there, the screen says so: {OTHER_COSTS_NOT_ITEMISED}
          </p>
          <DocCallout kind="warning" title="Ask before you rely on a total">
            <p>
              Ask the seller or agent for every cost in writing, and ask your solicitor which others apply. Vallo cannot
              tell you a cost that is not on the listing.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "lister",
      heading: "If you are the seller or agent",
      body: (
        <>
          <p>
            Any fee a lister agrees to is shown to them before they publish. The calculator uses the rates in force today,
            read from the same place the payment split reads them.
          </p>
          <FeeCalculatorSection />
        </>
      ),
    },
    {
      id: "wrong",
      heading: "If someone asks you for money",
      body: (
        <p>
          Nobody on Vallo needs money from you to make or hold an offer. If someone asks you to pay a deposit, a booking
          fee or a fee to secure a property, say no, use <strong>Raise a concern</strong> in the Deal Room and write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.
        </p>
      ),
    },
  ],
};
