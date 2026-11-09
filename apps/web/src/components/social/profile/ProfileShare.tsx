"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { plural, type PluralForms } from "@vallo/i18n/core";

import { ShareButton, type ShareCopy } from "@/components/share/ShareSheet";

/**
 * Share, floating on the cover beside the `…`.
 *
 * It opens the Vallo share composer in a bottom sheet (SHARE_AND_CONTROLS.md
 * section 1): the member builds a brand card of the person (their face or
 * initial, their @handle, two public counts) and sends the short `/u/<handle>`
 * link, rather than meeting the bare OS sheet. Public fields only: the handle,
 * the display name, the avatar and the follower and post counts the profile
 * page already shows. Nothing private is on the card.
 */
export function ProfileShare({
  handle,
  displayLabel,
  avatarUrl,
  followers,
  posts,
  copy,
  statWords,
  leadWords,
}: {
  handle: string;
  displayLabel: string;
  avatarUrl?: string | undefined;
  followers?: number;
  posts?: number;
  copy?: ShareCopy;
  statWords?: { followers: PluralForms; posts: PluralForms };
  leadWords?: { profile: string; stats: string };
}) {
  const who = displayLabel || `@${handle}`;
  /* Words default to English, so a preview harness that passes none still works. */
  const t: ShareCopy = copy ?? { title: "Share", share: "Share", background: "Background", stats: "Stats", name: "Name", copied: "Link copied" };
  const sw = statWords ?? { followers: { one: "1 follower", other: "{count} followers" }, posts: { one: "1 post", other: "{count} posts" } };
  const lw = leadWords ?? { profile: "Profile", stats: "Stats" };

  const stats = [
    typeof followers === "number" ? { label: plural(followers, sw.followers, "en").replace(/^[\d,.]+\s*/, ""), value: new Intl.NumberFormat("en-NG").format(followers) } : null,
    typeof posts === "number" ? { label: plural(posts, sw.posts, "en").replace(/^[\d,.]+\s*/, ""), value: new Intl.NumberFormat("en-NG").format(posts) } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  const subject = {
    avatar: avatarUrl,
    initial: who,
    handle: `@${handle}`,
    headline: who,
    stats,
    url: `/u/${handle}`,
    ...(stats.length
      ? {
          leads: [
            { id: "profile", label: lw.profile, headline: who },
            { id: "stats", label: lw.stats, headline: stats[0]!.value, sub: stats[0]!.label },
          ],
        }
      : {}),
  };

  return (
    <ShareButton subject={subject} copy={t}>
      {(open) => (
        <button type="button" className="nf-social-round nf-btn--glass" aria-label={`${t.share} ${who}`} onClick={open} data-testid="profile-share">
          <UiIcon name="share" size={19} />
        </button>
      )}
    </ShareButton>
  );
}
