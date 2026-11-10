import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import type { StaffScope } from "@/lib/admin/guard";
import { MANUAL_AREA_LABEL as STAFF_SCOPE_LABEL } from "@/lib/admin/manual/chapters";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";
import { A, FounderToName, ScreenshotSlot, type ManualBody } from "./parts";

/**
 * Chapter 1. Read from `lib/admin/guard.ts` (requireAdmin, requireConsole,
 * the access areas), `app/admin/_components/StaffFrame.tsx` (which desks each
 * area opens), `lib/security/console-step-up.ts` (the security key, twelve
 * hours), `lib/admin/staff-positions.ts` (the positions, drawn from the data
 * itself so the table cannot drift) and `lib/admin/staff-actions.ts` (only
 * the founder's super admin account grants access).
 */

/** What each access area opens, as StaffFrame and the database read it. */
const AREA_OPENS: Record<StaffScope, string> = {
  listing_approval:
    "Listings. Cases about property, and review calls on a listing.",
  kyc_review:
    "Verification: identity documents, identity checks and agent applications. Review calls on those.",
  moderation:
    "The Reports, Flags and Held lanes of the Unified queue, Blocked terms, Cases (property, stays, messages, account, Circle and feed) and the Circle desk.",
  support:
    "Support. Cases, to read, note, message a member and escalate, never to act on content.",
  agreements: "Agreements and its Risk settings.",
  guarantee:
    "Guarantee claims made before the Vallo Guarantee was retired on 9 November 2026, and caution rulings on the Money desk.",
  finance: "Money, Payments, Chargebacks, and Record retention to read.",
  compliance: "Compliance (sanctions, reports to the NFIU, thresholds, politically exposed persons) and the audit log export.",
  operations:
    "Operations, Alerts, Bookings, Visits, Reservations, Restaurant fees, Crash log, Call usage, Provider checks and Team oversight.",
  trust_safety: "Cases in every module, Trust overview, Appeals, Roommates and Circle.",
  roommates: "The Roommates desk and Roommates cases.",
  circle: "The Circle desk, and Circle and feed cases.",
  analyst: "Trust overview: the numbers only, never what a case says.",
  business_development:
    "The Business Development desk: partnerships, the pipeline, and listing review (through the listing_approval scope every Business Development Executive also holds).",
  social_media: "The Social Media desk: the content calendar, drafts, campaigns, the media library and approvals. No listing, moderation or member data.",
};

const AREA_ROWS: DocTableRow[] = (Object.keys(AREA_OPENS) as StaffScope[]).map((scope) => ({
  id: scope,
  cells: { area: STAFF_SCOPE_LABEL[scope], opens: AREA_OPENS[scope] },
}));

const POSITION_ROWS: DocTableRow[] = STAFF_POSITIONS.map((position) => {
  const job = JOB_DESCRIPTIONS[position];
  return {
    id: position,
    cells: {
      position: job.title,
      areas: job.scopes.map((scope) => STAFF_SCOPE_LABEL[scope]).join(", "),
      reports: job.reportsTo,
    },
  };
});

export const ACCESS: ManualBody = {
  intro: (
    <p>
      Before any desk opens, three things have to be true of your account. This chapter says what they are, which access
      areas a person can hold, what each one opens, and the named positions that bundle them.
    </p>
  ),
  glance: [
    "Only the founder's super admin account gives or ends staff access. You cannot give access to anybody, yourself included.",
    "Your desks stay locked until you acknowledge the current staff handbook, and lock again whenever it changes until you acknowledge the new one.",
    "Every sign-in proves your security key before the console opens. One proof lasts twelve hours on that session.",
    "An access area opens its own desks and nothing else. The database refuses the rest even if a page were to open.",
  ],
  sections: [
    {
      id: "the-door",
      title: "How you get in",
      body: (
        <>
          <ol role="list">
            <li>
              <strong>Sign in with your own Vallo account.</strong> An account with no staff access gets the site&apos;s ordinary
              &quot;not found&quot; at every console address, so the console does not confirm it exists to anybody who
              cannot use it.
            </li>
            <li>
              <strong>Prove your security key.</strong> The passkey on your phone or computer, set up at Settings, Privacy.
              The console asks once per sign-in session and again after twelve hours. A password alone opens nothing: the
              database treats your access as held only while your session carries a live proof. The first key on a staff
              account takes your password and a code sent to your email; adding another key, or removing one, takes a key
              you already have.
            </li>
            <li>
              <strong>Acknowledge the staff handbook.</strong> Until you do, you can read the handbook and your role and
              nothing else. Read the{" "}
              <Link href="/admin/handbook" className={A}>
                staff handbook
              </Link>{" "}
              and{" "}
              <Link href="/admin/handbook/position" className={A}>
                your role
              </Link>{" "}
              first.
            </li>
          </ol>
          <p>
            A staff member does not see the operator&apos;s rail. You see a short frame with Console, Handbook, Your role,
            Staff manual and Help and support, then one button for each desk your access opens. Every desk asks the
            database again when it opens, so a typed address to any other desk gets the same refusal.
          </p>
          <ScreenshotSlot desk="the staff frame and the security key screen" />
        </>
      ),
    },
    {
      id: "areas",
      title: "The access areas",
      body: (
        <>
          <p>
            An access area is what the super admin grants. A person can hold several. Each opens the desks below and
            nothing more. Admins and super admins hold every area.
          </p>
          <DocTable
            caption="What each access area opens"
            columns={[
              { key: "area", label: "Access area" },
              { key: "opens", label: "What it opens" },
            ]}
            rows={AREA_ROWS}
          />
        </>
      ),
    },
    {
      id: "positions",
      title: "Named positions",
      body: (
        <>
          <p>
            A grant can carry a named position. Each position comes with a default set of access areas, which the super
            admin can widen or narrow, and a job description you can read at{" "}
            <Link href="/admin/handbook/position" className={A}>
              Your role
            </Link>
            . This table is drawn from the same list the console uses.
          </p>
          <DocTable
            caption="Named positions, their default access areas and who each reports to"
            columns={[
              { key: "position", label: "Position" },
              { key: "areas", label: "Default access areas" },
              { key: "reports", label: "Reports to" },
            ]}
            rows={POSITION_ROWS}
          />
          <DocCallout tone="note" title="The Guarantee is history">
            The Vallo Guarantee was retired on 9 November 2026. The Guarantee claims area is still granted because claims
            made before that date are still decided. No new claim can be made.
          </DocCallout>
        </>
      ),
    },
    {
      id: "admins",
      title: "Admins, super admins and the founder",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>An admin</strong> holds every access area, and also opens the desks that ask for no area at all:
              the person file, Supply, Businesses, Stops, Standing, Around, Withheld weight, Referrals, the Audit log,
              Analytics, Switches, Reference data, Examples and Account recovery. Refunds, cancellations and safety holds
              are admin decisions too.
            </li>
            <li>
              <strong>A super admin</strong> is an admin who can also give and end staff access, raise a fee rate, move an
              account to a new email address (with a second super admin), destroy money records past their retention
              date, and revoke somebody else&apos;s lost console key.
            </li>
            <li>
              <strong>The founder&apos;s account</strong> is the one account the console lets decide its own listing or
              application. Nobody else may decide anything they are a party to.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "other-roles",
      title: "Business development and social media",
      body: (
        <>
          <p>
            The console has no named position and no access area for business development or for social media
            management. The positions and areas above are the whole list. If your work is one of these, you hold no
            console access unless the founder grants you an area, and the narrowest one is the read-only analyst area,
            which shows numbers and never what a case says.
          </p>
          <FounderToName>
            Which access area, if any, a business developer or a social media manager holds, and who they ask when they
            need something from a desk they cannot open.
          </FounderToName>
        </>
      ),
    },
  ],
};
