import type { Metadata } from "next";
import { TERMS_SECTIONS, TERMS_UPDATED } from "@/lib/legal/terms";
import { LegalDocument } from "../LegalDocument";
import { LegalGlance, LegalShortVersion } from "@/components/legal/LegalPreface";
import { TERMS_SHORT, TermsGlance } from "@/lib/legal/glance";
import { TERMS_VERSION } from "@/lib/legal/versions";

export const metadata: Metadata = {
  title: "Terms of service",
  // Same reasoning as the privacy route: /terms is the canonical public copy.
  robots: { index: false, follow: false },
};

export default function AppTermsPage() {
  return (
    <LegalDocument
      title="Terms of service"
      intro="The agreement between you and Vallo when you use the platform, book a place, or list one."
      updated={TERMS_UPDATED}
      sections={TERMS_SECTIONS}
      preface={
        <>
          <LegalShortVersion items={TERMS_SHORT} version={TERMS_VERSION} updated={TERMS_UPDATED} />
          <LegalGlance>
            <TermsGlance />
          </LegalGlance>
        </>
      }
      otherHref="/legal/privacy"
      otherLabel="Privacy policy"
      also={{ href: "/legal/disclaimer", label: "Disclaimer" }}
    />
  );
}
