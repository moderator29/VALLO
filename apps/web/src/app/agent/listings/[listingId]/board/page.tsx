import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";
import { boardFor } from "@/lib/listings/board";
import { listingBoardIsOn, ownedBoardSubject } from "@/lib/listings/board-queries";
import { ListingPitch } from "../../../list/ListingPitch";
import { BoardPrint } from "./BoardPrint";

export const metadata: Metadata = {
  title: "TO LET board",
  robots: { index: false, follow: false },
};

/**
 * `/agent/listings/<id>/board` (V-08): "Print or paint your board".
 *
 * The board carries "TO LET", the unit's shape, "on Vallo" and the listing
 * code, and nothing else: no phone number, no address, no price, no name. The
 * square image is for a sign-writer; the A3 is printed from the browser, which
 * saves it as a PDF from its own print screen, so no PDF library is added to
 * the build for it.
 *
 * Off until the founder rules (question 12): with `feature_flags.listing_board`
 * anything but true, this page is a 404, the workspace shows no Board action,
 * and the share door does not resolve VL- codes.
 *
 * Every state is written: not signed in or not an agent (the pitch), a listing
 * that is not theirs or does not exist, an example (never printed), a listing
 * with no code yet (not published), a read that failed, and the board itself.
 */
export default async function BoardPage({ params }: { params: Promise<{ listingId: string }> }) {
  if (!(await listingBoardIsOn())) notFound();
  const { listingId } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.frontDoor.board;
  const owned = await ownedBoardSubject(listingId);

  if (owned.state === "signed-out" || owned.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={owned.state === "not-agent"} />
      </AgentShell>
    );
  }

  const back = (
    <ButtonLink href="/agent/listings" variant="primary">
      {copy.back}
    </ButtonLink>
  );

  if (owned.state !== "ready") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <EmptyState
          icon="home-search"
          title={owned.state === "missing" ? copy.missing : t.frontDoor.door.unreachableTitle}
          body={owned.state === "missing" ? copy.missingBody : t.frontDoor.door.unreachableBody}
          action={back}
        />
      </AgentShell>
    );
  }

  const verdict = boardFor(owned.subject, copy);
  if (verdict.state !== "ready") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/listings" profile={null}>
        <EmptyState
          icon="doc-home"
          title={verdict.state === "example" ? copy.example : copy.notYet}
          body={verdict.state === "example" ? copy.exampleBody : copy.notYetBody}
          action={back}
        />
      </AgentShell>
    );
  }

  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={null} chromeBack={false}>
      <PageFrame title={copy.title} subtitle={copy.lede} fallback="/agent/listings" width="narrow">
        <div>
          <BoardPrint listingId={listingId} lines={verdict.lines} copy={copy} />
        </div>
      </PageFrame>
    </AgentShell>
  );
}
