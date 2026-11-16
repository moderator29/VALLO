import Link from "next/link";
import { DocCallout, DocCrossLink } from "@/components/docs/DocArticle";
import { DocTable } from "@/components/docs/DocTable";
import { A, ScreenshotSlot, type ManualBody } from "./parts";

/**
 * Chapter 3. Read from the desks' own actions: `lib/admin/actions.ts`
 * (listings, applications, reports, flags, tickets), `kyc-actions.ts` and
 * `identity-check-actions.ts`, `moderation-actions.ts`,
 * `review-contest-actions.ts`, `support-workbench-actions.ts` and
 * `support-workspace.ts` (lanes, promises, hand-offs), `queue-desk.ts` and
 * `queue-desk-actions.ts` (claims, bulk), `lib/admin/cases/actions.ts` with
 * the case engine's SQL, `bookings-actions.ts` and
 * `lib/after-gate/refund-decision-actions.ts` (refunds), and
 * `lib/trust/standards.ts` (the published promises).
 *
 * What the retired staff manual (`/admin/handbook/manual`, 16 November 2026)
 * said about identity, listings, agreements, cases and support that this
 * chapter did not, read again against the code: the reviewer guide
 * (`app/admin/kyc/guide/guide-content.ts`), the listings queue and review
 * page (`app/admin/listings/page.tsx`, `[id]/section-links.ts`), mandates
 * (`decideListingMandate` in `lib/compliance/beneficial-ownership-actions.ts`,
 * the words in `packages/i18n/src/locales/compliance-17.en.ts`), the
 * agreement gate (`app/admin/agreements/page.tsx`, `agreements-actions.ts`),
 * the case page (`app/admin/cases/[id]/page.tsx`), the support desk
 * (`app/admin/support/page.tsx`, `lib/docs/helpful-actions.ts`) and email
 * recovery (`lib/admin/email-recovery-actions.ts`).
 */

export const QUEUES: ManualBody = {
  intro: (
    <p>
      How to work each queue the console has, from taking an item to the decision and what the other side is told. Every
      reason you write where a reason is asked for is read by the member exactly as you wrote it, so write it for them.
    </p>
  ),
  glance: [
    "Take an item before you work it. A claim frees itself after thirty minutes without a touch.",
    "If somebody decided the item first, your click changes nothing and the desk says it was decided elsewhere.",
    "Late items come first. The promise each item is under is the one Vallo publishes: 4 hours, 1 day or 3 days.",
    "Refunds and cancellations are made by an admin on the stay's own page. Support hands money questions to the Money desk.",
  ],
  sections: [
    {
      id: "basics",
      title: "Before you start: claims, clocks and the Unified queue",
      body: (
        <>
          <p>
            The{" "}
            <Link href="/admin/queue" className={A}>
              Unified queue
            </Link>{" "}
            shows every item your areas decide, sorted by when it falls due rather than by age. Narrow it to items that
            are late, items you hold, items nobody holds, or support tickets that probably did not come from a person.
          </p>
          <ul role="list">
            <li>
              <strong>Take it first.</strong> Taking an item puts your name on it so a colleague does not work it too. The
              claim frees itself after thirty minutes without a touch, or when you hand it back.
            </li>
            <li>
              <strong>One decision wins.</strong> Every decision checks the item is still in the state you saw. If a
              colleague moved it first, nothing changes and you are told.
            </li>
            <li>
              <strong>The clock.</strong> Vallo publishes how fast a person answers. Within 4 hours: anybody asked to pay
              outside Vallo, anything unsafe or threatening, money already lost. Within 1 day: listings not as described,
              suspected scams, duplicates, content the scanner held. Within 3 days: applications, verification documents,
              appeals.
            </li>
            <li>
              <strong>Deciding in bulk.</strong> A bulk decision runs the same single decision once per item, with every
              rule that decision carries, and writes one audit row per item under one batch. A decision that does not fit
              an item is skipped and counted, never forced.
            </li>
          </ul>
          <ScreenshotSlot desk="the Unified queue with a claimed row" />
        </>
      ),
    },
    {
      id: "listings",
      title: "Listings to approve",
      body: (
        <>
          <p>
            On{" "}
            <Link href="/admin/listings" className={A}>
              Listings
            </Link>
            , open the Waiting tab and the oldest row. Read the whole listing before you decide: the photographs and any
            that look like photographs on another listing, the costs with who each one is paid to, the lister&apos;s
            verification, the owner&apos;s written mandate when an agent or a firm lists it, and the description.
          </p>
          <ol role="list">
            <li>
              <strong>Approve.</strong> The listing passes review and the console tries to publish it straight away. It
              goes live only when every publishing rule passes: a nightly stay has declared its charges at the door, an
              agent or firm listing has an approved mandate from the owner, the lister has accepted the current fee on this
              price, and a lister under enhanced checks has been cleared. If a rule holds it back, you are told which, and
              the lister is told what is missing.
            </li>
            <li>
              <strong>Ask for more.</strong> Pick the reason chips that fit and add your own words. A reason is required.
              The lister reads it word for word and the listing waits with them.
            </li>
            <li>
              <strong>Reject.</strong> A reason of at least eight characters is required. The lister reads it and can edit
              and send the listing again.
            </li>
          </ol>
          <p>
            You cannot review your own listing. A listing that is a draft, already rejected, or with the lister for
            changes cannot be decided until it comes back.
          </p>
          <p>
            The queue has a tab for every state, with search and a date range, and pages forty at a time. A row opens the
            listing under review and carries your place in the queue, so the page knows which listing comes next. The
            page leads with the decision. Under it, each part of the evidence is a row of its own: Photos, Property
            details, Location, the move-in or purchase costs, Lister, Checklist, Fee terms, Same property and Notes.
            Notes are for staff only; the member never sees them.
          </p>
          <p>
            An example listing carries an Example tag in the queue, and the queue&apos;s counts leave examples out. An
            example is never real supply. The set of examples is on{" "}
            <Link href="/admin/examples" className={A}>
              Examples
            </Link>
            .
          </p>
          <p>
            <strong>Owners&apos; mandates.</strong> An agent or firm listing goes live only once Vallo has confirmed the
            owner who instructed the lister. The Mandates panel on Listings shows every mandate waiting. Open one to see
            the owner&apos;s number, and ring it, or meet or call the owner another way, to confirm they asked this lister.
            Approving records how you confirmed them, against your name. You may note an ID document you saw by its
            reference, but never a NIN. Refusing needs a reason of at least eight characters, which the lister reads.
          </p>
          <ScreenshotSlot desk="a listing under review" />
        </>
      ),
    },
    {
      id: "identity",
      title: "Identity checks, documents and applications",
      body: (
        <>
          <p>
            <Link href="/admin/kyc" className={A}>
              Verification
            </Link>{" "}
            shows one row per person, not per file. Open the person to see their ladder, their documents, their identity
            checks and the consent they gave. Read the{" "}
            <Link href="/admin/kyc/guide" className={A}>
              reviewer guide
            </Link>{" "}
            before your first decision. You confirm that the people who list and get paid on Vallo are who they say
            they are. Renters and buyers are never asked for documents.
          </p>
          <ol role="list">
            <li>Open the person. Identity at a glance shows their ID beside their selfie, and the names to compare.</li>
            <li>Check the ID, then the selfie, against the checklists in the reviewer guide.</li>
            <li>
              Approve the ID by typing the name exactly as printed on it. That name becomes their confirmed identity, and
              their bank account must match it.
            </li>
            <li>Approve the selfie if it is the same person, live. Then check the proof of address.</li>
            <li>
              Anything you cannot accept, send back with a reason they can act on. They replace just that document, and it
              comes back to the queue.
            </li>
          </ol>
          <ul role="list">
            <li>
              <strong>Documents.</strong> Open each one in the console&apos;s own viewer, never a raw link. Every opening
              is written to the audit log. Approving needs no reason. Rejecting needs a reason of at least twelve
              characters, which the person is sent word for word.
            </li>
            <li>
              <strong>Identity checks.</strong> The result of a government record check, with the selfie match and
              liveness. Approve, or refuse with a reason of at least twelve characters. A check where no government
              record came back cannot be approved: refuse it with a reason or wait for a new check.
            </li>
            <li>
              <strong>Asking for a selfie with the ID.</strong> Say what you need and why, in at least twelve characters.
              The person is sent your words.
            </li>
            <li>
              <strong>Applications.</strong> Approve, ask for changes with a note, or refuse with a reason of at least
              eight characters. The applicant reads it.
            </li>
          </ul>
          <p>
            <strong>When an ID looks wrong</strong>, use the panel called Cross-checks on the person&apos;s row before you
            decide. It says whether the same ID number, the same file or a very similar picture is on another account,
            looks for signs an image was edited, checks a passport&apos;s bottom lines and their check digits, compares
            the name with the bank details, and gives a by-eye list of what a real one looks like. A line marked Stop
            means do not approve. None of it proves an ID is genuine. If you still doubt it, send it back asking for a
            different government ID without saying what you suspect, and escalate to Trust and Safety from the same
            panel. The steps are in the{" "}
            <Link href="/admin/kyc/guide#forged" className={A}>
              reviewer guide
            </Link>{" "}
            and in{" "}
            <Link href="/admin/manual/business-development#forged-id" className={A}>
              Before you escalate a possible fake ID
            </Link>
            . Never type an ID number, a name or a date of birth into any outside website or app.
          </p>
          <p>You cannot decide your own document, check or application. The desk and the database both refuse it.</p>
          <ScreenshotSlot desk="the Verification desk with a person open" />
        </>
      ),
    },
    {
      id: "reports",
      title: "Reports, flags, held content and cases",
      body: (
        <>
          <p>
            Reports, message flags and content the safety scan held are tabs of the{" "}
            <Link href="/admin/queue?tab=reports" className={A}>
              Unified queue
            </Link>
            .
          </p>
          <ul role="list">
            <li>
              <strong>A report.</strong> Start review, then resolve or dismiss. Dismissing needs a reason of at least
              eight characters. You can write a separate line for the person who reported; only that line reaches them,
              never your notes.
            </li>
            <li>
              <strong>Held content.</strong> Let it through, which needs no reason, or take it down, which does. The author
              reads the reason word for word. Your own post, story, comment or bio goes to another moderator.
            </li>
            <li>
              <strong>A lister asking about a review.</strong> Keep the review, or hide it behind a public note. Either
              closes the request and tells the lister and the reviewer.
            </li>
          </ul>
          <p>You cannot decide a report you filed, one about you, or one about your own words.</p>
          <p>
            Every report also opens or joins a case on{" "}
            <Link href="/admin/cases" className={A}>
              Cases
            </Link>
            , one case per thing reported. A case is due by its severity: critical in 4 hours, high in 24, medium in 72,
            low in 7 days. Three or more reports raise it one level. Work it like this:
          </p>
          <ol role="list">
            <li>Assign it to yourself, which puts it under review.</li>
            <li>
              Write internal notes for colleagues. Set it to awaiting information while you wait on a member, and message
              the member from the case: they receive a notice from Vallo Trust and Safety that never names the reporter.
            </li>
            <li>Act on the content: hold, remove or restore it, with a reason. Each action can be reversed.</li>
            <li>
              Restrict the member if the case needs it. They are told at once with your reason and can appeal from their
              account standing page.
            </li>
            <li>
              Resolve it with an outcome and a note. Linked reports close with it, and you choose whether the people who
              reported are told the outcome in plain words.
            </li>
          </ol>
          <p>
            A case shows what was reported, read by the database. A private thread beyond the reported item is never
            shown, and you do not look for it another way. Write the reason the member reads in plain words, and put what
            a colleague needs in the internal notes, never in a message to the member.
          </p>
          <DocCallout tone="warning" title="Report these to your lead the same day">
            A request for money off the platform, anybody asking for an inspection fee, and a fake listing. A report about
            being asked to pay outside Vallo runs on the 4 hour promise.
          </DocCallout>
          <ScreenshotSlot desk="a case with its timeline" />
        </>
      ),
    },
    {
      id: "tickets",
      title: "Support tickets",
      body: (
        <>
          <p>
            <Link href="/admin/support" className={A}>
              Support
            </Link>{" "}
            opens on lanes: All open, New, Waiting on us, Waiting on member, Escalated, Mine and Done. Late tickets come
            first. The clock runs from the member&apos;s oldest unanswered message; once we have written last, no clock
            runs.
          </p>
          <p>
            A ticket is filed by a signed-in member or through the contact form, and each carries a VAL-SUP reference a
            member can read out. Read the ticket and anything attached to it. A member can also link one of their own
            bookings or payments to it.
          </p>
          <ol role="list">
            <li>
              <strong>Take it</strong> (or press c). Replying takes an unheld ticket for you. The database refuses a reply
              on a ticket a colleague holds.
            </li>
            <li>
              <strong>Reply.</strong> A saved reply fills the box; read it and adjust it before it goes, because your name
              is on it. Send and resolve answers and resolves in one step.
            </li>
            <li>
              <strong>Set the status honestly.</strong> Closing always needs a note saying what was done.
            </li>
            <li>
              <strong>Hand it to another desk</strong> (or press e) when it is about money, safety or identity: Money,
              Safety or Verification, with a reason of at least eight characters. That desk is told and hands it back with
              what it found. Keep talking to the member on the thread meanwhile.
            </li>
            <li>
              <strong>Internal notes</strong> are for colleagues and never reach the member.
            </li>
          </ol>
          <p>
            A ticket the member filed under safety, or one handed to Money or Safety, runs on a 4 hour clock. A verification
            ticket runs on a 3 day clock. Everything else runs on a 1 day clock. Compliance is never a hand-off target: if you suspect a
            compliance matter, hand it to Safety and say why.
          </p>
          <p>
            A ticket handed to another desk can be opened by a person on that desk through its link. They see that one
            ticket and no queue.
          </p>
          <p>
            <strong>Feedback on a help page.</strong> When a signed-in reader marks a help page as not helpful, it arrives
            here as an ordinary ticket whose first line is &quot;Documentation feedback&quot; and names the page. Treat it
            as a request to fix that page and pass it to whoever owns the help pages. The totals per page are on{" "}
            <Link href="/admin/doc-feedback" className={A}>
              Pages that fail
            </Link>
            .
          </p>
          <p>
            The response times are the ones printed on the public{" "}
            <Link href="/standards" className={A}>
              standards page
            </Link>
            , the same numbers the desk works its due times from. If you are close to a due time, tell your lead. Contact a
            member only inside Vallo, or on the contact address they gave the form. Never ask for or pass on an account
            number, and never tell a member Vallo is holding their money.
          </p>
          <p>
            <strong>A member who cannot find something.</strong> Ask what they typed, and type the same words into{" "}
            <Link href="/intelligence" className={A}>
              VALLO Intelligence
            </Link>{" "}
            yourself. Read the chips under Search understood: a place they did not mean, a budget or a bedroom count is
            the usual cause, and a tap on the chip removes it. Tell them which chip to remove, or a shorter way to say
            it. If a word or a nickname is not understood, note it on the ticket and tell the Content desk, which can
            add it as an alias. If nothing on Vallo matches, say so plainly and never promise that a listing will
            appear. You cannot see what a member searched; work only from what they tell you. Chapter 15 says how
            VALLO Intelligence works.
          </p>
          <p>Keys: j and k move between tickets, n opens the next one nobody holds, r replies, m opens saved replies, ? lists them all.</p>
          <p>
            The copilot on this desk can write a reply for you. Type /reply, or ask &quot;Reply to the oldest
            ticket&quot;. It shows the reply word for word on a card, and it reaches the member only when you press Send
            reply (or Send and resolve). Read it as if you wrote it, because your name is on it. It can also resolve,
            reopen or close a ticket on a card; closing still needs a note. See{" "}
            <Link href="/admin/manual/copilot" className={A}>
              The AI copilot
            </Link>
            .
          </p>
          <ScreenshotSlot desk="the Support desk with a ticket open" />
        </>
      ),
    },
    {
      id: "agreements",
      title: "Agreements waiting for review",
      body: (
        <>
          <p>
            <Link href="/admin/agreements" className={A}>
              Agreements
            </Link>{" "}
            is the gate between an agreement and payment, for the Agreement approval area. An agreement reaches the queue
            only when the inspection report was submitted with its photos (for a rental) or the host accepted the stay,
            and both parties confirmed the same version of the terms. Payment cannot start for anybody until a reviewer
            approves it.
          </p>
          <ol role="list">
            <li>Decide on what was agreed, and on the inspection report and its photographs.</li>
            <li>
              <strong>Approve</strong>, or <strong>send it back</strong> with a reason of at least ten characters, which both
              parties read.
            </li>
            <li>Both parties are told by notification and by email. The decision is in the audit log with your name.</li>
          </ol>
          <p>
            If you or anybody close to you is a party, leave it for a colleague; the database already refuses a decision by
            a party to the agreement. Nothing on this desk takes or moves money: approving lets payment start, it does not
            make a payment.
          </p>
          <p>
            The review threshold, the risk signals and the incident switch behind the gate are on{" "}
            <Link href="/admin/agreements/settings" className={A}>
              Risk settings
            </Link>
            , for the same area. The database checks each change and writes it to the audit log. Offers on homes for sale
            have their own desk and chapter:{" "}
            <Link href="/admin/manual/offers-and-deals" className={A}>
              The Offers and deals desk
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      title: "Refunds",
      body: (
        <>
          <DocCallout tone="warning" title="Admins only">
            Making a refund, cancelling a stay and declining a guest&apos;s refund request are admin decisions. No staff
            access area makes them. Support hands the ticket to Money; Finance can read the refund record.
          </DocCallout>
          <p>Where refund work shows up, and what each control does:</p>
          <DocTable
            caption="Refund work, desk by desk"
            columns={[
              { key: "where", label: "Where" },
              { key: "what", label: "What you do there" },
            ]}
            rows={[
              {
                id: "clock",
                icon: "clock",
                cells: {
                  where: (
                    <Link href="/admin/money#refund-clock" className={A}>
                      Money, Refund clock
                    </Link>
                  ),
                  what: "Refunds past their due date and refunds due within 24 hours, each linked to its stay. A guest's request can be declined with a reason the guest reads.",
                },
              },
              {
                id: "cancel",
                icon: "calendar-booking",
                cells: {
                  where: "A stay's own page in Bookings: Cancel and refund",
                  what: "Choose one of four reasons. The amount comes from the published cancellation schedule, never typed. Three of the reasons give a full refund and need a note saying what a person confirmed.",
                },
              },
              {
                id: "part",
                icon: "receipt",
                cells: {
                  where: "A stay's own page in Bookings: refund part of a payment",
                  what: "An amount, one of six reasons and a note of at least ten characters. It can never exceed what was paid less what was already refunded, so two people cannot refund the same naira twice.",
                },
              },
              {
                id: "record",
                icon: "file-text",
                cells: {
                  where: (
                    <Link href="/admin/money#refunds" className={A}>
                      Money, Refunds
                    </Link>
                  ),
                  what: "The record of every refund decided, with its state. Read only.",
                },
              },
            ]}
          />
          <p>
            The money goes back through Paystack to the card or account that paid. Vallo holds no balance to pay a refund
            from and credits nothing. The guest is sent the amount and the reason in writing.
          </p>
        </>
      ),
    },
    {
      id: "other",
      title: "The other queues",
      body: (
        <>
          <DocTable
            caption="Other queues and who works them"
            columns={[
              { key: "queue", label: "Queue" },
              { key: "who", label: "Who decides" },
              { key: "know", label: "What to know" },
            ]}
            rows={[
              { id: "claims", icon: "history", cells: { queue: "Guarantee claims made before 9 November 2026", who: "Guarantee claims", know: "The Guarantee is retired. Decide each old claim against the inspection report and the agreement. The claimant reads your reason." } },
              { id: "chargebacks", icon: "credit-card", cells: { queue: "Chargebacks and disputed payments", who: "Finance", know: "Each move and note is written to the chargeback's history and the audit log, and the lister is told. See Working the money desks." } },
              { id: "appeals", icon: "scale", cells: { queue: "Appeals", who: "Trust and Safety", know: "Somebody other than the person who made the decision decides. Overturning lifts the restriction and tells the member." } },
              { id: "reservations", icon: "utensils", cells: { queue: "Restaurant reservations", who: "Operations", know: "Accept or decline on the restaurant's behalf; the guest is told." } },
              { id: "alerts", icon: "bell", cells: { queue: "Alerts", who: "Operations reads, admins resolve", know: "A critical alert also goes to a person outside the console." } },
              { id: "referrals", icon: "hand-coins", cells: { queue: "Referrals and reward payouts", who: "Admins", know: "Approve or refuse each with a reason." } },
              { id: "recovery", icon: "key", cells: { queue: "Account recovery", who: "Super admins", know: "The NIN the person gives must match an approved identity on file, and the old address is told at once. Then a 72 hour wait, during which any admin or the owner can cancel. A super admin other than the one who opened it moves the address. A move signs the account out everywhere and holds money leaving it for 7 days." } },
              { id: "compliance", icon: "shield-lock", cells: { queue: "Compliance lanes", who: "Compliance", know: "Every decision needs a second member of staff. Never tell anybody they are the subject of a check or a report." } },
            ]}
          />
          <p>
            What needs a second person, and what only an admin decides, is in{" "}
            <DocCrossLink href="/admin/manual/decisions">What you may decide alone</DocCrossLink>. Disputed payments,
            chargebacks, fee rates and record retention are worked step by step in{" "}
            <DocCrossLink href="/admin/manual/money">Working the money desks</DocCrossLink>.
          </p>
        </>
      ),
    },
  ],
};
