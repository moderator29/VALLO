import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import Link from "next/link";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import { SiteHead } from "@/components/site/SiteHead";
import { DISCLAIMER_SECTIONS as sections, DISCLAIMER_UPDATED } from "@/lib/legal/disclaimer";
import "@/app/css/site.css";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("disclaimer");
}

/** The Disclaimer, public copy. The content lives in `lib/legal/disclaimer.tsx`. */
export default function DisclaimerPage() {
  return (
    <>
      <SiteHead
        plate="skyline-waterfront-dusk"
        icon="shield-lock"
        chip="Legal"
        title="Disclaimer"
        lede="What Vallo is responsible for, and what it is not. Keep everything on the platform."
      >
        <p className="nf-site-badge">Last updated: {DISCLAIMER_UPDATED}</p>
      </SiteHead>
      <div className="nf-shell pb-section">
        <div className="mx-auto max-w-3xl">
          {/* THE DOCUMENT, ON PAPER (D28.1; Session 3, W1): the shared document
             sheet is the frame, a light sheet on the reader's theme that prints
             on its own (print.css). Only the frame changed; every word is the
             legal text exactly as it was. */}
          <DocumentSheet kind="document" printable className="mt-block nf-legal-sheet">
            <div className="space-y-block">
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
            <Link href="/terms" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
