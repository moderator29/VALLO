import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { A, type ManualSection } from "./parts";

/**
 * THE SECTIONS EVERY ROLE CHAPTER SHARES (the Marketing, Content, Technical
 * and Support Lead chapters, 10 November 2026): what Vallo is and why it
 * exists, who the members are, the promises made to them, the money wording
 * and the privacy rules. Each chapter says in its own words how the role keeps
 * these, so the shared words are written once and the role's part is passed in.
 * Read from `lib/money/copy.ts` (the money wording), `lib/trust/standards.ts`
 * (the promised answer times) and `lib/admin/staff-positions.ts`.
 */

const MEMBERS: DocTableRow[] = [
  { id: "renters", cells: { who: "Renters", what: "People looking for a home to rent in Nigeria, paid by the year.", need: "To see what they will actually pay before they call anybody, and to deal with a real person." } },
  { id: "buyers", cells: { who: "Buyers and investors", what: "People looking at homes, land and other property to buy.", need: "Plain facts about the property and the person selling it." } },
  { id: "agents", cells: { who: "Agents", what: "Property agents who list on Vallo, many of them small businesses.", need: "Leads that are real, fair treatment and quick answers when something is wrong." } },
  { id: "landlords", cells: { who: "Landlords and owners", what: "People who own what they let or sell.", need: "Good tenants, and not to be buried in paperwork." } },
  { id: "hosts", cells: { who: "Hosts", what: "People who let a room, flat or house for short stays.", need: "Guests who arrive as described, and payouts that make sense." } },
  { id: "restaurants", cells: { who: "Restaurants", what: "Places that take table reservations through Vallo.", need: "Diners who turn up, and clear rules on deposits and fees." } },
  { id: "students", cells: { who: "Students", what: "Students looking for rooms and flatmates near their school, through Roommates.", need: "A place near campus, flatmates they can trust, and no surprises." } },
];

export function aboutVallo(role: { who: string; keeps: string }): ManualSection[] {
  return [
    {
      id: "what-vallo-is",
      title: "What Vallo is, and why it exists",
      body: (
        <>
          <p>
            Vallo is a Nigeria-first place to find and deal in property, and to find somewhere to stay or eat. It began
            with a simple, stubborn problem: in too many Nigerian property searches, nobody can be sure that a listing is
            real, that the price is the price, or that the person at the other end is who they say. Vallo exists to make
            that ordinary thing, finding a home, calmer and fairer.
          </p>
          <ul role="list">
            <li>
              <strong>Property.</strong> Homes to rent, homes and land to buy, listed by owners, agents and firms. Each
              listing is reviewed by a person before it goes live, and the price a renter sees is what they pay Vallo, which
              charges renters no fee.
            </li>
            <li>
              <strong>Stays.</strong> Rooms, flats and houses for short stays, with hosts and guests dealing through the app.
            </li>
            <li>
              <strong>Tables.</strong> Restaurant reservations, with deposits where a restaurant asks for one.
            </li>
            <li>
              <strong>Roommates.</strong> Students and young professionals finding rooms and flatmates, with schools
              listed so a person can search near their own campus.
            </li>
            <li>
              <strong>Circle.</strong> Communities around a school, a neighbourhood or an interest, where members talk.
            </li>
            <li>
              <strong>Around and the feed.</strong> Posts, stories and local events, so Vallo is a place people come back
              to, not only a place they come once.
            </li>
          </ul>
          <p>
            As {role.who}, you are part of the reason a stranger can trust a page on Vallo. {role.keeps}
          </p>
        </>
      ),
    },
    {
      id: "the-members",
      title: "Who the members are",
      body: (
        <>
          <p>
            Every screen, every campaign, every article and every answer is read by a real person. Keep these people in
            mind when you write or decide.
          </p>
          <DocTable
            caption="The people Vallo serves"
            columns={[
              { key: "who", label: "Who" },
              { key: "what", label: "What they are doing" },
              { key: "need", label: "What they need from us" },
            ]}
            rows={MEMBERS}
          />
          <p>
            Many members use a phone on a patchy connection, and many are careful with money for good reasons. Plain words
            and honest numbers are a kindness to them. Hausa, Yoruba and Igbo speakers deserve the same care as English
            speakers, and the staff who write for them should say when a translation is not ready rather than pretend.
          </p>
        </>
      ),
    },
    {
      id: "promises",
      title: "The promises to members",
      body: (
        <>
          <p>
            Vallo makes a small number of promises and keeps them. Write nothing, decide nothing and promise nothing that
            goes against them.
          </p>
          <ul role="list">
            <li>
              <strong>Answers on time.</strong> A member who asks us to look at something is answered within four hours if
              they were asked to pay outside Vallo or something is unsafe, within a day for a listing that is not as
              described, and within three days for matters that need judgement rather than speed.
            </li>
            <li>
              <strong>No fee for renters.</strong> Vallo charges renters nothing. Never describe a charge to a renter as
              ours.
            </li>
            <li>
              <strong>Reasons, not silence.</strong> When Vallo says no, the member is told why in plain words.
            </li>
            <li>
              <strong>Privacy.</strong> Staff see only what their job needs, and what they see is written down in the audit
              log.
            </li>
            <li>
              <strong>Honesty about money.</strong> Vallo never holds customer money, and we say so exactly.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "money-wording",
      title: "The money wording, and what you never say",
      body: (
        <>
          <p>
            Vallo uses regulated payment partners to process eligible payments. Vallo does not hold customer funds. When a
            card payment is made, the owner&apos;s or agent&apos;s share goes to their bank account through the payment
            processor in the same transaction. Where a payment is held until a member confirms, it is held by the licensed
            payment partner, not by Vallo.
          </p>
          <DocCallout tone="warning" title="Never write these">
            <ul role="list">
              <li>That Vallo holds, keeps, safeguards or looks after anybody&apos;s money.</li>
              <li>That a payment, a listing, a person or a place is safe, protected, guaranteed or verified, unless a real check behind that exact word is named. Say what was checked and by whom.</li>
              <li>That a member will get a refund, a payout or a particular outcome that another desk decides.</li>
            </ul>
          </DocCallout>
          <p>
            The Vallo Guarantee was retired on 9 November 2026. Do not mention it as something members can claim.
          </p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "Privacy rules",
      body: (
        <>
          <ul role="list">
            <li>You see what your access area opens and nothing more. If you can open it, you still open it only for work.</li>
            <li>Never copy a member&apos;s name, phone number, email, address, document or message into a note, a campaign, an article, a brief or a report. Use a reference or a count.</li>
            <li>Never paste a password, a key, a token, a card number or a one-time code anywhere in the console, and never ask a member for one.</li>
            <li>Counts are not people, but a count of one can be a person. If a number is so small that a reader could guess who it is, say &ldquo;a few&rdquo;.</li>
            <li>
              Everything you create or change is written to the{" "}
              <Link href="/admin/audit" className={A}>
                audit log
              </Link>{" "}
              with your name.
            </li>
          </ul>
        </>
      ),
    },
  ];
}
