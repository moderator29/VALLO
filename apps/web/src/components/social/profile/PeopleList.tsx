"use client";

import { initial as initialOf } from "@/lib/text/initial";
import { useState, useTransition } from "react";
import Link from "next/link";
import { TierBadge } from "@/components/trust/TierBadge";
import { FollowButton } from "./FollowButton";
import { moreFollows } from "@/lib/social/follows-actions";
import type { FollowDirection, FollowRow } from "@/lib/social/follows-queries";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * A list of people.
 *
 * One component for followers and for following, because the two differ in
 * exactly two things a person can see: the words when it is empty, and which
 * side of the follow each row is. Two components would be two places to get a
 * row wrong.
 *
 * Every row carries a Follow control, because a list you cannot act from is a
 * list you look at once. The viewer's own row does not, and neither does the
 * page owner's when they are reading their own followers: a button that would
 * refuse itself is worse than no button.
 *
 * Bios are shown whole. They are capped at 240 characters by the database, so
 * there is nothing here to truncate, and truncating the one sentence somebody
 * wrote about themselves to make a row tidier is the wrong trade.
 */

const EMPTY: Record<
  FollowDirection,
  { mineTitle: string; mineBody: string; theirsTitle: string; theirsBody: string }
> = {
  followers: {
    mineTitle: "Nobody follows you yet",
    mineBody:
      "Followers arrive from what you write. Say something useful in a place you know and the people who live there will find you.",
    theirsTitle: "Nobody follows @{handle} yet",
    theirsBody: "When somebody follows them, they show up here.",
  },
  following: {
    mineTitle: "You are not following anybody yet",
    mineBody:
      "Open a place, read what people there are saying, and follow the ones worth hearing from again.",
    theirsTitle: "@{handle} is not following anybody yet",
    theirsBody: "When they follow somebody, that person shows up here.",
  },
};

export function PeopleList({
  handle,
  direction,
  isOwner,
  signedIn,
  total,
  initial,
  initialCursor,
}: {
  handle: string;
  direction: FollowDirection;
  isOwner: boolean;
  signedIn: boolean;
  /** The count the profile itself reports. Not always the length of the list. */
  total: number;
  initial: FollowRow[];
  initialCursor: string | null;
}) {
  const [people, setPeople] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await moreFollows({ handle, direction, before: cursor });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        /* Appended rather than replaced, and de-duplicated on the way in, so a
           follow arriving between two pages cannot put the same person on the
           screen twice. */
        setPeople((current) => {
          const seen = new Set(current.map((person) => person.userId));
          return [...current, ...result.data.people.filter((p) => !seen.has(p.userId))];
        });
        setCursor(result.data.cursor);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  /*
   * An empty list is not always an empty count, and saying so would be a lie.
   *
   * Proven on the live database: two people follow an account, one of them has
   * blocked it, `follows_select` returns both edges and `social_profiles_select`
   * returns one row, because it carries `not private.blocked_with(user_id)`. So
   * the count says two and the list can show one, or none. The copy below never
   * asserts that nobody is there when the count says somebody is, and it never
   * explains which person is missing either, because naming them is exactly the
   * disclosure the block exists to prevent.
   */
  if (people.length === 0 && total > 0) {
    return (
      <div className="nf-panel nf-panel--card mt-md items-center p-lg text-center sm:p-xl">
        <IconPlate size="lg" tone="brand">
          <UiIcon name="users" size={24} />
        </IconPlate>
        <h2 className="nf-h3 mt-sm text-[length:var(--nf-text-body-lg)]">Nobody here you can see</h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          The count is real, and none of these accounts is reachable from your
          own. That happens when a block sits between you.
        </p>
        <div className="mt-md">
          <ButtonLink href={`/u/${handle}`} variant="primary">
            Back to @{handle}
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (people.length === 0) {
    const copy = EMPTY[direction];
    return (
      <div className="nf-panel nf-panel--card mt-md items-center p-lg text-center sm:p-xl">
        <IconPlate size="lg" tone="brand">
          <UiIcon name="users" size={24} />
        </IconPlate>
        <h2 className="nf-h3 mt-sm text-[length:var(--nf-text-body-lg)]">
          {isOwner ? copy.mineTitle : copy.theirsTitle.replace("{handle}", handle)}
        </h2>
        <p className="mx-auto mt-xs max-w-sm text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {isOwner ? copy.mineBody : copy.theirsBody.replace("{handle}", handle)}
        </p>
        <div className="mt-md">
          <ButtonLink href={isOwner ? "/around" : `/u/${handle}`} variant="primary">
            {isOwner ? "Find a place to talk in" : `Back to @${handle}`}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-md flex flex-col gap-[var(--nf-social-gap)]">
        {people.map((person) => {
          const name = person.displayLabel || `@${person.handle}`;
          const monogram = initialOf(person.displayLabel || person.handle);
          return (
            <li key={person.userId} className="nf-panel nf-panel--card nf-social-person flex-row">
              <Link
                href={`/u/${person.handle}`}
                className="nf-social-person__face"
                aria-label={`Open ${name}`}
              >
                {person.avatarUrl ? (
                  <RemoteImage
                    src={person.avatarUrl}
                    alt=""
                    width={96}
                    height={96}
                    sizes="48px"
                  />
                ) : (
                  <span aria-hidden="true">{monogram}</span>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
                  <Link
                    href={`/u/${person.handle}`}
                    /* nf-tap grows the target to 44px with a centred
                       transparent ::before, so the line keeps the height it
                       draws (the name measured 21.7px tall, Round 3 sweep). */
                    className="nf-tap text-[length:var(--nf-text-body-sm)] font-bold tracking-[-0.015em] text-[var(--nf-content-primary)]"
                  >
                    {name}
                  </Link>
                  {/*
                    THE BADGE, FROM THE ONE PUBLISHED SOURCE, BESIDE THE NAME.
                    A directory row draws the same mark this person's own
                    profile draws, because both ask `public.person_badge`.
                  */}
                  <TierBadge tier={person.badgeTier} size={14} />
                  {/*
                    AND THE ROLE CHIP KEEPS ITS WORD AND LOSES ITS TICK. It used
                    to carry the `verified-badge` glyph beside the word "Agent",
                    so a role marker wore the trust mark's own shape and a
                    reader had no way to tell "this person has an agent account"
                    from "this person was checked". They are different facts and
                    they now look different. The chip says what somebody IS; the
                    seal says what we CHECKED.
                  */}
                  {person.isAgent ? (
                    <span className="nf-role-tag shrink-0 uppercase tracking-[0.08em]">
                      {person.supplyRole === "owner" ? "Landlord" : "Agent"}
                    </span>
                  ) : null}
                </p>
                <p className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                  @{person.handle}
                </p>
                {person.bio ? (
                  <p className="mt-2xs whitespace-pre-line text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
                    {person.bio}
                  </p>
                ) : null}
              </div>

              {person.isViewer ? (
                <span className="shrink-0 self-start text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-muted)]">
                  You
                </span>
              ) : (
                <div className="shrink-0 self-start">
                  <FollowButton
                    handle={person.handle}
                    initialFollowing={person.viewerFollows}
                    signedIn={signedIn}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-md text-center text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-state-error)]"
        >
          {error}
        </p>
      ) : null}

      {cursor ? (
        <div className="mt-md text-center">
          <Button
            type="button"
            variant="secondary"
            onClick={loadMore}
            disabled={pending}
            loading={pending}
          >
            {pending ? "Loading" : "Show more people"}
          </Button>
        </div>
      ) : (
        <p aria-live="polite" className="mt-md text-center text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          That is everybody.
        </p>
      )}
    </>
  );
}
