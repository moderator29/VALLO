import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { TYPE } from "@/components/app/Screen";
import { State } from "@/components/ui/State";
import { ButtonLink } from "@/components/ui/Button";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { readRecordCode, recordLines } from "@/lib/trust/record";
import { readRecordByCode } from "@/lib/trust/record-read";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).trustVisible.record.lookupTitle, robots: { index: false } };
}

/**
 * A RECORD CODE, TYPED (V-34). A lister puts `VR-` and six characters on a
 * WhatsApp bio, a business card or a TO LET board; anybody signed in who types
 * it into search lands here and sees the live Record, not a screenshot of one.
 *
 * States: a code that cannot be one of ours or matches nobody (one answer,
 * so the page never confirms which codes exist), too many lookups this hour,
 * a failed read, a lister with nothing counted yet, and the Record. Loading
 * is `loading.tsx` beside this file. Signed out never reaches this route: it
 * is inside the sign-in wall.
 */
export default async function RecordLookupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.trustVisible.record;
  const code = readRecordCode(decodeURIComponent(raw));
  const lookup = code ? await readRecordByCode(code) : ({ state: "missing" } as const);

  const back = (
    <ButtonLink href="/search" variant="primary" size="lg">
      {copy.search}
    </ButtonLink>
  );

  /* A code that matches nobody is the neutral not-found (UI-15): the empty
     kit's search glyph, never the shield with a tick, which reads as a Record
     that checked out (Round 3 sweep, C3). */
  const missing = (
    <PageFrame title={copy.lookupTitle} fallback="/search" width="narrow">
      <div>
      <State kind="empty" art={false} title={copy.lookupMissingTitle} body={copy.lookupMissingBody} action={back} />
      </div>
    </PageFrame>
  );
  if (lookup.state === "missing") return missing;
  if (lookup.state === "limited" || lookup.state === "failed") {
    return (
      <PageFrame title={copy.lookupTitle} fallback="/search" width="narrow">
        <div>
        {/* The same designed empty state as a code that matches nobody, so a
            refusal is a screen with a way on rather than a bare line of text
            under the header (restyle only: the words are unchanged). */}
        {/* A failed read is an error and says so (`role="alert"` is the
            kit's); too many lookups is a pause, said politely, with the
            neutral glyph. Neither wears the verified shield. */}
        {lookup.state === "failed" ? (
          <State kind="error" title={copy.lookupTitle} body={copy.lookupFailed} action={back} />
        ) : (
          <div role="status">
            <State kind="offline" title={copy.lookupTitle} body={copy.lookupLimited} action={back} />
          </div>
        )}
        </div>
      </PageFrame>
    );
  }

  const record = lookup.record;
  /* A Record with no line at all (a stop the database cannot date) is
     answered exactly as a code that matches nobody. */
  if (recordLines(record, copy, locale).length === 0) return missing;
  const title = record.displayName ?? copy.lookupTitle;
  /* Only the joining month counted so far: say so rather than draw a Record
     that looks empty. */
  const onlySince = recordLines(record, copy, locale).every((line) => line.key === "since");
  return (
    <PageFrame title={title} subtitle={copy.code.replace("{code}", record.recordCode ?? "")} fallback="/search" width="narrow">
      <div>
      <ValloRecord record={record} t={t} locale={locale} />
      {onlySince && <p className={`${TYPE.body} mt-block`}>{copy.lookupEmpty}</p>}
      </div>
    </PageFrame>
  );
}
