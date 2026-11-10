import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";

import { requireDeskUser } from "@/lib/admin/my-desk/access";

import { weeklyState, type WeeklyState } from "./model";
import { readReport } from "./queries";
import { dateLabel, addDays, weekWindow } from "./week";

const HREF = "/admin/my-desk/weekly";

function words(state: WeeklyState, nextSaturday: string): { title: string; line: string; tone: "info" | "clear" | "error" } {
  switch (state) {
    case "open":
      return { title: "Your weekly report is open, due Monday 12:00", line: "Lagos time. Write it up and add your proof.", tone: "info" };
    case "overdue":
      return { title: "Overdue", line: "Your weekly report was due Monday 12:00. You can still file it; it will show as late.", tone: "error" };
    case "submitted":
    case "reviewed":
      return { title: "Submitted", line: state === "reviewed" ? "Your weekly report has been reviewed." : "Your weekly report is in. You can edit it until a reviewer has looked at it.", tone: "clear" };
    default:
      return { title: "Weekly report opens Saturday", line: `The next one opens ${nextSaturday}.`, tone: "info" };
  }
}

/**
 * A short strip for My Desk saying where this person's weekly report stands:
 * opens Saturday, open and due Monday 12:00, submitted, or overdue, with a
 * link to the form. Pass the desk's `db` and the person's `userId` when the
 * page already has them; with neither it asks the desk door itself. It draws
 * nothing when the person cannot be admitted or the reports are not set up
 * yet, so it never adds an error to a page that is otherwise fine.
 */
export async function WeeklyReportBanner({ db, userId, now = new Date() }: { db?: SupabaseClient; userId?: string; now?: Date }) {
  let client = db;
  let me = userId;
  if (!client || !me) {
    const door = await requireDeskUser();
    if (door.state !== "ok") return null;
    client = door.db;
    me = door.who.userId;
  }
  const week = weekWindow(now);
  const read = await readReport(client, me, week.weekStart);
  if (read.state !== "ok") return null;
  const state = weeklyState(week, read.data?.status ?? null, now, true);
  const copy = words(state, dateLabel(addDays(week.nextWeekStart, 5)));
  return (
    <div className={`nf-admin-calm nf-admin-calm--${copy.tone}`} role="note" data-testid="weekly-report-banner" data-state={state}>
      <span className="nf-admin-calm__text">
        <span className="nf-admin-calm__title">{copy.title}</span>
        <span className="nf-admin-calm__line">{copy.line}</span>
        <Link href={HREF} className="nf-admin-calm__link">
          {state === "open" || state === "overdue" ? "Open the weekly report" : "See the weekly report"}
        </Link>
      </span>
    </div>
  );
}
