"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useRequireAuth } from "@/components/auth/AuthGate";
import { toggleFollow } from "@/lib/social/follows-actions";
import { setOrKeep } from "@/lib/offline/send-or-keep";
import { POST_COPY } from "@/lib/social/posts-model";
import { sayNowSettleLater } from "@/lib/ui/optimistic";

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
  /* Which tap is the latest, so a slow refusal never undoes a newer tap. */
  const tap = useRef(0);

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

  /* SAID ON THE TAP (lib/ui/optimistic.ts): the label flips and the banner
     goes up in the tap's own task; the server answer only corrects. Never
     disabled while a call is out: each tap sends the state it wants. */
  const onClick = () => {
    const next = !following;
    const mine = ++tap.current;
    setFollowing(next);
    const who = `@${handle}`;
    void sayNowSettleLater({
      message: (next ? POST_COPY.followedDone : POST_COPY.unfollowedDone).replace("{name}", who),
      undo: {
        undo: () => toggleFollow({ handle, want: !next }),
        undone: (next ? POST_COPY.unfollowUndone : POST_COPY.followUndone).replace("{name}", who),
        onUndone: () => {
          setFollowing(!next);
          refreshProfile();
        },
      },
      /* Follow shows at once; with no signal it is kept and sent later. */
      send: () => setOrKeep("follow", handle, next, () => toggleFollow({ handle, want: next })),
      rollBack: () => {
        if (tap.current === mine) setFollowing(!next);
      },
      retry: onClick,
      notKeptWords: "You are offline, and this phone could not keep that for later.",
    }).then((result) => {
      if (!result || !result.ok || tap.current !== mine) return;
      /* The database is the authority even when it agrees with us: a second
         tab may already have done this. */
      setFollowing(result.data.following);
      refreshProfile();
    });
  };

  /* The follower count is kept by a trigger, so the profile it belongs to is
     drawn again for the real figure. Only that profile: on a list of people
     a refresh would render the whole list and empty the router cache (going
     back would then refetch) for a number that list does not show. */
  function refreshProfile() {
    if (typeof window !== "undefined" && window.location.pathname === `/u/${handle}`) router.refresh();
  }

  return (
    <div className={compact ? "shrink-0" : "flex flex-col items-end gap-2xs"}>
      <Button
        variant={following ? "secondary" : "primary"}
        size={compact ? "sm" : "md"}
        onClick={onClick}
        aria-pressed={following}
        aria-label={(following ? labels.unfollowAria : labels.followAria).replace(
          "{handle}",
          handle,
        )}
        className={compact ? "shrink-0" : "min-w-[6.5rem]"}
      >
        {following ? labels.following : labels.follow}
      </Button>
    </div>
  );
}
