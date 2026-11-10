import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { ManualBody } from "./parts";

/**
 * Chapter 4. Each row names the gate it was read from: the access area the
 * action passes to `requireAdmin`, the reason length its schema or database
 * function enforces, and the second-person rules in the compliance lanes
 * (`lib/admin/str-actions.ts`, the threshold, politically exposed person and
 * sanctions lanes), email recovery (`email-recovery-actions.ts`), the key
 * roster (`key-roster-actions.ts`), the case engine
 * (`admin_restrict_member`, `admin_decide_appeal`), fee rates
 * (`money-actions.ts`) and retention (`lib/admin/desk-reads/retention-actions.ts`).
 */

type Row = { id: string; icon: UiIconName; decision: string; who: string; rule: string };

function table(list: Row[]): DocTableRow[] {
  return list.map((r) => ({ id: r.id, icon: r.icon, cells: { decision: r.decision, who: r.who, rule: r.rule } }));
}

const ALONE: Row[] = [
  { id: "listing", icon: "clipboard-list", decision: "Approve, send back or reject a listing", who: "Listing approval", rule: "A rejection needs a reason of eight characters or more. Never your own listing." },
  { id: "document", icon: "id-card", decision: "Approve or reject an identity document or identity check", who: "KYC review", rule: "A rejection needs a reason of twelve characters or more. Never your own." },
  { id: "application", icon: "user", decision: "Approve, send back or refuse an application", who: "KYC review", rule: "A refusal needs a reason of eight characters or more. Never your own." },
  { id: "report", icon: "flag", decision: "Resolve or dismiss a report, review a message flag", who: "Reports and moderation", rule: "A dismissal needs a reason of eight characters or more. Never a report you filed or one about you." },
  { id: "held", icon: "eye", decision: "Let held content through or take it down", who: "Reports and moderation", rule: "Taking it down needs a reason the author reads. Never your own content." },
  { id: "ticket", icon: "headset", decision: "Reply to, resolve or close a ticket, or hand it to another desk", who: "Support", rule: "Closing needs a note. A hand-off needs a reason of eight characters or more." },
  { id: "agreement", icon: "file-check", decision: "Approve an agreement or send it back", who: "Agreement approval", rule: "Sending back needs a reason of ten characters or more. Never one you are a party to." },
  { id: "restrict", icon: "block", decision: "Restrict a member for up to 30 days: a warning, messaging, posting or roommates", who: "The area that owns the case's module, or Trust and Safety", rule: "A reason of ten characters or more, which the member reads." },
  { id: "chargeback", icon: "credit-card", decision: "Open a chargeback, move it, add a note", who: "Finance", rule: "Written to the chargeback's history and the audit log in the same step." },
];

const SECOND: Row[] = [
  { id: "str", icon: "shield-lock", decision: "Decide whether a suspicious transaction is reported to the NFIU", who: "Compliance", rule: "One member of staff decides with written reasons; a second approves." },
  { id: "hold", icon: "lock", decision: "End a compliance hold on an account", who: "Compliance", rule: "One proposes the release; a second approves it." },
  { id: "threshold", icon: "receipt", decision: "Record a threshold report", who: "Compliance", rule: "One records the filing; a second approves or rejects it." },
  { id: "pep", icon: "user-check", decision: "Clear a politically exposed person's transaction", who: "Compliance", rule: "One records the source of funds; a second approves." },
  { id: "sanctions", icon: "file-search", decision: "Decide a sanctions match, or put a new list in force", who: "Compliance", rule: "One proposes; a second approves. Nobody approves their own proposal, and nobody decides a match about themselves." },
  { id: "email", icon: "mail", decision: "Move an account to a new email address", who: "Super admins", rule: "A super admin other than the one who opened the request finishes it, after a 72 hour wait the account owner can cancel." },
  { id: "key", icon: "key", decision: "Revoke a lost console key", who: "Super admins", rule: "Always another super admin. Nobody can do it for themselves." },
  { id: "appeal", icon: "scale", decision: "Decide an appeal", who: "Trust and Safety", rule: "Somebody other than the person who made the decision being appealed." },
];

const ADMIN_ONLY: Row[] = [
  { id: "refund", icon: "receipt", decision: "Cancel a stay and refund it, or refund part of a payment", who: "Admins", rule: "The schedule sets a cancellation's amount. A part refund needs a note and cannot exceed what is still refundable." },
  { id: "decline", icon: "circle-x", decision: "Decline a guest's refund request", who: "Admins", rule: "A reason the guest reads." },
  { id: "suspend", icon: "shield-stop", decision: "Suspend a member, or restrict for longer than 30 days or with no end", who: "Trust and Safety (and admins)", rule: "A reason the member reads. They can appeal." },
  { id: "alert", icon: "bell", decision: "Acknowledge or resolve an alert", who: "Admins", rule: "Operations staff can read alerts but not close them." },
  { id: "safety-hold", icon: "lock", decision: "Clear or extend a safety hold after somebody pressed \"I feel unsafe\"", who: "Admins", rule: "Clear it once somebody has looked, or extend it." },
  { id: "stop", icon: "shield-stop", decision: "Stop an agent trading, or lift a stop", who: "Admins", rule: "Upholding a stop as fraud is a super admin's, with a reason of ten characters or more." },
  { id: "badge", icon: "star", decision: "Grant or revoke a standing badge", who: "Admins", rule: "A reason of ten characters or more. Never to yourself." },
  { id: "fee", icon: "price-tag", decision: "Change a fee rate", who: "Admins", rule: "Lowering is any admin. Raising is a super admin." },
  { id: "switch", icon: "sliders", decision: "Turn a feature on or off", who: "Admins", rule: "It changes the product for everybody at once." },
  { id: "business", icon: "building-hotel", decision: "Record a business's verification and publish it", who: "Admins", rule: "Hotels and restaurants." },
  { id: "staff", icon: "users", decision: "Give or end staff access", who: "The founder's super admin account", rule: "Ending access needs a reason of five characters or more, which the person reads." },
  { id: "retention", icon: "archive", decision: "Destroy money records past retention", who: "A super admin", rule: "Only after typing the confirmation phrase exactly, against the count shown." },
];

const COLUMNS = [
  { key: "decision", label: "Decision" },
  { key: "who", label: "Who" },
  { key: "rule", label: "What it needs" },
];

export const DECISIONS: ManualBody = {
  intro: (
    <p>
      What a staff member may decide alone inside their access area, what always needs a second person, and what only an
      admin or super admin decides. The screens only choose which buttons to draw: every rule here is enforced again on the
      server and, for most of them, by the database.
    </p>
  ),
  glance: [
    "Nobody decides their own case: not their own listing, document, application, report, agreement or appeal.",
    "Every compliance decision, every account email move and every lost-key revocation needs two people.",
    "Refunds, cancellations, alerts, switches, fees and staff access are admin decisions, never a staff member's.",
    "Where a reason is asked for, the member reads it. Write it in plain words.",
  ],
  sections: [
    {
      id: "alone",
      title: "Decisions you may take alone",
      body: (
        <>
          <p>Inside your own access area, and only on an item that is not yours:</p>
          <DocTable caption="Decisions a staff member takes alone" columns={COLUMNS} rows={table(ALONE)} />
        </>
      ),
    },
    {
      id: "two-people",
      title: "Decisions that need a second person",
      body: (
        <>
          <p>The database refuses the second step from the person who took the first.</p>
          <DocTable caption="Decisions that need a second person" columns={COLUMNS} rows={table(SECOND)} />
        </>
      ),
    },
    {
      id: "admin-only",
      title: "Decisions only an admin takes",
      body: (
        <>
          <p>No staff access area opens these. If one is needed, hand the item over with what you found.</p>
          <DocTable caption="Decisions only an admin or super admin takes" columns={COLUMNS} rows={table(ADMIN_ONLY)} />
        </>
      ),
    },
    {
      id: "everywhere",
      title: "The rules that hold on every desk",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>If you know the person, or have any interest, leave it.</strong> Say why in the internal notes. The
              console refuses the cases it can see; the rest is on you.
            </li>
            <li>
              <strong>Decide on the evidence in the console</strong>: the listing, the documents, the inspection report,
              the thread. Never on who the person is or what they promise.
            </li>
            <li>
              <strong>Never ask for or pass on money</strong>, never give out an account number, and never move a
              conversation or a payment off the platform. Vallo charges no inspection fee: a member asked for one is a
              report.
            </li>
            <li>
              <strong>When you are unsure, do not guess.</strong> Escalate. A slower right answer is better than a quick
              wrong one.
            </li>
          </ul>
          <DocCallout tone="note" title="The security key is the only step-up">
            The console asks for your security key when it opens and again after twelve hours. No desk asks for it again
            before a single decision. Destroying records past retention asks you to type a confirmation phrase instead.
          </DocCallout>
        </>
      ),
    },
  ],
};
