import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { AgentShell } from "@/components/agent/AgentShell";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { getOwnLadder } from "@/lib/agent/verification-queries";
import { ListingPitch } from "../list/ListingPitch";
import { SuccessFromFlag } from "@/components/ui/SuccessFromFlag";
import { approvedRecently } from "@/lib/ui/recent-approval";
import { TIER_NAME, VERIFICATION_ORDER } from "@/lib/trust/verification";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { TrustTierFan } from "@/components/app/artefact/TrustTierFan";
import { Ladder, Standing } from "./VerificationLadder";

/**
 * /agent/verification: where this agent stands, and what the next rung wants.
 *
 * This was an `AgentComingSoon` stub, and the gap it left was not cosmetic. The
 * ladder behind it has existed and worked for a while: four rungs in
 * `agent_verification_checks`, a tier derived by `private.agent_tier`, and an
 * admin console that awards them. What did not exist was any way for the person
 * being judged to see the judgement. A host climbing the one ladder that decides
 * how much of the platform they can use had to be told over the phone, and a
 * host whose rung was FAILED had no way at all to learn why.
 *
 * Three things this page will not do, each of which was the tempting version:
 *
 * 1. **It does not invent a submission flow.** There is no "upload your ID
 *    here" control, because nothing behind this page accepts one: the evidence
 *    for every rung already arrived with the application, and a rung is a
 *    decision a member of staff records after looking at it. A button that
 *    posted a document nowhere would be a worse lie than silence.
 * 2. **It does not recompute the tier.** `private.agent_tier` owns that, gaps
 *    and all, and a second implementation here would eventually disagree with
 *    the badge on the agent's own listings.
 * 3. **It does not soften a failure.** A failed rung says failed, in the same
 *    weight as a passed one, with the reviewer's note in full underneath.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.verification, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/verification" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/verification" profile={null}>
        <div className="mx-auto max-w-md py-10 text-center">
          <IconPlate size="lg">
            <UiIcon name="shield-check" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-5">{t.agent.nav.verification}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            {t.agentBookings.unconfigured}
          </p>
        </div>
      </AgentShell>
    );
  }

  /* The ladder's first run (north star 14.1): what each check looks at and
     that a person decides it, once, before the ladder is read. */
  await gateFirstRun("verification", "/agent/verification", await searchParams);

  const read = await getOwnLadder(context);

  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/verification"
      profile={agentProfileFrom(context.agent)}
    >
      <div className="mb-lg">
        <h1 className="nf-h1">{t.agent.nav.verification}</h1>
        <p className="mt-2xs max-w-[60ch] text-[var(--nf-content-secondary)]">
          Four checks, in order. Each one you pass is shown to guests on every
          listing you have, and none of them is a fee.
        </p>
      </div>

      {read.state === "unavailable" ? (
        /* An honest absence rather than an empty ladder. Drawing four "not
           checked yet" rungs from a failed read would tell an agent who has
           passed three that they have passed none. */
        <p className="nf-panel nf-panel--card block p-panel text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
          Your checks could not be loaded just now. Nothing has changed, and
          reloading usually settles it.
        </p>
      ) : (
        <>
          {/* THE TIERS AS CREDENTIALS (north star 14.4, D14): each tier the
              ladder defines is something held or not yet, in the ladder's own
              words, and the stack is how an agent picks one up to read it. It
              opens on the tier they hold; "Held" is the database's tier. */}
          <section className="mb-lg">
            <TrustTierFan
              tiers={VERIFICATION_ORDER.map((rung) => ({
                step: rung.step,
                name: TIER_NAME[rung.step],
                meaning: rung.meaning,
                held: read.ladder.tier >= rung.step,
              }))}
              current={read.ladder.tier}
              copy={{
                selector: t.experienceFeatures.trustTiers.selector,
                position: t.experienceFeatures.artefact.position,
                tier: t.experienceFeatures.trustTiers.tier,
                held: t.experienceFeatures.trustTiers.held,
                notYet: t.experienceFeatures.trustTiers.notYet,
              }}
            />
          </section>
          <div className="grid gap-lg lg:grid-cols-[1fr_20rem]">
            <div className="lg:order-2">
              <Standing tier={read.ladder.tier} />
            </div>
            {/* Where the reviewer's decision notice lands. The same key as
                /verification, so a level is celebrated once on this device
                whichever door it is seen through (docs/SUCCESS_MOMENTS.md). */}
            <SuccessFromFlag
              copy={t.success}
              show={read.ladder.tier > 0 && approvedRecently(Object.values(read.ladder.rungs), requestNow())}
              moment="verificationApproved"
              seenKey={`verification-approved:tier-${read.ladder.tier}`}
              haptic={false}
            />
            <div className="lg:order-1">
              <Ladder ladder={read.ladder} />
            </div>
          </div>
        </>
      )}
    </AgentShell>
  );
}

