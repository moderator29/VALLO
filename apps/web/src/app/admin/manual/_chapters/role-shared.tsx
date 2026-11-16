import type { ReactNode } from "react";
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

/**
 * THE SEARCH DESK, HOW TO WORK IT (16 November 2026). Read from
 * `app/admin/search/page.tsx` and `AliasForms.tsx`, `lib/admin/search-desk.ts`,
 * `lib/admin/search-alias-actions.ts`, `lib/intelligence/analytics.ts` (the
 * five minute alias cache) and the SQL `intelligence_search_2026-11-16.sql`
 * (applied live): `private.search_desk_reader` admits Read-only analyst,
 * Content and Marketing, `private.search_desk_writer` admits Content and
 * Marketing, `admin_search_overview` keeps the floor of three visits, and the
 * two alias functions write `public.audit_log`.
 *
 * The section's id is written in each chapter that uses this body, so the
 * docs coverage check can read it there.
 */
export function searchDeskBody(role: { use: ReactNode }): ReactNode {
  return (
    <>
      <p>
        <Link href="/admin/search" className={A}>
          Search
        </Link>{" "}
        shows what people look for in VALLO Intelligence, the one search members use across Vallo. It sits under
        Intelligence in the console menu. Read-only analyst, Content and Marketing open it, and so does an admin. Content
        and Marketing can also change the aliases. A read-only analyst sees them and cannot change them.
      </p>
      <p>{role.use}</p>
      <DocTable
        caption="The Search desk, figure by figure"
        columns={[
          { key: "figure", label: "Figure" },
          { key: "means", label: "What it means" },
        ]}
        rows={SEARCH_FIGURES}
      />
      <DocCallout tone="note" title="The privacy floor">
        A word shows on either list only once at least three different visits searched it in the range. Below that
        it is not shown at all, so one person&apos;s search never appears here. No search is kept with an account id
        or an address, and words carrying a long run of digits, such as a phone or account number, are dropped before
        they are kept. The desk has no way to show who searched for anything, and you never try to work it out.
      </DocCallout>
      <h3 className="nf-h4">Adding a spelling or a nickname (an alias)</h3>
      <p>
        An alias teaches search a word people really use. There are two kinds. A <strong>word</strong> alias reads one
        set of words as another: buka as restaurant. A <strong>place</strong> alias points a nickname at a place Vallo
        already knows: Lekki 1 as Lekki Phase 1. A place alias that points at a name Vallo does not know is ignored.
      </p>
      <ol role="list">
        <li>
          Open Search and scroll to <strong>Aliases</strong>.
        </li>
        <li>
          In <strong>When people type</strong>, write the words as people type them. In <strong>Read it as</strong>,
          write what they mean. Each side is 1 to 60 characters.
        </li>
        <li>
          Choose the <strong>Kind</strong>: Word or Place.
        </li>
        <li>
          Press <strong>Save alias</strong>. Saving words that already have an alias of the same kind changes where it
          points and switches it on again.
        </li>
        <li>
          Search it yourself in VALLO Intelligence. It can take up to five minutes to reach every search.
        </li>
      </ol>
      <p>
        To stop an alias, press <strong>Switch off</strong> on its row. Nothing is ever deleted: a switched off alias
        stays on the list, and <strong>Switch on</strong> brings it back. The database refuses an alias whose two sides
        are the same, or that carries a long number, and the banner says why. Every add, change, switch off and switch
        on is written to the{" "}
        <Link href="/admin/audit" className={A}>
          audit log
        </Link>{" "}
        with your name, and what the alias said before.
      </p>
      <DocCallout tone="warning" title="What an alias is not">
        An alias changes how every member&apos;s search is read, so add one only for a word you have seen people
        type, on this desk or in tickets. Never use one to push a listing, a lister or a place up the results, never
        write a person&apos;s name or a phone number into one, and switch off any alias that makes results worse.
      </DocCallout>
    </>
  );
}

const SEARCH_FIGURES: DocTableRow[] = [
  { id: "range", cells: { figure: "Range", means: "Last 7 days or last 30 days, chosen at the top right. Every figure on the page reads the same range." } },
  { id: "searches", cells: { figure: "Searches", means: "How many searches were run." } },
  { id: "visits", cells: { figure: "Visits that searched", means: "How many different visits ran at least one search. A visit is counted, never named." } },
  { id: "zero", cells: { figure: "Found nothing", means: "The share of searches that came back with no result at all." } },
  { id: "ctr", cells: { figure: "Opened a result", means: "Results opened as a share of searches, with the count under it." } },
  { id: "median", cells: { figure: "Median server time", means: "How long the server took to answer half of all searches, with the time 9 in 10 came in under." } },
  { id: "top", cells: { figure: "Most searched", means: "The words searched most, with searches, visits and how many of those found nothing." } },
  { id: "zero-words", cells: { figure: "Searches that found nothing", means: "The words that found nothing: what people want that Vallo does not have yet, or a word search does not understand yet." } },
  { id: "places", cells: { figure: "Places searched", means: "The places named most, from the list of places Vallo knows." } },
  { id: "tabs", cells: { figure: "Tabs, and what the words pointed at", means: "Which tab people searched in, and which kind of thing the words were about: homes, stays, restaurants, people, help and so on." } },
  { id: "opened", cells: { figure: "What was opened", means: "Which kind of result people actually opened." } },
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
            <li>
              <strong>VALLO Intelligence.</strong> One search across all of it: homes, stays, restaurants, roommates,
              people, communities, help and a member&apos;s own records. Chapter 15 says how it works.
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
              <li>That a payment, a listing, a person or a place comes with a promise of safety or protection, unless a real check behind that exact claim is named. Say what was looked at and by whom.</li>
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
