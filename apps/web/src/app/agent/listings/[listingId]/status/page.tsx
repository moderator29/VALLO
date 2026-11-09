import { RevokeDoor } from "./RevokeDoor";
import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";
import { readStatusKit } from "@/lib/share/status-queries";
import { ListingPitch } from "../../../list/ListingPitch";
import { StatusShare } from "./StatusShare";

export const metadata: Metadata = {
  title: "Share to Status",
  robots: { index: false, follow: false },
};

/**
 * `/agent/listings/<id>/status` (V-71): THE STATUS KIT.
 *
 * The honest answer to "why would a good agent choose Vallo over WhatsApp":
 * they do not have to choose. Their Status is their shop window; this gives
 * them a 9:16 picture of the listing in the Vallo register (area never the
 * address, the move-in total, beds, power and water in words, the code) and
 * their OWN link, the share door they minted. Renters who first come through
 * that link and later enquire are credited to them, and they see their own
 * numbers here and nowhere else.
 *
 * States: the pitch (not a lister), not theirs, an example (never shared), not
 * yet published, could not read, and the kit.
 */
export default async function StatusPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.frontDoor.status;
  const read = await readStatusKit(listingId);

  if (read.state === "signed-out" || read.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={read.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (read.state !== "ready") {
    const words =
      read.state === "missing"
        ? copy.notYours
        : read.state === "example"
          ? copy.example
          : read.state === "not-live"
            ? copy.notLive
            : copy.failed;
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <EmptyState
          icon="home-search"
          title={copy.title}
          body={words}
          action={
            <ButtonLink href="/agent/listings" variant="primary">
              {copy.back}
            </ButtonLink>
          }
        />
      </AgentShell>
    );
  }

  const imagePath = `/s/${read.token}/status`;
  const stats = read.stats;
  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={null} chromeBack={false}>
      {/* The frame's header carries the one way back (Grade 1 page frame). */}
      <PageFrame title={copy.title} subtitle={copy.lede} fallback="/agent/listings" width="narrow">
      <div className="flex max-w-md flex-col gap-group" data-testid="status-kit">
        {/* The picture itself, at phone scale. A plain img: it is a PNG the
            server draws, and the optimiser would only re-encode it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagePath}
          alt={copy.image}
          width={1080}
          height={1920}
          className="mx-auto h-auto w-full max-w-[18rem] rounded-md"
          data-testid="status-image"
        />
        <StatusShare path={read.path} imagePath={imagePath} copy={copy} />
        <p className="nf-body-sm text-[var(--nf-content-secondary)]" data-testid="status-stats">
          {stats === null
            ? copy.statsUnavailable
            : stats.opens === 0
              ? copy.statsNone
              : copy.stats.replace("{opens}", String(stats.opens)).replace("{enquiries}", String(stats.enquiries))}
        </p>
        <p className="nf-caption text-[var(--nf-content-muted)]">{copy.note}</p>
        {/* V-07 carry-over: close this door; the next load mints a new one. */}
        <RevokeDoor token={read.token} copy={copy} />
      </div>
      </PageFrame>
    </AgentShell>
  );
}
