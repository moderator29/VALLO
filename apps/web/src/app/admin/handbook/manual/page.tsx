import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireConsole } from "@/lib/admin/guard";
import { PageHead } from "../../_components/panels";

export const metadata: Metadata = { title: "Staff manual", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * THE RETIRED STAFF MANUAL'S ADDRESS (16 November 2026). The old manual's
 * pages were folded into the staff manual at `/admin/manual`; an old link or
 * bookmark lands there. The same door as the manual itself: the console
 * layout has already refused anybody who is not staff, and this asks again
 * before it says where the manual went.
 */
export default async function RetiredManualIndexPage() {
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  redirect("/admin/manual");
}
