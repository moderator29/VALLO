import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { State } from "@/components/ui/State";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { getDictionary, formatMoney, plural, type Locale } from "@vallo/i18n";
import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES, filtersQuery, type ListingStatus } from "@/lib/features/roommates/model";
import { readRoommatesHub, type InterestRow, type RoommatesHub } from "@/lib/features/roommates/queries";
import { agoShort, dateTimeLabel, requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";

import { Empty, Face, Plate, Section, Tag, fill } from "../groups/_parts/kit";
import "../groups/_parts/fe-b.css";
import {
  ConnectionActions,
  GroupInviteActions,
  OutgoingActions,
  PostActions,
  ProfileStatusActions,
  RequestActions,
  SearchActions,
  ViewingActions,
} from "./_parts/HubActions";

export const metadata: Metadata = { title: "My roommates" };
export const dynamic = "force-dynamic";

const TABS = ["requests", "connections", "posts", "groups", "viewings", "searches", "verification"] as const;
type Tab = (typeof TABS)[number];

function readTab(v: string | string[] | undefined): Tab {
  return typeof v === "string" && (TABS as readonly string[]).includes(v) ? (v as Tab) : "requests";
}

/**
 * MY ROOMMATES, THE HUB (FE-B, WORK_PLAN.md). One page for everything that
 * waits on the member: requests in and out, connections, their posts, groups
 * and invitations, viewings, saved searches and checks. Each section is a tab
 * in the address (`?tab=`), so Back and a shared link land on it, and each
 * carries its live count. Every list is the database's own read
 * (`roommate_my_hub`); an empty one says what is true and the next step.
 */
export default async function RoommatesHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = readTab(params.tab);
  const locale = await getLocale();
  const t = getDictionary(locale);
  const R = t.roommates;
  const X = R.hubX;
  const hub = await readRoommatesHub();
  const now = requestNow();

  if (hub.live && !hub.signedIn) redirect(withNext("/sign-in", ROOMMATES_ROUTES.hub));

  if (!hub.live) {
    return (
      <PageFrame title={R.hub.title} subtitle={X.subtitle} fallback={ROOMMATES_ROUTES.home}>
        <State kind="empty" title={R.hub.title} body={R.notOpen} primary={{ href: ROOMMATES_ROUTES.home, label: R.title }} />
      </PageFrame>
    );
  }

  const incoming = hub.interests.filter((i) => i.direction === "in" && i.status === "pending");
  const outgoing = hub.interests.filter((i) => i.direction === "out" && i.status === "pending");
  const connections = hub.interests.filter((i) => i.status === "accepted");
  const activeGroups = hub.groups.filter((g) => g.state === "active").map((g) => ({ id: g.id, name: g.name }));
  const counts: Record<Tab, number> = {
    requests: incoming.length,
    connections: connections.length,
    posts: hub.listings.length,
    groups: hub.groups.length,
    viewings: hub.viewings.filter((v) => v.status === "requested" || v.status === "confirmed").length,
    searches: hub.searches.length,
    verification: hub.verifications.length,
  };
  const tabs = TABS.map((key) => ({
    key,
    label: R.hub[key === "posts" ? "listings" : key],
    href: key === "requests" ? ROOMMATES_ROUTES.hub : `${ROOMMATES_ROUTES.hub}?tab=${key}`,
    count: counts[key],
  }));

  return (
    <PageFrame
      title={R.hub.title}
      subtitle={X.subtitle}
      fallback={ROOMMATES_ROUTES.home}
      width="wide"
      tabs={<UnderlineTabs items={tabs} active={tab} label={X.tabsLabel} itemTestIdPrefix="rm-hub-tab-" />}
    >
      <div className="nf-rmb" data-testid="roommates-hub">
        <ProfileCard hub={hub} t={X} />
        {tab === "requests" ? <Requests incoming={incoming} outgoing={outgoing} now={now} locale={locale} X={X} /> : null}
        {tab === "connections" ? <Connections rows={connections} groups={activeGroups} now={now} locale={locale} X={X} /> : null}
        {tab === "posts" ? <Posts hub={hub} locale={locale} R={R} /> : null}
        {tab === "groups" ? <Groups hub={hub} X={X} R={R} /> : null}
        {tab === "viewings" ? <Viewings hub={hub} now={now} locale={locale} R={R} /> : null}
        {tab === "searches" ? <Searches hub={hub} locale={locale} R={R} /> : null}
        {tab === "verification" ? <Checks hub={hub} now={now} locale={locale} R={R} /> : null}
      </div>
    </PageFrame>
  );
}

type Words = ReturnType<typeof getDictionary>["roommates"];
type HubWords = Words["hubX"];

function ProfileCard({ hub, t }: { hub: RoommatesHub; t: HubWords }) {
  const s = hub.myStatus;
  const tone = s === "active" ? "good" : s === "held" ? "warn" : "quiet";
  return (
    <section className="nf-rmb-card nf-rmb-card--smoked nf-rmh-status" data-testid="rm-hub-profile" aria-labelledby="rm-hub-profile-title">
      <div className="grid gap-2xs">
        <h2 id="rm-hub-profile-title" className="nf-rmh-status__title">
          <span>{t.profile.title}</span>
          <Tag tone={tone}>{t.profile.status[s]}</Tag>
        </h2>
        <p className="nf-rmh-status__line">{t.profile.line[s]}</p>
      </div>
      <div className="nf-rmh-status__actions">
        {s === "none" ? (
          <ButtonLink href={ROOMMATES_ROUTES.profile} variant="primary" size="sm">
            {t.profile.create}
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href={ROOMMATES_ROUTES.profile} variant={s === "draft" ? "primary" : "secondary"} size="sm">
              {t.profile.edit}
            </ButtonLink>
            {s === "active" || s === "paused" ? <ProfileStatusActions status={s} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

/** Today, Yesterday, This week, Earlier: the reference's notification grouping. */
function bucketOf(iso: string, now: number): "today" | "yesterday" | "week" | "earlier" {
  const day = 24 * 3600 * 1000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t = Date.parse(iso);
  if (t >= start.getTime()) return "today";
  if (t >= start.getTime() - day) return "yesterday";
  if (t >= start.getTime() - 6 * day) return "week";
  return "earlier";
}

function grouped<T>(rows: T[], when: (row: T) => string, now: number): { key: "today" | "yesterday" | "week" | "earlier"; rows: T[] }[] {
  const order = ["today", "yesterday", "week", "earlier"] as const;
  return order.map((key) => ({ key, rows: rows.filter((r) => bucketOf(when(r), now) === key) })).filter((g) => g.rows.length > 0);
}

function Requests({ incoming, outgoing, now, locale, X }: { incoming: InterestRow[]; outgoing: InterestRow[]; now: number; locale: Locale; X: HubWords }) {
  return (
    <div className="nf-rmb">
      <Section title={X.requests.incoming} id="rm-hub-in">
        {incoming.length === 0 ? (
          <Empty href={ROOMMATES_ROUTES.discover} label={X.requests.findPeople}>
            {X.requests.emptyIn}
          </Empty>
        ) : (
          grouped(incoming, (r) => r.createdAt, now).map((g) => (
            <div key={g.key} className="grid gap-xs">
              <p className="nf-rmb-section__overline">{X.groupsLabel[g.key]}</p>
              <ul className="nf-rmb-rows" data-testid="rm-hub-incoming">
                {g.rows.map((r) => (
                  <li key={r.id} className="nf-rmb-row nf-rmb-arrive">
                    <Face person={r.person} />
                    <div className="nf-rmb-row__text">
                      <p className="nf-rmb-row__title">
                        <Link href={ROOMMATES_ROUTES.person(r.person.userId)}>{r.person.name}</Link>
                      </p>
                      <p className="nf-rmb-row__line">{r.listing ? fill(X.requests.about, { title: r.listing.title }) : fill(X.requests.inviteLine, { name: r.person.name })}</p>
                    </div>
                    <span className="nf-rmb-row__aside">
                      <span className="nf-rmb-row__time">{agoShort(r.createdAt, { now, locale })}</span>
                      <span className="nf-rmb-dot" aria-hidden="true" />
                    </span>
                    <div className="nf-rmb-row__actions">
                      <RequestActions id={r.id} person={r.person} note={r.note} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Section>
      <Section title={X.requests.outgoing} id="rm-hub-out">
        {outgoing.length === 0 ? (
          <Empty>{X.requests.emptyOut}</Empty>
        ) : (
          <ul className="nf-rmb-rows" data-testid="rm-hub-outgoing">
            {outgoing.map((r) => (
              <li key={r.id} className="nf-rmb-row">
                <Face person={r.person} />
                <div className="nf-rmb-row__text">
                  <p className="nf-rmb-row__title">
                    <Link href={ROOMMATES_ROUTES.person(r.person.userId)}>{r.person.name}</Link>
                  </p>
                  <p className="nf-rmb-row__line">{r.listing ? fill(X.requests.about, { title: r.listing.title }) : X.requests.status[r.status]}</p>
                </div>
                <span className="nf-rmb-row__aside">
                  <span className="nf-rmb-row__time">{agoShort(r.createdAt, { now, locale })}</span>
                </span>
                <div className="nf-rmb-row__actions">
                  <OutgoingActions id={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Connections({ rows, groups, now, locale, X }: { rows: InterestRow[]; groups: { id: string; name: string }[]; now: number; locale: Locale; X: HubWords }) {
  if (rows.length === 0) {
    return (
      <Empty href={ROOMMATES_ROUTES.discover} label={X.requests.findPeople}>
        {X.connections.empty}
      </Empty>
    );
  }
  return (
    <ul className="nf-rmb-rows" data-testid="rm-hub-connections">
      {rows.map((r) => (
        <li key={r.id} className="nf-rmb-row">
          <Face person={r.person} />
          <div className="nf-rmb-row__text">
            <p className="nf-rmb-row__title">
              <Link href={ROOMMATES_ROUTES.person(r.person.userId)}>{r.person.name}</Link>
            </p>
            {r.listing ? <p className="nf-rmb-row__line">{fill(X.requests.about, { title: r.listing.title })}</p> : null}
          </div>
          <span className="nf-rmb-row__aside">
            <span className="nf-rmb-row__time">{agoShort(r.decidedAt ?? r.createdAt, { now, locale })}</span>
          </span>
          <div className="nf-rmb-row__actions">
            <ConnectionActions interestId={r.id} conversationId={r.conversationId} person={r.person} groups={groups} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function statusTone(s: ListingStatus): "good" | "quiet" | "warn" | "bad" | "brand" {
  if (s === "live") return "good";
  if (s === "removed") return "bad";
  if (s === "paused" || s === "draft") return "quiet";
  if (s === "expired") return "warn";
  return "brand";
}

function Posts({ hub, locale, R }: { hub: RoommatesHub; locale: Locale; R: Words }) {
  const X = R.hubX;
  if (hub.listings.length === 0) {
    return (
      <Empty href={ROOMMATES_ROUTES.create} label={X.posts.create}>
        {X.posts.empty}
      </Empty>
    );
  }
  return (
    <ul className="nf-rmb-list" data-testid="rm-hub-posts">
      {hub.listings.map((l) => (
        <li key={l.id} className="nf-rmb-card nf-rmh-post">
          <div className="nf-rmh-post__photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- a member's own upload from the public bucket, already sized */}
            {l.photoUrls[0] ? <img src={l.photoUrls[0]} alt="" loading="lazy" /> : null}
          </div>
          <div className="grid gap-2xs min-w-0">
            <div className="flex flex-wrap items-center gap-xs">
              <Tag tone={statusTone(l.status)}>{R.listingStatus[l.status]}</Tag>
              <span className="nf-rmb-row__line">{R.listingKinds[l.kind]}</span>
            </div>
            <p className="nf-rmb-row__title">
              <Link href={ROOMMATES_ROUTES.listing(l.id)}>{l.title}</Link>
            </p>
            <p className="nf-rmh-post__meta">
              {l.rentMinor !== null ? (
                <span>
                  {formatMoney(l.shareMinor ?? l.rentMinor, locale)}
                  {R.perPeriod[l.rentPeriod]}
                </span>
              ) : null}
              <span>{plural(l.viewCount, X.posts.views, locale)}</span>
              <span>{plural(l.interestCount, X.posts.interest, locale)}</span>
            </p>
          </div>
          <div className="nf-rmh-post__actions">
            <PostActions id={l.id} status={l.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Groups({ hub, X, R }: { hub: RoommatesHub; X: HubWords; R: Words }) {
  const invites = hub.groups.filter((g) => g.state === "invited");
  const mine = hub.groups.filter((g) => g.state !== "invited");
  return (
    <div className="nf-rmb">
      {invites.length > 0 ? (
        <Section title={X.groups.invites} id="rm-hub-invites">
          <ul className="nf-rmb-rows" data-testid="rm-hub-group-invites">
            {invites.map((g) => (
              <li key={g.id} className="nf-rmb-row">
                <Face person={g.invitedBy} />
                <div className="nf-rmb-row__text">
                  <p className="nf-rmb-row__title">{g.name}</p>
                  <p className="nf-rmb-row__line">{g.invitedBy ? fill(X.groups.invitedBy, { name: g.invitedBy.name }) : R.groups.stage[g.stage]}</p>
                </div>
                <span className="nf-rmb-row__aside">
                  <span className="nf-rmb-row__time">{fill(X.groups.members, { count: g.memberCount, target: g.sizeTarget })}</span>
                </span>
                <div className="nf-rmb-row__actions">
                  <GroupInviteActions groupId={g.id} groupName={g.name} inviter={g.invitedBy} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section
        title={X.groups.mine}
        id="rm-hub-groups"
        action={
          <Link href={ROOMMATES_ROUTES.groups} className="nf-link">
            {X.groups.open}
          </Link>
        }
      >
        {mine.length === 0 ? (
          <Empty href={ROOMMATES_ROUTES.newGroup} label={X.groups.start}>
            {X.groups.empty}
          </Empty>
        ) : (
          <ul className="nf-rmb-rows" data-testid="rm-hub-groups">
            {mine.map((g) => (
              <li key={g.id} className="nf-rmb-row">
                <Plate icon="users" />
                <div className="nf-rmb-row__text">
                  <p className="nf-rmb-row__title">
                    <Link href={ROOMMATES_ROUTES.group(g.id)}>{g.name}</Link>
                  </p>
                  <p className="nf-rmb-row__line">{g.state === "requested" ? X.groups.requested : [R.groups.stage[g.stage], g.city].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="nf-rmb-row__aside">
                  <span className="nf-rmb-row__time">{fill(X.groups.members, { count: g.memberCount, target: g.sizeTarget })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Viewings({ hub, now, locale, R }: { hub: RoommatesHub; now: number; locale: Locale; R: Words }) {
  const X = R.hubX;
  if (hub.viewings.length === 0) {
    return (
      <Empty href={ROOMMATES_ROUTES.rooms} label={R.discover.rooms}>
        {X.viewings.empty}
      </Empty>
    );
  }
  const sides = [
    { key: "host" as const, title: X.viewings.host },
    { key: "guest" as const, title: X.viewings.guest },
  ];
  return (
    <div className="nf-rmb">
      {sides.map((side) => {
        const rows = hub.viewings.filter((v) => v.role === side.key);
        if (rows.length === 0) return null;
        return (
          <Section key={side.key} title={side.title} id={`rm-hub-viewings-${side.key}`}>
            <ul className="nf-rmb-rows" data-testid={`rm-hub-viewings-${side.key}`}>
              {rows.map((v) => (
                <li key={v.id} className="nf-rmb-row">
                  <Face person={v.person} />
                  <div className="nf-rmb-row__text">
                    <p className="nf-rmb-row__title">
                      <Link href={ROOMMATES_ROUTES.listing(v.listing.id)}>{v.listing.title}</Link>
                    </p>
                    <p className="nf-rmb-row__line">
                      {fill(X.viewings.with, { name: v.person.name })} · {v.mode === "virtual" ? R.viewings.virtual : R.viewings.inPerson}
                    </p>
                    <p className="nf-rmb-row__line">
                      {dateTimeLabel(v.proposedAt, { now: new Date(now), locale })}
                      {v.altAt ? ` · ${fill(X.viewings.alt, { when: dateTimeLabel(v.altAt, { now: new Date(now), locale }) })}` : ""}
                    </p>
                  </div>
                  <span className="nf-rmb-row__aside">
                    <Tag tone={v.status === "confirmed" ? "good" : v.status === "requested" ? "brand" : "quiet"}>{R.viewings.status[v.status]}</Tag>
                  </span>
                  <div className="nf-rmb-row__actions">
                    <ViewingActions id={v.id} role={v.role} status={v.status} altAt={v.altAt} altLabel={v.altAt ? dateTimeLabel(v.altAt, { now: new Date(now), locale }) : null} past={Date.parse(v.proposedAt) < now} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
      <p className="nf-rmb-note">{R.viewings.notReserved}</p>
    </div>
  );
}

function Searches({ hub, locale, R }: { hub: RoommatesHub; locale: Locale; R: Words }) {
  const X = R.hubX;
  if (hub.searches.length === 0) {
    return (
      <Empty href={ROOMMATES_ROUTES.discover} label={X.searches.discover}>
        {X.searches.empty}
      </Empty>
    );
  }
  return (
    <ul className="nf-rmb-rows" data-testid="rm-hub-searches">
      {hub.searches.map((s) => {
        const href = `${ROOMMATES_ROUTES.discover}${filtersQuery({
          mode: "rooms",
          kind: s.kind,
          stateCode: s.stateCode,
          city: s.city,
          institutionId: s.institutionId,
          maxMinor: s.maxMinor,
          period: s.period,
        })}`;
        const where = [s.city, s.stateCode].filter(Boolean).join(", ") || X.searches.any;
        return (
          <li key={s.id} className="nf-rmb-row">
            <Plate icon="search" />
            <div className="nf-rmb-row__text">
              <p className="nf-rmb-row__title">
                <Link href={href}>{s.label}</Link>
              </p>
              <p className="nf-rmb-row__line">
                {where}
                {s.kind ? ` · ${R.listingKinds[s.kind]}` : ""}
                {s.maxMinor ? ` · ${fill(X.searches.upTo, { amount: `${formatMoney(s.maxMinor, locale)}${R.perPeriod[s.period]}` })}` : ""}
              </p>
            </div>
            <span />
            <div className="nf-rmb-row__actions">
              <SearchActions id={s.id} alert={s.alert} href={href} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Checks({ hub, now, locale, R }: { hub: RoommatesHub; now: number; locale: Locale; R: Words }) {
  const X = R.hubX;
  const V = R.verification;
  return (
    <div className="nf-rmb">
      {hub.verifications.length === 0 ? (
        <Empty href={ROOMMATES_ROUTES.verify} label={X.verification.start}>
          {X.verification.empty}
        </Empty>
      ) : (
        <ul className="nf-rmb-rows" data-testid="rm-hub-checks">
          {hub.verifications.map((v) => (
            <li key={v.id} className="nf-rmb-row">
              <Plate icon={v.status === "verified" ? "shield-check" : "hourglass"} />
              <div className="nf-rmb-row__text">
                <p className="nf-rmb-row__title">{V.kinds[v.kind]}</p>
                <p className="nf-rmb-row__line">
                  {[v.institution?.shortName ?? v.institution?.name, v.emailMasked, fill(X.verification.submitted, { when: agoShort(v.createdAt, { now, locale }) })].filter(Boolean).join(" · ")}
                </p>
                {v.reason && v.status === "rejected" ? <p className="nf-rmb-row__line">{v.reason}</p> : null}
              </div>
              <span className="nf-rmb-row__aside">
                <Tag tone={v.status === "verified" ? "good" : v.status === "rejected" ? "bad" : v.status === "expired" ? "warn" : "brand"}>{V.status[v.status]}</Tag>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="nf-rmb-actions">
        <ButtonLink href={ROOMMATES_ROUTES.verify} variant="primary" size="sm">
          {X.verification.start}
        </ButtonLink>
      </div>
      <p className="nf-rmb-note">{V.honest}</p>
    </div>
  );
}
