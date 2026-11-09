"use client";

import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import type { CircleInviteView } from "@/lib/features/circle/queries";
import { State } from "@/components/ui/State";

import { InviteActions } from "./CircleActions";

export function InviteList({ invites }: { invites: CircleInviteView[] }) {
  if (invites.length === 0) return null;
  const words = CIRCLE_COPY.invite;
  return (
    <section className="nf-circle-section" data-testid="circle-invites">
      <h2 className="nf-circle-section__title">{words.title}</h2>
      <ul className="nf-circle-list">
        {invites.map((inv) => (
          <li key={inv.id} className="nf-circle-list__item">
            <div className="min-w-0 flex-1">
              <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">
                {inv.communityName}
              </p>
              {inv.inviter && (
                <p className="nf-caption text-[var(--nf-content-secondary)]">
                  {words.from} {inv.inviter.label}
                </p>
              )}
            </div>
            <InviteActions inviteId={inv.id} isMine={inv.isMine} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SentInviteList({ invites }: { invites: CircleInviteView[] }) {
  const words = CIRCLE_COPY.invite;
  return (
    <section className="nf-circle-section" data-testid="circle-sent-invites">
      <h2 className="nf-circle-section__title">{words.sent}</h2>
      {invites.length === 0 ? (
        <State compact kind="empty" icon="user-check" title={words.sentEmpty} />
      ) : (
        <ul className="nf-circle-list">
          {invites.map((inv) => (
            <li key={inv.id} className="nf-circle-list__item">
              <div className="min-w-0 flex-1">
                <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">
                  {inv.invitee?.label ?? "Member"}
                </p>
                <p className="nf-caption text-[var(--nf-content-secondary)]">
                  {inv.status === "pending" ? words.pending : inv.status}
                </p>
              </div>
              {inv.status === "pending" && (
                <InviteActions inviteId={inv.id} isMine />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
