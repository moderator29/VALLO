import "server-only";
import { createClient } from "../supabase/server";
import { reportReadError } from "../observability/read-error";
import { hoursLine, readSchedule } from "./hours";

/**
 * "Mon to Fri, 9:00 to 18:00." for the agent on a published listing, or null.
 * Read through `listing_agent_hours`, which hands back the schedule and
 * nothing else about the agent, so the public page learns no id from it. A
 * failed read is no line, never an error.
 */
export async function readListingAgentHoursLine(listingId: string): Promise<string | null> {
  try {
    const db = await createClient();
    if (!db) return null;
    const rpc = db.rpc.bind(db) as unknown as (
      fn: "listing_agent_hours",
      args: { p_listing: string },
    ) => PromiseLike<{ data: unknown; error: unknown }>;
    const { data, error } = await rpc("listing_agent_hours", { p_listing: listingId });
    if (error) {
      await reportReadError("read.agent.listing_agent_hours", error);
      return null;
    }
    return hoursLine(readSchedule(data));
  } catch {
    return null;
  }
}
