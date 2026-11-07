import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { readCommunity, readJoinRequests } from "@/lib/features/circle/queries";
import { agoShort, requestNow } from "@/lib/format/when";

import { CircleEmpty } from "../../../_parts/CircleCards";
import { RequestDecision } from "../../../_parts/CircleActions";

export const metadata: Metadata = { title: "Join requests" };
export const dynamic = "force-dynamic";

/** Join requests for a private community, for its owner and moderators only (RLS shows nobody else any). */
export default async function ManageCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await readCommunity(slug);
  if (!page) notFound();
  if (!page.signedIn) redirect(`/sign-in?next=/circle/c/${slug}/manage`);
  const runner = page.membership?.status === "active" && (page.membership.role === "owner" || page.membership.role === "moderator");
  if (!runner) redirect(`/circle/c/${slug}`);
  const requests = await readJoinRequests(page.community.id);
  const now = requestNow();
  return (
    <PageFrame title={CIRCLE_COPY.community.manage} subtitle={page.community.name} fallback={`/circle/c/${slug}`} width="narrow">
      {requests.length === 0 ? (
        <CircleEmpty>No one is waiting to join.</CircleEmpty>
      ) : (
        <ul className="nf-circle-list" data-testid="circle-requests">
          {requests.map((r) => (
            <li key={r.userId} className="nf-circle-reply">
              <span className="nf-circle-card__title">{r.author?.label ?? "Member"}</span>
              <span className="nf-circle-card__meta">{agoShort(r.at, { now })}</span>
              <RequestDecision communityId={page.community.id} userId={r.userId} slug={slug} />
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
