import Link from "next/link";
import { SiteHead } from "@/components/site/SiteHead";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import { AI_DOCS, type AiDoc } from "@/lib/legal/ai-assistant";
import "@/app/css/site.css";

/** One of the four AI assistant documents, on the site's legal layout. */
export function AiLegalPage({ doc }: { doc: AiDoc }) {
  const others = Object.values(AI_DOCS).filter((d) => d.slug !== doc.slug);
  return (
    <>
      <SiteHead plate="skyline-waterfront-dusk" icon="shield-lock" chip="VALLO AI" title={doc.title} lede={doc.lede}>
        <p className="nf-site-badge">
          Version {doc.version}. Last updated: {doc.updated}
        </p>
      </SiteHead>
      <div className="nf-shell pb-section">
        <div className="mx-auto max-w-3xl">
          <DocumentSheet kind="document" printable className="mt-block nf-legal-sheet">
            <div className="space-y-block">
              {doc.sections.map((s) => (
                <section key={s.title}>
                  <h2 className="nf-h3">{s.title}</h2>
                  <div className="mt-inline space-y-row text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)] [&_li]:mt-inline [&_strong]:text-[var(--nf-content-primary)] [&_ul]:list-disc [&_ul]:space-y-inline [&_ul]:pl-heading">
                    {s.body}
                  </div>
                </section>
              ))}
            </div>
          </DocumentSheet>
          <p className="mt-block text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            Also read:{" "}
            {others.map((d, i) => (
              <span key={d.slug}>
                {i > 0 ? ", " : ""}
                <Link href={`/ai/${d.slug}`} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                  {d.title}
                </Link>
              </span>
            ))}
            . Or the{" "}
            <Link href="/privacy" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              Vallo Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
