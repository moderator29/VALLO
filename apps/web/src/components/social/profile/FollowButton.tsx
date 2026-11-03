"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRequireAuth } from "@/components/auth/AuthGate";
import { toggleFollow } from "@/lib/social/follows-actions";
import { setOrKeep } from "@/lib/offline/send-or-keep";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * Follow, and unfollow.
 *
 * Optimistic where it is safe to be and truthful the moment it is not. The
 * label flips on the tap, because the person already knows what they did and
 * waiting for a round trip to admit it feels broken. If the database refuses,
 * the label goes straight back to what the database says and the reason is
 * shown in full underneath, never swallowed.
 *
 * The counts are not guessed here. They are maintained by a trigger, so the
 * page is refreshed after a successful write and the Followers figure comes
 * back from the row rather than from arithmetic this component did. A number
 * that is right a beat later beats a number that is confidently wrong.
 *
 * Signed out, this is a link to sign in rather than a button that fails. A
 * control that cannot work should say so before it is pressed.
 *
 * **The words are a prop, and they are optional for one honest reason.** This
 * button appears in four places. On `/u/[handle]` a server component resolves
 * the reader's dictionary and hands the four strings down, so a Hausa reader
 * gets a Hausa button. The other three - the people list, the story viewer and
 * the people directory - sit under client components that hold no dictionary,
 * and threading one to each of them means translating three screens of prose
 * that are not this task. Until that happens they get the English below, which
 * is the same wording `en.socialProfile` carries, kept here as literals rather
 * than by importing `getDictionary` so a client bundle does not have to carry
 * all four languages to render one word.
 */

export type FollowLabels = {
  follow: string;
  following: string;
  followAria: string;
  unfollowAria: string;
};

const ENGLISH: FollowLabels = {
  follow: "Follow",
  following: "Following",
  followAria: "Follow @{handle}",
  unfollowAria: "Following @{handle}. Tap to unfollow.",
};

export function FollowButton({
  handle,
  initialFollowing,
  signedIn,
  compact = false,
  labels = ENGLISH,
}: {
  handle: string;
  initialFollowing: boolean;
  signedIn: boolean;
  /** Small and pill shaped, for a row floating over a photograph. */
  compact?: boolean;
  /** From `t.socialProfile` where a server component has one in hand. */
  labels?: FollowLabels;
}) {
  const router = useRouter();
  const { gateHref } = useRequireAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * SIGNED OUT IT IS STILL A LINK, and it now remembers what it was for.
   *
   * This pointed at a bare `/sign-in`, so a guest who tapped Follow on a
   * profile signed in and landed on the home shelf, with no way back to the
   * person they had been looking at short of searching for them again. The
   * shared gate builds the href instead: `/sign-up?next=/u/ada?do=follow`.
   *
   * It stays an anchor rather than becoming an `<AuthGate>` wrapper because an
   * anchor is the honest element here - it navigates, it can be opened in a new
   * tab, and it needs no JavaScript to work.
   */
  /*
   * ONE CONTROL, ONE HEIGHT (auditor A7). The signed-out link was a
   * hand-built `h-9` (36px) while the signed-in Button is the system's `sm`
   * at the 44px floor, so the same Follow came in two heights depending on
   * who was looking. It is now `ButtonLink` at the same size and width as the
   * button it stands in for: still an anchor, still no JavaScript needed.
   */
  if (!signedIn) {
    return (
      <ButtonLink
        href={gateHref("follow")}
        variant="primary"
        size={compact ? "sm" : "md"}
        className={compact ? "shrink-0" : "min-w-[6.5rem]"}
      >
        {labels.follow}
      </ButtonLink>
    );
  }

  const onClick = () => {
    const next = !following;
    setFollowing(next);
    setError(null);

    startTransition(async () => {
      try {
        /* Follow shows at once; with no signal it is kept and sent later. */
        const sent = await setOrKeep("follow", handle, next, () => toggleFollow({ handle, want: next }));
        if (sent.state === "kept") return;
        const result = sent.state === "sent" ? sent.result : null;
        if (!result || !result.ok) {
          setFollowing(!next);
          setError(result && !result.ok ? result.error : "You are offline, and this phone could not keep that for later.");
          return;
        }
        /* The database is the authority even when it agrees with us: a second tab
           may already have done this. */
        setFollowing(result.data.following);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <div className={compact ? "shrink-0" : "flex flex-col items-end gap-2xs"}>
      <Button
        variant={following ? "secondary" : "primary"}
        size={compact ? "sm" : "md"}
        onClick={onClick}
        disabled={pending}
        aria-pressed={following}
        aria-label={(following ? labels.unfollowAria : labels.followAria).replace(
          "{handle}",
          handle,
        )}
        className={compact ? "shrink-0" : "min-w-[6.5rem]"}
      >
        {following ? labels.following : labels.follow}
      </Button>
      {error && (
        <p
          role="alert"
          className="max-w-[14rem] text-right text-[length:var(--nf-text-overline)] leading-snug text-[var(--nf-state-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
