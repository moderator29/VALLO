import type { Metadata } from "next";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../_components/panels";
import { ManualIndexView } from "./_chapters/views";

export const metadata: Metadata = { title: "Staff manual", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE STAFF MANUAL (DOCS_AND_PRESENCE_UPGRADE.md section 10): the index of
 * chapters. Behind the same door as the handbook: the console layout has
 * already refused anybody who is not staff, and this asks again, so the
 * manual is open to every admin and every staff member with an access area,
 * including one who has not acknowledged the handbook yet (it explains what
 * they are about to acknowledge). It reads no data.
 */
export default async function StaffManualPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div data-testid="staff-manual">
      <ManualIndexView />
    </div>
  );
}
