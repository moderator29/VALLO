import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRange } from "@/lib/admin/account-deletions/model";
import { requireDeletionReasonsDoor } from "@/lib/admin/account-deletions/door";
import { readDeletionReasons, toDeskRead } from "@/lib/admin/account-deletions/read";
import { CalmNote, PageHead } from "../_components/panels";
import { AccountDeletionsView, type ViewRead } from "./AccountDeletionsView";

export const metadata: Metadata = { title: "Account deletions", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * WHY PEOPLE DELETE THEIR ACCOUNT (founder, 10 November 2026). Read only. The
 * door is Operations (the COO), the Customer Support Lead or Marketing; an
 * admin or super admin passes with any. Notes are read, and shown, for a super
 * admin only. Until the pending SQL is applied the desk says so plainly.
 */
export default async function AccountDeletionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const door = await requireDeletionReasonsDoor();
  if (door.state !== "admin") {
    return (
      <div className="nf-console" data-testid="account-deletions-refused">
        <PageHead title="Account deletions" />
        <CalmNote
          title="This desk is for Operations, Support lead and Marketing"
          fills="Your access covers other desks. Ask a super admin for one of those scopes to read why members leave."
          action={{ href: "/admin", label: "Back to your console" }}
        />
      </div>
    );
  }
  const range = parseRange((await searchParams).range);
  const result = await readDeletionReasons(door.supabase as unknown as SupabaseClient, door.isSuperAdmin);
  const read: ViewRead = toDeskRead(result, range, door.isSuperAdmin);
  return <AccountDeletionsView read={read} range={range} canSeeNotes={door.isSuperAdmin} />;
}
