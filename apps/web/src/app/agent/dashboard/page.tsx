import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { AgentShell } from "@/components/agent/AgentShell";
import {
  agentProfileFrom,
  getAgentContext,
  readAgentNumbers,
} from "@/lib/agent/listings-queries";
import { RealDashboard } from "./RealDashboard";
import { readRequestSeries } from "./request-series";
import { loadAgentDash, loadOwnerDash } from "./dashboard-data";
import { DeskFigure } from "@/components/workspace/DeskFigure";
import { StillAvailableCard } from "@/components/agent/StillAvailableCard";
import { readLiveFreshness } from "@/lib/agent/freshness-read";
import { daysSinceConfirmed, dueForConfirmation } from "@/lib/agent/freshness";
import { KycBanner } from "@/components/agent/KycBanner";
import { PasscodeOffer } from "@/components/passcode/PasscodeOffer";
import { getKycStanding } from "@/lib/agent/kyc-standing";
import { readInspectionsForLister } from "@/lib/inspections/queries";
import { ButtonLink } from "@/components/ui/Button";
import { SUPPLY_DOOR_HREF } from "@/components/agent/agent-doors";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { withNext } from "@/lib/auth/next-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.dashboard.title, robots: { index: false, follow: false } };
}

/**
 * The agent workspace.
 *
 * A signed-in approved agent sees their own numbers, read live under RLS.
 *
 * NOBODY ELSE SEES NUMBERS AT ALL, and that is the whole of this change. This
 * screen used to fall back to a deck of invented figures for every other
 * caller: 845,060,000 kobo of earnings, 248 bookings, a 98% response rate, an
 * eighteen point sparkline, four listings called Oceanview 3BR Apartment and
 * Victoria Island Luxury Stay, and three guest messages from John D., Maryam
 * S. and Tunde A. A badge above it read "Designed figures", and the file that
 * held them had already worked out why that is not enough: it says, about the
 * agent's own name, that identity is the one thing a label cannot rescue. It
 * was right, and it applied the reasoning to the agent while leaving three
 * invented guests and their messages on the same screen.
 *
 * The catalogue of twenty-three invented listings was deleted for the same
 * reason. This was the same thing in the workspace nobody had opened yet.
 *
 * So there are three honest answers and no fourth. Signed out: this is what
 * the workspace is, here is the way in. Signed in without an agent row: you
 * have no listings yet, here is how to start. Unconfigured: say so plainly.
 */
/** The request's moment, read once, outside render proper (as the console does). */
function requestTime(): number {
  return Date.now();
}

export default async function AgentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const a = t.agent.dashboard;

  const context = await getAgentContext();
  if (context.state === "agent") {
    /* The workspace's first run (north star 14.1, D11): once, for an agent,
       before anything is read. Fails towards drawing the workspace. */
    await gateFirstRun("agent", "/agent/dashboard", await searchParams);

    /* Two independent reads, so they cost one round trip rather than two.
       On the connections this product is built for that is the difference
       between a dashboard and a wait. */
    const figureNow = new Date(requestTime());
    /* One account holds one side (`agents.role`): the cards differ, the page does not. */
    const ownerSide = context.agent.role === "owner";
    const [numbers, inspections, standing, freshness, requestRows, ownerDash] = await Promise.all([
      readAgentNumbers(context.supabase, context.agent.id, context.user.id),
      readInspectionsForLister(),
      /*
       * Where they stand on verification, on the screen they actually land on.
       *
       * It joins the same round trip as the numbers rather than blocking after
       * them: on the connections this product is built for, a third sequential
       * read is the difference between a dashboard and a wait, and that is the
       * reasoning the two above were already written to.
       */
      getKycStanding(context),
      /* C5: the live listings due a "still available?". Null until the column exists. */
      readLiveFreshness(context.supabase, context.agent.id),
      /* The figure card (reference 5): viewing requests over the last thirty days. */
      ownerSide ? Promise.resolve(null) : readRequestSeries(context.supabase, context.user.id, figureNow),
      /* The owner's units, rent paid through Vallo, leases and agreements. */
      ownerSide ? loadOwnerDash(context, figureNow) : Promise.resolve(null),
    ]);
    const now = requestTime();
    const due = freshness ? dueForConfirmation(freshness, now) : [];
    const workspace =
      ownerSide && ownerDash
        ? ({ role: "owner", view: ownerDash.view, places: ownerDash.places } as const)
        : ({
            role: "agent",
            dash: await loadAgentDash(context, {
              now: figureNow,
              liveListings: numbers.liveListings,
              freshness,
              dueCount: freshness ? due.length : null,
            }),
          } as const);
    return (
      <AgentShell
        t={t}
        locale={locale}
        active="/agent/dashboard"
        profile={agentProfileFrom(context.agent)}
      >
        {/* P0.1: the passcode is offered, never forced. */}
        <PasscodeOffer />
        {standing ? <KycBanner standing={standing} /> : null}
        {due.length > 0 ? (
          <div className="mb-block">
            <StillAvailableCard
              items={due.map((row) => ({ id: row.id, title: row.title, days: daysSinceConfirmed(row, now) }))}
            />
          </div>
        ) : null}
        <RealDashboard
          t={t}
          locale={locale}
          displayName={context.agent.displayName}
          numbers={numbers}
          inspections={inspections}
          figure={<DeskFigure rows={requestRows} kind="viewings" t={t} locale={locale} now={figureNow} />}
          workspace={workspace}
          now={figureNow}
        />
      </AgentShell>
    );
  }

  /*
   * What each caller is actually told. One sentence about where they stand and
   * one thing to do about it, which is the same standard every other empty
   * state on this platform is held to.
   */
  const state =
    context.state === "unconfigured"
      ? {
          title: a.unconfiguredTitle,
          body: a.unconfiguredBody,
          href: "/",
          cta: t.common.back,
        }
      : context.state === "signed-out"
        ? { title: a.signedOutTitle, body: a.signedOutBody, href: withNext("/sign-in", "/agent/dashboard"), cta: t.common.signIn }
        : {
            title: a.notAgentTitle,
            body: a.notAgentBody,
            /* The workspace chooser (owner, agent or firm), not the owner
               form: a signed-in member here may be any of the three, and
               sending an agent to "Register as an owner" was UX-11. */
            href: SUPPLY_DOOR_HREF,
            cta: a.applyCta,
          };

  return (
    <AgentShell t={t} locale={locale} active="/agent/dashboard" profile={null}>
      <div className="mx-auto max-w-lg py-section text-center">
        <IconPlate size="lg" tone="brand" className="mx-auto">
          <UiIcon name="briefcase" size={24} />
        </IconPlate>

        <h1 className="nf-h2 mt-heading">{state.title}</h1>
        <p className="nf-lede mx-auto mt-row max-w-[44ch]">
          {state.body}
        </p>
        <ButtonLink href={state.href} variant="primary" size="lg" className="mt-block">
          {state.cta}
        </ButtonLink>

        {/*
          The four things this workspace does, named rather than mocked up. A
          list of what is here is honest at nought listings and still honest at
          a hundred; a chart of numbers nobody earned is neither.
        */}
        <ul className="mt-section-tight grid gap-row text-left sm:grid-cols-2">
          {(
            [
              { icon: "plus", label: a.addListing, href: "/agent/list" },
              { icon: "calendar-check", label: a.viewBookings, href: "/agent/bookings" },
              { icon: "house", label: a.manageListings, href: "/agent/listings" },
              { icon: "wallet", label: a.earningsReport, href: "/agent/earnings" },
            ] as { icon: UiIconName; label: string; href: string }[]
          ).map((quick) => (
            <li key={quick.href}>
              <Link
                href={quick.href}
                className="nf-panel nf-panel--card nf-card--interactive flex flex-row items-center gap-row p-card-sm"
              >
                {/* The quick link's plated glyph (plate v2): a flat neutral
                    square, the family every row and card on the platform
                    uses, not a glass object. */}
                <IconPlate size="sm" className="shrink-0">
                  <UiIcon name={quick.icon} size={20} />
                </IconPlate>
                <span className="nf-body-sm font-semibold">{quick.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AgentShell>
  );
}
