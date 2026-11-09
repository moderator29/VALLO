import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readRoommatesHome } from "@/lib/features/roommates/queries";
import { recordRoommatesStep } from "@/lib/funnel/roommates";
import { requestNow } from "@/lib/format/when";

import { RoommatesHomeView } from "./_parts/HomeView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: copy.title, description: copy.tagline };
export const dynamic = "force-dynamic";

/** The roommates home: the read, then the screen (`_parts/HomeView.tsx`). */
export default async function RoommatesHomePage() {
  /* The funnel's first step, read alongside the home so it adds no wait. */
  const [home] = await Promise.all([readRoommatesHome(), recordRoommatesStep("roommates_home_view")]);
  return <RoommatesHomeView home={home} t={copy} now={requestNow()} />;
}
