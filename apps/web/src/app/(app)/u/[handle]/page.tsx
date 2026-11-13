import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHeader } from "@/components/app/PageHeader";
import { PromoBanner } from "@/components/app/PromoBanner";
import { ButtonLink } from "@/components/ui/Button";
import { FollowButton } from "@/components/social/profile/FollowButton";
import { ProfileHeader } from "@/components/social/profile/ProfileHeader";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { readUserRecord } from "@/lib/trust/record-read";
import { readPersonChecks } from "@/lib/trust/person-checks-read";
import { personChecks, personStats, reasonsTitle } from "@/lib/trust/checks";
import { RECORD_MIN_COUNT, replyBand } from "@/lib/trust/record";
import { PersonReasons } from "@/components/app/trust/PersonReasons";
/* ONE empty-state anatomy across the whole product. See EmptyPanel. */
import { EmptyPanel } from "@/components/social/profile/EmptyPanel";
import { ProfileMenu } from "@/components/social/profile/ProfileMenu";
import { reportWordsOf } from "@/components/social/sheet-words";
import { ProfileShare } from "@/components/social/profile/ProfileShare";
import { ProfileTabs } from "@/components/social/profile/ProfileTabs";
/* Plain module, never the client component: a server component importing a
   value from a `"use client"` file gets a client reference, not the value. */
import {
  AGENT_TABS,
  ALL_TABS,
  MEMBER_TABS,
  type TabKey,
} from "@/lib/social/profile-tabs-schema";
import { loadPublicProfile, normaliseHandle } from "@/lib/social/profiles-queries";
import { siteUrl } from "@/lib/site";
import { withNext } from "@/lib/auth/next-link";
import {
  getProfileActivity,
  getProfileFeed,
  getProfileReplies,
} from "@/lib/social/posts-queries";
import {
  getAgentProperties,
  getAgentRatingAggregate,
  getAgentReviews,
  getProfileMediaGrid,
} from "@/lib/social/profile-tabs-queries";
import { OWN_PROFILE_HREF } from "@/lib/social/own-profile";
import { joinDate } from "@/lib/format/join-date";
import { listStories } from "@/lib/social/stories-queries";
import { SocialPaused } from "@/components/social/SocialPaused";
import { createClient } from "@/lib/supabase/server";
import { badgeCopyOf } from "@/components/social/badges/badge-copy";
import { readProfileBadges } from "@/components/social/profile/badges-read";
import { isSocialEnabled } from "@/lib/social/flag";
import { readPublicRoleWords } from "@/lib/profile/role-facts";
import { roleLine } from "@/lib/profile/role-line";
import { passportIsOpen } from "@/lib/passport/passport-read";
import { messageDoor } from "@/lib/social/message-door";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ownershipSeenFor } from "@/lib/trust/ownership-seen";
import { OwnershipSeenMark } from "@/components/trust/OwnershipSeenMark";
import { RatingSummary } from "@/components/ui/RatingSummary";

/**
 * `/u/[handle]`: a person's page.
 *
 * A handle is an address, so this route answers for every one of them, whether
 * somebody holds it or not. A handle nobody has taken is not a 404: it is an
 * offer, because the fastest way to get somebody their own page is to show them
 * the one that is waiting.
 *
 * **Two kinds of person get two sets of tabs**, and which set is decided here
 * rather than in the component: an agent whose listings can actually be
 * resolved gets Properties, Stories, Reviews and Activity, and everybody else
 * gets Posts, Replies, Media and Activity. Somebody who is marked as an agent
 * but whose `agents` row cannot be reached from a public page falls back to the
 * ordinary set, because a Properties tab that could only ever be empty is a
 * worse lie than an absent one.
 *
 * Everything the page renders is read in parallel. Nine small reads that all
 * start at once cost one round trip; the same nine in sequence cost nine, and
 * on the connections this product is built for that is the whole difference
 * between a page and a wait.
 *
 * **The header's three controls are built here and passed in**, so the header
 * itself never has to become a client component to hold a button that does.
 * Follow and the overflow ride the avatar's row; share floats on the banner.
 * The overflow is no longer `onCover`, because it no longer is: it sits on the
 * canvas beside Follow, where the bordered form is the one that reads.
 *
 * This is also where the reader's language enters the profile. The dictionary
 * is resolved once, the whole of it goes to the header because that costs
 * nothing in a server component, and the two client components get
 * `t.socialProfile` alone so a profile does not ship four languages of copy it
 * will never render.
 */

/**
 * THE SHARE CARD FOR A PROFILE (R3 finding F-10).
 *
 * The product tells a person their address is `/u/<handle>` and then published
 * that address with no card at all, so the link they were invited to share
 * unfurled as the generic site card. It now carries the name, the bio and the
 * avatar.
 *
 * `loadPublicProfile` is the same read the page makes, and it is the read that
 * enforces the rules: a held bio comes back empty to everybody but its owner,
 * and a blocked or missing handle comes back as a state that is not `found`,
 * in which case the card says nothing about whether the handle is taken.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = normaliseHandle(raw);
  const title = `@${handle}`;
  const view = await loadPublicProfile(raw);
  if (view.state !== "found") return { title };

  const name = view.profile.displayLabel || title;
  const description =
    view.profile.bio || getDictionary(await getLocale()).experienceSocial.profilePage.metaDescription.replace("{name}", name);
  const url = `${siteUrl().replace(/\/+$/, "")}/u/${handle}`;
  const avatar = view.profile.avatarUrl || undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: `${name} (${title})`,
      description,
      url,
      ...(avatar ? { images: [avatar] } : {}),
    },
    twitter: {
      card: "summary",
      title: `${name} (${title})`,
      description,
      ...(avatar ? { images: [avatar] } : {}),
    },
  };
}

function tabFrom(raw: string | string[] | undefined, allowed: TabKey[]): TabKey | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const found = ALL_TABS.find((key) => key === value);
  return found && allowed.includes(found) ? found : undefined;
}

export default async function SocialProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { handle: raw } = await params;
  const handle = normaliseHandle(raw);
  if (!(await isSocialEnabled())) return <SocialPaused title={`@${handle}`} />;

  const locale = await getLocale();
  const t = getDictionary(locale);
  const words = t.experienceSocial.profilePage;
  const [view, query] = await Promise.all([loadPublicProfile(raw), searchParams]);

  if (view.state === "found") {
    /*
     * MY OWN ADDRESS IS MY OWN PROFILE (the founder, 13 October 2026). Tapping
     * my own avatar or name anywhere (a post, a story, a reply, a people list,
     * a chat) opened this page as if I were somebody else: the public view of
     * me, with the header of a stranger. There are a hundred places that link
     * to `/u/<handle>`, and one of them forgetting the rule would bring the
     * bug back, so the rule lives HERE, once, at the address every one of them
     * points at: when the signed-in reader IS this person, the page is
     * `/profile`, their own. Nothing else is read first, so no work is done
     * for a page that will not be drawn. A reader who is not the owner sees
     * exactly what they saw before. `loadPublicProfile` decides ownership on
     * the server from the session, so a typed handle cannot claim it. The
     * owner's edit, followers and following pages are their own routes and
     * stay where they are.
     */
    if (view.isOwner) redirect(OWN_PROFILE_HREF);
    const userId = view.profile.userId;

    /* An agent's own tabs need an `agents` row, and `agents` is select-own plus
       admin, so this resolves for the agent themselves and for nobody else
       until it is projected. The fallback is the ordinary tab set, never an
       empty Properties tab. */
    const agentId = view.agentId;
    const isAgentPage = view.profile.isAgent && Boolean(agentId);
    const tabs = isAgentPage ? AGENT_TABS : MEMBER_TABS;
    const door = messageDoor({
      isOwner: view.isOwner,
      contactPolicy: view.profile.contactPolicy,
      viewerFollows: view.viewerFollows,
    });

    const supabase = await createClient();
    const [posts, replies, media, activity, properties, reviews, stories, record, badges, roleWords, passportOpen, ratingAgg, checkFacts] =
      await Promise.all([
        isAgentPage ? Promise.resolve([]) : getProfileFeed(userId),
        isAgentPage ? Promise.resolve([]) : getProfileReplies(userId),
        isAgentPage ? Promise.resolve([]) : getProfileMediaGrid(userId),
        getProfileActivity(userId),
        isAgentPage ? getAgentProperties(agentId) : Promise.resolve([]),
        isAgentPage ? getAgentReviews(agentId) : Promise.resolve([]),
        isAgentPage ? listStories({ authorId: userId, limit: 30 }) : Promise.resolve([]),
        /* V-34: a lister's Record. No row for a member who is not one, or for
           a reader who is signed out, and then nothing is drawn. */
        view.profile.isAgent ? readUserRecord(userId) : Promise.resolve(null),
        /* Their badges, earned and given, for the credentials section. Null
           when the read failed, and then the older chips stand in. */
        readProfileBadges(supabase, userId, locale, view.signedIn),
        /* The one role line under their name: what their published listings
           and businesses say they are (`lib/profile/role-facts.ts`). */
        readPublicRoleWords(supabase, userId, view.profile.supplyRole),
        /* The Vallo passport: a signed-in member sees "View passport" only when
           it would open (on, and no block either way). Signed out: no button,
           and no read. */
        view.signedIn && !view.isOwner ? passportIsOpen(userId) : Promise.resolve(false),
        isAgentPage ? getAgentRatingAggregate(agentId) : Promise.resolve(null),
        /* The dates behind this person's checks (identity, mobile, email).
           No facts on any failure, and no facts draw no lines. */
        readPersonChecks(userId),
      ]);
    const passportAction = view.isOwner ? (
      <ButtonLink href="/settings/passport" size="sm" variant="secondary" leadingIcon="id-card" data-testid="profile-your-passport">
        {t.passportV2.yourPassport}
      </ButtonLink>
    ) : passportOpen ? (
      <ButtonLink href={`/passport/${view.profile.handle}`} size="sm" variant="secondary" leadingIcon="id-card" data-testid="profile-view-passport">
        {t.passportV2.viewPassport}
      </ButtonLink>
    ) : null;
    /* "Ownership seen": a reviewer approved this owner's proof of ownership. */
    const ownershipSeen = view.profile.isAgent ? await ownershipSeenFor(userId) : null;

    /*
     * REASONS TO TRUST (13 November 2026). The person's dated checks, each a
     * row that opens to say when, who, what was looked at and what it does not
     * prove, under a row of real numbers. Built only from dates the database
     * holds: a check with no date is not a row, and the section is absent
     * when there is nothing dated to show. The agent's reviews stay in the
     * card below it, so a number is never printed twice.
     */
    const reasonsCopy = t.trustReasons;
    const reasonChecks = personChecks({ ...checkFacts, ownershipSeenAt: ownershipSeen }, reasonsCopy, locale);
    const recordReplies =
      record && !record.stopped && record.replied !== null && record.replied >= RECORD_MIN_COUNT ? replyBand(record.replyMedianMinutes) : null;
    const reasonStats = personStats(
      {
        memberSince: view.profile.claimedAt,
        lets: record && !record.stopped ? record.lets : null,
        replyBand: recordReplies,
      },
      reasonsCopy,
      locale,
    );

    return (
      /* Room under the tabs' last line for the dock (`pb-4xl`): a short
         page's empty state sat under it with no way to scroll it clear
         (Round 3 sweep). */
      <div className="mx-auto max-w-2xl pb-4xl">
        <ProfileHeader
          profile={view.profile}
          isOwner={view.isOwner}
          homeArea={view.homeArea}
          moderatorOf={view.moderatorOf}
          locale={locale}
          t={t}
          occupation={view.occupation}
          standing={view.standing}
          place={view.place}
          published={view.published}
          trust={view.trust}
          joinedLabel={joinDate(view.profile.claimedAt, locale)}
          badges={badges}
          badgeCopy={badgeCopyOf(t)}
          shareUrl={`${siteUrl().replace(/\/+$/, "")}/u/${view.profile.handle}`}
          roleLine={roleLine(roleWords, t.socialProfile.roleLine)}
          reasons={
            <PersonReasons
              title={reasonsTitle(view.profile.displayLabel, reasonsCopy)}
              lede={reasonsCopy.person.lede}
              stats={reasonStats}
              checks={reasonChecks}
              labels={reasonsCopy.sheet}
            />
          }
          /* V-34: a lister's Record, in the credentials section. Null for a
             member who is not one, and then nothing is drawn. */
          record={
            record || passportAction ? (
              <>
                {record ? <ValloRecord record={record} t={t} locale={locale} /> : null}
                {passportAction ? <div className="mt-sm">{passportAction}</div> : null}
              </>
            ) : null
          }
          follow={
            view.isOwner ? undefined : (
              <FollowButton
                handle={view.profile.handle}
                initialFollowing={view.viewerFollows}
                signedIn={view.signedIn}
                labels={t.socialProfile}
                /* The compact rung (D79: "a bit smaller and clean"). */
                compact
              />
            )
          }
          /* How to reach them (founder, 9 and 11 October 2026): one chat per
             pair of people, separate from the chats about a listing, which
             still start from the listing. `messageDoor` decides: never on your
             own page; the button for anybody when they are open to anyone;
             and when they ask first, the button only for a viewer who follows
             them, and "Follow to message" for everybody else. Signed out, the
             link leads to a sign-in that returns here. */
          /* VIEW-ONLY SIGNED OUT (founder, 9 November 2026). A visitor with no
             account reads the profile but takes no action from it: the message
             control is not drawn for them at all, and the Join banner below is
             their one way on. Follow is already a link to sign up. */
          message={
            !view.signedIn ? undefined : door === "message" ? (
              <ButtonLink href={`/u/${view.profile.handle}/message`} size="sm" variant="secondary" leadingIcon="messages" className="shrink-0">
                {t.socialProfile.message}
              </ButtonLink>
            ) : door === "follow-first" ? (
              <span
                className="inline-flex shrink-0 items-center gap-inline-tight nf-caption text-[var(--nf-content-muted)]"
                data-testid="profile-follow-to-message"
              >
                <UiIcon name="messages" size={16} />
                {t.experienceSocial.followToMessage}
              </span>
            ) : undefined
          }
          share={
            <ProfileShare
              handle={view.profile.handle}
              displayLabel={view.profile.displayLabel}
              avatarUrl={view.profile.avatarUrl || undefined}
              followers={view.profile.followerCount}
              posts={view.profile.postCount}
              copy={{ title: t.shareCard.title, share: t.shareCard.share, background: t.shareCard.background, stats: t.shareCard.stats, name: t.shareCard.name, copied: t.shareCard.copied }}
              statWords={{ followers: t.shareCard.profileStats.followers, posts: t.shareCard.profileStats.posts }}
              leadWords={{ profile: t.shareCard.leads.profile, stats: t.shareCard.leads.stats }}
            />
          }
          menu={
            <ProfileMenu
              handle={view.profile.handle}
              userId={userId}
              displayLabel={view.profile.displayLabel}
              isOwner={view.isOwner}
              signedIn={view.signedIn}
              initialMuted={view.viewerMutes}
              reportWords={reportWordsOf(t)}
            />
          }
        />

        {!view.signedIn ? (
          <div className="px-gutter pb-row">
            <PromoBanner
              eyebrow={t.shareCard.joinPrompt.title}
              title={t.shareCard.joinPrompt.title}
              body={t.shareCard.joinPrompt.profile}
              href={withNext("/sign-up", `/u/${view.profile.handle}`)}
              cta={t.shareCard.joinPrompt.action}
              art="team"
              testId="join-vallo-profile"
            />
          </div>
        ) : null}

        {ownershipSeen ? (
          <p className="px-gutter pb-row">
            <OwnershipSeenMark seenAt={ownershipSeen} label={t.supply.register.owner.proof.seenMark} />
          </p>
        ) : null}

        {ratingAgg && ratingAgg.count > 0 ? (
          <section className="px-gutter pb-row" data-testid="profile-rating-summary">
            <RatingSummary
              rating={ratingAgg.average}
              count={ratingAgg.count}
              breakdown={ratingAgg.breakdown}
              locale={locale}
            />
          </section>
        ) : null}

        <ProfileTabs
          handle={view.profile.handle}
          isOwner={view.isOwner}
          signedIn={view.signedIn}
          hasBio={view.profile.bio.length > 0}
          tabs={tabs}
          storyCount={view.storyCount}
          initialTab={tabFrom(query.tab, tabs)}
          labels={t.socialProfile}
          sheet={sheetWordsOf(t)}
          data={{ posts, replies, media, activity, properties, stories, reviews }}
        />

        {/* No create fan here (founder, 7 October): the composer belongs on
            the feed, which has its own plus; a person's profile is theirs. */}
      </div>
    );
  }

  /* Every other outcome is a designed page with its own way onward, under the
     ordinary page header rather than under a cover, because there is no person
     here for a cover to belong to. */
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={`@${handle}`} fallback="/home" />

      {view.state === "unconfigured" && (
        <EmptyPanel
          icon="user-check"
          title={t.experienceSocial.people.unreachableTitle}
          body={t.experienceSocial.people.unreachableBody}
          action={{ href: "/home", label: words.backToHome }}
        />
      )}

      {view.state === "malformed" && (
        <EmptyPanel
          icon="home-search"
          title={words.malformedTitle}
          body={words.malformedBody}
          action={{ href: "/home", label: words.backToHome }}
          secondary={{ href: "/search", label: t.experienceSocial.paused.searchStays }}
        />
      )}

      {/*
        The copy here never says the handle is free, and that is deliberate.
        `social_profiles_select` hides a profile from anybody a block touches in
        either direction, so this one screen covers two situations and nothing in
        an exposed schema can tell them apart. Telling a blocked visitor that a
        name is available would be a lie and would send them into a claim the
        unique index then refuses.
      */}
      {view.state === "claimable" && (
        <EmptyPanel
          icon="user-verified"
          title={(view.official ? words.officialTitle : words.nothingTitle).replace("{handle}", handle)}
          body={
            view.official
              ? words.officialBody
              : view.canClaim
                ? words.claimableBody
                : view.signedIn
                  ? words.ownHandleBody
                  : words.signedOutBody
          }
          action={
            view.official
              ? { href: "/around", label: t.experienceSocial.people.goToAround }
              : view.canClaim
                ? { href: `/u/${handle}/edit`, label: words.claim.replace("{handle}", handle) }
                : view.signedIn
                  ? { href: "/profile", label: words.goToAccount }
                  : { href: withNext("/sign-in", `/u/${handle}`), label: words.signInToClaim }
          }
          secondary={{ href: "/home", label: words.backToHome }}
        />
      )}
    </div>
  );
}
