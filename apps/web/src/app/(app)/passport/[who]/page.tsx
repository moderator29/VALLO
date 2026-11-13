import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { formatRating } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { PassportBook } from "@/components/passport/PassportBook";
import { withNext } from "@/lib/auth/next-link";
import { readPassportOf } from "@/lib/passport/passport-read";
import { buildPassportView } from "@/lib/passport/view";
import { PersonReasons } from "@/components/app/trust/PersonReasons";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { personChecks, reasonsTitle } from "@/lib/trust/checks";
import { ownershipSeenFor } from "@/lib/trust/ownership-seen";
import { readPersonChecks, readPersonRegisters } from "@/lib/trust/person-checks-read";
import { readUserRecord } from "@/lib/trust/record-read";

export async function generateMetadata(): Promise<Metadata> {
  /* A passport is for signed-in members: never indexed, never unfurled. */
  return { title: getDictionary(await getLocale()).passportV2.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * A MEMBER'S PASSPORT, FOR OTHER SIGNED-IN MEMBERS.
 *
 * `/passport/<handle or account id>`. Opened from a profile's "View passport"
 * and from the card in a chat. It draws exactly what the database function
 * `passport_read` returns, which is only the lines the owner left on.
 *
 * Every refusal is one screen. Signed out is told to sign in (and sent back
 * here after). Everything else, whether the passport is off, the two of them
 * have blocked each other, or nobody has that address, is the same "not
 * available", so the page never says which. Your own address goes to your own
 * passport in settings, where the switches are.
 */
export default async function MemberPassportPage({ params }: { params: Promise<{ who: string }> }) {
  const { who } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.passportV2;
  const found = await readPassportOf(who);

  if (found.state === "self") redirect("/settings/passport");

  if (found.state === "signed-out") {
    return (
      <PageFrame title={copy.title} fallback="/around" width="narrow">
        <div>
        <EmptyState
          icon="user-verified"
          art="id-check"
          title={copy.membersOnlyTitle}
          body={copy.membersOnlyBody}
          action={
            <ButtonLink href={withNext("/sign-in", `/passport/${encodeURIComponent(who)}`)} variant="primary" size="lg">
              {copy.signIn}
            </ButtonLink>
          }
          data-testid="passport-members-only"
        />
        </div>
      </PageFrame>
    );
  }

  if (found.state === "unavailable") {
    return (
      <PageFrame title={copy.title} fallback="/around" width="narrow">
        <div>
        <EmptyState
          icon="user-verified"
          art="id-check"
          title={copy.unavailableTitle}
          body={copy.unavailableBody}
          data-testid="passport-unavailable"
        />
        </div>
      </PageFrame>
    );
  }

  const view = buildPassportView(found.facts, copy, t.socialProfile.roleLine, locale);

  /*
   * REASONS TO TRUST, ON THE PASSPORT (13 November 2026). The same dated
   * checks and the same sheets as the member's profile (one component,
   * `PersonReasons`), under the book: the counts as a row of real figures,
   * then each check with its date, then a lister's Record.
   *
   * THE OWNER'S SWITCHES WIN HERE. `passport_read` nulls every line its owner
   * switched off before the row leaves the database, so a hidden count is not
   * in `view.stats` to draw. The identity check follows the same switch: with
   * the verification line off (`tier` null), its dated row is not drawn on
   * the passport either, though the profile still carries it.
   */
  const subject = found.facts.userId;
  const lister = (found.facts.roles ?? []).some((role) => role !== "renter");
  const [checkFacts, registers, ownershipSeen, record] = await Promise.all([
    readPersonChecks(subject),
    lister ? readPersonRegisters(subject) : Promise.resolve([]),
    lister ? ownershipSeenFor(subject) : Promise.resolve(null),
    lister ? readUserRecord(subject) : Promise.resolve(null),
  ]);
  const reasonsCopy = t.trustReasons;
  const checks = personChecks(
    {
      ...checkFacts,
      ...(found.facts.tier === null ? { identitySeenAt: null } : {}),
      registers,
      ownershipSeenAt: ownershipSeen,
    },
    reasonsCopy,
    locale,
  );
  /* The book's own counts, as the stats row. A review count carries its
     average as a second cell, when there is one. */
  const stats = view.stats
    .filter((stat) => stat.figure)
    .flatMap((stat) =>
      stat.key === "reviews" && found.facts.reviewAverage
        ? [
            { key: stat.key, label: stat.label, value: stat.value },
            { key: "rating", label: reasonsCopy.person.stats.rating, value: formatRating(found.facts.reviewAverage, locale) },
          ]
        : [{ key: stat.key, label: stat.label, value: stat.value }],
    );
  const identityShown = checks.some((check) => check.kind === "personIdentity" || check.kind === "personIdentityNimc");

  return (
    <PageFrame title={copy.viewTitle.replace("{name}", view.name)} subtitle={copy.viewLede} fallback="/around" width="narrow" testId="member-passport">
      <div className="grid gap-lg pb-4xl">
        {/* The book keeps its text lines (reply time, language). Its counts
            move to the row below only when that row is drawn (two cells or
            more), and its level line gives way only to the dated identity
            row that says the same thing with its date. */}
        <PassportBook view={view} copy={copy} hideFigures={stats.length >= 2} hideLevel={identityShown} />
        <PersonReasons
          title={reasonsTitle(view.name, reasonsCopy)}
          lede={reasonsCopy.person.lede}
          stats={stats}
          checks={checks}
          labels={reasonsCopy.sheet}
          testId="passport-reasons"
        />
        <ValloRecord record={record} t={t} locale={locale} />
      </div>
    </PageFrame>
  );
}
