import Link from "next/link";
import type { ReactNode } from "react";
import { BackButton } from "@/components/site/BackButton";
import { STAFF_SCOPE_LABEL, type StaffAccess, type StaffScope } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { PageHead } from "./panels";

/**
 * TRACK K: THE RESTRICTED CONSOLE A STAFF MEMBER SEES.
 *
 * Not the operator's rail with rows hidden: a separate, short frame that
 * names only the desks this person was given, plus the handbook. Nothing on
 * it links anywhere else, and every desk it links to asks the database again
 * (`requireAdmin(scope)`), so a hand-typed address to any other desk answers
 * with the refusal it always gave.
 */
export const STAFF_DESK: Record<StaffScope, string> = {
  listing_approval: "/admin/listings",
  kyc_review: "/admin/kyc",
  moderation: "/admin/queue",
  support: "/admin/support",
  agreements: "/admin/agreements",
  guarantee: "/admin/agreements#claims",
  finance: "/admin/money",
  compliance: "/admin/compliance",
  operations: "/admin/operations",
  trust_safety: "/admin/cases",
  roommates: "/admin/roommates",
  circle: "/admin/circle",
  analyst: "/admin/trust",
  business_development: "/admin/business-development",
  social_media: "/admin/social-media",
  marketing: "/admin/marketing",
  content: "/admin/content",
  technical: "/admin/technical",
  support_lead: "/admin/support-lead",
};

/** The other desks a scope opens, beyond its front door. */
export const STAFF_EXTRA_DESKS: Partial<Record<StaffScope, { href: string; label: string }[]>> = {
  finance: [
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/chargebacks", label: "Chargebacks" },
  ],
  moderation: [
    { href: "/admin/blocked-terms", label: "Blocked terms" },
    { href: "/admin/cases", label: "Cases" },
  ],
  trust_safety: [
    { href: "/admin/trust", label: "Trust overview" },
    { href: "/admin/appeals", label: "Appeals" },
    { href: "/admin/roommates", label: "Roommates" },
    { href: "/admin/circle", label: "Circle" },
  ],
  roommates: [{ href: "/admin/cases?module=roommates", label: "Roommates cases" }],
  circle: [{ href: "/admin/cases?module=circle", label: "Circle cases" }],
  support: [{ href: "/admin/cases", label: "Cases" }],
  operations: [
    { href: "/admin/call-usage", label: "Call usage" },
    { href: "/admin/alerts", label: "Alerts" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/bookings/visits", label: "Visits" },
    { href: "/admin/oversight", label: "Team oversight" },
  ],
};

export function StaffFrame({ staff, name, children }: { staff: StaffAccess; name: string; children: ReactNode }) {
  return (
    <div className="nf-console nf-staff-frame" data-testid="staff-console">
      <header className="nf-panel nf-panel--card block p-card">
        {/* The way back, as the operator's console bar draws it: every desk
            goes to `/admin` and a record to its desk (`route-parents.ts`).
            This frame had none, so a staff member on a desk had only the
            desk buttons below and the browser. */}
        <div className="flex items-center gap-sm">
          <BackButton fallback="/admin" surface="round" />
          <div className="min-w-0">
            <p className="nf-caption text-[var(--nf-content-secondary)]">
              Vallo console · {staff.position ? JOB_DESCRIPTIONS[staff.position].title : "staff"}
            </p>
            <p className="font-semibold">{name}</p>
          </div>
        </div>
        <nav aria-label="Your desks" className="mt-inline">
          <ul className="flex flex-wrap gap-xs">
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/admin/my-desk">
                My desk
              </Link>
            </li>
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/admin">
                Console
              </Link>
            </li>
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/admin/handbook">
                Handbook
              </Link>
            </li>
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/admin/handbook/position">
                Your role
              </Link>
            </li>
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/admin/manual">
                Staff manual
              </Link>
            </li>
            <li>
              <Link className="nf-btn nf-btn--glass nf-btn--sm" href="/settings/help">
                Help and support
              </Link>
            </li>
            {staff.handbookAcknowledged
              ? staff.scopes.flatMap((scope) => [
                  <li key={scope}>
                    <Link className="nf-btn nf-btn--glass nf-btn--sm" href={STAFF_DESK[scope]}>
                      {STAFF_SCOPE_LABEL[scope]}
                    </Link>
                  </li>,
                  ...(STAFF_EXTRA_DESKS[scope] ?? []).map((desk) => (
                    <li key={desk.href}>
                      <Link className="nf-btn nf-btn--glass nf-btn--sm" href={desk.href}>
                        {desk.label}
                      </Link>
                    </li>
                  )),
                ])
              : null}
          </ul>
        </nav>
        {!staff.handbookAcknowledged ? (
          <p className="nf-body mt-inline" role="status">
            Read and acknowledge the staff handbook to unlock your desks.
          </p>
        ) : null}
      </header>
      <div className="mt-block">{children}</div>
    </div>
  );
}

/** The console's front page for a staff member. */
export function StaffHome({ staff }: { staff: StaffAccess }) {
  return (
    <div className="nf-admin-stack" data-testid="staff-home">
      {/* The console's one header (`PageHead`, AD-01), then the card that says
          what this person's access covers and opens their desks. */}
      <PageHead title={staff.position ? `Your console: ${JOB_DESCRIPTIONS[staff.position].title}` : "Your console"} />
      <section className="nf-panel nf-panel--card block p-card">
        {staff.position ? (
          <p className="nf-body">
            {JOB_DESCRIPTIONS[staff.position].summary}{" "}
            <Link href="/admin/handbook/position" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Read your full role description
            </Link>
            .
          </p>
        ) : null}
        <p className={staff.position ? "nf-body mt-inline" : "nf-body"}>
          Your access: {staff.scopes.map((s) => STAFF_SCOPE_LABEL[s]).join(", ")}. Every decision you make is written to
          the audit log with your name.
        </p>
        {staff.handbookAcknowledged ? (
          <ul className="mt-block grid gap-xs">
            <li>
              <Link href="/admin/my-desk" className="font-semibold text-[var(--nf-content-link)] hover:underline">
                Open My desk
              </Link>
            </li>
            {staff.scopes.map((scope) => (
              <li key={scope}>
                <Link href={STAFF_DESK[scope]} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                  Open {STAFF_SCOPE_LABEL[scope]}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nf-body mt-block">
            <Link href="/admin/handbook" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Read the staff handbook
            </Link>{" "}
            first. Your desks unlock the moment you acknowledge it.
          </p>
        )}
      </section>
    </div>
  );
}
