import type { Metadata } from "next";
import Link from "next/link";
import { SiteHead } from "@/components/site/SiteHead";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import { LegalContents } from "@/components/legal/LegalPreface";
import { COOKIES_SECTIONS as sections, COOKIES_UPDATED } from "@/lib/legal/cookies";
import "@/app/css/site.css";

export const metadata: Metadata = {
  title: "Cookies and device storage",
  description: "Every cookie and piece of device storage Vallo uses, what it is for and how long it lasts, and how to change your choice.",
  alternates: { canonical: "/cookies" },
};

/**
 * Cookies and device storage. The words are `lib/legal/cookies.tsx`; the table
 * is generated from `lib/consent/inventory.ts`, the same list the app uses to
 * decide what it may store.
 */
export default function CookiesPage() {
  return (
    <>
      <SiteHead
        plate="skyline-waterfront-dusk"
        icon="shield-lock"
        chip="Legal"
        title="Cookies and device storage"
        lede="Everything Vallo stores on your device, what it is for, how long it lasts, and how to change your choice."
      >
        <p className="nf-site-badge">Last updated: {COOKIES_UPDATED}</p>
      </SiteHead>
      <div className="nf-shell pb-section">
        <div className="mx-auto max-w-3xl">
          <DocumentSheet kind="document" printable className="mt-block nf-legal-sheet">
            <div className="space-y-block">
              <LegalContents sections={sections} />
              {sections.map((s) => (
                <section key={s.title} id={s.id} className="scroll-mt-28">
                  <h2 className="nf-h3">{s.title}</h2>
                  <div className="mt-inline space-y-row text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)] [&_li]:mt-inline [&_strong]:text-[var(--nf-content-primary)] [&_ul]:list-disc [&_ul]:space-y-inline [&_ul]:pl-heading">
                    {s.body}
                  </div>
                </section>
              ))}
            </div>
          </DocumentSheet>
          <p className="mt-block text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            See also our{" "}
            <Link href="/privacy" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Privacy policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Terms of service
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
