import { getDictionary } from "@vallo/i18n";
import { adminUi } from "@/app/admin/_components/ui";
import { SubjectCard } from "@/app/admin/kyc/SubjectCard";
import { VerificationDesk, type VerificationRow } from "@/app/admin/kyc/VerificationDesk";
import type { KycSubjectView } from "@/lib/admin/kyc-queries";
import type { CrossCheckReport } from "@/lib/identity/cross-check/actions";
import { getLocale } from "@/lib/locale";
import { ConsoleFrame } from "../bd/ConsoleFrame";
import { CLEAN_SUBJECT, DOWN_SUBJECT, STOP_SUBJECT, cleanReport, downReport, stopReport } from "./fixtures";
import "@/app/admin/_review/review.css";

/**
 * Verification desk > one person > Cross-checks, on the console frame, from
 * fixtures. Three people: one with nothing wrong, one with a Stop (the ID
 * number on another account, an editing mark, a screenshot), and one whose
 * checks could not run. The panel is the real `CrossChecks` inside the real
 * `SubjectCard` and `VerificationDesk`; its findings come from the real
 * `readCrossChecks` over a staged database, and no server call is made.
 *
 * `?open=clean`, `?open=stop` or `?open=down` draws that one person's card
 * open on its own, for a screenshot. The photos are not drawn here: the
 * document route is behind the staff door, which this sandbox cannot pass.
 * The passport checker and the checklist work as on the desk; Compare and
 * the decisions call real actions, which the door refuses here.
 */
export const dynamic = "force-dynamic";

const CASES = ["clean", "stop", "down"] as const;
type Case = (typeof CASES)[number];

export default async function PreviewKycCrossChecks({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const [clean, stop, down] = await Promise.all([cleanReport(), stopReport(), downReport()]);
  const people: Record<Case, { subject: KycSubjectView; report: CrossCheckReport }> = {
    clean: { subject: CLEAN_SUBJECT, report: clean },
    stop: { subject: STOP_SUBJECT, report: stop },
    down: { subject: DOWN_SUBJECT, report: down },
  };

  const one = (CASES as readonly string[]).includes(open ?? "") ? people[open as Case] : null;
  if (one) {
    return (
      <ConsoleFrame t={t}>
        <div className="nf-rv nf-rv--kyc">
          <div className="nf-rv-detail__body" data-testid="preview-one">
            <SubjectCard subject={one.subject} ui={ui} decidable crossChecks={one.report} />
          </div>
        </div>
      </ConsoleFrame>
    );
  }

  const rows: VerificationRow[] = CASES.map((key) => {
    const { subject, report } = people[key];
    return {
      id: subject.userId ?? key,
      name: subject.displayName,
      role: "Agent",
      tier: subject.tier,
      rungsPassed: 0,
      submitted: ui.when(subject.documents[0]?.uploadedAt ?? null),
      pending: subject.documents.length,
      body: <SubjectCard subject={subject} ui={ui} decidable crossChecks={report} />,
    };
  });

  return (
    <ConsoleFrame t={t}>
      <VerificationDesk rows={rows} empty={{ title: "Nothing to show", body: "" }} summary={null} recent={[]} />
    </ConsoleFrame>
  );
}
