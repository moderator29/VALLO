import Link from "next/link";
import { welcome, type SignupRole } from "@/lib/email/welcome-message";
import { siteUrl } from "@/lib/email/render";

/**
 * THE WELCOME EMAIL, RENDERED (track H). Development only: the preview layout
 * answers not-found on Vercel and off Vercel unless the harness is open.
 *
 * Every version is drawn from `WELCOME_COPY` in `lib/email/welcome-message.ts`,
 * so refining the email is editing that object and reloading this page. The
 * HTML is shown in a frame at a phone's width and at the 600px desktop
 * column, and the plain-text twin beneath it, because both are sent.
 *
 * Images in the email are absolute URLs on the production origin, which this
 * page's content policy does not load; for the frame only they are pointed at
 * this server, which serves the same files.
 */
const ROLES: (SignupRole | "general")[] = ["general", "renter", "buyer", "landlord", "seller", "agent"];

export default async function WelcomeEmailPreview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = typeof params.role === "string" ? params.role : "general";
  const role = (ROLES as string[]).includes(pick) ? (pick as SignupRole | "general") : "general";
  const name = typeof params.name === "string" ? params.name : "Ada Obi";
  const message = welcome({ name, role: role === "general" ? null : role });
  const html = message.html.split(siteUrl()).join("");

  return (
    <main id="main" className="mx-auto max-w-5xl p-gutter">
      <h1 className="nf-h2">Welcome email</h1>
      <p className="nf-body-sm mt-2xs text-[var(--nf-content-secondary)]">
        Subject: <strong className="text-[var(--nf-content-primary)]">{message.subject}</strong>
      </p>
      <nav aria-label="Versions" className="mt-sm flex flex-wrap gap-xs">
        {ROLES.map((r) => (
          <Link
            key={r}
            href={`/preview/email/welcome?role=${r}`}
            aria-current={r === role ? "page" : undefined}
            className={`nf-btn nf-btn--sm ${r === role ? "nf-btn--primary" : "nf-btn--glass"}`}
            data-testid={`welcome-role-${r}`}
          >
            {r}
          </Link>
        ))}
      </nav>
      <div className="mt-md grid gap-md lg:grid-cols-[390px_1fr]">
        <section aria-label="Phone width">
          <h2 className="nf-h4 mb-xs">390px</h2>
          <iframe
            title="Welcome email at phone width"
            srcDoc={html}
            className="block h-[1700px] w-[390px] max-w-full rounded-md border border-[var(--nf-border-default)]"
            data-testid="welcome-frame-phone"
          />
        </section>
        <section aria-label="Desktop width" className="hidden lg:block">
          <h2 className="nf-h4 mb-xs">640px</h2>
          <iframe
            title="Welcome email at desktop width"
            srcDoc={html}
            className="block h-[1500px] w-[640px] rounded-md border border-[var(--nf-border-default)]"
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
