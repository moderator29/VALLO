import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { readRoommatesHome } from "@/lib/features/roommates/queries";
import { requestNow } from "@/lib/format/when";

import { RoommatesHomeView } from "./_parts/HomeView";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: copy.title, description: copy.tagline };
export const dynamic = "force-dynamic";

/** The roommates home: the read, then the screen (`_parts/HomeView.tsx`). */
export default async function RoommatesHomePage() {
  const home = await readRoommatesHome();
  return <RoommatesHomeView home={home} t={copy} now={requestNow()} />;
}
