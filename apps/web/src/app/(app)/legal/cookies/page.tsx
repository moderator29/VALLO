import type { Metadata } from "next";
import { COOKIES_SECTIONS, COOKIES_UPDATED } from "@/lib/legal/cookies";
import { LegalDocument } from "../LegalDocument";

export const metadata: Metadata = {
  title: "Cookies and device storage",
  /* The public copy at /cookies is the canonical one for search engines. */
  robots: { index: false, follow: false },
};

export default function AppCookiesPage() {
  return (
    <LegalDocument
      title="Cookies and device storage"
      intro="Everything Vallo stores on your device, what it is for, how long it lasts, and how to change your choice."
      updated={COOKIES_UPDATED}
      sections={COOKIES_SECTIONS}
      otherHref="/legal/privacy"
      otherLabel="Privacy policy"
    />
  );
}
