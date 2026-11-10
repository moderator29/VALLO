import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin } from "@/lib/admin/guard";
import { getSupportQueue, getSupportTicketDetail } from "@/lib/admin/support-queue";
import { isSupportTab } from "@/lib/admin/support-workspace";
import { CalmNote, PageHead } from "../_components/panels";
import { SupportDesk, type SupportDeskProps } from "./SupportDesk";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { supportContext } from "@/lib/admin/copilot/contexts/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.support.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Support: the honest end of the escalation path, and a support agent's
 * whole working day (docs/SUPPORT_STAFF.md).
 *
 * The door is `requireAdmin("support")`, read on the server before any
 * ticket is: an admin, or a staff member holding the support scope who has
 * acknowledged the handbook and proved their security key this session. The
 * one exception is a single ticket escalated to another desk, which a holder
 * of that desk may open by its link (the database decides, through
 * `support_ticket_escalations_for`); they see that ticket and no queue.
 *
 * A reply inserts a staff message and the database tells the member
 * (private.notify_support_reply). A ticket about being asked to pay outside
 * Vallo, or one escalated to money or safety, runs on the four-hour promise
 * /standards publishes; the rest on a day.
 */
function requestTime(): number {
  return Date.now();
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = getDictionary(await getLocale());
  const params = await searchParams;
  const tab = isSupportTab(params.tab) ? params.tab : "open";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const ticketId = typeof params.ticket === "string" ? params.ticket : null;
  const now = requestTime();

  const door = await requireAdmin("support");
  let queue: SupportDeskProps["queue"] = { state: "none" };
  if (door.state === "admin") {
    const read = await getSupportQueue({ q, now });
    queue = read.state === "ok" ? { state: "ok", ...read.data } : { state: "unavailable" };
  } else if (!ticketId) {
    return (
      <div className="nf-console" data-testid="support-desk-refused">
        <PageHead title="Support" />
        <CalmNote
          title="Support is not one of your desks"
          fills="Your access covers other desks. If a ticket was handed to your desk, open it from the notification that told you."
          action={{ href: "/admin", label: "Back to your console" }}
        />
      </div>
    );
  }

  let selected: SupportDeskProps["selected"] = null;
  let missing: SupportDeskProps["missing"] = null;
  if (ticketId) {
    const read = await getSupportTicketDetail(ticketId, now);
    if (read.state === "ok") {
      selected = read.data;
      if (!read.data) missing = "unknown";
    } else {
      missing = read.state === "forbidden" ? "forbidden" : "unavailable";
    }
  }

  return (
    <>
      <SupportDesk now={now} tab={tab} q={q} queue={queue} selected={selected} missing={missing} copy={t.admin.support} />
      {door.state === "admin" ? (
        <DeskCopilot
          scope="support"
          deskName="Support"
          context={supportContext(
            queue.state === "ok"
              ? queue.rows.map((r) => ({ lane: r.lane, breached: r.sla.breached, createdAt: r.createdAt }))
              : null,
            now,
          )}
        />
      ) : null}
    </>
  );
}
