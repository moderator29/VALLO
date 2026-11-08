"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
  acceptAnswer,
  acceptCircleInvite,
  decideJoinRequest,
  declineCircleInvite,
  followQuestion,
  joinCommunity,
  leaveCommunity,
  replyInCircle,
  sendCircleInvite,
  setHelpful,
  vouchForMember,
  withdrawCircleInvite,
  withdrawVouch,
} from "@/lib/features/circle/actions";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The Circle's small controls: join and leave, helpful, accept, follow, the
 * reply box and a request decision. Each is optimistic where it is a toggle,
 * reverts on a refusal and shows the server's own sentence.
 */

type Result = { ok: true } | { ok: false; error: string };

function useRun() {
  const [pending, start] = useSafeTransition();
  const run = (task: () => Promise<Result>, onFail?: () => void, onOk?: () => void) =>
    start(async () => {
      try {
        const result = await task();
        if (result.ok) {
          onOk?.();
          return;
        }
        onFail?.();
        banner.error(result.error);
      } catch (error) {
        onFail?.();
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}

export function JoinControl({
  communityId,
  slug,
  name,
  visibility,
  initial,
  signedIn,
}: {
  communityId: string;
  slug: string;
  name: string;
  visibility: "public" | "private";
  initial: "none" | "active" | "requested" | "owner";
  signedIn: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const { pending, run } = useRun();
  const words = CIRCLE_COPY.community;

  if (!signedIn) {
    return (
      <Button variant="primary" size="md" onClick={() => router.push(`/sign-in?next=/circle/c/${slug}`)} data-testid="circle-join">
        {visibility === "private" ? words.request : words.join}
      </Button>
    );
  }
  if (state === "owner") return null;
  if (state === "requested") {
    return (
      <Button variant="secondary" size="md" disabled data-testid="circle-requested">
        {words.requested}
      </Button>
    );
  }
  if (state === "active") {
    return (
      <Button
        variant="quiet"
        size="md"
        loading={pending}
        data-testid="circle-leave"
        onClick={() =>
          run(
            async () => leaveCommunity({ communityId, slug }),
            () => setState("active"),
            () => {
              setState("none");
              banner.success(CIRCLE_COPY.leftBanner);
              router.refresh();
            },
          )
        }
      >
        {words.leave}
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      size="md"
      loading={pending}
      data-testid="circle-join"
      onClick={() =>
        run(async () => {
          const result = await joinCommunity({ communityId, slug });
          if (result.ok) {
            setState(result.data.status);
            banner.success(result.data.status === "requested" ? CIRCLE_COPY.requestedBanner : `${CIRCLE_COPY.joinedBanner} ${name}`);
            router.refresh();
            return { ok: true };
          }
          return result;
        })
      }
    >
      {visibility === "private" ? words.request : words.join}
    </Button>
  );
}

export function HelpfulToggle({ postId, rootId, count, initial, disabled }: { postId: string; rootId: string; count: number; initial: boolean; disabled: boolean }) {
  const [on, setOn] = useState(initial);
  const { pending, run } = useRun();
  const shown = count - (initial ? 1 : 0) + (on ? 1 : 0);
  return (
    <Button
      variant={on ? "primary" : "quiet"}
      size="sm"
      aria-pressed={on}
      disabled={disabled || pending}
      leadingIcon="check"
      data-testid="circle-helpful"
      onClick={() => {
        const next = !on;
        setOn(next);
        run(async () => setHelpful({ postId, rootId, on: next }), () => setOn(!next));
      }}
    >
      {`${CIRCLE_COPY.thread.helpful}${shown > 0 ? ` ${shown}` : ""}`}
    </Button>
  );
}

export function AcceptToggle({ questionId, answerId, accepted }: { questionId: string; answerId: string; accepted: boolean }) {
  const router = useRouter();
  const { pending, run } = useRun();
  return (
    <Button
      variant={accepted ? "secondary" : "quiet"}
      size="sm"
      aria-pressed={accepted}
      loading={pending}
      data-testid="circle-accept"
      onClick={() => run(async () => acceptAnswer({ questionId, answerId: accepted ? null : answerId }), undefined, () => router.refresh())}
    >
      {accepted ? CIRCLE_COPY.thread.unaccept : CIRCLE_COPY.thread.accept}
    </Button>
  );
}

export function FollowToggle({ questionId, initial }: { questionId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const { pending, run } = useRun();
  return (
    <Button
      variant={on ? "secondary" : "quiet"}
      size="sm"
      aria-pressed={on}
      disabled={pending}
      leadingIcon="bell"
      data-testid="circle-follow"
      onClick={() => {
        const next = !on;
        setOn(next);
        run(async () => followQuestion({ questionId, on: next }), () => setOn(!next));
      }}
    >
      {on ? CIRCLE_COPY.thread.following : CIRCLE_COPY.thread.follow}
    </Button>
  );
}

export function ReplyBox({ rootId, parentId, question }: { rootId: string; parentId: string; question: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  const label = question ? CIRCLE_COPY.thread.reply : CIRCLE_COPY.thread.replyDiscussion;
  return (
    <form
      className="nf-circle-field nf-creplybox"
      data-testid="circle-reply-box"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        run(async () => replyInCircle({ rootId, parentId, body }), undefined, () => {
          setBody("");
          banner.success(CIRCLE_COPY.saved);
          router.refresh();
        });
      }}
    >
      <label htmlFor={`reply-${parentId}`} className="nf-circle-section__title">
        {label}
      </label>
      <textarea
        id={`reply-${parentId}`}
        value={body}
        maxLength={4000}
        placeholder={question ? CIRCLE_COPY.thread.answerHint : CIRCLE_COPY.thread.replyHint}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="nf-creplybox__foot">
        <span className="nf-circle-field__hint nf-numeric">{body.length > 3600 ? `${4000 - body.length} left` : ""}</span>
        <Button type="submit" variant="primary" size="md" loading={pending} disabled={!body.trim()} trailingIcon="send">
          {CIRCLE_COPY.thread.send}
        </Button>
      </div>
    </form>
  );
}

export function InviteActions({ inviteId, isMine }: { inviteId: string; isMine: boolean }) {
  const router = useRouter();
  const { pending, run } = useRun();
  if (isMine) {
    return (
      <Button
        variant="quiet"
        size="sm"
        disabled={pending}
        data-testid="circle-withdraw-invite"
        onClick={() =>
          run(async () => withdrawCircleInvite({ inviteId }), undefined, () => {
            banner.success(CIRCLE_COPY.invite.withdrawn);
            router.refresh();
          })
        }
      >
        {CIRCLE_COPY.invite.withdraw}
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-sm">
      <Button
        variant="primary"
        size="sm"
        disabled={pending}
        data-testid="circle-accept-invite"
        onClick={() =>
          run(async () => acceptCircleInvite({ inviteId }), undefined, () => {
            banner.success(CIRCLE_COPY.invite.accepted);
            router.refresh();
          })
        }
      >
        {CIRCLE_COPY.invite.accept}
      </Button>
      <Button
        variant="quiet"
        size="sm"
        disabled={pending}
        data-testid="circle-decline-invite"
        onClick={() =>
          run(async () => declineCircleInvite({ inviteId }), undefined, () => {
            banner.success(CIRCLE_COPY.invite.declined);
            router.refresh();
          })
        }
      >
        {CIRCLE_COPY.invite.decline}
      </Button>
    </span>
  );
}

export function SendInviteButton({
  communityId,
  inviteeId,
  inviteeName,
}: {
  communityId: string;
  inviteeId: string;
  inviteeName: string;
}) {
  const router = useRouter();
  const { pending, run } = useRun();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      data-testid="circle-send-invite"
      onClick={() =>
        run(async () => sendCircleInvite({ communityId, inviteeId }), undefined, () => {
          banner.success(`${CIRCLE_COPY.invite.inviteSent} to ${inviteeName}`);
          router.refresh();
        })
      }
    >
      {CIRCLE_COPY.invite.inviteMember}
    </Button>
  );
}

export function VouchButton({
  communityId,
  voucheeId,
  voucheeName,
}: {
  communityId: string;
  voucheeId: string;
  voucheeName: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  if (!open) {
    return (
      <Button variant="quiet" size="sm" data-testid="circle-vouch" onClick={() => setOpen(true)}>
        {CIRCLE_COPY.vouch.vouchFor}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-xs" data-testid="circle-vouch-form">
      <textarea
        className="nf-field min-h-[3rem]"
        maxLength={280}
        placeholder={CIRCLE_COPY.vouch.notePlaceholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-sm">
        <Button
          variant="primary"
          size="sm"
          loading={pending}
          onClick={() =>
            run(async () => vouchForMember({ communityId, voucheeId, note }), undefined, () => {
              banner.success(`${CIRCLE_COPY.vouch.sent} for ${voucheeName}`);
              setOpen(false);
              setNote("");
              router.refresh();
            })
          }
        >
          {CIRCLE_COPY.vouch.vouchFor}
        </Button>
        <Button variant="quiet" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function WithdrawVouchButton({ vouchId }: { vouchId: string }) {
  const router = useRouter();
  const { pending, run } = useRun();
  return (
    <Button
      variant="quiet"
      size="sm"
      disabled={pending}
      data-testid="circle-withdraw-vouch"
      onClick={() =>
        run(async () => withdrawVouch({ vouchId }), undefined, () => {
          banner.success(CIRCLE_COPY.vouch.withdrawn);
          router.refresh();
        })
      }
    >
      {CIRCLE_COPY.vouch.withdraw}
    </Button>
  );
}

export function RequestDecision({ communityId, userId, slug }: { communityId: string; userId: string; slug: string }) {
  const router = useRouter();
  const { pending, run } = useRun();
  const decide = (approve: boolean) =>
    run(async () => decideJoinRequest({ communityId, userId, approve, slug }), undefined, () => router.refresh());
  return (
    <span className="nf-circle-reply__actions">
      <Button variant="primary" size="sm" disabled={pending} onClick={() => decide(true)} data-testid="circle-approve">
        {CIRCLE_COPY.manage.accept}
      </Button>
      <Button variant="quiet" size="sm" disabled={pending} onClick={() => decide(false)} data-testid="circle-decline">
        {CIRCLE_COPY.manage.decline}
      </Button>
    </span>
  );
}
