import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";

import { readAdminCommunities } from "@/lib/admin/cases/queries";
import { getLocale } from "@/lib/locale";

import { PageHead, PanelEmpty, TabRow } from "../_components/panels";
import { adminUi } from "../_components/ui";
import { DeskRefusal } from "../cases/DeskRefusal";
import { CommunityActions } from "./CommunityActions";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { circleContext } from "@/lib/admin/copilot/contexts/circle";

export const metadata: Metadata = { title: "Circle", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/circle: Vallo Circle's communities, from the console. Health at a
 * glance (members, posts, posts held, open cases), and the community-level
 * actions (pause, remove, restore) with a reason that lands in the audit
 * log. Post and comment moderation stays where it already works: the
 * Unified queue's held lane and the case desk (Circle cases).
 */
export default async function CircleDeskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" && ["live", "paused", "removed"].includes(params.status) ? params.status : null;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  const read = await readAdminCommunities({ status, q });
  if (read.state !== "ok") return <DeskRefusal title="Circle" state={read.state} />;
  const rows = read.data;
  return (
    <div className="nf-console flex flex-col gap-xl" data-testid="admin-circle">
      <PageHead
        title="Circle"
        lede="Communities, their health and their cases."
        action={
          <Link className="nf-link" href="/admin/cases?module=circle">
            Circle cases
          </Link>
        }
      />
      <TabRow
        label="Community status"
        items={[
          { key: "all", href: "/admin/circle", label: "All", active: status === null },
          { key: "live", href: "/admin/circle?status=live", label: "Live", active: status === "live" },
          { key: "paused", href: "/admin/circle?status=paused", label: "Paused", active: status === "paused" },
          { key: "removed", href: "/admin/circle?status=removed", label: "Removed", active: status === "removed" },
        ]}
      />
      {rows.length === 0 ? (
        <PanelEmpty title="No communities" body="Communities appear here when members start them." />
      ) : (
        <div className="nf-panel nf-panel--flush overflow-x-auto" role="region" aria-label="Communities">
          <table className="w-full text-[length:var(--nf-text-body-sm)]">
            <thead>
              <tr className="text-left text-[var(--nf-content-muted)]">
                <th className="p-sm font-semibold">Community</th>
                <th className="p-sm font-semibold">Members</th>
                <th className="p-sm font-semibold">Posts</th>
                <th className="p-sm font-semibold">Held</th>
                <th className="p-sm font-semibold">Open cases</th>
                <th className="p-sm font-semibold">Last activity</th>
                <th className="p-sm font-semibold">Status</th>
                <th className="p-sm" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-[var(--nf-border-subtle)]">
                  <td className="p-sm">
                    <Link className="nf-link font-semibold" href={`/circle/c/${c.slug}`}>
                      {c.name}
                    </Link>
                    <span className="block nf-caption text-[var(--nf-content-muted)]">
                      {c.byVallo ? "Started by Vallo" : c.owner?.name ?? "Member"} · {c.visibility}
                    </span>
                  </td>
                  <td className="p-sm nf-numeric">{c.members}</td>
                  <td className="p-sm nf-numeric">{c.posts}</td>
                  <td className="p-sm nf-numeric">{c.held}</td>
                  <td className="p-sm nf-numeric">{c.openCases}</td>
                  <td className="p-sm">{ui.when(c.lastActivityAt)}</td>
                  <td className="p-sm">{c.status}</td>
                  <td className="p-sm">
                    <CommunityActions communityId={c.id} status={c.status} name={c.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DeskCopilot
        scope="circle"
        deskName="Circle"
        context={circleContext({
          communities: rows.length,
          live: rows.filter((c) => c.status === "live").length,
          paused: rows.filter((c) => c.status === "paused").length,
          removed: rows.filter((c) => c.status === "removed").length,
          held: rows.reduce((sum, c) => sum + c.held, 0),
          openCases: rows.reduce((sum, c) => sum + c.openCases, 0),
          statusFilter: status,
        })}
      />
    </div>
  );
}
