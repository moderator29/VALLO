import { Unreachable } from "@/components/app/Unreachable";
import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { readMyAgreements } from "@/lib/agreements/queries";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState, Section, TYPE } from "@/components/app/Screen";
import { NO_CUSTODY_SENTENCE, PAYMENT_GATE_SENTENCE } from "@/lib/money/copy";
import { RegisterRow } from "@/components/app/agreements/RegisterRow";
import { readKeptVersions } from "@/components/app/agreements/record-read";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).nav.agreements };
}
export const dynamic = "force-dynamic";

/**
 * Every agreement this person is a party to (Track A). An agreement is the
 * record of exactly what both sides committed to, drawn up from the renter's
 * inspection report or the host's acceptance, confirmed by both, and approved
 * by Vallo before payment opens.
 *
 * M2: A REGISTER OF DOCUMENTS. Each row is drawn as the document it is, with
 * the version its terms stand at and how many earlier versions are kept (B9's
 * snapshots, read in one query for the whole list). The order, the copy
 * above the list and every route are as they were.
 */
export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /* The agreements first run (north star 14.1, W7's system): once per
     member, before any read, teaching what has to happen before payment
     opens. The route sits behind the sign-in wall (proxy), so whoever reaches
     this line is signed in. */
  await gateFirstRun("agreements", "/agreements", await searchParams);
  const locale = await getLocale();
  const rows = await readMyAgreements();
  const kept = rows && rows.length > 0 ? await readKeptVersions(rows.map((row) => row.id)) : null;
  const t = getDictionary(locale);
  const copy = t.experienceMoney.agreements;
  return (
    <main className="nf-page nf-md">
      <PageFrame title={t.nav.agreements}>
      <div>
      <p className={`${TYPE.body} mt-inline`}>{PAYMENT_GATE_SENTENCE}</p>
      <p className={`${TYPE.rowMeta} mt-inline mb-block`}>{NO_CUSTODY_SENTENCE}</p>
      <Section title={copy.listTitle}>
        {rows === null ? (
          <Unreachable noun="agreements" icon="contract-sign" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="contract-sign"
            title={copy.emptyTitle}
            body={copy.emptyBody}
          />
        ) : (
          <ul className="nf-agr-register" data-testid="agreements-list">
            {rows.map((row) => (
              <li key={row.id}>
                <RegisterRow row={row} kept={kept ? (kept.get(row.id) ?? null) : null} locale={locale} copy={copy} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      </div>
    </PageFrame>
    </main>
  );
}
