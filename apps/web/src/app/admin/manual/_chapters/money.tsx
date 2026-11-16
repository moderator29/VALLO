import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 19, from the retired staff manual's "Money, fees and chargebacks"
 * page (16 November 2026), read again against the code rather than copied:
 * the dispute decision (`lib/admin/arrangement-actions.ts`,
 * `app/admin/arrangements/ArrangementDecision.tsx` and `ArrangementRecord.tsx`),
 * chargebacks (`lib/admin/chargeback-actions.ts`,
 * `lib/admin/reads/chargebacks-model.ts`, the desk's words in
 * `packages/i18n/src/locales/chargebacks.en.ts`), fee rates
 * (`app/admin/fees/page.tsx`, `lib/admin/money-actions.ts`,
 * `lib/admin/money-queries.ts`) and retention
 * (`lib/admin/desk-reads/retention-actions.ts`, `retention-read.ts`). Every
 * door here is `requireAdmin("finance")`; what only an admin or a super admin
 * may do on top of it is said where it applies.
 */

const CHARGEBACK_STATES: DocTableRow[] = [
  { id: "opened", cells: { state: "Opened", means: "Recorded from the partner's notice. Nothing decided yet." } },
  { id: "requested", cells: { state: "Evidence requested", means: "The partner asked for evidence. Note its deadline if it gave one." } },
  { id: "submitted", cells: { state: "Evidence submitted", means: "The evidence has gone to the partner. Wait for the bank's answer." } },
  { id: "won", cells: { state: "Won", means: "The bank found for the payment. It can be reopened as lost, with a reason." } },
  { id: "lost", cells: { state: "Lost", means: "The bank found for the payer. What was lost is owed back by the lister until it is recovered or written off." } },
];

export const MONEY: ManualBody = {
  intro: (
    <p>
      How the money desks are worked: the rules that never bend, a disputed payment the partner holds, a chargeback, a
      fee rate and money records past their retention date. Refunds and cancellations of a stay are in{" "}
      <Link href="/admin/manual/queues#refunds" className={A}>
        Working a queue
      </Link>
      . Which access area opens each money desk is in{" "}
      <Link href="/admin/manual/desks#money" className={A}>
        What each desk is for
      </Link>
      .
    </p>
  ),
  glance: [
    "Vallo never holds customer money. Licensed payment partners process payments, so there is no Vallo float to manage and no Vallo balance to pay a member from.",
    "A decision on a disputed payment only sends an instruction. The record changes when the partner reports what it did.",
    "A chargeback is worked from Opened to Won, or to Lost and then recovered or written off. Every move needs a reason.",
    "A fee rate change is a new dated row, never an edit, and it cannot start in the past. Zero is shown as No fee, never as a blank.",
  ],
  sections: [
    {
      id: "rules",
      title: "The rules that never bend",
      body: (
        <>
          <ul role="list">
            <li>
              Never tell anybody Vallo is holding their money. A licensed payment partner processes the payment; Vallo
              records it.
            </li>
            <li>
              Never ask for, accept or pass on money for any reason, and never move a conversation or a payment off the
              platform. There is no fee you may charge and no payment you may arrange.
            </li>
            <li>Vallo charges no inspection fee. A member who says they were asked for one is making a report.</li>
            <li>
              On a purchase Vallo takes no money at any stage. Never present the value of agreed offers as Vallo
              revenue.
            </li>
          </ul>
          <DocCallout tone="note" title="What is switched on today">
            Stays and hotel rooms pay by card through Paystack. A payment held by a licensed bank is built and switched
            off today, so its desk is expected to be empty. Never describe it to a member as something they can use.
          </DocCallout>
        </>
      ),
    },
    {
      id: "disputed-payments",
      title: "Deciding a disputed payment the partner holds",
      body: (
        <>
          <p>
            The desk is{" "}
            <Link href="/admin/arrangements" className={A}>
              Protected payments
            </Link>
            , not in use while that rail is switched off. It opens to the Finance area and to admins. The list itself
            only reads. Open a payment to see who pays, who is paid, what the partner last said beside Vallo&apos;s own
            record, and the whole trail, with each side&apos;s statement in their own words. Read both before you decide.
          </p>
          <p>Two decisions can be made there, and only while the partner still holds the money:</p>
          <ul role="list">
            <li>
              <strong>Refund the payer.</strong> The whole amount goes back to the payer. Offered while the money is
              held, or while it is disputed.
            </li>
            <li>
              <strong>Release to the lister.</strong> The whole amount is paid to the lister. Offered only on a disputed
              payment: an ordinary release is the payer&apos;s own confirmation, never staff&apos;s.
            </li>
          </ul>
          <ol role="list">
            <li>
              Write the reason first, in at least 20 characters. It is kept on the payment&apos;s trail and in the audit
              log with your name, and it is what the decision is judged on later.
            </li>
            <li>Choose the decision. A second press says exactly what will be sent; press it to send the instruction.</li>
            <li>
              The record does not change on your press. It reads refunded or released once the partner reports it.
            </li>
          </ol>
          <DocCallout tone="warning" title="If the partner does not answer">
            The desk says the partner did not answer. Nothing is recorded as moved, and the next check reads its answer.
            Do not send the instruction again. Tell Finance and wait for that check.
          </DocCallout>
        </>
      ),
    },
    {
      id: "chargebacks",
      title: "Working a chargeback",
      body: (
        <>
          <p>
            A chargeback is the payer&apos;s bank reversing a card payment that already settled. The partner takes the
            money back from Vallo&apos;s balance, and a lost one is owed back by the lister. It is not a dispute between
            members. Work it on{" "}
            <Link href="/admin/chargebacks" className={A}>
              Chargebacks
            </Link>
            , which opens to the Finance area and to admins.
          </p>
          <ol role="list">
            <li>
              <strong>Record chargeback</strong> from the partner&apos;s notice: the payment reference, the partner, the
              partner&apos;s dispute id, the disputed amount, the evidence deadline if there is one, and what the notice
              says. The lister is told a card payment was disputed.
            </li>
            <li>
              Open the case. It shows the payment and its history. Use the buttons it offers, which are only the moves
              allowed from where it stands: Request evidence, Evidence submitted, Mark won, Mark lost.
            </li>
            <li>
              On a lost case, use Record money recovered each time money comes back, Close as recovered when it is all
              back, or Write off what is still owed.
            </li>
          </ol>
          <DocTable
            caption="The states of a chargeback"
            columns={[
              { key: "state", label: "State" },
              { key: "means", label: "What it means" },
            ]}
            rows={CHARGEBACK_STATES}
          />
          <p>
            Every move and every note needs a reason of at least 12 characters. It is written to the chargeback&apos;s
            history and to the audit log in the same step, and the lister is told. If a colleague moved the case after
            you opened it, nothing changes and the desk asks you to refresh. A lost case cannot be reversed to won once
            money was recovered from the lister: return it first.
          </p>
        </>
      ),
    },
    {
      id: "rates",
      title: "Changing a fee rate",
      body: (
        <>
          <p>
            <Link href="/admin/fees" className={A}>
              Fees
            </Link>{" "}
            shows the rates in force, their whole history and what has been earned. The Finance area and admins read it.
            Changing a rate is an admin&apos;s: lowering a rate is open to any admin, raising one is a super
            admin&apos;s.
          </p>
          <ul role="list">
            <li>
              <strong>A change is a new dated row, never an edit.</strong> The history is the whole story of what has ever
              been charged, and nothing in it can be quietly revised.
            </li>
            <li>
              <strong>It starts now or later, never in the past.</strong> Back-dating a rate would make a fee already
              charged unexplainable. The database refuses it.
            </li>
            <li>
              <strong>Say why.</strong> A reason of at least 8 characters goes on the record. No rate can be more than 20
              percent.
            </li>
            <li>
              <strong>Zero is shown as No fee, never as a blank.</strong> A deliberate zero and a missing value mean
              different things.
            </li>
          </ul>
          <p>
            Read the rates with the earned section beside them. A rate above zero with nothing earned next to it is a
            question to ask.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "Money records past retention",
      body: (
        <>
          <p>
            <Link href="/admin/retention" className={A}>
              Record retention
            </Link>{" "}
            shows the bank and payout details of deleted accounts that are past their retention date: counts and dates
            only, never a name or a number. The Finance area and admins read it. Only a super admin destroys them.
          </p>
          <DocCallout tone="warning" title="This destroys data">
            Type DESTROY exactly as written. The number of accounts it is about to touch must match the number shown, and
            one press touches at most 500. If the list changed while you were reading it, nothing is destroyed and you
            are asked to review it again. Every destruction is in the audit log with your name.
          </DocCallout>
        </>
      ),
    },
  ],
};
