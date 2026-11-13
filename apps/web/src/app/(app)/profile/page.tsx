import type { Metadata } from "next";
import { sheetWordsOf } from "@/components/social/sheet-words";
import { redirect } from "next/navigation";
import "./profile.css";
import { getDictionary, type Locale } from "@vallo/i18n";
import { intlTag } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { RowLink, SettingsGroup } from "@/components/app/account/rows";
import { SupportGroup } from "@/components/app/account/SupportGroup";
import { loadProfileState } from "@/lib/profile/queries";
import { loadAccountSocialIdentity } from "@/lib/profile/social-identity";
import { getProfileFeed } from "@/lib/social/posts-queries";
import { AccountHero } from "./AccountHero";
import { PeopleSearch } from "@/components/social/find/PeopleSearch";
import { SignedOutHero } from "./SignedOutHero";
import { AccountBody } from "./AccountBody";
import { getAgentContext } from "@/lib/agent/listings-queries";
import { getMode } from "@/lib/mode";
import { RoleSwitcher } from "@/components/roles/RoleSwitcher";
import { VerifyPrompt } from "@/components/roles/VerifyPrompt";
import { needsVerification, roleStateFrom, type AgentFacts, type RoleState } from "@/components/roles/roles";
import { resolveWorkspaces } from "@/lib/supply/workspaces-queries";
import { loadBelongings, loadOwnBadgeTier } from "./belongings-queries";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { BadgeRow } from "@/components/social/badges/BadgeRow";
import { BadgeEarnedHost } from "@/components/social/badges/BadgeEarnedHost";
import { badgeCopyOf } from "@/components/social/badges/badge-copy";
import { readProfileBadges } from "@/components/social/profile/badges-read";
import { IdentityCredentials } from "@/components/app/identity/IdentityHeader";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { OwnTrust } from "@/components/app/trust/OwnTrust";
import { readUserRecord } from "@/lib/trust/record-read";
import { readMyPassportOn } from "@/lib/passport/passport-read";
import { readOwnRoleWords } from "@/lib/profile/role-facts";
import { roleLine } from "@/lib/profile/role-line";
import { PassportRows } from "./PassportRows";
import { switchParamTarget, switchRoleLine } from "./belongings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceSocial.account.title };
}

/**
 * What the three roles look like when there is no account behind them.
 *
 * Not `roleStateFrom(null, "personal")`, even though that returns the same
 * shape, because that function's job is to read an account and there is no
 * account here. Stating the three explicitly keeps the signed-out branch
 * honest about the fact that it is describing the product rather than a
 * person.
 */
const SIGNED_OUT_ROLES: RoleState[] = [
  { id: "renter", setUp: false, verified: false },
  { id: "owner", setUp: false, verified: false },
  { id: "professional", setUp: false, verified: false },
];

/**
 * Profile: your account, wearing your own identity.
 *
 * This page and `/u/[handle]` were two different ideas of the same person. One
 * ran a cover edge to edge, put the avatar on the stride ring and showed real
 * follower counts; this one showed a monogram in a white box, three numbers in
 * a bordered strip and seven square tiles. They were not two designs of one
 * screen, they were two people, and only one of them looked like it belonged to
 * this platform.
 *
 * It is built to `50E032EA` now, on this surface's own classes (`profile.css`,
 * `nf-pf-*`): the cover, the round face on its lit ring, the counts, the
 * Belongings and Posts control, the four belongings rows and Switch role.
 * Every figure on it is read from the database; the whole chain is written
 * out in `docs/archive/BUILD_SESSION_B_LEDGER.md`, section 1.
 *
 * **The cover, the counts and the posts all need a claimed handle**, because
 * they all live on `social_profiles`. Somebody who has not claimed one is not
 * shown empty versions of them. They get the same header without the counts,
 * and an offer, because the fastest way to get somebody their own page is to
 * show them the one that is waiting.
 *
 * Signed out, or before the platform keys land, the same header shape stands
 * with only what is actually known on it. It used to show 8 trips, 23 saved
 * and 5 reviews to somebody who had never booked anything, because those three
 * numbers were constants in the file. See `SignedOutHero`.
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const params = await searchParams;

  // Reads that do not depend on each other, so they cost one round trip rather
  // than six. `resolveWorkspaces` is React-cached and the app layout has
  // already run it for this request, so it costs nothing here.
  const [account, social, agentContext, mode, belongings, held, badgeTier] = await Promise.all([
    loadProfileState(),
    loadAccountSocialIdentity(),
    /*
     * WHAT THIS ACCOUNT IS, not what it is called.
     *
     * The three roles are read off the one `agents` row: absent means renter
     * only, `individual` means somebody listing their own property, `business`
     * means a professional. There is no roles table and this page does not
     * invent one - see `components/roles/roles.ts` for the whole mapping.
     */
    getAgentContext(),
    getMode(),
    loadBelongings(),
    resolveWorkspaces(),
    loadOwnBadgeTier(),
  ]);

  const agentFacts: AgentFacts =
    agentContext.state === "agent"
      ? {
          type: agentContext.agent.type,
          status: agentContext.agent.status,
          verified: agentContext.agent.verified,
        }
      : null;
  const rolesView = roleStateFrom(agentFacts, mode);

  /*
   * `/profile?switch=owner` is a live link (`/agents` redirects to it, and the
   * home and search empty states point at it). It used to open the old role
   * sheet on the owner explanation; it now lands where that sheet would have
   * sent the person, decided from the account's real agent row. Signed out,
   * the setup routes put up the sign-in door themselves.
   */
  const switchTarget = switchParamTarget(params.switch, rolesView.roles);
  if (switchTarget) redirect(switchTarget);

  const identity = social.state === "claimed" ? social.identity : null;

  /*
   * Only somebody with a handle has posts to read, and the read is keyed by
   * user id rather than handle, so it needs the identity to have resolved.
   * The badges on this account, for the row under the hero and the earned
   * moment: null when the read failed, and then nothing is drawn; the row
   * never guesses. Only a signed-in account has any. The two are independent,
   * so they go out together (speed pass, 8 October 2026), not one after the
   * other.
   */
  const shareUrl = identity ? `${siteUrl().replace(/\/+$/, "")}/u/${identity.handle}` : undefined;
  /*
   * And what the header and the credentials section say about the person,
   * all independent, so all at once: the role line under the name (their
   * approved agents row and the businesses they publish), their renter
   * passport, and, for a lister, their Vallo Record. Each answers null or
   * nothing on a failure and then draws nothing; none of them guesses.
   */
  const signedIn = account.state === "signed-in";
  const userId = signedIn ? account.profile.userId : null;
  const client = signedIn ? await createClient() : null;
  const [posts, badges, roleWords, passportOn, record] = await Promise.all([
    social.state === "claimed" ? getProfileFeed(social.userId) : Promise.resolve([]),
    client && userId ? readProfileBadges(client, userId, locale) : Promise.resolve(null),
    client && userId
      ? readOwnRoleWords(client, userId, agentContext.state === "agent" ? agentContext.agent : null)
      : Promise.resolve(null),
    signedIn ? readMyPassportOn() : Promise.resolve(null),
    userId && agentContext.state === "agent" ? readUserRecord(userId) : Promise.resolve(null),
  ]);
  const copy = {
    bookings: t.nav.bookings,
    saved: t.nav.saved,
    agreements: t.nav.agreements,
    messages: t.nav.messages,
    settings: t.nav.settings,
    belongings: t.socialProfile.belongings,
    posts: t.socialProfile.posts,
    myBookings: t.socialProfile.myBookings,
    /* The render's own wording, one line each at 390 at the row's 12px. */
    myBookingsSub: t.socialProfile.myBookingsSub,
    savedSub: t.socialProfile.savedSub,
    agreementsSub: t.socialProfile.agreementsSub,
  };

  if (account.state !== "signed-in") {
    return (
      <div className="nf-pf">
        <SignedOutHero unconfigured={account.state === "unconfigured"} />

        {account.state === "no-row" && (
          <p
            role="status"
            className="nf-card mt-sm p-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]"
          >
            {t.experienceSocial.account.noRow}
          </p>
        )}

        {/* The destinations still exist and still say what they are. Hiding
            them would make the app look smaller than it is to the one person
            most likely to be deciding whether to sign up. No counts, because
            there is nothing yet to count. */}
        <div className="mt-lg space-y-lg">
          <SettingsGroup label={t.experienceSocial.account.whatIsHere}>
            <RowLink href="/search" icon="search" label={t.experienceSocial.account.findPlace} />
            <RowLink href="/bookings" icon="calendar-booking" label={t.nav.bookings} />
            <RowLink href="/saved" icon="heart" label={t.nav.saved} />
          </SettingsGroup>

          {/*
            SWITCHING PROFILE IS OFFERED SIGNED OUT TOO, and it is the same
            control the signed-in screen carries rather than a second one.

            `RoleSwitcher` wraps its own trigger in `AuthGate`, so tapping it
            here opens the sign-in door with `?do=switch-profile` and the
            screen to come back to. That is a better answer than the row this
            replaces, which pointed a signed-out visitor at a marketing page
            and then asked them to sign in at the end of it anyway.

            Every role reads as not set up, which is the truth about an
            account that does not exist yet.
          */}
          <RoleSwitcher roles={SIGNED_OUT_ROLES} current="renter" variant="row" />

          <SettingsGroup label={t.experienceSocial.account.more}>
            <RowLink href="/settings" icon="settings-gear" label={t.nav.settings} />
          </SettingsGroup>

          {/* SUPPORT, signed out too (DOCS_AND_PRESENCE_UPGRADE.md 2.9): a
              visitor can read every policy before creating an account. The
              Help row that stood in "More" is the group's first row. */}
          <SupportGroup />
        </div>
      </div>
    );
  }

  const { profile } = account;
  const placeLabel = [profile.place.lgaName, profile.place.stateName].filter(Boolean).join(", ");

  return (
    <div className="nf-pf">
      <AccountHero
        userId={profile.userId}
        displayName={
          profile.displayName || [profile.firstName, profile.surname].filter(Boolean).join(" ")
        }
        email={profile.email}
        avatarUrl={profile.avatarUrl}
        identity={
          identity
            ? {
                handle: identity.handle,
                coverUrl: identity.coverUrl,
                followerCount: identity.followerCount,
                followingCount: identity.followingCount,
                postCount: identity.postCount,
                isAgent: identity.isAgent,
                bio: identity.bio,
              }
            : null
        }
        badgeTier={badgeTier}
        roleLine={roleWords ? roleLine(roleWords, t.socialProfile.roleLine) : undefined}
        locale={locale}
        postsLabel={t.socialProfile.posts}
        credentials={
          /*
            THE PASSPORT AND CREDENTIALS, one section under the person, in the
            order somebody vouching for them would read: where a seller's or
            an agent's verification stands (the calm prompt, for somebody who
            has applied and is not yet verified; a renter or buyer is never
            asked), the badges they hold, their renter passport with what it
            says, and a lister's Vallo Record.
          */
          <IdentityCredentials label={t.socialProfile.passportAndCredentials}>
            {rolesView.roles.filter(needsVerification).map((role) => (
              <VerifyPrompt key={role.id} role={role} />
            ))}
            {badges && badges.length > 0 ? (
              <>
                <BadgeRow badges={badges} isOwner copy={badgeCopyOf(t)} shareUrl={shareUrl} />
                <BadgeEarnedHost viewerId={profile.userId} badges={badges} copy={badgeCopyOf(t)} shareUrl={shareUrl} />
              </>
            ) : null}
            <PassportRows
              on={passportOn}
              copy={t.passportV2}
              memberSinceLabel={t.socialProfile.accountPage.memberSince}
              memberSince={monthAndYear(profile.memberSince, locale)}
            />
            {record ? <ValloRecord record={record} t={t} locale={locale} /> : null}
          </IdentityCredentials>
        }
      />

      {/* Find anybody by @username (founder, 9 October 2026): type, and their
          profile is one tap away, where Follow and Message are. */}
      <div className="mx-gutter mt-block">
        <PeopleSearch
          mode="dropdown"
          copy={{
            label: t.experienceSocial.people.findLabel,
            placeholder: t.experienceSocial.people.findPlaceholder,
            clear: t.experienceSocial.people.clear,
            searching: t.experienceSocial.people.findSearching,
            none: t.experienceSocial.people.findNone,
            seeAll: t.experienceSocial.people.findSeeAll,
          }}
        />
      </div>

      {/* The member's own trust checks: what others see on their profile,
          each with its date, and the ones they can still add (the Community
          Promise is accepted here). Draws nothing when there is neither. */}
      <OwnTrust userId={profile.userId} isLister={agentContext.state === "agent"} locale={locale} t={t} />

      <AccountBody
        counts={profile.counts}
        copy={copy}
        email={profile.email}
        placeLabel={placeLabel}
        occupationName={profile.place.occupationName}
        details={{
          firstName: profile.firstName,
          surname: profile.surname,
          nickname: profile.nickname,
          phone: profile.phone,
        }}
        posts={posts}
        handle={identity?.handle ?? null}
        hasBio={(identity?.bio.length ?? 0) > 0}
        locale={locale}
        sheet={sheetWordsOf(t)}
        facts={belongings}
        /*
          SWITCH ROLE, the last row. It opens the workspace sheet the dock
          opens (Personal, every workspace held with its standing, the
          operations console for staff, and Add a workspace), and the line
          under it names only what this account actually holds.
        */
        switchLine={switchRoleLine(held.workspaces, t.socialProfile.accountPage)}
      />
    </div>
  );
}

/** Member-since reads as a month and a year, in Lagos time. */
/* The reader's own locale, not "en-NG" for everybody (Round 3 sweep). An
   unreadable date draws nothing: the line said "today", in English, which
   is a claim about the account the page cannot make. */
function monthAndYear(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlTag[locale], {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}
