import type { Metadata } from "next";

import { STAFF_SCOPE_LABEL } from "@/lib/admin/guard";
import { requireDeskUser } from "@/lib/admin/my-desk/access";
import { DESK_SCOPES, isDeskScope } from "@/lib/admin/my-desk/model";
import { readAnnouncements, readNames } from "@/lib/admin/my-desk/queries";

import { Badge, CalmNote, NotWired, PageHead, Panel } from "../../_components/panels";
import { AnnouncementDate } from "./AnnouncementDate";
import { MarkAllRead, MarkRead, PinToggle, PostAnnouncementForm } from "../AnnouncementControls";
import { DeskTabs } from "../DeskTabs";
import { DeskRefusal } from "../refusal";

export const metadata: Metadata = { title: "Announcements", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ANNOUNCEMENTS. Everything addressed to all staff or to an access area the
 * person holds, pinned first, with unread ones marked. Only the COO and
 * admins see the form to post.
 */
export default async function AnnouncementsPage() {
  const door = await requireDeskUser();
  if (door.state !== "ok") return <DeskRefusal state={door.state} title="Announcements" />;
  const { who, db } = door;

  const read = await readAnnouncements(db, who);
  const list = read.state === "ok" ? read.data : [];
  const names = await readNames(list.map((a) => a.createdBy).filter((v): v is string => typeof v === "string"));
  const unread = list.filter((a) => !a.read).length;
  const desks = DESK_SCOPES.map((value) => ({ value, label: STAFF_SCOPE_LABEL[value] }));

  return (
    <div className="nf-console nf-admin-stack" data-testid="my-desk-announcements">
      <PageHead title="Announcements" lede="What the COO and the admins have told staff, pinned first." />
      <DeskTabs active="announcements" />
      {read.state === "not-open" ? (
        <Panel>
          <NotWired
            what="The announcements table is not on this database yet."
            request="Ask the lead to apply supabase/migrations/pending/staff_tasks_announcements_2026-11-10.sql."
          />
        </Panel>
      ) : null}
      {read.state === "error" ? (
        <Panel>
          <p className="nf-body text-[var(--nf-content-secondary)]">The announcements could not be read just now. Reload in a moment.</p>
        </Panel>
      ) : null}
      {door.canAnnounce ? (
        <Panel title="Post an announcement">
          <PostAnnouncementForm desks={desks} />
        </Panel>
      ) : null}
      <Panel title="For you" action={unread > 0 ? <MarkAllRead /> : undefined}>
        <p className="nf-caption mb-sm text-[var(--nf-content-secondary)]" data-testid="my-desk-unread">
          Unread: {unread}
        </p>
        {list.length === 0 ? (
          <CalmNote title="No announcements" fills="Announcements addressed to you appear here." />
        ) : (
          <ul className="grid gap-sm">
            {list.map((a) => (
              <li key={a.id} className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="my-desk-announcement">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="font-semibold text-[var(--nf-content-primary)] break-words">{a.title}</span>
                  {a.pinned ? <Badge tone="info">Pinned</Badge> : null}
                  {!a.read ? <Badge tone="pending">Unread</Badge> : null}
                  <span className="nf-caption text-[var(--nf-content-secondary)]">
                    For {a.audience === "all" ? "all staff" : isDeskScope(a.audience) ? STAFF_SCOPE_LABEL[a.audience] : a.audience}
                  </span>
                </div>
                <p className="nf-body-sm mt-xs whitespace-pre-wrap">{a.body}</p>
                <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">
                  From {a.createdBy ? (names.get(a.createdBy) ?? "A member of staff") : "A removed account"}, <AnnouncementDate iso={a.createdAt} />.
                </p>
                <div className="mt-sm flex flex-wrap gap-xs">
                  {!a.read ? <MarkRead id={a.id} /> : null}
                  {door.canAnnounce ? <PinToggle id={a.id} pinned={a.pinned} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
