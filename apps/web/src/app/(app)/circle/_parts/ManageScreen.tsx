import { PageFrame } from "@/components/app/PageFrame";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { countWords } from "@/lib/features/circle/model";
import type { CommunityView, JoinRequest } from "@/lib/features/circle/queries";
import { agoShort } from "@/lib/format/when";

import { CircleEmpty } from "./CircleCards";
import { CommunitySettingsForm, RequestDecision } from "./CircleActions";
import { CircleFace } from "./CircleFace";

/**
 * JOIN REQUESTS + COMMUNITY SETTINGS for the owner and moderators.
 * Requests at the top (the urgent work), settings below.
 */
export function ManageScreen({
  community,
  requests,
  now,
  role,
  fallback,
}: {
  community: CommunityView;
  requests: JoinRequest[];
  now: number;
  role: "owner" | "moderator" | "member";
  fallback?: string;
}) {
  const M = CIRCLE_COPY.manage;
  const W = CIRCLE_COPY.community;
  return (
    <PageFrame title={W.manage} subtitle={community.name} fallback={fallback ?? `/circle/c/${community.slug}`} width="narrow">
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

        <section className="nf-circle-section" aria-labelledby="circle-settings-title">
          <div className="nf-circle-section__head">
            <h2 id="circle-settings-title" className="nf-circle-section__title">{W.settingsTitle}</h2>
          </div>
          <CommunitySettingsForm
            communityId={community.id}
            slug={community.slug}
            name={community.name}
            description={community.description}
            visibility={community.visibility}
            rules={community.rules}
            isOwner={role === "owner"}
          />
        </section>

        <p className="nf-circle-note">
          <UiIcon name="shield-check" size={16} />
          <span>{M.note}</span>
        </p>
      </div>
    </PageFrame>
  );
}
