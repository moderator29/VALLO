import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireConsole } from "@/lib/admin/guard";
import { isManualSlug, manualChapter } from "@/lib/admin/manual/chapters";
import { PageHead } from "../../_components/panels";
import { ManualChapterView } from "../_chapters/views";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ chapter: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chapter } = await params;
  const title = isManualSlug(chapter) ? `${manualChapter(chapter).title}: staff manual` : "Staff manual";
  return { title, robots: { index: false, follow: false } };
}

/**
 * One chapter of the staff manual. The same door as the index and the
 * handbook; an unknown chapter is the ordinary 404 rather than an empty page
 * with a heading on it.
 */
export default async function StaffManualChapterPage({ params }: Params) {
  const { chapter } = await params;
  if (!isManualSlug(chapter)) notFound();
  const door = await requireConsole();
  if (door.state !== "console") {
    return (
      <div className="nf-console">
        <PageHead title="Staff manual" lede="This page is for Vallo staff." />
      </div>
    );
  }
  return (
    <div data-testid={`staff-manual-${chapter}`}>
      <ManualChapterView slug={chapter} />
    </div>
  );
}
