import { initial } from "@/lib/text/initial";
import type { Metadata } from "next";
import Link from "next/link";
import { withNext } from "@/lib/auth/next-link";
import { PageHeader } from "@/components/app/PageHeader";
import { SocialPaused } from "@/components/social/SocialPaused";
/* ONE empty-state anatomy across the whole product. See EmptyPanel. */
import { EmptyPanel } from "@/components/social/profile/EmptyPanel";
import { FollowButton } from "@/components/social/profile/FollowButton";
import { AroundFab } from "@/components/social/AroundFab";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { PeopleSearch } from "@/components/social/find/PeopleSearch";
import { ButtonLink } from "@/components/ui/Button";
import { isSocialEnabled } from "@/lib/social/flag";
import { findPeople } from "@/lib/social/people-queries";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { TierBadge } from "@/components/trust/TierBadge";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "People" };

/**
 * `/u`: a way to find a person.
 *
 * **This route did not exist, and `/u/[handle]` answered for every handle under
 * it.** Somebody was reachable only if you already knew their name, which made
 * following a thing you could only do to people you had already met. A follow
 * graph with no discovery surface is the same criticism `SOCIAL_DESIGN.md`
 * levelled at the follow graph it originally cut, and it was recorded as a dead
 * end in `docs/SOCIAL_AUDIT.md` for two rounds before this.
 *
 * A plain form with a GET, not a client search box. The query lives in the
 * address, so a search is a page somebody can send to somebody else, go back to,
 * or reload, and it costs no JavaScript to type in. On a Nigerian mobile
 * connection that is the difference between a search that works and one that
 * waits for a bundle.
 *
 * Every row carries a real Follow, because a list you cannot act from is a list
 * you look at once. The viewer's own row carries none: a button that would
 * refuse itself is worse than no button.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const w = getDictionary(await getLocale()).experienceSocial.people;
  if (!(await isSocialEnabled())) return <SocialPaused title={w.title} />;

  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const view = await findPeople(raw ?? "");

  if (view.state === "unconfigured") {
    return (
      <div className="mx-auto w-full max-w-2xl pb-4xl pt-md">
        <PageHeader title={w.title} fallback="/around" />
        <EmptyPanel
          icon="user-check"
          title={w.unreachableTitle}
          body={w.unreachableBody}
          action={{ href: "/around", label: w.goToAround }}
        />
      </div>
    );
  }

  const searching = view.query.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl pb-4xl pt-md">
      <PageHeader title={w.title} fallback="/around" />

      {/*
        Still a plain GET form: the query lives in the address, so a search is a
        page somebody can send, reload or go back to, and typing it costs no
        JavaScript.

        What changed is the field. It was a bare `id="q"` - an unqualified,
        GLOBAL id on a page that also renders follow controls and a FAB, where
        anything else claiming `q` would silently steal the label. `TextField`
        derives its id with `useId`, so it is unique by construction, and
        `name="q"` - the only part the GET actually needs - is untouched.

        It also brings the clear affordance the pill never had: an uncontrolled
        field, so clearing writes the DOM directly and the form still posts
        empty, which is the "see everybody" case.
      */}
      <div className="mt-2xs">
        <PeopleSearch
          mode="page"
          initialQuery={view.query}
          copy={{
            label: w.searchLabel,
            placeholder: w.findPlaceholder,
            clear: w.clear,
            searching: w.findSearching,
            none: w.findNone,
            seeAll: w.findSeeAll,
          }}
        />
      </div>

      <p className="mt-md nf-section-label">
        {searching ? w.matching.replace("{query}", view.query) : w.arrived}
      </p>

      {/* People are found by name and handle only (V-64): occupation and
          place are a member's own facts and are searched by nobody. */}
      {searching && view.people.length > 0 ? (
        <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {w.searchedBy}
        </p>
      ) : null}

      {view.people.length === 0 ? (
        <div className="mt-md">
          <EmptyPanel
            icon="home-search"
            title={searching ? w.noMatchTitle.replace("{query}", view.query) : w.noneTitle}
            body={
              searching
                ? w.noMatchBody
                : w.noneBody
            }
            action={{ href: "/around", label: w.goToAround }}
            secondary={searching ? { href: "/u", label: w.everybody } : undefined}
          />
        </div>
      ) : (
        <ul className="mt-sm flex flex-col gap-[var(--nf-social-gap)]">
          {view.people.map((person) => (
            <li key={person.userId} className="nf-panel nf-panel--card nf-people__row flex-row">
              <Link href={`/u/${person.handle}`} className="nf-people__who">
                <span className="nf-people__avatar">
                  {person.avatarUrl ? (
                    <RemoteImage
                      src={person.avatarUrl}
                      alt=""
                      width={96}
                      height={96}
                      sizes="48px"
                    />
                  ) : (
                    <span aria-hidden="true">
                      {initial(person.displayLabel)}
                    </span>
                  )}
                </span>
                <span className="nf-people__text">
                  <span className="nf-people__name">
                    <span className="truncate-none">{person.displayLabel}</span>
                    {/* The mark comes from the published badge only, as on the
                        profile itself (ProfileHeader). `isAgent` is a role and
                        draws nothing: an approved agent at tier 0 has had no
                        check, and a "Verified agent" tick from the role alone
                        claimed one (lib/trust/badge-tier.ts: no mark without a
                        check behind it). TierBadge draws nothing for "none". */}
                    <TierBadge tier={person.badgeTier} size={15} className="nf-social-verified" />
                  </span>
                  <span className="nf-people__handle">@{person.handle}</span>
                  {/* Bios are capped at 240 characters by the database, so there
                      is nothing here to truncate, and truncating the one
                      sentence somebody wrote about themselves to tidy a row is
                      the wrong trade. */}
                  {/* What they do and where, ONLY where the member published
                      it in their settings (V-64). Absent entirely otherwise:
                      a profile should never look like a form somebody
                      abandoned. */}
                  {person.occupation || person.place ? (
                    <span className="nf-people__facts">
                      {person.occupation ? (
                        <span>
                          <UiIcon name="user" size={12} />
                          {person.occupation}
                        </span>
                      ) : null}
                      {person.place ? (
                        <span>
                          <UiIcon name="location" size={12} />
                          {person.place}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {person.bio ? <span className="nf-people__bio">{person.bio}</span> : null}
                </span>
              </Link>

              {person.isViewer ? (
                <span className="nf-people__you">You</span>
              ) : (
                <span className="nf-people__acts">
                  <FollowButton
                    handle={person.handle}
                    initialFollowing={person.viewerFollows}
                    signedIn={view.signedIn}
                    compact
                  />
                  {/* Message, twice in the markup and once on screen: the
                      round glyph on a phone, where the word would squeeze the
                      name into a column of letters, and the word from a
                      tablet up. Only one is ever displayed, so only one is
                      in the tab order and the accessibility tree. */}
                  <ButtonLink
                    href={`/u/${person.handle}/message`}
                    variant="icon"
                    round
                    leadingIcon="messages"
                    className="nf-people__msg--glyph"
                    aria-label={w.messageLabel.replace("{name}", person.displayLabel)}
                  />
                  <ButtonLink
                    href={`/u/${person.handle}/message`}
                    size="sm"
                    variant="secondary"
                    leadingIcon="messages"
                    className="nf-people__msg--word"
                    aria-label={w.messageLabel.replace("{name}", person.displayLabel)}
                  >
                    {w.messageAction}
                  </ButtonLink>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!view.signedIn && view.people.length > 0 ? (
        <p className="mt-md text-center text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          <Link href={withNext("/sign-in", "/u")} className="font-semibold text-[var(--nf-brand-secondary)]">
            Sign in
          </Link>{" "}
          to follow anybody here.
        </p>
      ) : null}

      <AroundFab />
    </div>
  );
}

