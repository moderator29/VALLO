"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InterestSheet } from "@/components/roommates/Actions";
import { fill } from "@/components/roommates/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { answerInterest, inviteToGroup, openRoommateChat, withdrawInterest } from "@/lib/features/roommates/actions";
import { ROOMMATES_ROUTES, type ConnectionState } from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Result = { ok: true } | { ok: false; error: string };

/**
 * THE ONE ACTION ON A ROOMMATE PROFILE, by the connection between the two
 * people: interested (a sheet with an optional note), waiting (withdraw),
 * asked (accept or decline, and a quiet celebration when they connect),
 * connected (message, invite to a group). Your own profile: edit it.
 */
export function ProfileActions({
  userId,
  name,
  isSelf,
  connection,
  groups,
}: {
  userId: string;
  name: string;
  isSelf: boolean;
  connection: ConnectionState;
  groups: { id: string; name: string }[];
}) {
  const t = useScopedCopy("roommates");
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>(connection);
  const [celebrate, setCelebrate] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, start] = useSafeTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const first = name.split(" ")[0] ?? name;

  const run = (key: string, task: () => Promise<Result>) =>
    start(async () => {
      setBusy(key);
      try {
        const result = await task();
        if (!result.ok) {
          feedback("error");
          banner.error(result.error, { retry: () => run(key, task) });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      } finally {
        setBusy(null);
      }
    });

  if (isSelf) {
    return (
      <div className="nf-rmv-act" data-testid="profile-actions">
        <p className="nf-rmv-act__line">{t.ui.profile.selfNote}</p>
        <ButtonLink href={ROOMMATES_ROUTES.profile} variant="primary" size="lg" full leadingIcon="pencil">
          {t.profile.edit}
        </ButtonLink>
      </div>
    );
  }

  const message = (interestId: string, conversationId: string | null) =>
    run("chat", async () => {
      if (conversationId) {
        router.push(`/messages/${conversationId}`);
        return { ok: true };
      }
      const result = await openRoommateChat(interestId);
      if (!result.ok) return result;
      feedback("confirm");
      router.push(`/messages/${result.data.conversationId}`);
      return { ok: true };
    });

  return (
    <div className="nf-rmv-act" data-testid="profile-actions" data-state={state.state}>
      {state.state === "none" ? (
        <>
          <Button variant="primary" size="lg" full leadingIcon="heart" onClick={() => setInterestOpen(true)} data-testid="profile-interested">
            {t.actions.interested}
          </Button>
          <InterestSheet
            open={interestOpen}
            onOpenChange={setInterestOpen}
            toId={userId}
            name={first}
            onSent={(id) => {
              setState({ state: "sent", interestId: id });
              router.refresh();
            }}
          />
        </>
      ) : null}

      {state.state === "sent" ? (
        <>
          <p className="nf-rmv-act__line">
            <UiIcon name="hourglass" size={16} />
            {t.connection.sent}
          </p>
          <Button
            variant="secondary"
            size="md"
            full
            loading={pending && busy === "withdraw"}
            data-testid="profile-withdraw"
            onClick={() =>
              run("withdraw", async () => {
                const result = await withdrawInterest(state.interestId);
                if (!result.ok) return result;
                feedback("confirm");
                banner.info(t.ui.profile.withdrawn);
                setState({ state: "none" });
                router.refresh();
                return { ok: true };
              })
            }
          >
            {t.actions.withdraw}
          </Button>
        </>
      ) : null}

      {state.state === "received" ? (
        <>
          <p className="nf-rmv-act__line nf-rmv-act__line--strong">{fill(t.connection.received, { name: first })}</p>
          {state.note ? <blockquote className="nf-rmv-act__note">{state.note}</blockquote> : null}
          <div className="nf-rmv-act__pair">
            <Button
              variant="secondary"
              size="lg"
              full
              loading={pending && busy === "decline"}
              disabled={pending}
              data-testid="profile-decline"
              onClick={() =>
                run("decline", async () => {
                  const result = await answerInterest({ id: state.interestId, accept: false });
                  if (!result.ok) return result;
                  feedback("confirm");
                  banner.info(t.ui.profile.declinedBanner);
                  setState({ state: "declined" });
                  router.refresh();
                  return { ok: true };
                })
              }
            >
              {t.actions.decline}
            </Button>
            <Button
              variant="primary"
              size="lg"
              full
              morph
              loading={pending && busy === "accept"}
              disabled={pending}
              data-testid="profile-accept"
              onClick={() =>
                run("accept", async () => {
                  const result = await answerInterest({ id: state.interestId, accept: true });
                  if (!result.ok) return result;
                  feedback("confirm");
                  banner.success(t.ui.profile.accepted);
                  setState({ state: "connected", interestId: state.interestId, conversationId: null });
                  setCelebrate(true);
                  router.refresh();
                  return { ok: true };
                })
              }
            >
              {t.actions.accept}
            </Button>
          </div>
        </>
      ) : null}

      {state.state === "connected" ? (
        <>
          {celebrate ? (
            <div className="nf-rmv-celebrate" role="status" data-testid="profile-celebrate">
              <span className="nf-rmv-celebrate__mark" aria-hidden="true">
                <UiIcon name="check" size={28} />
              </span>
              <p className="nf-rmv-celebrate__title">{fill(t.connection.celebrate, { name: first })}</p>
              <p className="nf-rmv-celebrate__body">{t.connection.next}</p>
            </div>
          ) : (
            <p className="nf-rmv-act__line">
              <UiIcon name="circle-check" size={16} filled />
              {t.connection.accepted}
            </p>
          )}
          <Button variant="primary" size="lg" full leadingIcon="chat-bubble" loading={pending && busy === "chat"} onClick={() => message(state.interestId, state.conversationId)} data-testid="profile-message">
            {celebrate ? t.connection.startChat : t.actions.message}
          </Button>
          <Button variant="secondary" size="md" full leadingIcon="circle-people" onClick={() => setInviteOpen(true)} data-testid="profile-invite">
            {t.actions.inviteToGroup}
          </Button>
          <Sheet open={inviteOpen} onOpenChange={setInviteOpen} title={t.actions.inviteToGroup} description={t.connection.findTogether} closeLabel={t.ui.flow.close} detents={[0.6]}>
            {groups.length ? (
              <ul className="nf-rmv-picklist">
                {groups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="nf-rmv-pick"
                      disabled={pending}
                      onClick={() =>
                        run(`invite-${g.id}`, async () => {
                          const result = await inviteToGroup({ groupId: g.id, userId });
                          if (!result.ok) return result;
                          feedback("confirm");
                          banner.success(`${t.groups.invite}: ${g.name}`);
                          setInviteOpen(false);
                          return { ok: true };
                        })
                      }
                    >
                      <span className="nf-rm-plate" aria-hidden="true">
                        <UiIcon name="circle-people" size={20} />
                      </span>
                      <span className="nf-rmv-pick__name">{g.name}</span>
                      <UiIcon name={busy === `invite-${g.id}` ? "hourglass" : "plus"} size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="nf-rmv-picknone">
                <p className="nf-rm-panel__sub">{t.ui.profile.noGroups}</p>
                <ButtonLink href={ROOMMATES_ROUTES.newGroup} variant="primary" size="md" leadingIcon="plus">
                  {t.groups.create}
                </ButtonLink>
              </div>
            )}
          </Sheet>
        </>
      ) : null}

      {state.state === "declined" ? (
        <p className="nf-rmv-act__line">
          <UiIcon name="info" size={16} />
          {t.connection.declined}
          <Link href={ROOMMATES_ROUTES.discover} className="nf-rmv-act__link">
            {t.ui.findRoommate}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
