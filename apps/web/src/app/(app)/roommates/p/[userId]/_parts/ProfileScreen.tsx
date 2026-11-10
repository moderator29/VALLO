import { getDictionary } from "@vallo/i18n";

import { PageFrame } from "@/components/app/PageFrame";
import { SafetyRows, SaveButton, ShareButton } from "@/components/roommates/Actions";
import { ShareToCircleButton } from "@/components/roommates/ShareToCircle";
import {
  BadgesRow,
  CardGrid,
  LifestyleChips,
  MatchPanel,
  PersonFace,
  RoomCardView,
  RoommatesEmpty,
  SectionHead,
  budgetText,
  dayText,
  fill,
  lagosDay,
  monthlyHint,
  placeText,
  stateName,
  type RoommatesCopy,
} from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ROOMMATES_ROUTES, type RoommateProfileView } from "@/lib/features/roommates/model";
import type { ProfileRead } from "@/lib/features/roommates/queries";
import { ago } from "@/lib/format/when";

import { ProfileActions } from "./ProfileActions";

/**
 * A ROOMMATE PROFILE, THE SCREEN (server safe; the reference's profile: the
 * photograph leads, the intro, the "general info" chips with their glyphs,
 * and one primary action). On a wide screen the action and the compatibility
 * panel sit in a column beside the facts.
 */
export function RoommateProfileScreen({
  read,
  groups,
  t: copy,
  now,
  userId,
}: {
  read: ProfileRead;
  /** The viewer's active groups, for "Invite to a group". */
  groups: { id: string; name: string }[];
  t: RoommatesCopy;
  now: number;
  /** The profile asked for, for the sign-in return. */
  userId: string;
}) {
  if (read.state !== "ok") {
    const here = ROOMMATES_ROUTES.person(userId);
    const body =
      read.state === "not-open" ? (
        <RoommatesEmpty icon="info">{copy.notOpen}</RoommatesEmpty>
      ) : read.state === "signed-out" ? (
        <RoommatesEmpty icon="lock" action={<ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`} variant="primary" size="md">{copy.ui.signInCta}</ButtonLink>}>
          {copy.ui.profile.signedOut}
        </RoommatesEmpty>
      ) : read.state === "need-profile" ? (
        <RoommatesEmpty icon="user-pen" action={<ButtonLink href={ROOMMATES_ROUTES.profile} variant="primary" size="md">{copy.ui.discover.needProfileCta}</ButtonLink>}>
          {copy.ui.profile.needProfile}
        </RoommatesEmpty>
      ) : (
        <RoommatesEmpty icon="users" action={<ButtonLink href={ROOMMATES_ROUTES.discover} variant="secondary" size="md">{copy.ui.findRoommate}</ButtonLink>}>
          {copy.ui.profile.notFound}
        </RoommatesEmpty>
      );
    return (
      <PageFrame title={copy.title} fallback={ROOMMATES_ROUTES.discover} width="narrow">
        {body}
      </PageFrame>
    );
  }

  const p = read.profile;
  const today = lagosDay(now);
  const share = getDictionary("en").shareCard;
  return (
    <PageFrame
      title={p.name}
      fallback={ROOMMATES_ROUTES.discover}
      width="wide"
      actions={
        p.isSelf ? null : (
          <span className="nf-rmv-headacts">
            <SaveButton kind="person" id={p.userId} />
            <ShareToCircleButton target={{ kind: "person", id: p.userId }} />
            <ShareButton
              path={ROOMMATES_ROUTES.person(p.userId)}
              title={p.name}
              subject={{
                ...(p.avatarUrl ? { avatar: p.avatarUrl } : { initial: p.name }),
                ...(p.handle ? { handle: `@${p.handle}` } : p.city ? { handle: p.city } : {}),
                headline: p.name,
                url: ROOMMATES_ROUTES.person(p.userId),
              }}
              shareCopy={{ title: share.title, share: share.share, background: share.background, stats: share.stats, name: share.name, copied: share.copied }}
            />
          </span>
        )
      }
    >
      <div className="nf-rmv" data-testid="roommate-profile">
        <div className="nf-rmv__main">
          <Header p={p} t={copy} now={now} />
          {p.intro ? (
            <section className="nf-rm-section" aria-labelledby="rmv-about">
              <SectionHead id="rmv-about" title={copy.profile.about} />
              <p className="nf-rmv__intro">{p.intro}</p>
            </section>
          ) : null}
          <Facts p={p} t={copy} />
          {Object.values(p.lifestyle).some((v) => v !== null) ? (
            <section className="nf-rm-section" aria-labelledby="rmv-life">
              <SectionHead id="rmv-life" title={copy.profile.lifestyle} />
              <LifestyleChips lifestyle={p.lifestyle} t={copy} labelled />
            </section>
          ) : null}
          {p.listings.length ? (
            <section className="nf-rm-section" aria-labelledby="rmv-posts">
              <SectionHead id="rmv-posts" title={copy.ui.profile.theirPosts} />
              <CardGrid kind="rooms">
                {p.listings.map((r) => (
                  <li key={r.id}>
                    <RoomCardView room={r} t={copy} today={today} />
                  </li>
                ))}
              </CardGrid>
            </section>
          ) : null}
          {p.isSelf ? null : <SafetyRows targetType="roommate_profile" targetId={p.userId} label={p.name} userId={p.userId} name={p.name.split(" ")[0] ?? p.name} signedIn />}
        </div>
        <aside className="nf-rmv__side">
          <ActionsSlot p={p} groups={groups} />
          {p.isSelf ? null : <MatchPanel match={p.match ?? { score: null, parts: {}, reasons: [] }} t={copy} />}
        </aside>
      </div>
      <div className="nf-rm-dock" data-testid="roommates-dock">
        {p.isSelf ? null : <SaveButton kind="person" id={p.userId} />}
        <ProfileActions userId={p.userId} name={p.name} isSelf={p.isSelf} connection={p.connection} groups={groups} />
      </div>
    </PageFrame>
  );
}

function ActionsSlot({ p, groups }: { p: RoommateProfileView; groups: { id: string; name: string }[] }) {
  return (
    <div className="nf-rm-panel nf-rmv__actcard">
      <ProfileActions userId={p.userId} name={p.name} isSelf={p.isSelf} connection={p.connection} groups={groups} />
    </div>
  );
}

function Header({ p, t: copy, now }: { p: RoommateProfileView; t: RoommatesCopy; now: number }) {
  const stage = p.lifeStage ? copy.lifeStages[p.lifeStage] : null;
  const school = p.institution ? p.institution.name : null;
  const study = [p.course, p.studyLevel].filter(Boolean).join(", ");
  return (
    <header className="nf-rmv-head" data-theme="dark" data-trusted={p.badges.includes("identity") && p.badges.length >= 2 ? "" : undefined}>
      <span className="nf-rmv-head__glow" aria-hidden="true" />
      <PersonFace person={p} size="xl" />
      <div className="nf-rmv-head__words">
        <h2 className="nf-rmv-head__name">
          {p.name}
          {p.badges.includes("identity") ? (
            <span className="nf-rm-card__tick" role="img" aria-label={copy.verification.kinds.identity}>
              <UiIcon name="verified" size={20} filled />
            </span>
          ) : null}
        </h2>
        <p className="nf-rmv-head__sub">
          {[stage, p.gender ? copy.gender[p.gender] : null].filter(Boolean).join(" · ")}
        </p>
        <ul className="nf-rmv-head__meta">
          {school ? (
            <li>
              <UiIcon name="id-card" size={16} />
              {study ? `${school}, ${study}` : school}
            </li>
          ) : null}
          {p.workplace ? (
            <li>
              <UiIcon name="briefcase" size={16} />
              {`${copy.profile.work} ${p.workplace}`}
            </li>
          ) : null}
          <li>
            <UiIcon name="clock" size={16} />
            {fill(copy.profile.activeAgo, { ago: ago(p.lastActiveAt, { now }) })}
          </li>
          <li>
            <UiIcon name="calendar-check" size={16} />
            {fill(copy.ui.profile.memberSince, { date: dayText(p.memberSince) })}
          </li>
        </ul>
      </div>
      <BadgesRow badges={p.badges} t={copy} />
    </header>
  );
}

function Facts({ p, t: copy }: { p: RoommateProfileView; t: RoommatesCopy }) {
  const where = placeText(p.areas.join(", "), p.city, stateName(p.stateCode));
  const budget = budgetText(p.budget, copy);
  const hint = monthlyHint(p.budget.maxMinor, p.budget.period, copy);
  const wants = [
    p.roomPref ? copy.roomPref[p.roomPref] : null,
    p.furnishedPref && p.furnishedPref !== "either" ? copy.furnishedPref[p.furnishedPref] : null,
    p.householdSize ? fill(copy.ui.profile.household, { n: p.householdSize }) : null,
    p.genderPref !== "any" ? copy.genderPref[p.genderPref] : null,
  ].filter((x): x is string => Boolean(x));
  const rows: { icon: UiIconName; label: string; value: string; sub?: string | null }[] = [];
  if (where) rows.push({ icon: "pin", label: copy.profile.lookingIn, value: where });
  if (budget) rows.push({ icon: "wallet", label: copy.profile.budget, value: budget, sub: hint });
  rows.push({ icon: "calendar-check", label: copy.profile.moveIn, value: p.moveInFlex === "asap" ? copy.moveInFlex.asap : p.moveInOn ? dayText(p.moveInOn) : copy.moveInFlex.flexible });
  if (wants.length) rows.push({ icon: "house-heart", label: copy.profile.accommodation, value: wants.join(" · ") });
  return (
    <dl className="nf-rmv-facts">
      {rows.map((r) => (
        <div key={r.label} className="nf-rmv-fact">
          <span className="nf-rm-plate" aria-hidden="true">
            <UiIcon name={r.icon} size={20} />
          </span>
          <div className="nf-rmv-fact__words">
            <dt>{r.label}</dt>
            <dd>
              {r.value}
              {r.sub ? <span className="nf-rmv-fact__sub">{r.sub}</span> : null}
            </dd>
          </div>
        </div>
      ))}
      {p.intents.length ? (
        <div className="nf-rmv-fact">
          <span className="nf-rm-plate" aria-hidden="true">
            <UiIcon name="circle-people" size={20} />
          </span>
          <div className="nf-rmv-fact__words">
            <dt>{copy.ui.profile.hereFor}</dt>
            <dd>{p.intents.map((i) => copy.intents[i]).join(" · ")}</dd>
          </div>
        </div>
      ) : null}
    </dl>
  );
}
