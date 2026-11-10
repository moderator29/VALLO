"use client";

import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { ConfirmSheet as PlatformConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import {
  answerGroupInvite,
  answerInterest,
  answerRoommateViewing,
  cancelRoommateViewing,
  deleteRoommateListing,
  deleteRoommateSearch,
  endConnection,
  inviteToGroup,
  markRoommateViewingDone,
  openRoommateChat,
  setRoommateListingStatus,
  setRoommateProfileStatus,
  setRoommateSearchAlert,
  shareRoommateListingToFeed,
  withdrawInterest,
} from "@/lib/features/roommates/actions";
import { ROOMMATES_ROUTES, type ListingStatus, type PersonRef, type ViewingStatus } from "@/lib/features/roommates/model";
import { useScopedCopy } from "@/lib/i18n/copy-scope";

import { Face, fill } from "../../groups/_parts/kit";
import { useRun } from "../../groups/_parts/use-run";

/**
 * THE HUB'S CONTROLS (FE-B). Every one waits for the server and says its
 * outcome in the banner; a destructive one asks first in a Sheet; accepting a
 * request or a group invitation opens the founder's "New invite" card: the
 * person, one sentence, Cancel and Accept.
 */

export function ProfileStatusActions({ status }: { status: "active" | "paused" }) {
  const X = useScopedCopy("roommates").hubX.profile;
  const { pending, run } = useRun();
  const next = status === "active" ? "paused" : "active";
  return (
    <Button
      variant="quiet"
      size="sm"
      loading={pending}
      data-testid="rm-hub-profile-toggle"
      onClick={() => run(() => setRoommateProfileStatus(next), { success: next === "paused" ? X.paused : X.resumed, undo: () => setRoommateProfileStatus(status) })}
    >
      {status === "active" ? X.pause : X.resume}
    </Button>
  );
}

/** The founder's centred invite card: the person, the sentence, Cancel and Accept. */
function InviteCard({
  open,
  onOpenChange,
  title,
  person,
  line,
  note,
  noteLabel,
  acceptLabel,
  cancelLabel,
  pending,
  onAccept,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  person: Pick<PersonRef, "name" | "avatarUrl"> | null;
  line: string;
  note?: string | null;
  noteLabel?: string;
  acceptLabel: string;
  cancelLabel: string;
  pending: boolean;
  onAccept: () => void;
  testId: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} card testId={testId}>
      <div className="nf-rmh-invite">
        <Face person={person} size="lg" />
        <p className="nf-rmh-invite__line">{line}</p>
        {note ? (
          <p className="nf-rmh-invite__note">
            <span className="sr-only">{noteLabel}: </span>
            {note}
          </p>
        ) : null}
        <div className="nf-rmh-invite__buttons">
          <Button variant="secondary" size="md" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="md" loading={pending} onClick={onAccept} data-testid={`${testId}-accept`}>
            {acceptLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** A yes-or-no question before something that cannot be undone: the platform's ConfirmSheet, with this area's prop names. */
function ConfirmSheet({
  open,
  onOpenChange,
  title,
  line,
  yes,
  cancel,
  pending,
  onYes,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  line: string;
  yes: string;
  cancel: string;
  pending: boolean;
  onYes: () => void;
  testId: string;
}) {
  return <PlatformConfirmSheet open={open} onOpenChange={onOpenChange} title={title} line={line} confirmLabel={yes} cancelLabel={cancel} pending={pending} onConfirm={onYes} testId={testId} />;
}

export { ConfirmSheet, InviteCard };

export function RequestActions({ id, person, note }: { id: string; person: PersonRef; note: string | null }) {
  const X = useScopedCopy("roommates").hubX.requests;
  const { pending, run, router } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" disabled={pending} onClick={() => setOpen(true)} data-testid="rm-hub-accept">
        {X.accept}
      </Button>
      <Button
        variant="quiet"
        size="sm"
        loading={pending && !open}
        data-testid="rm-hub-decline"
        onClick={() => run(() => answerInterest({ id, accept: false }), { success: X.declined })}
      >
        {X.decline}
      </Button>
      <InviteCard
        open={open}
        onOpenChange={setOpen}
        title={X.inviteTitle}
        person={person}
        line={fill(X.inviteLine, { name: person.name })}
        note={note}
        noteLabel={X.inviteNote}
        acceptLabel={X.accept}
        cancelLabel={X.cancel}
        pending={pending}
        testId="rm-hub-request-card"
        onAccept={() =>
          run(() => answerInterest({ id, accept: true }), {
            success: fill(X.accepted, { name: person.name }),
            onOk: () => {
              setOpen(false);
              router.push(ROOMMATES_ROUTES.connected(id));
            },
          })
        }
      />
    </>
  );
}

export function OutgoingActions({ id }: { id: string }) {
  const X = useScopedCopy("roommates").hubX.requests;
  const { pending, run } = useRun();
  return (
    <Button variant="quiet" size="sm" loading={pending} data-testid="rm-hub-withdraw" onClick={() => run(() => withdrawInterest(id), { success: X.withdrawn })}>
      {X.withdraw}
    </Button>
  );
}

export function ConnectionActions({
  interestId,
  conversationId,
  person,
  groups,
}: {
  interestId: string;
  conversationId: string | null;
  person: PersonRef;
  groups: { id: string; name: string }[];
}) {
  const R = useScopedCopy("roommates");
  const X = R.hubX.connections;
  const chat = useRun();
  const invite = useRun();
  const end = useRun();
  const [picking, setPicking] = useState(false);
  const [ending, setEnding] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leadingIcon="chat-bubble"
        loading={chat.pending}
        data-testid="rm-hub-message"
        onClick={() => {
          if (conversationId) {
            chat.router.push(`/messages/${conversationId}`);
            return;
          }
          chat.run(() => openRoommateChat(interestId), { refresh: false, onOk: (d) => chat.router.push(`/messages/${d.conversationId}`) });
        }}
      >
        {X.message}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setPicking(true)} data-testid="rm-hub-invite-group">
        {X.invite}
      </Button>
      <Button variant="quiet" size="sm" onClick={() => setEnding(true)} data-testid="rm-hub-disconnect">
        {X.disconnect}
      </Button>
      <Sheet open={picking} onOpenChange={setPicking} title={X.pickGroup} detents={[0.6]} testId="rm-hub-group-picker">
        {groups.length === 0 ? (
          <div className="nf-rmb-empty">
            <p>{X.noGroups}</p>
            <ButtonLink href={ROOMMATES_ROUTES.newGroup} variant="primary" size="sm">
              {R.hubX.groups.start}
            </ButtonLink>
          </div>
        ) : (
          <ul className="nf-rmb-rows">
            {groups.map((g) => (
              <li key={g.id} className="nf-rmb-row">
                <span />
                <p className="nf-rmb-row__title">{g.name}</p>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={invite.pending}
                  onClick={() =>
                    invite.run(() => inviteToGroup({ groupId: g.id, userId: person.userId }), {
                      success: fill(X.invited, { name: person.name }),
                      onOk: () => setPicking(false),
                    })
                  }
                >
                  {R.groupsX.membersX.pickInvite}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <ConfirmSheet
        open={ending}
        onOpenChange={setEnding}
        title={fill(X.disconnectTitle, { name: person.name })}
        line={X.disconnectLine}
        yes={X.disconnectYes}
        cancel={R.hubX.requests.cancel}
        pending={end.pending}
        testId="rm-hub-disconnect-sheet"
        onYes={() => end.run(() => endConnection(interestId), { success: X.disconnected, onOk: () => setEnding(false) })}
      />
    </>
  );
}

export function PostActions({ id, status }: { id: string; status: ListingStatus }) {
  const R = useScopedCopy("roommates");
  const X = R.hubX.posts;
  const { pending, run } = useRun();
  const del = useRun();
  const [sure, setSure] = useState(false);
  const editable = status !== "removed";
  return (
    <>
      {editable ? (
        <ButtonLink href={ROOMMATES_ROUTES.editListing(id)} variant="secondary" size="sm" leadingIcon="pencil">
          {X.edit}
        </ButtonLink>
      ) : null}
      {status === "live" ? (
        <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => setRoommateListingStatus({ id, status: "paused" }), { success: X.pausedDone, undo: () => setRoommateListingStatus({ id, status: "live" }) })}>
          {X.pause}
        </Button>
      ) : null}
      {status === "paused" || status === "filled" || status === "expired" ? (
        <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => setRoommateListingStatus({ id, status: "live" }), { success: X.liveDone, undo: status === "paused" ? () => setRoommateListingStatus({ id, status: "paused" }) : undefined })}>
          {X.resume}
        </Button>
      ) : null}
      {status === "live" || status === "paused" ? (
        <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => setRoommateListingStatus({ id, status: "filled" }), { success: X.filledDone, undo: () => setRoommateListingStatus({ id, status: status === "paused" ? "paused" : "live" }) })}>
          {X.filled}
        </Button>
      ) : null}
      {status === "live" ? <ShareToFeed id={id} /> : null}
      <Button variant="dangerQuiet" size="sm" onClick={() => setSure(true)} data-testid="rm-hub-post-delete">
        {X.delete}
      </Button>
      <ConfirmSheet
        open={sure}
        onOpenChange={setSure}
        title={X.deleteTitle}
        line={X.deleteLine}
        yes={X.deleteYes}
        cancel={R.hubX.requests.cancel}
        pending={del.pending}
        testId="rm-hub-post-delete-sheet"
        onYes={() => del.run(() => deleteRoommateListing(id), { success: X.deleted, onOk: () => setSure(false) })}
      />
    </>
  );
}

/** Share a live post to the feed as a post with the room's card on it, with an optional line. */
function ShareToFeed({ id }: { id: string }) {
  const X = useScopedCopy("roommates").hubX.posts;
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  return (
    <>
      <Button variant="secondary" size="sm" leadingIcon="share" onClick={() => setOpen(true)} data-testid="rm-hub-share-feed">
        {X.shareFeed}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={X.shareFeedTitle}
        detents={[0.6]}
        apply={{
          label: X.shareFeedSend,
          loading: pending,
          onClick: () =>
            run(() => shareRoommateListingToFeed({ listingId: id, body }), {
              success: X.sharedFeed,
              refresh: false,
              onOk: () => {
                setBody("");
                setOpen(false);
              },
            }),
        }}
        testId="rm-hub-share-feed-sheet"
      >
        <div className="nf-rmb-field">
          <label htmlFor={`rm-share-${id}`}>{X.shareFeedField}</label>
          <textarea id={`rm-share-${id}`} value={body} maxLength={2000} placeholder={X.shareFeedPlaceholder} onChange={(e) => setBody(e.target.value)} />
        </div>
      </Sheet>
    </>
  );
}

export function GroupInviteActions({ groupId, groupName, inviter }: { groupId: string; groupName: string; inviter: PersonRef | null }) {
  const R = useScopedCopy("roommates");
  const X = R.hubX.groups;
  const { pending, run, router } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" disabled={pending} onClick={() => setOpen(true)} data-testid="rm-hub-group-accept">
        {X.accept}
      </Button>
      <Button variant="quiet" size="sm" loading={pending && !open} onClick={() => run(() => answerGroupInvite({ groupId, accept: false }), { success: X.declined })}>
        {X.decline}
      </Button>
      <InviteCard
        open={open}
        onOpenChange={setOpen}
        title={X.inviteTitle}
        person={inviter}
        line={fill(X.inviteLine, { name: inviter?.name ?? "", group: groupName })}
        acceptLabel={X.accept}
        cancelLabel={R.hubX.requests.cancel}
        pending={pending}
        testId="rm-hub-group-card"
        onAccept={() =>
          run(() => answerGroupInvite({ groupId, accept: true }), {
            success: fill(X.joined, { group: groupName }),
            refresh: false,
            onOk: () => {
              setOpen(false);
              router.push(ROOMMATES_ROUTES.group(groupId));
            },
          })
        }
      />
    </>
  );
}

/** `datetime-local` gives a wall-clock time with no zone; the browser's own offset makes it an instant. */
function toInstant(local: string): string | null {
  if (!local) return null;
  const t = new Date(local);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export function ViewingActions({ id, role, status, altAt, altLabel, past }: { id: string; role: "host" | "guest"; status: ViewingStatus; altAt: string | null; altLabel: string | null; past: boolean }) {
  const R = useScopedCopy("roommates");
  const X = R.hubX.viewings;
  const { pending, run } = useRun();
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const live = status === "requested" || status === "confirmed";
  return (
    <>
      {role === "host" && status === "requested" ? (
        <>
          <Button variant="primary" size="sm" disabled={pending} onClick={() => run(() => answerRoommateViewing({ id, confirm: true }), { success: X.confirmed })}>
            {X.confirm}
          </Button>
          {altAt ? (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => answerRoommateViewing({ id, confirm: true, at: altAt }), { success: X.confirmed })}>
              {fill(X.alt, { when: altLabel ?? "" })}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" disabled={pending} onClick={() => setMoving(true)}>
            {X.reschedule}
          </Button>
          <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => answerRoommateViewing({ id, confirm: false }), { success: X.declined })}>
            {X.decline}
          </Button>
        </>
      ) : null}
      {role === "guest" && live ? (
        <Button variant="quiet" size="sm" disabled={pending} onClick={() => run(() => cancelRoommateViewing(id), { success: X.cancelled })}>
          {X.cancel}
        </Button>
      ) : null}
      {status === "confirmed" && past ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => markRoommateViewingDone(id), { success: X.doneDone })}>
          {X.done}
        </Button>
      ) : null}
      <Sheet
        open={moving}
        onOpenChange={setMoving}
        title={X.rescheduleTitle}
        detents={[0.5]}
        apply={{
          label: X.rescheduleSend,
          loading: pending,
          onClick: () => {
            const at = toInstant(when);
            if (!at || Date.parse(at) < Date.now() + 30 * 60 * 1000) {
              setProblem(X.pickTime);
              return;
            }
            setProblem(null);
            run(() => answerRoommateViewing({ id, confirm: true, at }), { success: X.rescheduled, onOk: () => setMoving(false) });
          },
        }}
      >
        <div className="nf-rmb-field">
          <label htmlFor={`rm-move-${id}`}>{X.rescheduleField}</label>
          <input
            id={`rm-move-${id}`}
            type="datetime-local"
            value={when}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `rm-move-${id}-problem` : undefined}
            onChange={(e) => setWhen(e.target.value)}
          />
          <FieldProblem id={`rm-move-${id}-problem`} message={problem} />
        </div>
      </Sheet>
    </>
  );
}

export function SearchActions({ id, alert, href }: { id: string; alert: boolean; href: string }) {
  const X = useScopedCopy("roommates").hubX.searches;
  const [on, setOn] = useState(alert);
  const toggle = useRun();
  const del = useRun();
  return (
    <>
      <Switch
        checked={on}
        label={X.alert}
        disabled={toggle.pending}
        onCheckedChange={(next) => {
          setOn(next);
          toggle.run(() => setRoommateSearchAlert({ id, alert: next }), { success: next ? X.alertOn : X.alertOff, onFail: () => setOn(!next), refresh: false, undo: async () => { setOn(!next); return setRoommateSearchAlert({ id, alert: !next }); } });
        }}
      />
      <ButtonLink href={href} variant="secondary" size="sm">
        {X.open}
      </ButtonLink>
      <Button variant="dangerQuiet" size="sm" loading={del.pending} onClick={() => del.run(() => deleteRoommateSearch(id), { success: X.deleted })}>
        {X.delete}
      </Button>
    </>
  );
}
