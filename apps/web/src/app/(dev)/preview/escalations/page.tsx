import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AdminFrame } from "@/app/admin/_components/AdminFrame";
import { EscalateButton } from "@/app/admin/_components/EscalateButton";
import { StaffFrame } from "@/app/admin/_components/StaffFrame";
import { EscalationRecordView } from "@/app/admin/escalations/EscalationRecordView";
import { EscalationsDesk } from "@/app/admin/escalations/EscalationsDesk";
import { NewEscalation } from "@/app/admin/escalations/NewEscalation";
import { WaitingOnYou } from "@/app/admin/escalations/WaitingOnYou";
import { NotSetUp } from "@/app/admin/escalations/parts";
import { COUNTS, LIST_EMPTY, LIST_MIXED, LIST_NOT_SET_UP, PREVIEW_NOW, RECORD_RESOLVED, RECORD_WAITING, ROWS } from "./fixtures";

/**
 * ESCALATIONS, on the console's own frame, from fixtures. The screens are the
 * real ones (`EscalationsDesk`, `EscalationRecordView`, `NewEscalation`,
 * `WaitingOnYou`) fed what the reads would return, inside the real
 * `AdminFrame` with the real Escalate button in its bar, so the shell is seen
 * as an operator sees it. `?frame=staff` draws the staff frame instead.
 *
 *   ?screen=empty        nothing waiting
 *   ?screen=list         a mixed list with an overdue row (the default)
 *   ?screen=record       a record waiting on the viewer
 *   ?screen=resolved     a resolved record, as its raiser sees it
 *   ?screen=not-set-up   before the SQL has run
 *   ?screen=form         the form as a page, prefilled as the ID cross-check links it
 *   ?screen=card         the "Waiting on you" card
 *
 * Every button calls the real action, which the console door refuses here.
 * Never the proof of a write; only the proof of the look.
 */
export const dynamic = "force-dynamic";

const SCREENS = ["list", "empty", "record", "resolved", "not-set-up", "form", "card"] as const;
type Screen = (typeof SCREENS)[number];

export default async function PreviewEscalations({ searchParams }: { searchParams: Promise<{ screen?: string; frame?: string }> }) {
  const { screen: asked, frame } = await searchParams;
  const screen: Screen = (SCREENS as readonly string[]).includes(asked ?? "") ? (asked as Screen) : "list";
  const locale = await getLocale();
  const t = getDictionary(locale);
  const setUp = screen !== "not-set-up";
  const staffed = COUNTS.state === "ok" ? COUNTS.data.staffed : null;

  const body =
    screen === "empty" ? (
      <EscalationsDesk read={LIST_EMPTY} view="for_me" canSeeAll waiting={0} now={PREVIEW_NOW} locale={locale} />
    ) : screen === "not-set-up" ? (
      <EscalationsDesk read={LIST_NOT_SET_UP} view="for_me" canSeeAll={false} waiting={null} now={PREVIEW_NOW} locale={locale} />
    ) : screen === "record" ? (
      <EscalationRecordView read={RECORD_WAITING} now={PREVIEW_NOW} locale={locale} />
    ) : screen === "resolved" ? (
      <EscalationRecordView read={RECORD_RESOLVED} now={PREVIEW_NOW} locale={locale} />
    ) : screen === "form" ? (
      <NewEscalation
        query={{ category: "identity_fraud", recordUrl: "/admin/kyc?person=example", recordLabel: "The identity check" }}
        counts={COUNTS}
        locale={locale}
      />
    ) : screen === "card" ? (
      <div className="nf-console nf-admin-stack">
        <WaitingOnYou read={{ state: "ok", data: { view: "for_me", rows: ROWS.filter((r) => r.waitingOnMe), canSeeAll: true } }} now={PREVIEW_NOW} locale={locale} />
        <WaitingOnYou read={LIST_EMPTY} now={PREVIEW_NOW} locale={locale} title="Escalations with the COO" who="the COO" />
        <WaitingOnYou read={LIST_NOT_SET_UP} now={PREVIEW_NOW} locale={locale} />
      </div>
    ) : (
      <EscalationsDesk read={LIST_MIXED} view="all" canSeeAll waiting={4} now={PREVIEW_NOW} locale={locale} />
    );

  const menu = (
    <nav aria-label="Preview screens" className="nf-console mb-block flex flex-wrap gap-xs">
      {SCREENS.map((s) => (
        <Link key={s} href={`/preview/escalations?screen=${s}${frame === "staff" ? "&frame=staff" : ""}`} className="nf-btn nf-btn--glass nf-btn--sm" aria-current={s === screen ? "page" : undefined}>
          {s}
        </Link>
      ))}
    </nav>
  );

  if (frame === "staff") {
    return (
      <StaffFrame
        name="Kemi Adeyemi"
        staff={{ isAdmin: false, isSuperAdmin: false, scopes: ["kyc_review"], position: "kyc_reviewer", handbookVersion: "v", handbookAcknowledged: true, consoleVerified: true }}
        escalationsWaiting={2}
        escalate={<EscalateButton staffed={staffed} {...(setUp ? {} : { notSetUp: <NotSetUp /> })} />}
      >
        {menu}
        {body}
      </StaffFrame>
    );
  }

  return (
    <AdminFrame
      identity={{ name: "Example Operator", role: t.admin.shell.bar.owner, initial: "E", avatarUrl: null, tier: null }}
      counts={{ escalations: 4, listings: 18, alerts: 2 }}
      unread={3}
      navLabel={t.admin.console.navLabel}
      navLabels={t.admin.nav}
      searchLabel={t.admin.common.searchLabel}
      bellLabel={t.uiCommon.console.notifications}
      shell={t.admin.shell}
      escalate={<EscalateButton compact staffed={staffed} {...(setUp ? {} : { notSetUp: <NotSetUp /> })} />}
      experience={{ palette: t.experienceAdmin.palette, deskLedes: t.experienceAdmin.deskLedes, waitingTotal: t.experienceAdmin.shell.waitingTotal }}
    >
      {menu}
      {body}
    </AdminFrame>
  );
}
