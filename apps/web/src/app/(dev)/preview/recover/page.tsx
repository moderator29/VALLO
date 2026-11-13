import Link from "next/link";

/**
 * THE RECOVERY PROOF'S DOOR (13 November 2026). A page that always answers,
 * with a link into `./fail`, so the failing page is reached the way a member
 * reaches one: a tap inside the app, a soft navigation, not a fresh load.
 * Dev-only, behind the preview harness's own gate (`../layout.tsx`).
 */
export default function RecoverStart() {
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-gutter py-section">
      <h1 className="nf-h2">Recovery proof</h1>
      <p className="mt-row text-[var(--nf-content-secondary)]">The next page fails on the server as its cookie says, then answers.</p>
      <Link href="/preview/recover/fail" prefetch={false} className="mt-block inline-block underline" data-testid="to-fail">
        Open the page
      </Link>
    </main>
  );
}
