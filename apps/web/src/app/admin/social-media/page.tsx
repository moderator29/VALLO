import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { requireAdmin } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import {
  buildReportSummary,
  buildWeekGrid,
  CATEGORY_LABEL,
  copilotContext,
  FORMAT_LABEL,
  PLATFORM_LABEL,
  SLOT_LABEL,
  SLOTS,
  STATUS_LABEL,
  weekdaysOf,
  type SocialPost,
} from "@/lib/admin/social-media/model";
import { readMediaLibrary, readSocialPosts } from "@/lib/admin/social-media/queries";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

import { PageHead, Panel, Badge, CalmNote, NotWired, type BadgeTone } from "../_components/panels";
import { DraftForm, ApprovalActions, MediaDelete, MediaUploader } from "./SocialMediaControls";

export const metadata: Metadata = { title: "Social Media", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["calendar", "Calendar"],
  ["drafts", "Drafts and campaigns"],
  ["media", "Media library"],
  ["report", "Report"],
] as const;
type Tab = (typeof TABS)[number][0];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const STATUS_TONE: Record<SocialPost["status"], BadgeTone> = {
  draft: "info",
  awaiting_approval: "pending",
  approved: "info",
  posted: "success",
  cancelled: "error",
};

/**
 * THE SOCIAL MEDIA MANAGER'S DESK (founder, 10 November 2026). A planning and
 * reporting tool only: the content calendar (a weekday grid, Monday to
 * Friday, four fixed posting slots, matching the manager's own weekly
 * planning sheet), drafts and campaigns, the media library, and the
 * permanent, honest record of what was actually posted by hand, on the real
 * platform, in a different tab. No platform API, no OAuth, no credential
 * anywhere on this page or in anything it calls.
 */
export default async function SocialMediaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await requireAdmin("social_media");
  if (access.state !== "admin") {
    return (
      <div className="nf-console nf-admin-stack">
        <PageHead title="Social media" />
        <Panel>
          <p className="nf-body text-[var(--nf-content-secondary)]">
            {access.state === "step-up"
              ? "Confirm your security key to use the console."
              : access.state === "signed-out"
                ? "Sign in with your operations account to continue."
                : access.state === "unconfigured"
                  ? "We cannot reach the console right now. This is on our side, not yours. Try again in a few minutes."
                  : "This desk is for the Social Media Manager."}
          </p>
        </Panel>
      </div>
    );
  }
  const params = await searchParams;
  const tab: Tab = (TABS.some(([k]) => k === one(params.tab)) ? one(params.tab) : "calendar") as Tab;
  const db = access.supabase as unknown as SupabaseClient;

  const [postsRead, mediaRead] = await Promise.all([readSocialPosts(db), readMediaLibrary(db)]);
  const notOpen = postsRead.state === "not-open";
  const posts = postsRead.state === "ok" ? postsRead.data : [];
  const media = mediaRead.state === "ok" ? mediaRead.data : [];

  const summary = buildReportSummary(posts);
  const context = notOpen ? null : copilotContext(summary);

  return (
    <div className="nf-console nf-admin-stack">
      <PageHead
        title="Social media"
        lede="The content calendar, drafts and campaigns, the media library, and the record of what was actually posted by hand. Nothing here connects to a social platform; posting happens on the real app, in a separate tab."
      />
      {notOpen ? (
        <Panel>
          <NotWired
            what="The social media table is not on this database yet."
            request="Ask the lead to apply supabase/migrations/pending/social_posts_2026-11-10.sql."
          />
        </Panel>
      ) : null}
      <UnderlineTabs
        label="Social media desk"
        active={tab}
        items={TABS.map(([key, label]) => ({ key, label, href: key === "calendar" ? "/admin/social-media" : `/admin/social-media?tab=${key}` }))}
      />
      {tab === "calendar" ? <Calendar posts={posts} /> : null}
      {tab === "drafts" ? <Drafts posts={posts} media={media} /> : null}
      {tab === "media" ? <MediaLibrary media={media} /> : null}
      {tab === "report" ? <Report posts={posts} /> : null}
      <AdminCopilot
        scope="social_media"
        position="social_media_manager"
        deskName="Social Media"
        context={context}
        greeting={JOB_DESCRIPTIONS.social_media_manager.summary}
      />
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="social-post-card">
      <div className="flex flex-wrap items-center gap-xs">
        <span className="font-semibold text-[var(--nf-content-primary)]">{PLATFORM_LABEL[post.platform]}</span>
        <Badge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</Badge>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{FORMAT_LABEL[post.format]}</span>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{CATEGORY_LABEL[post.category]}</span>
      </div>
      {post.campaign ? <p className="nf-caption mt-3xs text-[var(--nf-content-secondary)]">Campaign: {post.campaign}</p> : null}
      <p className="nf-body-sm mt-xs whitespace-pre-wrap">{post.caption || "No caption yet."}</p>
      {post.mediaUrls.length > 0 ? <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">{post.mediaUrls.length} file(s) attached</p> : null}
      {post.rejectionReason ? <p className="nf-caption mt-xs" role="note">Sent back: {post.rejectionReason}</p> : null}
      {post.status === "posted" ? (
        <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">
          Posted {post.postedAt ? new Date(post.postedAt).toLocaleString("en-NG") : ""}
          {post.liveUrl ? (
            <>
              {" · "}
              <a href={post.liveUrl} target="_blank" rel="noreferrer" className="underline">
                View live post
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="mt-sm">
        <ApprovalActions post={post} />
      </div>
    </li>
  );
}

function Calendar({ posts }: { posts: SocialPost[] }) {
  const weekdays = weekdaysOf(new Date());
  const grid = buildWeekGrid(weekdays, posts);
  const hasAny = posts.length > 0;
  return (
    <Panel title="This week" className="grid gap-md">
      {!hasAny ? (
        <CalmNote title="Nothing planned yet" fills="No post has a planned date yet." creates="Create one on the Drafts and campaigns tab." />
      ) : (
        <div className="grid gap-md md:grid-cols-5">
          {grid.map((day) => (
            <div key={day.day} className="grid gap-xs">
              <p className="nf-caption font-semibold text-[var(--nf-content-primary)]">{day.label}</p>
              {SLOTS.map((slot) => (
                <div key={slot} className="nf-panel nf-panel--card nf-admin-card p-sm">
                  <p className="nf-caption text-[var(--nf-content-secondary)]">{SLOT_LABEL[slot]}</p>
                  {day.slots[slot].length === 0 ? (
                    <p className="nf-caption text-[var(--nf-content-secondary)]">Open</p>
                  ) : (
                    <ul className="grid gap-3xs">
                      {day.slots[slot].map((p) => (
                        <li key={p.id} className="nf-body-sm">
                          {PLATFORM_LABEL[p.platform]} · <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {day.unslotted.length > 0 ? (
                <div className="nf-panel nf-panel--card nf-admin-card p-sm">
                  <p className="nf-caption text-[var(--nf-content-secondary)]">No fixed slot</p>
                  <ul className="grid gap-3xs">
                    {day.unslotted.map((p) => (
                      <li key={p.id} className="nf-body-sm">
                        {PLATFORM_LABEL[p.platform]} · <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="nf-caption text-[var(--nf-content-secondary)]">
        The weekday grid above shows this week only. Every planned post, including other weeks, is on the Drafts and campaigns tab.
      </p>
    </Panel>
  );
}

function Drafts({ posts, media }: { posts: SocialPost[]; media: { path: string; name: string; url: string | null; isVideo: boolean; createdAt: string | null }[] }) {
  const sorted = [...posts].sort((a, b) => (a.plannedAt < b.plannedAt ? -1 : a.plannedAt > b.plannedAt ? 1 : 0));
  return (
    <div className="grid gap-lg">
      <Panel title="New draft">
        <DraftForm media={media} />
      </Panel>
      <Panel title="All posts">
        {sorted.length === 0 ? (
          <CalmNote title="No posts yet" fills="Create the first draft above." />
        ) : (
          <ul className="grid gap-sm">
            {sorted.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function MediaLibrary({ media }: { media: { path: string; name: string; url: string | null; isVideo: boolean; createdAt: string | null }[] }) {
  return (
    <Panel title="Media library">
      <MediaUploader />
      {media.length === 0 ? (
        <CalmNote title="Nothing uploaded yet" fills="Upload an image or short video above to start the library." />
      ) : (
        <ul className="mt-md grid gap-sm sm:grid-cols-2 md:grid-cols-3">
          {media.map((m) => (
            <li key={m.path} className="nf-panel nf-panel--card nf-admin-card p-sm">
              {m.isVideo ? (
                m.url ? <video src={m.url} controls className="w-full rounded" /> : null
              ) : m.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="w-full rounded object-cover" />
              ) : null}
              <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">{m.name}</p>
              <div className="mt-xs">
                <MediaDelete path={m.path} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Report({ posts }: { posts: SocialPost[] }) {
  const s = buildReportSummary(posts);
  const platformRows = Object.entries(s.postedThisMonthByPlatform);
  const categoryRows = Object.entries(s.postedThisMonthByCategory);
  return (
    <div className="grid gap-lg">
      <Panel title="This week">
        <ul className="grid gap-3xs nf-body-sm">
          <li>{s.thisWeekScheduled} posts scheduled this week</li>
          <li>{s.thisWeekByFormat.feed_post} feed posts, {s.thisWeekByFormat.reel} reels, {s.thisWeekByFormat.story} stories</li>
          <li>{s.overdue} overdue (planned date has passed, still a draft or awaiting approval)</li>
          <li>{s.activeCampaigns} campaign(s) active</li>
        </ul>
      </Panel>
      <Panel title="Posted this month">
        {s.postedThisMonth === 0 ? (
          <CalmNote title="Nothing posted this month yet" fills="Once a post is marked posted, it counts here." />
        ) : (
          <div className="grid gap-md sm:grid-cols-2">
            <div>
              <p className="nf-caption font-semibold">By platform</p>
              <ul className="nf-body-sm">
                {platformRows.map(([k, v]) => (
                  <li key={k}>
                    {PLATFORM_LABEL[k as keyof typeof PLATFORM_LABEL] ?? k}: {v}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="nf-caption font-semibold">By category</p>
              <ul className="nf-body-sm">
                {categoryRows.map(([k, v]) => (
                  <li key={k}>
                    {CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k}: {v}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
