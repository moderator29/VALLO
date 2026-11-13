import type { Metadata } from "next";
import { LostMoment } from "@/components/app/LostMoment";

/**
 * 404 at the root: the brand moment on its own landmark.
 *
 * The screen itself is `components/app/LostMoment.tsx`, shared with
 * `app/(app)/not-found.tsx`, which draws the same thing inset because inside
 * the signed-in app this page lands within `AppShell`'s `<main id="main">`
 * and would otherwise nest a second one inside it.
 */
/* OPS-17: the not-found page is never a page to index. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NotFound() {
  return <LostMoment />;
}
