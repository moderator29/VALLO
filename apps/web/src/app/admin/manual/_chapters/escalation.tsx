import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";
import { CONTACT_EMAIL } from "@/lib/support-email";
import { A, FounderToName, type ManualBody } from "./parts";

/**
 * Chapter 6. Read from the hand-off targets (`lib/admin/support-workspace.ts`),
 * the case engine's escalation (`admin_case_escalate`), the job descriptions
 * (`lib/admin/staff-positions.ts`, drawn here from the data so the table
 * cannot drift), the staff handbook (`lib/admin/staff-handbook.ts`), the
 * critical alert pager (`lib/ops/page.ts`) and the lost key procedure
 * (`docs/SUPPORT_STAFF.md`, `key-roster-actions.ts`).
 *
 * NOBODY IS NAMED HERE BECAUSE NOTHING NAMES THEM. The code and the documents
 * give positions, not people, and no rota or out of hours number. Those are
 * the founder's to supply, and the callouts below say so instead of guessing.
 */

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
      Where to take what you cannot decide, who answers for each area, and what to do when something cannot wait. The
      console names positions, not people. Where a name or a number is needed and nothing names it, this chapter says so.
    </p>
  ),
  glance: [
    "When you are unsure, escalate rather than guess. The handbook names the founder as the last step.",
    "Support hands money, safety and identity to the Money, Safety and Verification desks, never to Compliance.",
    "Threats of violence, child safety or anything that may be a crime: escalate at once and do not contact the member.",
    "Who answers out of hours is not written down yet. It is marked below for the founder to name.",
  ],
  sections: [
    {
      id: "in-the-console",
      title: "Escalating inside the console",
      body: (
        <ul role="list">
          <li>
            <strong>From a support ticket:</strong> hand it to Money (a payment that has not arrived, a refund that has not
            come back, a charge the member does not recognise), Safety (somebody asked to pay outside Vallo, a threat, a
            scam, a person who says they are unsafe) or Verification (a stuck or refused check, a document to look at),
            with a reason. The ticket then runs on a 4 hour clock while it is with Money or Safety.
          </li>
          <li>
            <strong>From a case:</strong> Escalate, with a reason. The case moves to the Trust and Safety team, rises to at
            least high severity, and is due within 24 hours.
          </li>
          <li>
            <strong>A compliance worry:</strong> support never hands to Compliance. Hand it to Safety and say why; the
            safety lead decides whether Compliance hears of it, so nothing you write can tip a person off.
          </li>
          <li>
            <strong>A decision only an admin takes</strong> (a refund, an alert, a switch): leave an internal note with
            what you found and hand the item over. See{" "}
            <Link href="/admin/manual/decisions" className={A}>
              What you may decide alone
            </Link>
            .
          </li>
        </ul>
      ),
    },
    {
      id: "who-answers",
      title: "Who answers for each area",
      body: (
        <>
          <p>
            Each position has a line it reports to and the things it escalates. Read your own at{" "}
            <Link href="/admin/handbook/position" className={A}>
              Your role
            </Link>
            . This table is drawn from the same job descriptions.
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
            Who holds each position today, and how to reach them. The console names positions only. Until the founder
            names people, take what you cannot decide to the founder, as the handbook says.
          </FounderToName>
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
              <strong>Threats of violence, child safety, or anything that may be a crime:</strong> escalate at once, and do
              not contact the member yourself.
            </li>
            <li>
              <strong>A member who says they are in danger:</strong> escalate immediately.
            </li>
            <li>
              <strong>A report about a member of staff:</strong> escalate to the Head of Trust and Safety without acting on
              it.
            </li>
            <li>
              <strong>Your account may be compromised:</strong> tell the founder at once.
            </li>
            <li>
              <strong>You lost your security key:</strong> tell a super admin by phone or in person, never by email alone,
              because an email is exactly what somebody holding your lost phone could send. A second super admin confirms
              it is you and revokes the old key for the console. You then set up a key on your new device.
            </li>
          </ul>
          <DocCallout tone="note" title="When the platform itself is failing">
            A critical alert is sent to a person outside the console, by email or by a push to a phone, through a channel
            the founder sets up. When the app itself is down, an outside uptime monitor is what notices. Neither tells you
            who will answer.
          </DocCallout>
        </>
      ),
    },
    {
      id: "out-of-hours",
      title: "Out of hours",
      body: (
        <>
          <p>
            The console keeps the clock when nobody is looking: late items rise to the top of every queue, and a critical
            alert leaves the building. What the code and the documents do not say is who picks it up at night, at the
            weekend or on a public holiday.
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
