import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("community");
}

/**
 * Community promise.
 *
 * A plain-language page that sets out what Vallo commits to for every person
 * on the platform, and what every person commits to in return. No legal
 * weight - the terms page carries that - but the five things a reader should
 * be able to find without reading the terms.
 */

const SECTIONS: {
  id: string;
  title: string;
  body: string;
}[] = [
  {
    id: "honest-listings",
    title: "Honest listings",
    body: "Every listing on Vallo is reviewed before it goes live. Photographs must be of the actual property, prices must include what the listing says they include, and availability must be current. A listing that misrepresents what you will find is taken down.",
  },
  {
    id: "safe-viewings",
    title: "Careful viewings",
    body: "Meet in daylight, bring someone with you, and keep the conversation on Vallo. If anything feels wrong before or during a viewing, report it. Vallo reviews all parties involved and responds to safety reports within hours.",
  },
  {
    id: "money-held-safely",
    title: "Money through licensed providers",
    body: "Payments are processed by licensed providers, never held in personal accounts. The price you agree is the price you pay, with no hidden charges. If something goes wrong, the refund policy on your booking applies automatically.",
  },
  {
    id: "respectful-community",
    title: "Respectful community",
    body: "Discrimination, harassment and threats have no place here. Listers confirm their identity before a listing is published, messages are scanned for unsafe language, and anyone who makes the platform worse for others is removed.",
  },
  {
    id: "your-part",
    title: "Your part",
    body: "Be honest in your listings and in your messages. Treat the people you deal with the way you expect to be treated. If you see something that does not belong here, report it - that is how the platform stays safe for everyone.",
  },
];

export default function CommunityPromisePage() {
  return (
    <>
      <SiteHead
        plate="villa-pool-terrace"
        icon="shield-check"
        chip="Community"
        title="Our promise to you"
        lede="Five commitments Vallo makes to every person on the platform, and one commitment we ask in return."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ---------------------------------------------------- sections */}
        <div className="mt-section space-y-heading">
          {SECTIONS.map((s) => (
            <section key={s.id} aria-labelledby={s.id}>
              <h2
                id={s.id}
                className="nf-h2 text-[length:var(--nf-text-h3)]"
              >
                {s.title}
              </h2>
              <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {/* -------------------------------------------------- cross link */}
        <p className="mt-block text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
          For the full rules, read the{" "}
          <Link href="/terms" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            Terms of service
          </Link>
          . To report a problem,{" "}
          <Link href="/contact" className="font-semibold text-[var(--nf-content-link)] hover:underline">
            contact us
          </Link>
          .
        </p>
      </div>
    </div>
    </>
  );
}
