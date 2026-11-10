import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import { TERMS_SECTIONS as sections, TERMS_UPDATED } from "@/lib/legal/terms";
import "@/app/css/site.css";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("terms");
}

/**
 * Terms of service.
 *
 * A structured, honest document for the Nigerian context. It describes how the
 * platform actually works, without inventing corporate details that do not
 * exist yet and without promising mechanisms that are not reachable.
 *
 * This description used to say "payments held until after check-in or
 * inspection". It was removed along with the clause it described: see the
 * header of `lib/legal/terms.tsx` for why a holding promise cannot stand in
 * this document today.
 */
export default function TermsPage() {
  return (
    <>
      <SiteHead
        plate="skyline-waterfront-dusk"
        icon="shield-lock"
        chip="Legal"
        title="Terms of service"
        lede="The rules of the platform, in plain language: what you can expect from Vallo, and what Vallo expects from you."
      >
        <p className="nf-site-badge">Last updated: {TERMS_UPDATED}</p>
      </SiteHead>
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ---------------------------------------------------- document */}
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

        {/* -------------------------------------------------- cross link */}
        <p className="mt-block text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
          See also our{" "}
          <Link href="/privacy" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            Privacy policy
          </Link>
          , or{" "}
          <Link href="/contact" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            contact us
          </Link>{" "}
          with any question.
        </p>
      </div>
    </div>
    </>
  );
}
