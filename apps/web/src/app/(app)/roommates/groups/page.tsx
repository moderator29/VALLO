import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { State } from "@/components/ui/State";
import { getDictionary, plural } from "@vallo/i18n";
import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { readMyRoommateProfile, readOpenGroups, readRoommatesHub, type GroupRow } from "@/lib/features/roommates/queries";
import { getLocale } from "@/lib/locale";

import { Empty, FaceStack, Plate, Section, Tag, fill } from "./_parts/kit";
import { JoinGroupButton } from "./_parts/GroupActions";
import "./_parts/fe-b.css";

export const metadata: Metadata = { title: "Find together" };
export const dynamic = "force-dynamic";

/**
 * FIND TOGETHER (FE-B): the member's own groups, the open groups near where
 * their roommate profile says they want to live (`roommate_open_groups`),
 * each with Request to join, and the door to start one. Nothing is invented:
 * a group with no faces shows its name and its count.
 */
export default async function RoommateGroupsPage() {
  const locale = await getLocale();
  const R = getDictionary(locale).roommates;
  const G = R.groupsX;
  const [hub, mine] = await Promise.all([readRoommatesHub(), readMyRoommateProfile()]);
  if (hub.live && !hub.signedIn) redirect(withNext("/sign-in", ROOMMATES_ROUTES.groups));
  if (!hub.live) {
    return (
      <PageFrame title={R.groups.title} subtitle={G.subtitle} fallback={ROOMMATES_ROUTES.home}>
        <State kind="empty" title={R.groups.title} body={R.notOpen} primary={{ href: ROOMMATES_ROUTES.home, label: R.title }} />
      </PageFrame>
    );
  }
  const where = mine.state === "ok" ? { stateCode: mine.profile.stateCode, city: mine.profile.city || null } : { stateCode: null, city: null };
  const open = await readOpenGroups(where);
  const myIds = new Set(hub.groups.map((g) => g.id));
  const joined = hub.groups.filter((g) => g.state !== "invited");
  const others = open.groups.filter((g) => !myIds.has(g.id));

  return (
    <PageFrame
      title={R.groups.title}
      subtitle={G.subtitle}
      fallback={ROOMMATES_ROUTES.home}
      width="wide"
      actions={
        <ButtonLink href={ROOMMATES_ROUTES.newGroup} variant="primary" size="sm" leadingIcon="plus">
          {G.start}
        </ButtonLink>
      }
    >
      <div className="nf-rmb nf-rmg-split" data-testid="roommates-groups">
        <Section title={G.mine} id="rm-groups-mine">
          {joined.length === 0 ? (
            <Empty href={ROOMMATES_ROUTES.newGroup} label={G.start}>
              {`${G.mineEmpty} ${G.startLine}`}
            </Empty>
          ) : (
            <ul className="nf-rmb-list">
              {joined.map((g) => (
                <li key={g.id}>
                  <GroupCard group={g} R={R} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={where.city || where.stateCode ? G.open : G.openAll} id="rm-groups-open">
          {others.length === 0 ? (
            <Empty href={ROOMMATES_ROUTES.newGroup} label={G.start}>
              {G.openEmpty}
            </Empty>
          ) : (
            <ul className="nf-rmb-list" data-testid="rm-open-groups">
              {others.map((g) => (
                <li key={g.id}>
                  <GroupCard group={g} R={R} locale={locale} join />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageFrame>
  );
}

function GroupCard({ group: g, R, locale, join = false }: { group: GroupRow; R: ReturnType<typeof getDictionary>["roommates"]; locale: Parameters<typeof plural>[2]; join?: boolean }) {
  const G = R.groupsX;
  return (
    <article className="nf-rmb-card">
      <div className="flex items-center gap-sm">
        <Plate icon="users" />
        <div className="grid min-w-0 flex-1 gap-3xs">
          <h3 className="nf-rmb-row__title">
            <Link href={ROOMMATES_ROUTES.group(g.id)}>{g.name}</Link>
          </h3>
          <p className="nf-rmb-row__line">{[g.city, plural(g.memberCount, G.members, locale)].filter(Boolean).join(" · ")}</p>
        </div>
        <Tag tone={g.stage === "living" ? "good" : "brand"}>{R.groups.stage[g.stage]}</Tag>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="flex items-center gap-xs">
          <FaceStack people={g.faces} />
          <span className="nf-rmb-row__time">{fill(G.ofTarget, { count: g.memberCount, target: g.sizeTarget })}</span>
        </span>
        {join ? (
          <JoinGroupButton groupId={g.id} />
        ) : g.state === "requested" ? (
          <Tag tone="quiet">{G.requested}</Tag>
        ) : (
          <ButtonLink href={ROOMMATES_ROUTES.group(g.id)} variant="secondary" size="sm">
            {G.viewGroup}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
