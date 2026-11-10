import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 5. Read from `lib/admin/audit.ts` and the migrations that make the
 * audit log append-only (`20260805094300`), the staff sign-in audit
 * (`20261107180200`), `lib/admin/oversight.ts` (what counts as work and who
 * reads it), the member-facing reads: `lib/reports/my-reports.ts` (the
 * reporter's line only), `lib/support/my-tickets.ts` and the
 * `support_message_staff_name` trigger (a staff reply carries the writer's
 * first name), the notices each decision sends, and `lib/account/export.ts`
 * (a member's data export strips staff identities and keeps the reasons).
 */

const WRITTEN: DocTableRow[] = [
  { id: "decisions", icon: "circle-check", cells: { what: "Every decision you make", detail: "Who, when, which record, the state before and after, and your note or reason.", logged: { yes: true } } },
  { id: "views", icon: "eye", cells: { what: "Opening sensitive records", detail: "A person's file, an identity document, a check's files, saved payment methods.", logged: { yes: true } } },
  { id: "claims", icon: "user-check", cells: { what: "Taking and handing back items", detail: "Each take and each release on the queue.", logged: { yes: true } } },
  { id: "exports", icon: "archive", cells: { what: "Every export", detail: "The money history, the audit log and team oversight exports are each written down when they are downloaded.", logged: { yes: true } } },
  { id: "signin", icon: "log-out", cells: { what: "Every staff sign-in and every security key proof", detail: "The network and a fingerprint of the browser or app. A device not seen on your account in 60 days tells you and every super admin, at most once a day.", logged: { yes: true } } },
  { id: "handbook", icon: "file-text", cells: { what: "Acknowledging the handbook", detail: "Which version, and when.", logged: { yes: true } } },
  { id: "notes", icon: "pencil", cells: { what: "Internal notes", detail: "Kept on the record, append-only. A note restricted to an access area is shown only to the people who hold it and to admins.", logged: { yes: true, note: "Kept on the record" } } },
];

const MEMBER_SEES: DocTableRow[] = [
  { id: "listing", cells: { action: "A listing decision", sees: "A notice and an email. A send-back or a rejection carries your reason word for word.", name: { yes: false } } },
  { id: "document", cells: { action: "A document, identity check or application decision", sees: "The decision, and a refusal's reason word for word.", name: { yes: false } } },
  { id: "report", cells: { action: "A report decided", sees: "The reporter sees the status and only the line you wrote for them, never your notes.", name: { yes: false } } },
  { id: "held", cells: { action: "Held content taken down", sees: "The author reads your reason word for word.", name: { yes: false } } },
  { id: "reply", cells: { action: "A support reply", sees: "Your reply on their ticket, signed with your first name and Vallo support. Internal notes and hand-offs stay with staff.", name: { yes: true, note: "First name" } } },
  { id: "case", cells: { action: "A case message, restriction or appeal decision", sees: "A notice from Vallo Trust and Safety with your reason. Never who reported them, and never what happened to somebody else.", name: { yes: false } } },
  { id: "agreement", cells: { action: "An agreement decision", sees: "Both parties are told; a send-back carries your reason.", name: { yes: false } } },
  { id: "refund", cells: { action: "A refund or cancellation", sees: "The amount and the reason, in writing.", name: { yes: false } } },
  { id: "compliance", cells: { action: "Anything on the Compliance desk", sees: "Nothing. A hold shows only a neutral line that names no check, list or report.", name: { yes: false } } },
];

export const RECORDS: ManualBody = {
  intro: (
    <p>
      Everything you do in the console is written down, and some of it reaches the member. This chapter says what is
      recorded, who can read it, and exactly what a member sees of a staff decision.
    </p>
  ),
  glance: [
    "Every decision is written to the audit log with your name, the time, the record and what changed.",
    "Nobody can edit or delete the audit log, admins and the founder included.",
    "Your lead sees each queue's backlog and every staff member's decisions over the last 30 days.",
    "A member reads your reasons word for word, and the first name on a support reply. They never read internal notes.",
  ],
  sections: [
    {
      id: "audit-log",
      title: "The audit log",
      body: (
        <>
          <p>
            Every decision in the console writes one row: who acted, what they did, which record, and the state before and
            after. Decisions the database can make in one step with their row (moderation, staff access, agreements and
            cases) are made that way. Where the row is written after the decision, a failed write is tried
            again, and if it still fails a critical alert is raised rather than the gap being hidden.
          </p>
          <p>
            The log can only be added to. Updating, deleting or emptying it is refused by the database for everybody,
            however they connect. The one change it accepts is removing a person&apos;s name from their rows when they
            delete their account; the record itself stays.
          </p>
        </>
      ),
    },
    {
      id: "about-you",
      title: "What is written about your work",
      body: (
        <DocTable
          caption="What the console records about a staff member's work"
          columns={[
            { key: "what", label: "What" },
            { key: "detail", label: "What is kept" },
            { key: "logged", label: "Recorded?", kind: "yesno" },
          ]}
          rows={WRITTEN}
        />
      ),
    },
    {
      id: "who-reads",
      title: "Who reads it",
      body: (
        <ul role="list">
          <li>
            <strong>The Audit log desk</strong> is open to admins. Its CSV export belongs to the Compliance area, and the
            export is itself recorded.
          </li>
          <li>
            <strong>Team oversight</strong> is open to the Operations area and admins: how many items wait on each queue
            and how long the oldest has waited, and each staff member&apos;s decisions over 30 days. Looking, claiming and
            exporting do not count as decisions there.
          </li>
          <li>
            <strong>The Staff page</strong> shows admins every staff member, their access, when they were last active and
            their security keys.
          </li>
          <li>
            <strong>Members</strong> never read the audit log.{" "}
            <Link href="/admin/oversight" className={A}>
              Team oversight
            </Link>{" "}
            and the audit log are staff only.
          </li>
        </ul>
      ),
    },
    {
      id: "member-sees",
      title: "What a member sees of a staff action",
      body: (
        <>
          <DocTable
            caption="What a member sees of each staff action"
            columns={[
              { key: "action", label: "Your action" },
              { key: "sees", label: "What the member sees" },
              { key: "name", label: "Sees your name?", kind: "yesno" },
            ]}
            rows={MEMBER_SEES}
          />
          <p>
            A member who downloads their data gets the decisions about them and the reasons they were already shown. Every
            staff identity is removed from that file.
          </p>
          <DocCallout tone="warning" title="Never tip off">
            Never tell a person, or anybody who might tell them, that they matched a sanctions list, are under review, or
            are the subject of a report. Say nothing more on the phone, in support or by email. Tipping off is an offence.
          </DocCallout>
        </>
      ),
    },
  ],
};
