import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { State } from "@/components/ui/State";
import { getDictionary } from "@vallo/i18n";
import { resolveSessionClaims } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES, VERIFICATION_KINDS } from "@/lib/features/roommates/model";
import { listInstitutions, readRoommatesHub } from "@/lib/features/roommates/queries";
import { agoShort, requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";

import { Empty, Plate, Section, Tag, fill } from "../groups/_parts/kit";
import "../groups/_parts/fe-b.css";
import { VerificationBanner } from "@/components/roommates/VerificationBanner";

import { DocumentCheck, EmailCheck } from "./VerifyFlows";

export const metadata: Metadata = { title: "Add a check" };
export const dynamic = "force-dynamic";

/**
 * GET VERIFIED (FE-B): the member's checks as they stand, the school email
 * check (a code to an address on the school's own domain), the document
 * check (a student ID, an NYSC call-up letter or a work letter, uploaded to
 * the member's own folder of the PRIVATE `roommate-evidence` bucket and read
 * by staff through a short signed link), and what each badge means. The
 * honest line is said once: a badge says what was checked, not who someone is.
 */
export default async function RoommateVerifyPage() {
  const locale = await getLocale();
  const R = getDictionary(locale).roommates;
  const V = R.verifyX;
  const [hub, schools, claims] = await Promise.all([readRoommatesHub(), listInstitutions({ limit: 1500 }), resolveSessionClaims()]);
  if (hub.live && !hub.signedIn) redirect(withNext("/sign-in", ROOMMATES_ROUTES.verify));
  const now = requestNow();
  if (!hub.live) {
    return (
      <PageFrame title={V.title} subtitle={V.subtitle} fallback={ROOMMATES_ROUTES.hub}>
        <State kind="empty" title={V.title} body={R.notOpen} primary={{ href: ROOMMATES_ROUTES.home, label: R.title }} />
      </PageFrame>
    );
  }
  const userId = claims.state === "signed-in" ? claims.userId : null;
  const schoolOptions = schools.items.map((s) => ({ id: s.id, name: s.shortName ? `${s.name} (${s.shortName})` : s.name }));
  return (
    <PageFrame title={V.title} subtitle={V.subtitle} fallback={ROOMMATES_ROUTES.hub} width="wide">
      <div className="nf-rmb" data-testid="roommates-verify">
        <VerificationBanner title={V.title} line={R.verification.honest} />
        <Section title={V.current} id="rm-verify-current">
          {hub.verifications.length === 0 ? (
            <Empty>{V.none}</Empty>
          ) : (
            <ul className="nf-rmb-rows">
              {hub.verifications.map((v) => (
                <li key={v.id} className="nf-rmb-row">
                  <Plate icon={v.status === "verified" ? "shield-check" : "hourglass"} />
                  <div className="nf-rmb-row__text">
                    <p className="nf-rmb-row__title">{R.verification.kinds[v.kind]}</p>
                    <p className="nf-rmb-row__line">
                      {[v.institution?.shortName ?? v.institution?.name, v.emailMasked, fill(R.hubX.verification.submitted, { when: agoShort(v.createdAt, { now, locale }) })].filter(Boolean).join(" · ")}
                    </p>
                    {v.reason && v.status === "rejected" ? <p className="nf-rmb-row__line">{v.reason}</p> : null}
                  </div>
                  <Tag tone={v.status === "verified" ? "good" : v.status === "rejected" ? "bad" : v.status === "expired" ? "warn" : "brand"}>{R.verification.status[v.status]}</Tag>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="nf-rmg-split">
          <Section title={V.email.title} id="rm-verify-email">
            <p className="nf-rmb-row__line">{R.verification.emailIntro}</p>
            {schoolOptions.length === 0 ? <Empty>{V.email.noSchools}</Empty> : <EmailCheck schools={schoolOptions} />}
          </Section>
          <Section title={V.document.title} id="rm-verify-document">
            <p className="nf-rmb-row__line">{R.verification.idIntro}</p>
            <DocumentCheck userId={userId} schools={schoolOptions} />
          </Section>
        </div>
        <Section title={V.meaning.title} id="rm-verify-meaning">
          <ul className="nf-rmb-rows">
            {VERIFICATION_KINDS.map((k) => (
              <li key={k} className="nf-rmb-row">
                <Plate icon={k === "student_email" ? "mail" : k === "workplace" ? "briefcase" : "id-card"} />
                <div className="nf-rmb-row__text">
                  <p className="nf-rmb-row__title">{R.verification.kinds[k]}</p>
                  <p className="nf-rmb-row__line">{V.meaning[k]}</p>
                </div>
                <span />
              </li>
            ))}
          </ul>
          <p className="nf-rmb-note">{V.expires}</p>
          <p className="nf-rmb-note">{R.verification.honest}</p>
        </Section>
      </div>
    </PageFrame>
  );
}
