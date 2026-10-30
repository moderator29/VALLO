import { resolveSession } from "../actions/session";
import { readSchedule, type Schedule } from "./hours";
import type { ReplyTemplate } from "./reply-templates";

type Reader = {
  from(t: string): {
    select(c: string): {
      order?(c: string, o: { ascending: boolean }): PromiseLike<{ data: unknown }>;
      maybeSingle?(): PromiseLike<{ data: unknown }>;
    };
  };
};

/** The signed-in member's own templates, oldest first. A failed read is none. */
export async function readMyReplyTemplates(): Promise<ReplyTemplate[]> {
  try {
    const session = await resolveSession();
    if (session.state !== "signed-in") return [];
    const db = session.supabase as unknown as Reader;
    const { data } = await db.from("reply_templates").select("id, title, body").order!("created_at", { ascending: true });
    return Array.isArray(data) ? (data as ReplyTemplate[]) : [];
  } catch {
    return [];
  }
}

/** The signed-in member's own hours. A failed read is an empty week. */
export async function readMyAgentHours(): Promise<Schedule> {
  try {
    const session = await resolveSession();
    if (session.state !== "signed-in") return {};
    const db = session.supabase as unknown as Reader;
    const { data } = await db.from("agent_hours").select("schedule").maybeSingle!();
    return readSchedule((data as { schedule?: unknown } | null)?.schedule);
  } catch {
    return {};
  }
}
