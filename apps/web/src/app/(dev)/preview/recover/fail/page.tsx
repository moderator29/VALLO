import { cookies } from "next/headers";

/**
 * A SERVER COMPONENT THAT FAILS, THEN ANSWERS (13 November 2026, the proof for
 * the founder's dead Try again). Dev-only, behind the preview harness's gate
 * (`../../layout.tsx`): it 404s on Vercel and on any server not started with
 * VALLO_PREVIEW_HARNESS=1.
 *
 * The `recover_mode` cookie decides each answer:
 *   once:<id>  the first request for that id throws, every later one answers
 *              (a database read that timed out once)
 *   always     every request throws (the server is down for a while)
 *   anything else, or none: it answers
 *
 * The throw is a real Server Component failure, so the browser receives what
 * production sends: an error with a digest and no message.
 */
const seen = new Map<string, number>();

export default async function RecoverFail() {
  const mode = (await cookies()).get("recover_mode")?.value ?? "ok";
  if (mode.startsWith("once:")) {
    const count = seen.get(mode) ?? 0;
    seen.set(mode, count + 1);
    if (count === 0) throw new Error(`recover preview: first answer for ${mode} fails`);
  } else if (mode === "always") {
    throw new Error("recover preview: every answer fails");
  }
  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-gutter py-section" data-testid="recovered">
      <h1 className="nf-h2">Your homes</h1>
      <p className="mt-row text-[var(--nf-content-secondary)]">The server answered. Rendered at {new Date().toISOString()}.</p>
    </main>
  );
}
