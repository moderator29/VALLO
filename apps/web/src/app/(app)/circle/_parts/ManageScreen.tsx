import { PageFrame } from "@/components/app/PageFrame";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { countWords } from "@/lib/features/circle/model";
import type { CommunityView, JoinRequest } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";

import { CircleEmpty } from "./CircleCards";
import { RequestDecision } from "./CircleActions";
import { CircleFace } from "./CircleFace";

/**
 * JOIN REQUESTS FOR A PRIVATE COMMUNITY, DRAWN (the page reads and checks
 * the viewer runs it; RLS shows nobody else any request). One row a person:
 * their face and name, when they asked, Accept or Decline.
 */
export function ManageScreen({
  community,
  requests,
  now,
  fallback,
}: {
  community: CommunityView;
  requests: JoinRequest[];
  now: number;
  fallback?: string;
}) {
  const M = CIRCLE_COPY.manage;
  return (
    <PageFrame title={CIRCLE_COPY.community.manage} subtitle={community.name} fallback={fallback ?? `/circle/c/${community.slug}`} width="narrow">
      <div className="nf-circle" data-testid="circle-manage">
        {requests.length === 0 ? (
          <CircleEmpty icon="users">{CIRCLE_COPY.empty.requests}</CircleEmpty>
        ) : (
          <section className="nf-circle-section" aria-labelledby="circle-requests-title">
            <div className="nf-circle-section__head">
              <h2 id="circle-requests-title" className="nf-circle-section__title">
                {countWords(requests.length, M.waiting[0], M.waiting[1])}
              </h2>
            </div>
            <ul className="nf-crequests" data-testid="circle-requests">
              {requests.map((r) => (
                <li key={r.userId} className="nf-crequest">
                  <CircleFace author={r.author} />
                  <span className="nf-crequest__who">
                    <span className="nf-crequest__name">{r.author?.label ?? "Member"}</span>
                    <span className="nf-crequest__when">
                      {M.asked} {agoShort(r.at, { now })}
                    </span>
                  </span>
                  <RequestDecision communityId={community.id} userId={r.userId} slug={community.slug} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="nf-circle-note">
          <UiIcon name="shield-check" size={16} />
          <span>{M.note}</span>
        </p>
      </div>
    </PageFrame>
  );
}
