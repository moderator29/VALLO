import type { Metadata } from "next";
import { LostMoment } from "@/components/app/LostMoment";

/**
 * 404 INSIDE THE SIGNED-IN APP, AND WHY IT IS A SEPARATE FILE.
 *
 * Without it, a `notFound()` from any route in this group falls through to
 * the root `app/not-found.tsx`, which draws its stage as `<main id="main">`.
 * That body still renders inside this group's layout, so it lands within
 * `AppShell`'s own `<main id="main">`. Measured in Chromium on `/wallet` on
 * 13 November 2026: two `main` landmarks, one inside the other, both with
 * the id `main`, which is also the target of the skip link in
 * `app/layout.tsx`. The same screen, drawn inset, is a plain `<div>`.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NotFound() {
  return <LostMoment inset />;
}
