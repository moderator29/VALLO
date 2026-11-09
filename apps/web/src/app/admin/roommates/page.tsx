import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { getDictionary } from "@vallo/i18n";
import { requireConsole } from "@/lib/admin/guard";
import {
  readAdminRoommateGroups,
  readAdminRoommateListings,
  readAdminRoommateProfiles,
  readAdminVerifications,
  readRoommateSignals,
  type DeskRead,
} from "@/lib/admin/cases/queries";
import { faults, isNotLive } from "@/lib/features/degrade";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { getLocale } from "@/lib/locale";
import { reportReadFault } from "@/lib/observability/read-error";

import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { AddInstitutionForm, InstitutionControls, TargetActions, VerificationDecision, WeightsForm } from "./RoommateControls";

export const metadata: Metadata = {
  title: "Roommates",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["profiles", "Profiles"],
  ["posts", "Posts"],
  ["groups", "Groups"],
  ["verification", "Verification"],
  ["schools", "Schools"],
  ["weights", "Matching"],
] as const;
type Tab = (typeof TABS)[number][0];
const LISTING_STATUSES = ["live", "paused", "draft", "filled", "expired", "removed"] as const;
const PROFILE_STATUSES = ["active", "paused", "held", "draft"] as const;
const GROUP_STAGES = ["forming", "searching", "decided", "living", "closed"] as const;
const CHECK_STATUSES = ["review", "verified", "rejected", "pending", "expired"] as const;

type Ui = ReturnType<typeof adminUi>;
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | null => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null);

/**
 * THE ROOMMATES DESK (FE-B, on the rail under Moderation). Built on the Trust
 * and Safety layer: every read and every decision runs on the staff member's
 * OWN session (`lib/admin/cases/*`), so the database decides who may see a
 * profile, act on a post or open a document. Overview (signals), profiles
 * (hold, restore), posts (verify, remove, restore), groups (close, reopen),
 * the verification queue (the five-minute document link, approve, reject,
 * ask for more), the schools directory and the matching weights. Reports
 * about roommates are decided as cases: "Roommates cases" opens that queue.
 * A reason is required for every action; every outcome is a banner. Until the
 * SQL is pasted each tab says so, never a sample row. English (R-107).
 */
export default async function AdminRoommatesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await requireConsole();
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  if (access.state !== "console") {
    return (
      <div className="nf-console flex flex-col gap-xl">
        <PageHead title="Roommates" />
        <div className="nf-panel nf-panel--card nf-admin-card p-lg">
          <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
            {access.state === "step-up" ? "Confirm your security key to use the console." : access.state === "signed-out" ? "Sign in with your operations account to continue." : "This desk is for Vallo staff."}
          </p>
        </div>
      </div>
    );
  }
  const params = await searchParams;
  const tab: Tab = TABS.some(([k]) => k === one(params.tab)) ? (one(params.tab) as Tab) : "overview";
  const db = access.supabase as unknown as SupabaseClient;
  const base = (key: Tab) => (key === "overview" ? "/admin/roommates" : `/admin/roommates?tab=${key}`);

  return (
    <div className="nf-console flex flex-col gap-xl">
      <PageHead title="Roommates" lede="Roommate profiles, posts and groups, checks waiting for a decision, schools and how matching is weighed. Reports are decided as cases." />
      <div className="flex flex-wrap gap-xs">
        <ButtonLink href="/admin/cases?module=roommates" variant="secondary" size="sm" leadingIcon="clipboard-list">
          Roommates cases
        </ButtonLink>
        <ButtonLink href={ROOMMATES_ROUTES.home} variant="quiet" size="sm" arrow>
          Open Vallo Roommates
        </ButtonLink>
      </div>
      <UnderlineTabs label="Roommates desk" active={tab} items={TABS.map(([key, label]) => ({ key, label, href: base(key) }))} />
      {tab === "overview" ? <Overview ui={ui} /> : null}
      {tab === "profiles" ? <Profiles ui={ui} params={params} /> : null}
      {tab === "posts" ? <Posts ui={ui} params={params} /> : null}
      {tab === "groups" ? <Groups ui={ui} params={params} /> : null}
      {tab === "verification" ? <Checks ui={ui} params={params} /> : null}
      {tab === "schools" ? <Schools db={db} ui={ui} /> : null}
      {tab === "weights" ? <Weights db={db} ui={ui} /> : null}
    </div>
  );
}

/** The honest answer for a read that did not come back with rows. */
function Unread({ ui, read }: { ui: Ui; read: Exclude<DeskRead<unknown>, { state: "ok" }> }) {
  if (read.state === "not-open") return <ui.QueueEmpty title="Not open on this server yet" body="The roommate tables and desk functions are not on this database yet. This tab fills in once the roommate SQL is pasted." everHadRows={false} />;
  if (read.state === "signed-out") return <ui.QueueEmpty title="Signed out" body="Sign in with your operations account to continue." everHadRows={false} />;
  return <ui.QueueEmpty title="Not for your role" body="Your staff role does not include this. A super admin can add the roommates or trust and safety scope." everHadRows={false} />;
}

function Filters({ tab, name, values, current }: { tab: Tab; name: string; values: readonly string[]; current: string | null }) {
  return (
    <nav aria-label="Status" className="flex flex-wrap gap-xs">
      {[null, ...values].map((v) => (
        <Link
          key={v ?? "all"}
          href={v ? `/admin/roommates?tab=${tab}&${name}=${v}` : `/admin/roommates?tab=${tab}`}
          className={`nf-btn nf-btn--sm ${v === current ? "nf-btn--primary" : "nf-btn--quiet"}`}
          aria-current={v === current ? "page" : undefined}
        >
          {v ? v.replace(/_/g, " ") : "All"}
        </Link>
      ))}
    </nav>
  );
}

function who(p: { name: string; handle: string | null } | null | undefined): string {
  if (!p) return "A member";
  return p.handle ? `${p.name} (@${p.handle})` : p.name;
}

async function Overview({ ui }: { ui: Ui }) {
  const read = await readRoommateSignals();
  if (read.state !== "ok") return <Unread ui={ui} read={read} />;
  const s = read.data;
  const lists: { title: string; hint: string; rows: { key: string; text: string; href: string | null }[] }[] = [
    {
      title: "Reported often",
      hint: "Members with more than one open case about them.",
      rows: (s.reportedOften ?? []).map((p) => ({ key: p.userId, text: `${who(p)} · ${p.cases} open cases`, href: ROOMMATES_ROUTES.person(p.userId) })),
    },
    {
      title: "Many requests, many declines",
      hint: "Members sending interest at a pace people turn down.",
      rows: (s.heavySenders ?? []).map((p) => ({ key: p.userId, text: `${who(p)} · ${p.sent} sent, ${p.declined} declined`, href: ROOMMATES_ROUTES.person(p.userId) })),
    },
    {
      title: "Many live posts",
      hint: "One member with several live posts at once.",
      rows: (s.repeatListers ?? []).map((p) => ({ key: p.userId, text: `${who(p)} · ${p.live} live`, href: ROOMMATES_ROUTES.person(p.userId) })),
    },
    {
      title: "Repeated titles",
      hint: "The same title on several posts, often a copied advert.",
      rows: (s.duplicateTitles ?? []).map((d) => ({ key: d.title, text: `${d.title} · ${d.count} posts by ${d.owners} members`, href: null })),
    },
  ];
  return (
    <div className="grid gap-lg md:grid-cols-2">
      {lists.map((l) => (
        <ui.Section key={l.title} title={l.title} hint={l.hint}>
          {l.rows.length === 0 ? (
            <ui.QueueEmpty title="Nothing to look at" body="No member matches this signal now." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {l.rows.map((r) => (
                <li key={r.key} className="nf-panel nf-panel--card nf-admin-card p-sm nf-body-sm">
                  {r.href ? (
                    <Link href={r.href} className="text-[var(--nf-content-primary)]">
                      {r.text}
                    </Link>
                  ) : (
                    r.text
                  )}
                </li>
              ))}
            </ul>
          )}
        </ui.Section>
      ))}
    </div>
  );
}

async function Profiles({ ui, params }: { ui: Ui; params: Params }) {
  const status = pick(one(params.status), PROFILE_STATUSES);
  const read = await readAdminRoommateProfiles({ status, flagged: one(params.flagged) === "1" });
  return (
    <ui.Section title="Profiles" hint="Held profiles cannot be found or edited by their owner until restored." action={<Filters tab="profiles" name="status" values={PROFILE_STATUSES} current={status} />}>
      {read.state !== "ok" ? (
        <Unread ui={ui} read={read} />
      ) : read.data.length === 0 ? (
        <ui.QueueEmpty title="No profiles" body={status ? "No profile has this status." : "Nobody has a roommate profile yet."} state={status ? "no-match" : undefined} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {read.data.map((p) => (
            <li key={p.userId} className="nf-panel nf-panel--card nf-admin-card p-md">
              <div className="flex flex-wrap items-center gap-xs">
                <Link href={ROOMMATES_ROUTES.person(p.userId)} className="font-semibold text-[var(--nf-content-primary)]">
                  {who(p)}
                </Link>
                <ui.StatusChip status={p.status} label={p.status} />
                {p.openCases > 0 ? <ui.StatusChip label={`${p.openCases} open cases`} tone="warning" /> : null}
              </div>
              <p className="nf-body-sm mt-3xs text-content-2">
                {[p.lifeStage?.replace(/_/g, " "), p.city, `${p.listings} posts`, p.badges.length ? p.badges.join(", ").replace(/_/g, " ") : null, `joined ${ui.when(p.createdAt)}`, `active ${ui.when(p.lastActiveAt)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <TargetActions
                targetType="roommate_profile"
                targetId={p.userId}
                actions={p.status === "held" ? [{ action: "restore", label: "Restore profile", done: "Profile restored" }] : [{ action: "hold", label: "Hold profile", done: "Profile held for review", danger: true }]}
              />
            </li>
          ))}
        </ul>
      )}
    </ui.Section>
  );
}

async function Posts({ ui, params }: { ui: Ui; params: Params }) {
  const status = pick(one(params.status), LISTING_STATUSES);
  const read = await readAdminRoommateListings({ status, unverified: one(params.unverified) === "1" });
  return (
    <ui.Section title="Posts" hint="Verify marks a post as checked by Vallo. Remove takes it down for everyone; Restore brings it back." action={<Filters tab="posts" name="status" values={LISTING_STATUSES} current={status} />}>
      {read.state !== "ok" ? (
        <Unread ui={ui} read={read} />
      ) : read.data.length === 0 ? (
        <ui.QueueEmpty title="No posts" body={status ? "No post has this status." : "Nobody has posted on Roommates yet."} state={status ? "no-match" : undefined} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {read.data.map((l) => (
            <li key={l.id} className="nf-panel nf-panel--card nf-admin-card p-md">
              <div className="flex flex-wrap items-center gap-xs">
                <Link href={ROOMMATES_ROUTES.listing(l.id)} className="font-semibold text-[var(--nf-content-primary)]">
                  {l.title}
                </Link>
                <ui.StatusChip status={l.status} label={l.status} />
                {l.verified ? <ui.StatusChip label="Verified" tone="success" /> : null}
                {l.openCases > 0 ? <ui.StatusChip label={`${l.openCases} open cases`} tone="warning" /> : null}
              </div>
              <p className="nf-body-sm mt-3xs text-content-2">
                {[l.kind.replace(/_/g, " "), [l.area, l.city].filter(Boolean).join(", "), who(l.owner), l.authority?.replace(/_/g, " "), `${l.viewCount} views`, `${l.interestCount} interested`, ui.when(l.createdAt)].filter(Boolean).join(" · ")}
              </p>
              <TargetActions
                targetType="roommate_listing"
                targetId={l.id}
                actions={[
                  ...(l.status === "removed"
                    ? [{ action: "restore", label: "Restore", done: "Post restored" }]
                    : [
                        l.verified ? { action: "unverify", label: "Take back verified", done: "Verified mark taken back" } : { action: "verify", label: "Verify listing", done: "Post verified" },
                        { action: "remove", label: "Remove", done: "Post removed", danger: true },
                      ]),
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </ui.Section>
  );
}

async function Groups({ ui, params }: { ui: Ui; params: Params }) {
  const stage = pick(one(params.stage), GROUP_STAGES);
  const read = await readAdminRoommateGroups({ stage });
  return (
    <ui.Section title="Groups" hint="Close a group that is being misused; Reopen undoes it." action={<Filters tab="groups" name="stage" values={GROUP_STAGES} current={stage} />}>
      {read.state !== "ok" ? (
        <Unread ui={ui} read={read} />
      ) : read.data.length === 0 ? (
        <ui.QueueEmpty title="No groups" body={stage ? "No group is at this stage." : "Nobody has started a group yet."} state={stage ? "no-match" : undefined} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {read.data.map((g) => (
            <li key={g.id} className="nf-panel nf-panel--card nf-admin-card p-md">
              <div className="flex flex-wrap items-center gap-xs">
                <span className="font-semibold text-[var(--nf-content-primary)]">{g.name}</span>
                <ui.StatusChip status={g.stage} label={g.stage} />
                <ui.StatusChip label={g.visibility} tone="neutral" />
                {g.openCases > 0 ? <ui.StatusChip label={`${g.openCases} open cases`} tone="warning" /> : null}
              </div>
              <p className="nf-body-sm mt-3xs text-content-2">{[g.city, `started by ${who(g.owner)}`, `${g.members} members`, `${g.posts7d} board posts this week`, ui.when(g.createdAt)].filter(Boolean).join(" · ")}</p>
              <TargetActions
                targetType="roommate_group"
                targetId={g.id}
                actions={g.stage === "closed" ? [{ action: "restore", label: "Reopen", done: "Group reopened" }] : [{ action: "close", label: "Close group", done: "Group closed", danger: true }]}
              />
            </li>
          ))}
        </ul>
      )}
    </ui.Section>
  );
}

async function Checks({ ui, params }: { ui: Ui; params: Params }) {
  const status = pick(one(params.status), CHECK_STATUSES) ?? "review";
  const read = await readAdminVerifications(status);
  return (
    <ui.Section
      title={status === "review" ? "Checks waiting" : "Checks"}
      hint="Oldest first. Open the document (a five-minute link, logged), compare the name with the member's profile, then approve for a year, reject, or ask for more."
      action={<Filters tab="verification" name="status" values={CHECK_STATUSES} current={status} />}
    >
      {read.state !== "ok" ? (
        <Unread ui={ui} read={read} />
      ) : read.data.length === 0 ? (
        <ui.QueueEmpty title="Nothing here" body={status === "review" ? "When a member sends a student ID, an NYSC letter or a work letter, it lands here." : "No check has this status."} />
      ) : (
        <ul className="flex flex-col gap-sm">
          {read.data.map((v) => (
            <li key={v.id} className="nf-panel nf-panel--card nf-admin-card p-md">
              <div className="flex flex-wrap items-center gap-xs">
                <Link href={ROOMMATES_ROUTES.person(v.member.userId)} className="font-semibold text-[var(--nf-content-primary)]">
                  {who(v.member)}
                </Link>
                <ui.StatusChip label={v.kind.replace(/_/g, " ")} tone="neutral" />
                <ui.StatusChip status={v.status} label={v.status} />
              </div>
              <p className="nf-body-sm mt-3xs text-content-2">
                {[v.institution ? (v.institution.shortName ?? v.institution.name) : null, v.emailMasked, `sent ${ui.when(v.createdAt)}`, v.reviewedAt ? `decided ${ui.when(v.reviewedAt)}${v.reviewedBy ? ` by ${who(v.reviewedBy)}` : ""}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {v.reason ? <p className="nf-body-sm mt-xs text-content-2">{v.reason}</p> : null}
              {v.status === "review" ? <VerificationDecision id={v.id} hasDocument={v.hasDocument} /> : null}
            </li>
          ))}
        </ul>
      )}
    </ui.Section>
  );
}

type Read<T> = { live: boolean; rows: T[] };

async function read<T>(q: PromiseLike<{ data: unknown; error: unknown }>, kind: `read.${string}`): Promise<Read<T>> {
  const { data, error } = await q;
  if (error) {
    if (isNotLive(error)) return { live: false, rows: [] };
    await reportReadFault(kind, ...faults(error));
    return { live: true, rows: [] };
  }
  return { live: true, rows: (data as T[]) ?? [] };
}

function NotOpen({ ui }: { ui: Ui }) {
  return <ui.QueueEmpty title="Not open on this server yet" body="The roommate tables are not on this database yet. This tab fills in once the roommate SQL is pasted." everHadRows={false} />;
}

async function Schools({ db, ui }: { db: SupabaseClient; ui: Ui }) {
  const res = await read<{ id: string; name: string; short_name: string | null; kind: string; state_code: string | null; city: string | null; email_domains: string[]; email_verify_on: boolean; status: string }>(
    db.from("institutions").select("id, name, short_name, kind, state_code, city, email_domains, email_verify_on, status").order("name").limit(400),
    "read.admin.roommates.schools",
  );
  if (!res.live) return <NotOpen ui={ui} />;
  return (
    <div className="flex flex-col gap-lg">
      <AddInstitutionForm />
      <ui.Section title="Schools" hint="The email check works only for a school whose domains are listed and checked against its own website.">
        {res.rows.length === 0 ? (
          <ui.QueueEmpty title="No schools" body="The directory is empty. Add the first school above." />
        ) : (
          <ul className="flex flex-col gap-sm">
            {res.rows.map((s) => (
              <li key={s.id} className="nf-panel nf-panel--card nf-admin-card p-md">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="font-semibold text-[var(--nf-content-primary)]">{s.short_name ? `${s.name} (${s.short_name})` : s.name}</span>
                  {s.status !== "live" ? <ui.StatusChip label="Hidden" tone="neutral" /> : null}
                  {s.email_verify_on ? <ui.StatusChip label="Email check on" tone="success" /> : null}
                </div>
                <p className="nf-body-sm mt-3xs text-content-2">{[s.kind, s.city, s.state_code].filter(Boolean).join(" · ")}</p>
                <InstitutionControls id={s.id} on={s.email_verify_on} domains={s.email_domains ?? []} />
              </li>
            ))}
          </ul>
        )}
      </ui.Section>
    </div>
  );
}

async function Weights({ db, ui }: { db: SupabaseClient; ui: Ui }) {
  const res = await read<{ budget: number; location: number; move_in: number; lifestyle: number; accommodation: number; updated_at: string }>(
    db.from("roommate_match_weights").select("budget, location, move_in, lifestyle, accommodation, updated_at").limit(1),
    "read.admin.roommates.weights",
  );
  if (!res.live) return <NotOpen ui={ui} />;
  const row = res.rows[0];
  if (!row) return <ui.QueueEmpty title="No weights row" body="The single weights row is missing. The roommate SQL inserts it; paste it again to restore the defaults." everHadRows={false} />;
  return (
    <ui.Section title="How matching is weighed" hint={`How much each part counts in a compatibility score. Last changed ${ui.when(row.updated_at)}.`}>
      <WeightsForm initial={{ budget: row.budget, location: row.location, move_in: row.move_in, lifestyle: row.lifestyle, accommodation: row.accommodation }} />
    </ui.Section>
  );
}
