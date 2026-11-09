/**
 * Terms of service, as content rather than as a page.
 *
 * These sections are rendered in two places and must never differ between
 * them: `(site)/terms` for the public web, and `(app)/legal/terms` for
 * somebody already inside the product. The in-product copy exists because the
 * marketing page is a different application shell: tapping Terms of service in the
 * side navigation used to throw a signed-in person out of the product
 * entirely, and their back button then returned them to the marketing site
 * rather than to the screen they were reading a moment earlier.
 *
 * Two routes, one document. A legal text that says different things in two
 * places is not a legal text.
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED ON 15 SEPTEMBER 2026, AND WHY IT WAS URGENT
 *
 * Section 4 used to read: "Your payment is held securely by RentMe and
 * released to the agent only after check-in, or after you confirm that an
 * inspection matched the listing", and section 4 also said "the payment stays
 * held while we investigate". Section 9 then limited our liability "beyond the
 * protections described in sections 4 and 5", which leaned the whole liability
 * clause on that promise.
 *
 * **That was a binding contractual promise of escrow, and no guest's money has
 * ever moved that way.** It was checked rather than assumed before it was
 * removed:
 *
 *   - `public.escrows` DOES exist and is well built. There is a state machine
 *     enforced by a database trigger rather than only in TypeScript, four
 *     escrow purposes, an audit trigger, a timeout sweep, a locking
 *     SECURITY DEFINER settle function, and an admin resolution RPC behind
 *     `/admin/escrow`. The claim in some older notes that escrow is "zero
 *     percent built" is out of date and this file does not repeat it.
 *   - **Nothing routes a guest's payment into it.**
 *     `private.pay_booking_from_wallet` debits the payer and credits the payee
 *     in one transaction with no hold anywhere in it, no screen in the product
 *     can open a hold, and `public.booking_status` is still
 *     `PENDING, CONFIRMED, CANCELLED` with no COMPLETED, so there is no event
 *     that a release after check-in could fire on even if there were a flow.
 *
 * So the mechanism is real and unreachable, and the terms described the
 * mechanism as though a user could reach it. A person deciding whether to send
 * money to a stranger read that clause and relied on it.
 *
 * There is a second reason it could not simply be softened. **Holding client
 * funds between two parties is regulated by the Central Bank of Nigeria**, and
 * whether this company may operate such a service at all is an open question
 * the owner has not had answered. The corporate objects clause filed at the
 * Commission deliberately omits every payment and escrow word, because the
 * portal's classifier read those words as a regulated payments business and
 * demanded share capital of 500,000,000 naira. Promising in a contract a
 * service the memorandum does not permit is worse than promising one the code
 * does not implement.
 *
 * The clause now says what actually happens, and section 4 says plainly that
 * money is not held. **Restore a holding promise when there is a flow AND a
 * legal answer, not when either one arrives alone.**
 *
 * ---------------------------------------------------------------------------
 * WHAT CHANGED ON 25 SEPTEMBER 2026 (TRACK A AND TRACK B)
 *
 * The founder retired custody. Vallo holds no customer money at any point:
 * there is no wallet, no balance, no escrow and no held payment. Every charge
 * is split by the processor in the same transaction: the owner's or agent's
 * share to their own bank account through a Paystack subaccount, the Vallo
 * Guarantee contribution to a separate reserve, and Vallo's commission (zero
 * today) to Vallo. The old section 15 ("The wallet") is gone, section 4 now
 * describes the split, section 5 routes refunds to the card or account that
 * paid, and new sections describe the agreement and approval gate and the
 * Vallo Guarantee. Every money sentence is read from `lib/money/copy.ts`, the
 * module the screens and emails read, so the contract and the product say the
 * same thing. The Disclaimer (`lib/legal/disclaimer.tsx`) forms part of these
 * terms.
 *
 * The CBN point above now cuts the other way: the platform is designed so
 * that it never holds client funds, which is the position the objects clause
 * already takes.
 *
 * ---------------------------------------------------------------------------
 * FOR THE SOLICITOR
 *
 * Provisions are not invented here: anything carrying real legal consequence goes to the Company Solicitor.
 * The clauses below are DESCRIPTIVE: each one says what the platform actually
 * does, which can be established from the code and the schema. None of them creates a new right or a new liability.
 *
 * These seven need a solicitor's eye before Launch and are marked here rather
 * than in a separate document that would drift away from the text. (The
 * numbers below were re-pointed on 25 September 2026, and before that on 16 September 2026 to the current section
 * numbering; three of them still named an older draft's numbers. The flags
 * themselves are unchanged.)
 *
 *   2   What Vallo is, which gained a paragraph on 22 September naming the
 *       position: Vallo does not remove the agent, it removes the runaround,
 *       and a fee an agent charges is the agent's and not ours. It is
 *       descriptive and nothing turns on it, but it is the first thing a
 *       reader meets and it is the one place these terms now say anything
 *       about somebody else's fee, so he should read it.
 *   4   Payments, now that it describes a direct payment rather than a hold.
 *       The consumer protection position changes when the platform is not
 *       holding the money, and that should be said correctly rather than
 *       merely accurately.
 *   5   Cancellations and refunds. The schedule is real and lives in
 *       `lib/trust/cancellation.ts`, but a refund promise is a financial
 *       commitment.
 *   6   The commission paragraph, which describes a fee that is set to zero
 *       today. It must not read as introducing one.
 *   13  Agreements and approval: what an approval means and does not.
 *   15  Limitation of liability, which no longer rests on a holding promise.
 *   16  Suspension, closure and the appeal route.
 *   19  Governing law, which must stay consistent with the Co-Founder and
 *       Investment Agreement: Nigerian law, and arbitration in Abuja under the
 *       Arbitration and Mediation Act 2023.
 *   14  What Vallo does, and what it does not do. Until 9 November 2026 this
 *       was the Vallo Guarantee, a discretionary, capped protection funded from
 *       a reserve; the founder retired it, and the section now makes only
 *       specific promises Vallo can keep, never a guarantee of the deal.
 *
 * AND ONE CORRECTION OF FACT MADE ON 22 SEPTEMBER, recorded here because a
 * legal document should carry its own history. Section 7 described the
 * verification ladder as "phone, then identity document, then address, then a
 * physical inspection". There is no phone rung and there never was, and the
 * payout rung, the only automated check this platform has, was missing. So
 * the contract described a check we do not perform and omitted one we do. It
 * is no longer typed out here at all: it is read from
 * `lib/trust/verification.ts`, which is the array `private.agent_tier`
 * counts, so it cannot drift again. That is a correction of a false
 * statement, not a change of obligation, which is why it lands rather than
 * waiting.
 */

import { SUPPORT_HREF, SUPPORT_LABEL } from "@/lib/support-email";
import { VERIFICATION_ORDER } from "@/lib/trust/verification";
import { COMPANY_FORMAL_NAME, COMPANY_TRADING_NAME } from "./company";
import {
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  OFF_PLATFORM_SENTENCE,
  PAYMENT_GATE_SENTENCE,
  PRIVATE_FEE_NOTE,
  REFUND_ROUTE,
} from "@/lib/money/copy";
import Link from "next/link";

/**
 * The verification ladder, in the document's own words, read from the module
 * that defines it.
 *
 * Section 7 used to type the rungs out as "phone, then identity document,
 * then address, then a physical inspection". THERE IS NO PHONE RUNG AND THERE
 * NEVER WAS, and the payout rung, which is the only automated check this
 * platform has, was missing from the list entirely. A contract that describes
 * a check we do not perform and omits one we do is wrong in both directions
 * at once, and it was wrong in three other places in the same tree, which is
 * what a hand typed copy of somebody else's data always becomes.
 *
 * `VERIFICATION_ORDER` is what `private.agent_tier` counts. A rung added,
 * removed or renamed changes this sentence with it, in the same commit, with
 * nobody having to remember that this file exists.
 */
const LADDER = VERIFICATION_ORDER.map((rung) => rung.label.toLowerCase()).join(", then ");

export const TERMS_SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. About these terms",
    body: (
      <p>
        These terms are an agreement between you and {COMPANY_FORMAL_NAME}, a private
        company limited by shares registered in Nigeria, which operates the{" "}
        {COMPANY_TRADING_NAME} website, apps and services. Where these terms say{" "}
        &quot;{COMPANY_TRADING_NAME}&quot;, &quot;we&quot; or &quot;us&quot;, they mean
        that company. By creating an account or using the platform you accept these
        terms. If you do not accept them, please do not use the platform.
      </p>
    ),
  },
  {
    title: `2. What ${COMPANY_TRADING_NAME} is`,
    body: (
      <>
        <p>
          {COMPANY_TRADING_NAME} is a marketplace for property and stays in Nigeria.
          People list homes to rent, property for sale, land, shops and offices, and
          shortlets, hotels and rooms let by their owners. We check the people who
          list, host their listings, carry messages between them and you, review the
          agreements you make on the platform, and arrange payment through a licensed
          payment processor. We never hold your money.
        </p>
        {/* Identity, not obligation. This paragraph describes what the platform
            sets out to do; it creates no right and no duty, and nothing else in
            these terms turns on it. It is here because a person reading a
            contract is entitled to know what the thing they are contracting
            about actually is, and because the old description ("a marketplace
            for property") was true of every property website in Nigeria. */}
        <p>
          <strong>
            {COMPANY_TRADING_NAME} does not remove the agent. It sets out to remove the
            runaround.
          </strong>{" "}
          Agents hold most of the property offered in this market and their fee is
          theirs to charge. What {COMPANY_TRADING_NAME} is for is that you know who you
          are dealing with, what you will actually pay and whether the property is real,
          before you travel to see it. Where an owner lists a property directly, you
          deal with the owner; where an agent does, you deal with the agent, and either
          way any fee they charge is theirs and not ours.
        </p>
        <p>
          <strong>
            A real listing on {COMPANY_TRADING_NAME} is listed on {COMPANY_TRADING_NAME}
            by a person who applied and was approved.
          </strong>{" "}
          Nothing is imported from an outside feed, so a real listing has somebody to
          message and somebody accountable for what it says. Some listings are
          examples, marked Example, that {COMPANY_TRADING_NAME} publishes to show how
          the platform works; an example cannot be rented, bought or booked.
        </p>
        <p>
          The property itself is provided by the person who listed it, not by{" "}
          {COMPANY_TRADING_NAME}. The tenancy, sale or stay is between you and them. We
          are not a party to it, not an agent for either side, and not a landlord.
        </p>
      </>
    ),
  },
  {
    title: "3. Accounts and eligibility",
    body: (
      <ul>
        <li>You must be at least 18 years old to use {COMPANY_TRADING_NAME}.</li>
        <li>
          The information on your account must be accurate and kept up to date, and you
          may hold only one personal account.
        </li>
        <li>
          You are responsible for keeping your sign-in details secret and for activity
          on your account. Tell us immediately if you believe it has been compromised.
        </li>
        <li>
          Browsing is open to anybody. Saving, messaging, requesting an inspection,
          paying and listing need an account.
        </li>
      </ul>
    ),
  },
  {
    title: "4. Payments, and what happens to your money",
    body: (
      <>
        <ul>
          <li>
            All payments must go through the platform. The full price, in naira, is
            shown before you confirm anything.
          </li>
          <li>
            <strong>{NO_CUSTODY_SENTENCE}</strong> Card payments are handled by Paystack,
            our payment processor, which splits every payment at the moment it is made:
            the share of the owner or agent goes to the bank account on their payout
            details in the same transaction, and our commission, if any, goes to us. {COMPANY_TRADING_NAME} has no wallet and keeps no balance for
            you, so there is nothing to top up, nothing held and nothing to withdraw.
          </li>
          <li>
            {PAYMENT_GATE_SENTENCE} For a stay, the host accepts the booking and we
            approve it before payment opens. We record what was paid, to whom, for what
            and when, and that record is what we act on if something goes wrong.
          </li>
          <li>
            Where a crypto payment is offered, it is made through Yellow Card, which
            converts it to naira before it is split. {COMPANY_TRADING_NAME} never holds
            crypto and never gives you a crypto address of its own.
          </li>
          <li>
            Paying in cash or by direct bank transfer outside the platform leaves no
            record we can act on at all, and we cannot help recover money paid that way.
            {" "}{OFF_PLATFORM_SENTENCE} If anybody asks you to pay outside the platform,
            report them to us.
          </li>
          <li>
            If a property is materially not as listed, report it to us. We investigate,
            and we can suspend a listing and stop the person who posted it from trading.
            Because we never hold the money, we cannot reverse a payment that has already
            settled to them; what we can do is described in sections 5 and 14.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Cancellations and refunds",
    body: (
      <ul>
        <li>
          <strong>This schedule governs stays booked and paid for on{" "}
          {COMPANY_TRADING_NAME}</strong>, which is a shortlet, a hotel room or anything
          else let by the night. One schedule covers all of them, rather than a
          different one for each person who lists: everything back until 72 hours before check-in,
          half back inside that window, and nothing back once check-in day has started.
        </li>
        <li>
          <strong>A tenancy, a sale, a lease or a purchase of land is not governed by
          it.</strong> What is payable, what is returnable and on what notice are terms of
          the agreement you make with the landlord, the vendor or their agent. A rental
          paid on {COMPANY_TRADING_NAME} is paid against an agreement both of you
          confirmed and we approved (section 13), and the owner&rsquo;s or agent&rsquo;s
          share settles to them when you pay; the agreement decides what is returnable,
          between you and them.
        </li>
        <li>
          A stay nobody has paid for is only a hold on the calendar and can be called
          off at any time for nothing.
        </li>
        <li>
          If the person who listed it cancels, the property was not what was listed, or
          you could not get in, you get everything back whenever it happens. Report it
          rather than cancelling it yourself.
        </li>
        <li>{REFUND_ROUTE} There is no {COMPANY_TRADING_NAME} balance for a refund to sit in.</li>
      </ul>
    ),
  },
  {
    title: "6. Listing a property",
    body: (
      <ul>
        <li>
          <strong>
            Listing is free, and {COMPANY_TRADING_NAME} charges renters and guests nothing:
            no fee to look, to book or to pay, and nothing added to the price on the
            listing.
          </strong>{" "}
          {COMPANY_TRADING_NAME} charges a fee only when a deal is completed. When a payment
          is made through the platform, the platform fee comes out of your share as the
          lister, and it is shown to you in naira before you agree. A restaurant pays a
          fixed fee for each table that is seated; the diner pays nothing extra to book.
        </li>
        <li>
          If that ever changes, the rate will be shown before the action that incurs it,
          on the same screen and at the same weight as the amount. We will give thirty
          days&apos; notice by email and in the product first, and anything listed or
          booked under one rate completes under that rate.
        </li>
        <li>
          <strong>If you host a stay or a restaurant</strong>, you also agree to the Host
          Agreement (at /host-agreement) before your business is set up. In short: you must
          not charge a guest anything that is not listed on {COMPANY_TRADING_NAME}, every
          charge you list must say what it is for, and anything not listed cannot be charged.
        </li>
        <li>
          You are responsible for the accuracy of what you list. Listings must be
          lawful, must be yours to offer, and must carry photographs of the actual
          property. Every listing is reviewed by a person before it is published.
        </li>
        <li>
          <strong>No hidden charges.</strong> A lister or host must not charge a guest
          or renter anything that is not listed on {COMPANY_TRADING_NAME}, and must not
          add a charge without a stated reason. Every cost, including any charge payable
          at the door, must be listed before the booking is confirmed so that the guest
          sees the full total first. A charge that breaks this rule can lead to the
          listing being removed or the account being stopped, and you can report it.
        </li>
        <li>
          Where a listing states a title, such as a certificate of occupancy or a deed
          of assignment, that is what the seller claims.{" "}
          <strong>It is not a statement that anybody has checked it.</strong> Have a
          lawyer verify title at the land registry before money moves.
        </li>
        <li>
          Your share of a payment settles straight to the Nigerian bank account on your
          payout details, through our payment processor, at the moment it is paid. You
          need payout details on file before anybody can pay you. We may remove
          listings or stop accounts that break these terms.
        </li>
      </ul>
    ),
  },
  {
    title: "7. What verification means, and what it does not",
    body: (
      <>
        <p>
          Trust on {COMPANY_TRADING_NAME} is deliberately not a single tick, because a
          single tick is a promise we would have to keep about things we cannot know.
        </p>
        <ul>
          <li>
            <strong>The verified badge</strong> means an administrator approved the
            listing and the person who posted it has passed identity checks. It means
            those two things and nothing else.
          </li>
          <li>
            The person who lists climbs a ladder of four rungs, in this order:{" "}
            {LADDER}. Where a rung is shown with a date, that is a record of something
            that happened on that date. Where it is absent, nobody has done it. An
            absence is not a negative and does not mean anything is wrong.
          </li>
          <li>
            <strong>Verification is not a guarantee against fraud</strong>, not a
            valuation, not a survey, not a structural inspection and not legal advice
            about title. A verified person can still behave badly, and the checks tell
            you who somebody is rather than how they will behave.
          </li>
          <li>
            <strong>Verifying.</strong> To list property or be paid on{" "}
            {COMPANY_TRADING_NAME} you verify who you are: a photo of your government ID,
            a selfie taken in the app, a recent proof of address, and the bank account you
            are paid into, whose account name must match the name on your ID. A person on
            our verification team reviews them, usually within one working day, and if
            they cannot accept a document they tell you why so you can replace it. If we
            cannot confirm who you are, we may ask for one more photo of you holding your
            ID. Renters and buyers are not asked to verify.
          </li>
          <li>
            <strong>Your documents must be yours and true.</strong> Sending another
            person&rsquo;s documents, or documents that have been altered, ends your
            account, and we may report it to the authorities.
          </li>
          <li>
            Badges are earned and are never for sale.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "8. Messages, and what we can see",
    body: (
      <>
        <p>
          Keep every conversation on the platform. The record is what protects you when
          a deal goes wrong, and a conversation that moved to another app is one we
          cannot see, cannot verify and cannot act on.
        </p>
        <p>
          <strong>You should know that messages are screened automatically.</strong> An
          automated check flags messages containing things like bank account numbers and
          payment requests, and a flagged message is put in front of our staff to
          review. It exists because asking somebody to pay outside the platform is the
          most common way people are defrauded in this market.
        </p>
        <p>
          We do not give staff casual access to private conversations. Staff read a
          conversation when a check has flagged it, when somebody reports it, or where
          the law requires it. You can block and report any other member.
        </p>
      </>
    ),
  },
  {
    title: "9. Inspections",
    body: (
      <>
        <p>
          You can request an inspection through the platform and the person who listed
          the property arranges it with you.{" "}
          <strong>
            {COMPANY_TRADING_NAME} is not present at an inspection and does not conduct
            it
          </strong>{" "}
          unless the listing explicitly says the property was physically inspected by us
          and gives the date. Take somebody with you, meet in daylight, and never pay
          before you have seen the property.
        </p>
        <p>
          <strong>{NO_INSPECTION_FEE}</strong> {PRIVATE_FEE_NOTE}
        </p>
        <p>
          After a rental inspection you submit the inspection report on the platform:
          eight items, each with its photographs. It is the record of the property as you
          found it, it is what an agreement is drawn up from, and it is the record we
          look at first if something goes wrong (section 14).
        </p>
      </>
    ),
  },
  {
    title: "10. The assistant and anything automated",
    body: (
      <p>
        {COMPANY_TRADING_NAME} includes an assistant and other automated features that
        generate text.{" "}
        <strong>
          Anything they produce is assistance, not advice. It is not a valuation, not
          legal advice and never a substitute for inspecting a property in person.
        </strong>{" "}
        Generated answers can be wrong. Check anything that matters against the listing
        itself and against the person who posted it, and take professional advice before
        you commit money.
      </p>
    ),
  },
  {
    title: "11. Reviews and content",
    body: (
      <p>
        Reviews must reflect a genuine stay or visit, and you can only review a stay you
        actually had. You keep ownership of the content you post, and you grant{" "}
        {COMPANY_TRADING_NAME} a non-exclusive licence to host and display it on the
        platform and in connection with the service. We may remove content that is
        unlawful, abusive or misleading. The platform itself, its design, its software
        and its name remain ours.
      </p>
    ),
  },
  {
    title: "12. Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Post false, misleading or unlawful listings, reviews, posts or messages.</li>
          <li>
            Take a transaction or a payment off the platform, or ask anybody else to.
          </li>
          <li>Impersonate any person, or use another person&apos;s identity documents.</li>
          <li>Harass, threaten or discriminate against anybody, including our staff.</li>
          <li>
            Scrape the platform, interfere with its security, or use it to send spam.
          </li>
          <li>Hold more than one personal account, or try to claim a reserved handle.</li>
        </ul>
      </>
    ),
  },
  {
    title: "13. Agreements and approval",
    body: (
      <>
        <p>
          Before a rental or a stay is paid for on the platform, an agreement is drawn
          up from the listing&rsquo;s own figures and, for a rental, the inspection
          report. Both of you confirm the same version. Changing anything creates a new
          version and both of you confirm again.
        </p>
        <p>
          A person at {COMPANY_TRADING_NAME} then reviews the agreement and approves it,
          or sends it back with a reason. Both of you are told by email and in the app.
          Payment opens only after approval. Approval means the agreement is complete and
          consistent with the listing and the report; it is not a guarantee of the
          property, the owner or the agent, and every decision is logged.
        </p>
        <p>
          Where an agent confirms for an owner, the agent confirms that they hold the
          owner&rsquo;s mandate to do so.
        </p>
      </>
    ),
  },
  {
    title: "14. What Vallo does, and what it does not do",
    body: (
      <>
        <p>
          This section says plainly what {COMPANY_TRADING_NAME} does for you and what it
          does not. It replaces the Vallo Guarantee, which was retired on 9 November
          2026.
        </p>
        <ul>
          <li>
            We check the identity of members and review listings before they go live.
          </li>
          <li>
            <strong>{COMPANY_TRADING_NAME} never holds your money.</strong>
          </li>
          <li>
            Card payments are handled by Paystack, and the owner&rsquo;s share reaches
            their bank account in the same transaction.
          </li>
          <li>
            Payment held by a licensed bank until you confirm is not open yet. When it
            opens we will say so, and these Terms will be updated with a new version and
            date.
          </li>
          <li>
            {COMPANY_TRADING_NAME} is not a party to your tenancy or your sale, is not
            acting as agent for either side, and does not guarantee the transaction.
          </li>
        </ul>
        <p>
          <strong>What we will do if something goes wrong.</strong>
        </p>
        <ul>
          <li>
            Investigate, using the inspection report and the messages on the platform as
            the record.
          </li>
          <li>
            Act on members who break the rules, up to and including suspension and
            removal.
          </li>
          <li>Give you the evidence we hold.</li>
          <li>Refund anything {COMPANY_TRADING_NAME} itself charged.</li>
        </ul>
      </>
    ),
  },
  {
    title: "15. Our responsibility to you",
    body: (
      <>
        <p>
          We work hard to keep listings honest, but {COMPANY_TRADING_NAME} is a
          marketplace: we do not own, occupy, inspect daily or control the properties
          people list. To the extent Nigerian law allows:
        </p>
        <ul>
          <li>
            The platform is provided &quot;as is&quot;, and we do not guarantee it will
            always be uninterrupted or error free.
          </li>
          <li>
            We are not liable for losses caused by another user breaking their agreement
            with you, beyond the specific commitments in sections 5 and 14.
          </li>
          <li>
            We are not responsible for anything arranged, discussed or paid outside the
            platform. The{" "}
            <Link href="/disclaimer" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Disclaimer
            </Link>{" "}
            sets this out in full and forms part of these terms.
          </li>
          <li>
            Nothing in these terms excludes liability that cannot lawfully be excluded,
            including for fraud or for death or personal injury caused by negligence.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "16. Suspension, closing your account, and appealing",
    body: (
      <>
        <p>
          You may close your account at any time from settings or by contacting support.
          We may suspend or close an account that breaks these terms. Where we do, we
          tell you why and, where the breach can be fixed, give you the chance to fix
          it. Serious harm, fraud or a legal requirement may mean immediate suspension.
        </p>
        <p>
          <strong>You can appeal any suspension or closure.</strong> Reply to the notice
          or contact support, and a person who was not involved in the original decision
          reviews it.
        </p>
      </>
    ),
  },
  {
    title: "17. Privacy",
    body: (
      <p>
        How we handle personal data is described in our{" "}
        <Link href="/privacy" className="font-semibold text-[var(--nf-content-link)] hover:underline">
          Privacy policy
        </Link>
        , which is written for the Nigeria Data Protection Act 2023 and forms part of
        these terms.
      </p>
    ),
  },
  {
    title: "18. Changes to these terms",
    body: (
      <p>
        We may update these terms as the platform grows. The date at the top of this
        page always shows the current version, and we will notify you through the
        product or by email before significant changes take effect. Continuing to use{" "}
        {COMPANY_TRADING_NAME} after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    title: "19. Governing law and disputes",
    body: (
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria, and the
        Nigerian courts have jurisdiction over disputes arising from them. We would
        always rather resolve a problem directly first, so please contact support before
        anything else; most issues are settled that way.
      </p>
    ),
  },
  {
    title: "20. Contact",
    body: (
      <p>
        Questions about these terms go to{" "}
        <a href={SUPPORT_HREF} className="font-semibold text-[var(--nf-content-link)] hover:underline">
          {SUPPORT_LABEL}
        </a>
        . We reply within one business day.
      </p>
    ),
  },
];
