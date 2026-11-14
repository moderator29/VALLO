import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { LandingPageBody } from "@/components/site/landing/LandingPage";

/**
 * THE LANDING PAGE'S OWN ADDRESS.
 *
 * `/` became the signed-out discovery screen on 14 November 2026 (the
 * founder: "make it our Home Screen of VALLO unsigned"), and the landing
 * page is a real asset: the city capsules, the stats band that prints only
 * what `platform_stats()` returns, the ten-tile grid, the explainers, the
 * Stays band. None of it was deleted. It lives here, it is linked from the
 * site footer and the menu, and `/` still draws it while the public
 * catalogue is switched off.
 *
 * WHY `/tour`. It is what the page is: a walk through the product for
 * somebody deciding whether to use it. `/about` is the company, `/welcome`
 * is the first run inside the app, and `/discover` is reserved for the
 * showcase the brief asks for separately, so none of those could take it.
 */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("tour");
}

export default async function TourPage() {
  return <LandingPageBody />;
}
