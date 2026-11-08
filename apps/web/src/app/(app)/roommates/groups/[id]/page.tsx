import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { State } from "@/components/ui/State";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { formatMoney, getDictionary, plural, type Locale } from "@vallo/i18n";
import { resolveSessionClaims } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES, splitCosts, type ExpenseStatus } from "@/lib/features/roommates/model";
import { readMyConnections, readRoommateGroup, type GroupView } from "@/lib/features/roommates/queries";
import { agoShort, dayLabel, requestNow } from "@/lib/format/when";
import { getLocale } from "@/lib/locale";

import {
  AddExpense,
  BoardComposer,
  DeletePost,
  ExpenseControls,
  InvitePicker,
  InvitedActions,
  JoinGroupButton,
  JoinRequestDecision,
  LeaveGroup,
  RemoveMember,
  ShareEditor,
  ShortlistPanel,
  StageControl,
} from "../_parts/GroupActions";
import { Empty, Face, FaceStack, Plate, Section, Tag, fill } from "../_parts/kit";
import "../_parts/fe-b.css";

export const metadata: Metadata = { title: "Group" };
export const dynamic = "force-dynamic";

const TABS = ["shortlist", "members", "board", "costs"] as const;
type Tab = (typeof TABS)[number];
type Words = ReturnType<typeof getDictionary>["roommates"];

const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * THE GROUP DASHBOARD (FE-B): the founder's smoked dashboard in Vallo blue.
 * A header with the stage and the members' faces, four stat tiles (members
 * against the target, budget each, homes shortlisted, days to move in), then
 * the work as tabs in the address: the shortlist with votes and a compare,
 * the members, the board and the household costs. A member who is not in the
 * group sees an open group's summary and Request to join; an invited member
 * sees Accept and Decline.
 */
export default async function RoommateGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!uuidShape.test(id)) notFound();
  const query = await searchParams;
  const locale = await getLocale();
  const R = getDictionary(locale).roommates;
  const G = R.groupsX;
  const read = await readRoommateGroup(id);
  const now = requestNow();

  if (read.state === "signed-out") redirect(withNext("/sign-in", ROOMMATES_ROUTES.group(id)));
  if (read.state === "not-open") {
    return (
      <PageFrame title={R.groups.title} fallback={ROOMMATES_ROUTES.groups}>
        <State kind="empty" title={R.groups.title} body={R.notOpen} primary={{ href: ROOMMATES_ROUTES.home, label: R.title }} />
      </PageFrame>
    );
  }
  if (read.state === "not-found") {
    return (
      <PageFrame title={R.groups.title} fallback={ROOMMATES_ROUTES.groups}>
        <State kind="empty" title={R.groups.title} body={G.notFound} primary={{ href: ROOMMATES_ROUTES.groups, label: G.openAll }} />
      </PageFrame>
    );
  }
  const g = read.group;
  const active = g.members.filter((m) => m.state === "active");
  const isMember = g.myState === "active";
  const isOwner = isMember && g.myRole === "owner";
  const claims = await resolveSessionClaims();
  const me = claims.state === "signed-in" ? claims.userId : null;

  if (!isMember) return <Outsider g={g} R={R} locale={locale} />;

  const tabParam = typeof query.tab === "string" && (TABS as readonly string[]).includes(query.tab) ? (query.tab as Tab) : null;
  const tab: Tab = tabParam ?? (g.stage === "living" ? "costs" : "shortlist");
  const base = ROOMMATES_ROUTES.group(g.id);
  const tabs = TABS.map((key) => ({
    key,
    label: G.dash.tabs[key],
    href: `${base}?tab=${key}`,
    count: key === "shortlist" ? g.shortlist.length : key === "members" ? active.length : key === "board" ? g.posts.length : g.expenses.length,
  }));
  const connections = isOwner ? await readMyConnections() : [];

  return (
    <PageFrame
      title={g.name}
      subtitle={[R.groups.stage[g.stage], g.city].filter(Boolean).join(" · ")}
      fallback={ROOMMATES_ROUTES.groups}
      width="wide"
      tabs={<UnderlineTabs items={tabs} active={tab} label={G.dash.tabsLabel} itemTestIdPrefix="rm-group-tab-" />}
    >
      <div className="nf-rmb" data-testid="roommates-group">
        <header className="nf-rmg-head">
          <div className="nf-rmg-head__top">
            <span className="flex items-center gap-sm">
              <Tag tone={g.stage === "living" ? "good" : "brand"}>{R.groups.stage[g.stage]}</Tag>
              <Tag tone="quiet">{G.visibility[g.visibility]}</Tag>
              <FaceStack people={active} />
            </span>
            <span className="nf-rmb-actions">
              {isOwner ? <StageControl groupId={g.id} stage={g.stage} /> : null}
              {isOwner ? <InvitePicker groupId={g.id} groupName={g.name} connections={connections} memberIds={g.members.map((m) => m.userId)} /> : null}
            </span>
          </div>
          {g.intro ? <p className="nf-rmg-head__intro">{g.intro}</p> : null}
        </header>

        <Tiles g={g} R={R} locale={locale} now={now} />

        {tab === "shortlist" ? (
          <Section title={R.groups.shortlist} id="rm-group-shortlist">
            <ShortlistPanel
              groupId={g.id}
              items={g.shortlist}
              members={active.length}
              removable={g.shortlist.filter((s) => isOwner || s.addedBy.userId === me).map((s) => s.id)}
            />
          </Section>
        ) : null}
        {tab === "members" ? <Members g={g} R={R} isOwner={isOwner} /> : null}
        {tab === "board" ? <Board g={g} R={R} isOwner={isOwner} now={now} locale={locale} /> : null}
        {tab === "costs" ? <Costs g={g} R={R} locale={locale} now={now} /> : null}
      </div>
    </PageFrame>
  );
}

function Tiles({ g, R, locale, now }: { g: GroupView; R: Words; locale: Locale; now: number }) {
  const D = R.groupsX.dash;
  const active = g.members.filter((m) => m.state === "active").length;
  const budget =
    g.budgetMaxMinor !== null ? (
      <>
        {g.budgetMinMinor !== null && g.budgetMinMinor !== g.budgetMaxMinor ? (
          <>
            <Money minor={g.budgetMinMinor} locale={locale} mode="compact" />
            {" - "}
          </>
        ) : null}
        <Money minor={g.budgetMaxMinor} locale={locale} mode="compact" period={g.budgetPeriod} />
      </>
    ) : null;
  let moveIn: string = D.noDate;
  if (g.moveInOn) {
    const days = Math.ceil((Date.parse(`${g.moveInOn}T00:00:00`) - now) / (24 * 3600 * 1000));
    moveIn = days > 0 ? plural(days, D.daysLeft, locale) : days === 0 ? D.today : D.passed;
  }
  return (
    <dl className="nf-rmg-tiles" data-testid="rm-group-tiles">
      <div className="nf-rmg-tile">
        <dt>{D.tiles.members}</dt>
        <dd>
          {active}
          <span className="nf-rmg-tile__unit">{` / ${g.sizeTarget}`}</span>
        </dd>
      </div>
      <div className="nf-rmg-tile">
        <dt>{D.tiles.budget}</dt>
        <dd>
          {budget ?? D.noBudget}
          {budget ? <span className="nf-rmg-tile__unit">{R.perPeriod[g.budgetPeriod]}</span> : null}
        </dd>
      </div>
      <div className="nf-rmg-tile">
        <dt>{D.tiles.homes}</dt>
        <dd>{g.shortlist.length}</dd>
      </div>
      <div className="nf-rmg-tile">
        <dt>{D.tiles.moveIn}</dt>
        <dd>
          {moveIn}
          {g.moveInOn ? <span className="nf-rmg-tile__unit">{` · ${dayLabel(g.moveInOn, { now: new Date(now), locale })}`}</span> : null}
        </dd>
      </div>
    </dl>
  );
}

function Members({ g, R, isOwner }: { g: GroupView; R: Words; isOwner: boolean }) {
  const M = R.groupsX.membersX;
  const active = g.members.filter((m) => m.state === "active");
  const requested = g.members.filter((m) => m.state === "requested");
  const invited = g.members.filter((m) => m.state === "invited");
  return (
    <div className="nf-rmb">
      {isOwner && requested.length > 0 ? (
        <Section title={M.requests} id="rm-group-requests">
          <ul className="nf-rmb-rows" data-testid="rm-group-requests">
            {requested.map((m) => (
              <li key={m.userId} className="nf-rmb-row">
                <Face person={m} />
                <div className="nf-rmb-row__text">
                  <p className="nf-rmb-row__title">
                    <Link href={ROOMMATES_ROUTES.person(m.userId)}>{m.name}</Link>
                  </p>
                </div>
                <span />
                <div className="nf-rmb-row__actions">
                  <JoinRequestDecision groupId={g.id} person={m} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title={R.groups.members} id="rm-group-members">
        {active.length <= 1 && invited.length === 0 ? <Empty>{R.groups.noMembers}</Empty> : null}
        <ul className="nf-rmb-rows" data-testid="rm-group-members">
          {[...active, ...invited].map((m) => (
            <li key={m.userId} className="nf-rmb-row">
              <Face person={m} />
              <div className="nf-rmb-row__text">
                <p className="nf-rmb-row__title">
                  <Link href={ROOMMATES_ROUTES.person(m.userId)}>{m.name}</Link>
                </p>
                <p className="nf-rmb-row__line">{m.state === "invited" ? M.pending : m.role === "owner" ? M.owner : m.sharePercent !== null ? `${M.share}: ${m.sharePercent}%` : M.shareEqual}</p>
              </div>
              <span />
              {m.state === "active" ? (
                <div className="nf-rmb-row__actions">
                  {isOwner ? <ShareEditor groupId={g.id} member={m} /> : null}
                  {isOwner && m.role !== "owner" ? <RemoveMember groupId={g.id} person={m} /> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
      <div className="nf-rmb-actions">
        <LeaveGroup groupId={g.id} groupName={g.name} />
      </div>
    </div>
  );
}

function Board({ g, R, isOwner, now, locale }: { g: GroupView; R: Words; isOwner: boolean; now: number; locale: Locale }) {
  const B = R.groupsX.boardX;
  return (
    <Section title={R.groups.board} id="rm-group-board">
      <BoardComposer groupId={g.id} />
      {g.posts.length === 0 ? (
        <Empty>{B.empty}</Empty>
      ) : (
        <ul className="nf-rmb-list" data-testid="rm-group-posts">
          {g.posts.map((p) => (
            <li key={p.id} className="nf-rmb-card nf-rmg-post">
              <Face person={p.author} size="sm" />
              <div className="grid min-w-0 gap-2xs">
                <p className="nf-rmb-row__title">
                  {p.author.name} <span className="nf-rmb-row__time">{agoShort(p.createdAt, { now, locale })}</span>
                </p>
                <p className="nf-rmg-post__body">{p.body}</p>
                {p.mine || isOwner ? (
                  <div className="nf-rmb-actions">
                    <DeletePost groupId={g.id} post={p} />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Costs({ g, R, locale, now }: { g: GroupView; R: Words; locale: Locale; now: number }) {
  const C = R.groupsX.costsX;
  const active = g.members.filter((m) => m.state === "active");
  const sum = (s?: ExpenseStatus) => g.expenses.filter((e) => !s || e.status === s).reduce((a, e) => a + e.amountMinor, 0);
  const total = sum();
  /* Shares when every member has one and they add to something; equal otherwise. */
  const byShare = active.length > 0 && active.every((m) => m.sharePercent !== null) && active.reduce((a, m) => a + (m.sharePercent ?? 0), 0) > 0;
  const weights = active.length ? active.map((m) => (byShare ? (m.sharePercent ?? 0) : 1)) : [1];
  const split = splitCosts([{ key: "household", label: C.total, amountMinor: total, period: "once" }], weights);
  const nextDue = g.expenses
    .filter((e) => e.dueOn && e.status !== "settled" && Date.parse(`${e.dueOn}T23:59:59`) >= now)
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1))[0];

  return (
    <div className="nf-rmb">
      {g.stage === "living" ? (
        <p className="nf-rmb-card nf-rmb-card--smoked nf-rmb-note" data-testid="rm-costs-living">
          <UiIcon name="home" size={16} />
          <span>{C.livingNote}</span>
        </p>
      ) : null}
      <div className="nf-rmg-split">
        <Section title={R.groups.costs} id="rm-group-costs" action={<AddExpense groupId={g.id} members={active} />}>
          <dl className="nf-rmg-totals">
            <div>
              <dt>{C.totalPlanned}</dt>
              <dd>{formatMoney(sum("planned"), locale)}</dd>
            </div>
            <div>
              <dt>{C.totalRecorded}</dt>
              <dd>{formatMoney(sum("recorded"), locale)}</dd>
            </div>
            <div>
              <dt>{C.totalSettled}</dt>
              <dd>{formatMoney(sum("settled"), locale)}</dd>
            </div>
          </dl>
          {g.expenses.length === 0 ? (
            <Empty>{C.empty}</Empty>
          ) : (
            <ul className="nf-rmb-rows" data-testid="rm-group-expenses">
              {g.expenses.map((e) => (
                <li key={e.id} className="nf-rmb-row">
                  <Plate icon={e.status === "settled" ? "circle-check" : "receipt"} />
                  <div className="nf-rmb-row__text">
                    <p className="nf-rmb-row__title">{e.title}</p>
                    <p className="nf-rmb-row__line">
                      {[C.status[e.status], e.paidBy ? `${C.paidBy} ${e.paidBy.name}` : C.nobody, e.dueOn ? dayLabel(e.dueOn, { now: new Date(now), locale }) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="nf-rmb-row__aside">
                    <span className="nf-rmb-row__amount">{formatMoney(e.amountMinor, locale)}</span>
                  </span>
                  <div className="nf-rmb-row__actions">
                    <ExpenseControls groupId={g.id} expense={e} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="nf-rmb-note">
            <UiIcon name="info" size={16} />
            <span>{R.groups.recordedNote}</span>
          </p>
        </Section>
        <div className="nf-rmb">
          <Section title={C.perPerson} id="rm-group-per-person">
            <p className="nf-rmb-section__overline">{byShare ? C.byShare : C.byEqual}</p>
            <ul className="nf-rmb-rows" data-testid="rm-group-per-person">
              {active.map((m, i) => (
                <li key={m.userId} className="nf-rmb-row">
                  <Face person={m} size="sm" />
                  <p className="nf-rmb-row__title">{m.name}</p>
                  <span className="nf-rmb-row__amount">{formatMoney(split.shares[i]?.upfrontMinor ?? 0, locale)}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href={`${ROOMMATES_ROUTES.split}?people=${Math.max(1, active.length)}`} variant="secondary" size="sm" leadingIcon="scale">
              {C.splitter}
            </ButtonLink>
          </Section>
          {nextDue ? (
            <div className="nf-rmb-card nf-rmb-card--smoked nf-rmg-calendar" data-testid="rm-group-next-due">
              <span className="nf-rmb-section__overline">{C.due}</span>
              <span className="nf-rmg-calendar__day">{dayLabel(nextDue.dueOn!, { now: new Date(now), locale })}</span>
              <span className="nf-rmb-row__line">{`${nextDue.title} · ${formatMoney(nextDue.amountMinor, locale)}`}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Outsider({ g, R, locale }: { g: GroupView; R: Words; locale: Locale }) {
  const G = R.groupsX;
  const O = G.outsider;
  const active = g.members.filter((m) => m.state === "active");
  const inviter = g.members.find((m) => m.role === "owner") ?? null;
  return (
    <PageFrame title={g.name} subtitle={[R.groups.stage[g.stage], g.city].filter(Boolean).join(" · ")} fallback={ROOMMATES_ROUTES.groups}>
      <div className="nf-rmb" data-testid="roommates-group-outsider">
        <section className="nf-rmb-card nf-rmb-card--smoked">
          <span className="flex flex-wrap items-center gap-sm">
            <Tag tone="brand">{R.groups.stage[g.stage]}</Tag>
            <Tag tone="quiet">{G.visibility[g.visibility]}</Tag>
            <FaceStack people={active} />
            <span className="nf-rmb-row__line">{plural(active.length, G.members, locale)}</span>
          </span>
          {g.intro ? <p className="nf-rmg-head__intro">{g.intro}</p> : null}
          <p className="nf-rmb-row__line">
            {[g.areas.join(", ") || null, g.institution?.shortName ?? g.institution?.name ?? null, g.budgetMaxMinor !== null ? `${formatMoney(g.budgetMaxMinor, locale)}${R.perPeriod[g.budgetPeriod]}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {g.myState === "invited" ? (
            <>
              <p className="nf-rmb-row__line">{fill(O.invited, { name: inviter?.name ?? "" })}</p>
              <InvitedActions groupId={g.id} groupName={g.name} inviter={inviter} />
            </>
          ) : g.myState === "requested" ? (
            <p className="nf-rmb-row__line">{O.requested}</p>
          ) : g.visibility === "open" ? (
            <div className="nf-rmb-actions">
              <JoinGroupButton groupId={g.id} />
            </div>
          ) : (
            <p className="nf-rmb-row__line">{O.private}</p>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
