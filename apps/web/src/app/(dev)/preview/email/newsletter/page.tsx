import { platformNewsletter } from "@/lib/email/newsletter-message";
import { siteUrl } from "@/lib/email/render";

/**
 * THE PLATFORM NEWSLETTER, RENDERED. Development only: the preview layout
 * answers not-found on Vercel and off Vercel unless the harness is open.
 *
 * Shown in a frame at a phone's width and at the 600px desktop column, with
 * the plain-text twin beneath it. Images are absolute URLs on the production
 * origin; for the frame only they are pointed at this server, which serves
 * the same files in `public/brand/email/newsletter`.
 */
export default async function NewsletterEmailPreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const name = typeof params.name === "string" ? params.name : "Ada Obi";
  const message = platformNewsletter({ name });
  const html = message.html.split(siteUrl()).join("");

  return (
    <main id="main" className="mx-auto max-w-5xl p-gutter">
      <h1 className="nf-h2">Platform newsletter</h1>
      <p className="nf-body-sm mt-2xs text-[var(--nf-content-secondary)]">
        Subject: <strong className="text-[var(--nf-content-primary)]">{message.subject}</strong>
      </p>
      <div className="mt-md grid gap-md lg:grid-cols-[390px_1fr]">
        <section aria-label="Phone width">
          <h2 className="nf-h4 mb-xs">390px</h2>
          <iframe
            title="Newsletter at phone width"
            srcDoc={html}
            className="block h-[4200px] w-[390px] max-w-full rounded-md border border-[var(--nf-border-default)]"
            data-testid="newsletter-frame-phone"
          />
        </section>
        <section aria-label="Desktop width" className="hidden lg:block">
          <h2 className="nf-h4 mb-xs">640px</h2>
          <iframe
            title="Newsletter at desktop width"
            srcDoc={html}
            className="block h-[3600px] w-[640px] rounded-md border border-[var(--nf-border-default)]"
          />
        </section>
      </div>
      <section aria-label="Plain text" className="mt-md">
        <h2 className="nf-h4 mb-xs">Plain text</h2>
        <pre className="nf-body-sm overflow-x-auto whitespace-pre-wrap rounded-md border border-[var(--nf-border-default)] p-card-sm">
          {message.text}
        </pre>
      </section>
    </main>
  );
}
