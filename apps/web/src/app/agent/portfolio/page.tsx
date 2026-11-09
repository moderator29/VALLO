import type { Metadata } from "next";
import { formatDate, formatMoney, getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { ListingPitch } from "../list/ListingPitch";
import { groupByPlace } from "@/lib/landlord/portfolio";
import { readMandateBriefs, readMyBuildings, readPitchesFor } from "@/lib/landlord/portfolio-queries";
import { AwardButton, InviteForm, PitchForm, WithdrawButton } from "./PortfolioControls";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { portfolioInviteArrival } from "@/lib/ui/arrival-moments";
import { readDone } from "@/lib/ui/success-moments";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.landlord.portfolio.metaTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

function day(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDate(date, locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
}

/**
 * /agent/portfolio: V-42. THE OWNER'S BUILDINGS, AND AGENTS PITCHING FOR THE
 * MANDATE.
 *
 * Two halves, each drawn only when it has something in it. An owner sees every
 * unit they list as its owner, grouped by place: let until when and for how
 * much, who else lists the same flat, whom they gave the mandate, and for a
 * unit that is not let, one form to invite verified agents to pitch. A
 * verified agent sees the owners in places they already list in who are
 * choosing an agent, and answers with a note; the owner reads it beside the
 * agent's record on Vallo. Nothing here ever shows an address.
 */
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string | string[]; listing?: string | string[] }>;
}) {
  const query = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.landlord.portfolio;
  const context = await getAgentContext();

  if (context.state !== "agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/portfolio" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  const [units, briefs] = await Promise.all([readMyBuildings(), readMandateBriefs()]);
  /* THE OWNER'S FIRST RUN (north star 14.1, R3-12): once, and only for
     somebody who lists at least one unit as its owner, since it explains
     their buildings. An agent with only briefs to answer is never sent, and
     neither is an arrival carrying a done flag, which the gate would drop. */
  if ((units?.length ?? 0) > 0 && query.done === undefined) await gateFirstRun("portfolio", "/agent/portfolio", query);
  const open = (units ?? []).flatMap((u) => (u.invitationId && u.pitchCount > 0 ? [u.invitationId] : []));
  const pitches = await readPitchesFor(open);
  const groups = groupByPlace(units ?? []);
  const nothing = (units?.length ?? 0) === 0 && (briefs?.length ?? 0) === 0;
  const listingParam = Array.isArray(query.listing) ? query.listing[0] : query.listing;
  const invited = portfolioInviteArrival(units ?? [], readDone(query.done), listingParam);

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/portfolio"
      profile={agentProfileFrom(context.agent)}
      /* The frame's header carries the one way back (Grade 1 page frame). */
      chromeBack={false}
    >
      {/* Rendered unconditionally, `show` deciding: it latches what it says
          when it opens, so stripping the flag cannot take it away. */}
      <SuccessFromFlag
        copy={t.success}
        show={invited !== null}
        moment="agentsInvited"
        values={invited?.values}
        strip={["listing"]}
      />
      <PageFrame title={copy.title} subtitle={copy.lede} fallback="/agent/dashboard">
      <div className="max-w-2xl space-y-lg">
        {units === null && briefs === null && (
          <p role="status" className="text-[var(--nf-content-secondary)]">
            {copy.readFailed}
          </p>
        )}

        {nothing && units !== null && (
          <div className="nf-panel nf-panel--card p-panel" data-testid="portfolio-empty">
            <p className="nf-body font-semibold">{copy.emptyTitle}</p>
            <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">{copy.emptyBody}</p>
          </div>
        )}

        {groups.length > 0 && (
          <section aria-labelledby="buildings-title" data-testid="portfolio-buildings">
            <h2 id="buildings-title" className="nf-h3">
              {copy.buildingsTitle}
            </h2>
            <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{copy.buildingsLede}</p>
            <div className="mt-md space-y-md">
              {groups.map((group) => (
                <div key={group.place}>
                  <p className="nf-overline">{group.place}</p>
                  <ul className="mt-xs space-y-sm">
                    {group.units.map((unit) => {
                      const shape = [unit.bedrooms ? `${unit.bedrooms} bedroom` : null, unit.propertyType?.replace(/_/g, " ")]
                        .filter(Boolean)
                        .join(" ");
                      const unitPitches = unit.invitationId ? (pitches.get(unit.invitationId) ?? []) : [];
                      return (
                        <li key={unit.listingId} className="nf-panel nf-panel--card p-panel" data-testid="portfolio-unit">
                          <p className="font-semibold text-[var(--nf-content-primary)]">{shape}</p>
                          <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                            {unit.letState === "let"
                              ? unit.tenancyEndsOn
                                ? copy.let.replace("{date}", day(unit.tenancyEndsOn, locale))
                                : copy.letNoDate
                              : copy.vacant}
                            {unit.letState === "let" && unit.achievedRentMinor !== null && unit.rentPeriod && (
                              <>
                                {" · "}
                                {copy.achieved
                                  .replace("{amount}", formatMoney(unit.achievedRentMinor, locale))
                                  .replace("{period}", copy.period[unit.rentPeriod])}
                              </>
                            )}
                          </p>
                          {unit.otherListers.length > 0 && (
                            <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                              {copy.alsoListed.replace("{names}", unit.otherListers.join(", "))}
                            </p>
                          )}
                          {unit.mandateHolders.length > 0 && (
                            <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)]">
                              {copy.mandateTo.replace("{names}", unit.mandateHolders.join(", "))}
                            </p>
                          )}

                          {unit.invitationId ? (
                            <div className="mt-sm border-t border-[var(--nf-border-subtle)] pt-sm">
                              <p className="text-[length:var(--nf-text-body-sm)] font-semibold">
                                {(unit.invitationStatus === "awarded" ? copy.invitationAwarded : copy.invitationOpen).replace(
                                  "{n}",
                                  String(unit.pitchCount),
                                )}
                              </p>
                              {unitPitches.length === 0 ? (
                                <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{copy.pitchesNone}</p>
                              ) : (
                                <ul className="mt-xs space-y-sm">
                                  {unitPitches.map((pitch) => (
                                    <li key={pitch.pitchId} className="rounded-[var(--nf-container-radius)] border border-[var(--nf-border-subtle)] p-sm">
                                      <p className="font-semibold text-[var(--nf-content-primary)]">
                                        {pitch.agentName}
                                        {pitch.verifiedTier > 0 && (
                                          <span className="nf-badge nf-badge--brand ml-xs align-middle">{copy.pitchVerified}</span>
                                        )}
                                      </p>
                                      <p className="nf-numeric mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                                        {copy.pitchRecord
                                          .replace("{lets}", String(pitch.letsThroughVallo))
                                          .replace("{live}", String(pitch.liveListings))
                                          .replace("{since}", day(pitch.onValloSince, locale))}
                                      </p>
                                      <p className="mt-xs whitespace-pre-line text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                                        {pitch.note}
                                      </p>
                                      <div className="mt-xs">
                                        {pitch.awardedAt ? (
                                          <span className="nf-badge nf-badge--brand">{copy.awarded}</span>
                                        ) : (
                                          <AwardButton pitchId={pitch.pitchId} copy={copy} />
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {unit.invitationStatus === "open" && (
                                <div className="mt-xs">
                                  <WithdrawButton invitationId={unit.invitationId} copy={copy} />
                                </div>
                              )}
                            </div>
                          ) : unit.letState === "vacant" ? (
                            <div className="mt-sm border-t border-[var(--nf-border-subtle)] pt-sm">
                              <InviteForm listingId={unit.listingId} place={unit.place} copy={copy} />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {briefs && briefs.length > 0 && (
          <section aria-labelledby="briefs-title" data-testid="portfolio-briefs">
            <h2 id="briefs-title" className="nf-h3">
              {copy.briefsTitle}
            </h2>
            <p className="mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{copy.briefsLede}</p>
            <ul className="mt-md space-y-sm">
              {briefs.map((brief) => (
                <li key={brief.invitationId} className="nf-panel nf-panel--card p-panel" data-testid="portfolio-brief">
                  <p className="font-semibold text-[var(--nf-content-primary)]">
                    {copy.briefLine
                      .replace("{beds}", String(brief.bedrooms ?? ""))
                      .replace("{type}", (brief.propertyType ?? "").replace(/_/g, " "))
                      .replace("{place}", brief.place)}
                  </p>
                  <p className="nf-numeric mt-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                    {copy.briefBand
                      .replace("{min}", formatMoney(brief.askingMinMinor, locale))
                      .replace("{max}", formatMoney(brief.askingMaxMinor, locale))
                      .replace("{period}", copy.period[brief.rentPeriod])}
                  </p>
                  <p className="mt-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                    {copy.briefExpires.replace("{date}", day(brief.expiresAt, locale))}
                  </p>
                  {brief.awarded ? (
                    <p role="status" className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-state-success)]">
                      {copy.youHaveIt}
                    </p>
                  ) : brief.pitched ? (
                    <p className="mt-sm text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">{copy.pitched}</p>
                  ) : (
                    <PitchForm invitationId={brief.invitationId} copy={copy} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      </PageFrame>
    </AgentShell>
  );
}
