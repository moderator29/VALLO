import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireConsole } from "@/lib/admin/guard";
import { retiredManualTarget } from "@/lib/admin/manual/chapters";
import { PageHead } from "../../../_components/panels";

export const metadata: Metadata = { title: "Staff manual", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * ONE PAGE OF THE RETIRED STAFF MANUAL (16 November 2026). Each of its nine
 * pages now lives in a chapter of the staff manual; an old link goes to the
 * chapter and section that holds what it said (`RETIRED_MANUAL_PAGES` in
 * `lib/admin/manual/chapters.ts`), and an address it never had goes to the
 * manual's index. Behind the same door as the manual.
 */
export default async function RetiredManualPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  redirect(retiredManualTarget(slug));
}
