import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { loadRoommatesFeed } from "@/lib/features/roommates/actions";
import { readFeedState, startCursor } from "@/lib/features/roommates/feed";
import { readRoommatesHome } from "@/lib/features/roommates/queries";
import { recordRoommatesStep } from "@/lib/funnel/roommates";
import { requestNow } from "@/lib/format/when";

import { RoommatesHomeView } from "./_parts/HomeView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: copy.title, description: copy.tagline };
export const dynamic = "force-dynamic";

/** The roommates home: the read, then the screen (`_parts/HomeView.tsx`). */
export default async function RoommatesHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tab, filters } = readFeedState(await searchParams);
  /* The funnel's first step, read alongside the home so it adds no wait; the feed's first page comes with it (the filters run in the database). */
  const [home, first] = await Promise.all([
    readRoommatesHome(),
    loadRoommatesFeed({ tab, filters, cursor: startCursor(tab) }),
    recordRoommatesStep("roommates_home_view"),
  ]);
  return <RoommatesHomeView home={home} t={copy} now={requestNow()} feed={{ tab, filters, initial: first.ok ? first.data : null }} />;
}
