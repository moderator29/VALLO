import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { Section, Stack } from "@/components/app/Screen";
import { TrustFacts } from "@/components/app/listing/TrustFacts";
import { PersonReasons } from "@/components/app/trust/PersonReasons";
import { OwnChecks } from "@/components/app/trust/OwnChecks";
import { PromiseFoot } from "@/components/app/trust/PromiseFoot";
import { personChecks, personStats, reasonsTitle } from "@/lib/trust/checks";
import { proofLines } from "@/lib/trust/proof-strip";

/**
 * "WHY TRUST THIS SPACE?" AND "REASONS TO TRUST <NAME>", FROM FIXTURES.
 *
 * Every listing in production today is an example row, and an example row
 * carries no check by rule, so the live page can only ever show its empty
 * state. This page draws the real components with dated fixtures so the
 * dated states can be looked at: `?view=dated` (the default), `empty`,
 * `summary`, `summary-empty`, `person`, `own` (a member's own view, with the
 * checks they can still add) and `promise-foot` (the foot of /community; with
 * no database here it asks for its state, gets none, and draws nothing).
 *
 * The dates and the register entry are invented. Nothing here is a claim
 * about a real space or a real person, and the harness never opens on the
 * deployed site (`lib/preview-harness.ts`).
 */
const t = getDictionary("en");

const LINES = proofLines({
  isDemo: false,
  identitySeenAt: "2026-08-14T09:00:00Z",
  ownershipVerifiedAt: "2026-08-20T09:00:00Z",
  credentials: [
    {
      kind: "lasrera",
      number: "LAS-0004411",
      company: null,
      registerName: "Adaeze Chukwuemeka-Olanrewaju",
      checkedAt: "2026-09-01T09:00:00Z",
    },
  ],
  renters: { attended: 7, asListed: 6, lastAt: "2026-10-01T00:00:00Z" },
});

const DATED = { inspectedAt: "2026-09-12T10:00:00Z", addressCheckedAt: "2026-08-03T09:00:00Z" };
const NONE = { inspectedAt: null, addressCheckedAt: null };

export default async function TrustPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "dated" } = await searchParams;
  const copy = t.trustReasons;

  if (view === "person") {
    return (
      <main className="mx-auto w-full max-w-2xl px-gutter pb-4xl pt-lg" data-testid="preview-trust-person">
        <PersonReasons
          title={reasonsTitle("Sophia Duru", copy)}
          lede={copy.person.lede}
          stats={personStats(
            { reviewCount: 18, averageRating: 4.8, memberSince: "2025-03-04T09:00:00Z", lets: 6, replyBand: "hour" },
            copy,
            "en",
          )}
          checks={personChecks(
            {
              identitySeenAt: "2026-11-03T08:00:00Z",
              identityMethod: "seen",
              phoneConfirmedAt: "2026-11-12T08:00:00Z",
              emailConfirmedAt: "2026-11-12T07:40:00Z",
              promiseAcceptedAt: "2026-11-13T09:00:00Z",
              ownershipSeenAt: "2026-11-05T08:00:00Z",
            },
            copy,
            "en",
          )}
          labels={copy.sheet}
        />
      </main>
    );
  }

  if (view === "own") {
    return (
      <main className="mx-auto w-full max-w-2xl px-gutter pb-4xl pt-lg" data-testid="preview-trust-own">
        <section className="nf-reasons">
          <PersonReasons
            title={copy.own.title}
            lede={copy.own.lede}
            stats={[]}
            checks={personChecks({ emailConfirmedAt: "2026-11-12T07:40:00Z" }, copy, "en")}
            labels={copy.sheet}
            testId="own-reasons"
          />
          <OwnChecks
            rows={[
              { key: "identity", title: copy.own.identity.title, how: copy.own.identity.how, href: "/verification" },
              { key: "phone", title: copy.own.phone.title, how: copy.own.phone.how, href: "/settings/phone" },
              { key: "promise", title: copy.own.promise.title, how: copy.own.promise.how },
            ]}
            words={{ ...copy.own, close: copy.sheet.close }}
          />
        </section>
      </main>
    );
  }

  if (view === "promise-foot") {
    return (
      <main className="mx-auto w-full max-w-3xl px-gutter pb-4xl pt-lg" data-testid="preview-trust-promise-foot">
        <PromiseFoot
          locale="en"
          words={{
            accept: copy.own.promiseAccept,
            accepted: copy.own.promiseAccepted,
            done: copy.own.promiseDone,
            failed: copy.own.promiseFailed,
            signedOut: copy.own.promiseSignedOut,
            note: copy.own.promiseNote,
          }}
        />
      </main>
    );
  }

  const summary = view === "summary" || view === "summary-empty";
  const empty = view === "empty" || view === "summary-empty";
  const lines = empty ? [] : LINES;

  return (
    <main className="nf-cat-surface mx-auto w-full max-w-2xl px-gutter pb-section" data-testid="preview-trust">
      <PageHeader
        title={t.experienceDetail.trust.title}
        subtitle="Three bedroom terrace in Lekki Phase 1"
        subtitleHref="/preview/trust"
        fallback="/preview"
      />
      <Stack className="nf-trust-page">
        <Section className="nf-trust-page__lead">
          <div>
            <TrustFacts
              listingId="preview"
              trust={empty ? NONE : DATED}
              strip={null}
              proofCount={lines.length}
              lines={lines}
              locale="en"
              t={t}
              variant={summary ? "summary" : "full"}
              askHref={empty ? "/preview/trust?view=empty" : null}
            />
          </div>
        </Section>
      </Stack>
    </main>
  );
}
