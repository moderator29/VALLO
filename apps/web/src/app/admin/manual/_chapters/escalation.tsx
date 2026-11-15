import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import {
  CATEGORY_LABEL,
  ESCALATION_CATEGORIES,
  ESCALATION_SEVERITIES,
  PERSONAL_NUMBER_REFUSAL,
  REOPEN_DAYS,
  ROUTE_FALLBACK,
  ROUTE_LABEL,
  ROUTING,
  SEVERITY_LABEL,
  bumpWindowHours,
} from "@/lib/admin/escalations/types";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";
import { CONTACT_EMAIL } from "@/lib/support-email";
import { A, FounderToName, type ManualBody } from "./parts";

/**
 * Chapter 6, rewritten on 15 November 2026 for escalations on every admin
 * desk. Read from the rules themselves (`lib/admin/escalations/types.ts`: the
 * routing table, the response times and the overdue window are drawn here
 * from that data, so the tables cannot drift from what the console does),
 * the database functions (`supabase/migrations/pending/staff_escalations_2026-11-15.sql`),
 * the job descriptions (`lib/admin/staff-positions.ts`), the staff handbook
 * (`lib/admin/staff-handbook.ts`), the critical alert pager (`lib/ops/page.ts`)
 * and the lost key procedure (`docs/SUPPORT_STAFF.md`, `key-roster-actions.ts`).
 *
 * NOBODY IS NAMED HERE BECAUSE NOTHING NAMES THEM. The code and the documents
 * give positions, not people, and no rota or out of hours number. Those are
 * the founder's to supply, and the callouts below say so instead of guessing.
 */

const cap = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

const ROUTES: DocTableRow[] = ESCALATION_CATEGORIES.map((category) => {
  const fallback = ROUTE_FALLBACK[category];
  return {
    id: category,
    cells: {
      kind: CATEGORY_LABEL[category].name,
      covers: CATEGORY_LABEL[category].covers,
      goes: fallback ? `${cap(ROUTE_LABEL[ROUTING[category]])}, then ${ROUTE_LABEL[fallback]} if nobody holds it` : cap(ROUTE_LABEL[ROUTING[category]]),
    },
  };
});

const hours = (n: number) => (n === 1 ? "1 hour" : `${n} hours`);

const CLOCK: DocTableRow[] = [...ESCALATION_SEVERITIES].reverse().map((severity) => ({
  id: severity,
  cells: {
    urgency: SEVERITY_LABEL[severity].name,
    when: SEVERITY_LABEL[severity].when,
    answered: cap(SEVERITY_LABEL[severity].answer),
    after: `${hours(bumpWindowHours(severity))} more at each level it moves up to`,
  },
}));

const LADDER: DocTableRow[] = STAFF_POSITIONS.map((position) => {
  const job = JOB_DESCRIPTIONS[position];
  return {
    id: position,
    cells: { position: job.title, reports: job.reportsTo, escalate: job.escalate.join(" ") },
  };
});

export const ESCALATION: ManualBody = {
  intro: (
    <p>
      How to hand up what you cannot or may not decide, from any desk: the Escalate button, where each kind of issue
      goes, how soon somebody answers, what the receiver does, and what happens when nobody answers in time. The console
      names positions, not people. Where a name or a number is needed and nothing names it, this chapter says so.
    </p>
  ),
  glance: [
    "When you are unsure, escalate rather than guess. Use the Escalate button at the top of any admin page.",
    "It goes to one team with a response time. If nobody answers in time it moves up: the team, then the COO, then the super admin.",
    "Never tell a member you suspect them, and never paste an ID number, a bank detail or a document. The link carries the record.",
    "You are told when it is seen, when a question is asked, and when it is resolved or declined.",
    "Who answers out of hours is not written down yet. It is marked below for the founder to name.",
  ],
  sections: [
    {
      id: "when",
      title: "When to escalate",
      body: (
        <>
          <p>Escalate when any one of these is true:</p>
          <ul role="list">
            <li>
              <strong>You may not decide it.</strong> The decision belongs to another desk or to an admin: money, a
              restriction, an identity you doubt, staff access. See{" "}
              <Link href="/admin/manual/decisions" className={A}>
                What you may decide alone
              </Link>
              .
            </li>
            <li>
              <strong>You cannot decide it.</strong> The rules do not cover it, the evidence points both ways, or you have
              an interest in the outcome.
            </li>
            <li>
              <strong>Somebody may be harmed or lose money</strong> if nobody acts soon.
            </li>
            <li>
              <strong>Something is broken</strong> and it is stopping you or a member.
            </li>
          </ul>
          <p>
            Do the part that is yours first: read the record, write down what you looked at. Then escalate. Do not sit on
            it, and do not decide it yourself to save time.
          </p>
        </>
      ),
    },
    {
      id: "in-the-console",
      title: "How to escalate: the Escalate button",
      body: (
        <>
          <ol>
            <li>
              Open the record the issue is about, then press <strong>Escalate</strong>. It is at the top of every admin
              page. The page you are on is attached as a link, shown as &quot;Attached: this page&quot;.
            </li>
            <li>
              Choose <strong>what kind of issue</strong> it is and <strong>how urgent</strong> it is. Each urgency shows
              how soon it is answered.
            </li>
            <li>
              Write a <strong>short title</strong>, <strong>what happened</strong> (what you saw and what you have already
              done) and <strong>what you need from them</strong> (the decision or the action).
            </li>
            <li>
              Read the line that says where it will go, for example &quot;This goes to Trust and Safety. They aim to
              answer within 4 hours.&quot; If it should go somewhere else, choose &quot;Send it somewhere else&quot;.
            </li>
            <li>
              Press <strong>Send escalation</strong>. You get a reference such as ESC-000123, and the people it went to
              are told in the console and by email.
            </li>
          </ol>
          <p>
            Everything you raise, and everything waiting on you, is on{" "}
            <Link href="/admin/escalations" className={A}>
              Escalations
            </Link>
            . The same form is also a page of its own at{" "}
            <Link href="/admin/escalations/new" className={A}>
              Raise an escalation
            </Link>
            .
          </p>
          <DocCallout tone="note" title="Two older ways still work">
            A support ticket can still be handed to Money, Safety or Verification from the ticket itself, and a case can
            still be escalated from the case. Both keep the ticket or the case attached. Use the Escalate button for
            everything else, and whenever you are not sure which to use.
          </DocCallout>
        </>
      ),
    },
    {
      id: "who-answers",
      title: "Where it goes, and how soon they answer",
      body: (
        <>
          <p>The kind of issue decides who gets it. You do not need to know who is on which team.</p>
          <DocTable
            caption="Each kind of issue and the team it goes to"
            columns={[
              { key: "kind", label: "Kind of issue" },
              { key: "covers", label: "What it covers" },
              { key: "goes", label: "Goes to" },
            ]}
            rows={ROUTES}
          />
          <p>
            Nothing is sent to a team with nobody on it. If nobody holds the team, it goes to the COO, and if there is no
            COO it goes to the super admin. The form tells you when that happens, before you send.
          </p>
          <DocTable
            caption="How urgent it is, and how soon it is answered"
            columns={[
              { key: "urgency", label: "Urgency" },
              { key: "when", label: "Choose it when" },
              { key: "answered", label: "Answered" },
              { key: "after", label: "If nobody answers" },
            ]}
            rows={CLOCK}
          />
          <p>
            An urgent escalation also tells the super admin at once, whatever team it went to, and raises a critical
            alert. Choose urgent only when harm or loss is happening now. A team that sees urgent used for small things
            learns to ignore it.
          </p>
        </>
      ),
    },
    {
      id: "receiver",
      title: "When an escalation comes to you",
      body: (
        <>
          <p>
            You are told in the console and by email, and it shows under &quot;Waiting on me&quot; on{" "}
            <Link href="/admin/escalations" className={A}>
              Escalations
            </Link>
            , with a count beside the link. Open it. The record is a short brief: what happened, what is needed, the
            attached record, who has it now and the clock.
          </p>
          <ol>
            <li>
              <strong>I have seen this.</strong> Press it as soon as you have read it. The raiser is told, so they stop
              wondering.
            </li>
            <li>
              <strong>Take it.</strong> It becomes yours, and it stops waiting on the rest of your team. One escalation,
              one owner.
            </li>
            <li>
              <strong>Ask the raiser a question</strong> if you need more. The clock waits for their answer, and they are
              reminded once a day.
            </li>
            <li>
              <strong>Send to another team</strong> if it is not yours, with the reason. The new team gets a fresh
              response time.
            </li>
            <li>
              <strong>Resolve</strong> with a closing note: what was decided or done, in words the raiser can act on. Or{" "}
              <strong>Decline</strong> with the reason.
            </li>
          </ol>
          <p>
            The raiser is told the outcome and can reopen it within {REOPEN_DAYS} days. You cannot resolve or decline an
            escalation you raised yourself. Every step is on the record&apos;s timeline, which cannot be edited, and in
            the audit log with your name.
          </p>
        </>
      ),
    },
    {
      id: "overdue",
      title: "When nobody answers in time",
      body: (
        <>
          <p>
            Every escalation has a time it is due by. The console looks every ten minutes. One that has passed its time
            and is still open moves up a level by itself:
          </p>
          <ul role="list">
            <li>from the team to the COO,</li>
            <li>from the COO to the super admin.</li>
          </ul>
          <p>
            Each time it moves up it gets half the original time again, and never less than an hour. The people it moves
            up to are told, and the move is written on the timeline. At the super admin there is nowhere higher, so the
            super admin is reminded once a day until it is closed.
          </p>
          <p>
            While a question is waiting for the raiser, nothing moves up. The clock is the raiser&apos;s, and the raiser is
            reminded once a day.
          </p>
        </>
      ),
    },
    {
      id: "no-tipping-off",
      title: "No tipping off, and no pasted personal data",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Never tell the member you suspect them.</strong> Not in a message, not in a reply to a ticket, not
              on a call. On identity, fraud and safety the form and the record remind you. A person who is warned can
              destroy evidence or move money. If a member asks why something is taking long, say it is being reviewed and
              nothing more.
            </li>
            <li>
              <strong>Never paste an ID number, a bank detail or a document.</strong> No NIN, no BVN, no account number,
              no card number, no photograph of a document. The link carries the record, and only the people who may open
              that record can read it. The form refuses a long number with: &quot;{PERSONAL_NUMBER_REFUSAL}&quot;
            </li>
            <li>
              <strong>Write only what the receiver needs.</strong> What happened, what you looked at, what you need. Names
              stay in the record the link opens.
            </li>
            <li>
              <strong>Keep it in the console.</strong> The email about an escalation carries its reference, its urgency
              and its due time only. Do not forward it, and do not discuss the case in a reply to it.
            </li>
            <li>
              <strong>A compliance worry</strong> goes in as Identity or fraud, or as Safety. Do not write to Compliance
              directly from a support ticket: the people who receive it decide whether Compliance hears of it, so nothing
              you write can tip a person off.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "urgent",
      title: "When it cannot wait",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>Threats of violence, child safety, or anything that may be a crime:</strong> escalate at once as
              Safety and Urgent, and do not contact the member yourself.
            </li>
            <li>
              <strong>A member who says they are in danger:</strong> escalate immediately as Safety and Urgent.
            </li>
            <li>
              <strong>Money leaving that should not be:</strong> escalate as Money and Urgent, with the payment&apos;s own
              page attached.
            </li>
            <li>
              <strong>A report about a member of staff:</strong> escalate as Staff access, which goes to the super admin,
              without acting on it yourself.
            </li>
            <li>
              <strong>Your account may be compromised:</strong> tell the founder at once.
            </li>
            <li>
              <strong>You are a super admin and lost your security key:</strong> tell a super admin by phone or in person, never by email alone,
              because an email is exactly what somebody holding your lost phone could send. A second super admin confirms
              it is you and revokes the old key for the console. You then set up a key on your new device.
            </li>
          </ul>
          <DocCallout tone="note" title="When the platform itself is failing">
            A critical alert is sent to a person outside the console, by email or by a push to a phone, through a channel
            the founder sets up. An urgent escalation raises one. When the app itself is down, an outside uptime monitor
            is what notices. Neither tells you who will answer.
          </DocCallout>
        </>
      ),
    },
    {
      id: "ladder",
      title: "Who each position reports to",
      body: (
        <>
          <p>
            The Escalate button chooses the team for you. This table is for the other question: who your own position
            reports to, and what it is expected to hand up. Read your own at{" "}
            <Link href="/admin/handbook/position" className={A}>
              Your role
            </Link>
            . It is drawn from the same job descriptions.
          </p>
          <DocTable
            caption="Positions, who each reports to, and what each escalates"
            columns={[
              { key: "position", label: "Position" },
              { key: "reports", label: "Reports to" },
              { key: "escalate", label: "Escalate" },
            ]}
            rows={LADDER}
          />
          <FounderToName>
            Who holds each position today, and how to reach them outside the console. The console names positions only.
            Until the founder names people, an escalation with no team to go to reaches the founder&apos;s own account, as
            the handbook says.
          </FounderToName>
        </>
      ),
    },
    {
      id: "out-of-hours",
      title: "Out of hours",
      body: (
        <>
          <p>
            The console keeps the clock when nobody is looking: an escalation still moves up when its time passes, late
            items rise to the top of every queue, and a critical alert leaves the building. What the code and the
            documents do not say is who picks it up at night, at the weekend or on a public holiday.
          </p>
          <FounderToName>
            <ul role="list">
              <li>Who is on call out of hours, and for which areas.</li>
              <li>How to reach them: the phone number or the channel to use.</li>
              <li>The rota, and how a hand-over between shifts is recorded.</li>
              <li>
                A second super admin. Only a super admin can revoke a lost key, and a super admin&apos;s own lost key needs
                another one.
              </li>
            </ul>
          </FounderToName>
          <p>
            Members reach Vallo through the contact form, which lands on the Support desk, or by writing to{" "}
            {CONTACT_EMAIL}. Neither is an escalation line for staff.
          </p>
        </>
      ),
    },
  ],
};
