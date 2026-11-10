import type { Metadata } from "next";
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from "@/lib/legal/privacy";
import { LegalDocument } from "../LegalDocument";
import { LegalGlance, LegalShortVersion } from "@/components/legal/LegalPreface";
import { PRIVACY_SHORT, PrivacyGlance } from "@/lib/legal/glance";
import { PRIVACY_VERSION } from "@/lib/legal/versions";

export const metadata: Metadata = {
  title: "Privacy policy",
  /*
   * Not indexed, and that is deliberate rather than an oversight. The public
   * copy at /privacy is the canonical one for search engines; this route is
   * the same text inside the product, and two indexed pages with identical
   * bodies compete with each other for no gain.
   */
  robots: { index: false, follow: false },
};

export default function AppPrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      intro="How Vallo collects, uses and protects your personal data, and the rights the Nigeria Data Protection Act 2023 gives you over it."
      updated={PRIVACY_UPDATED}
      sections={PRIVACY_SECTIONS}
      preface={
        <>
          <LegalShortVersion items={PRIVACY_SHORT} version={PRIVACY_VERSION} updated={PRIVACY_UPDATED} />
          <LegalGlance>
            <PrivacyGlance />
          </LegalGlance>
        </>
      }
      otherHref="/legal/terms"
      otherLabel="Terms of service"
    />
  );
}
