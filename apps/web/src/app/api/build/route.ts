import { NextResponse } from "next/server";

/**
 * THE DEPLOY THAT IS LIVE, for `components/app/DeployWatch.tsx`.
 *
 * A page that stayed open on a phone across a release asks this on open and on
 * return to the front, compares the answer with the build id baked into its own
 * script (`NEXT_PUBLIC_BUILD_ID`, see next.config.ts) and reloads itself once
 * when they differ (`lib/deploy/watch.ts` decides).
 *
 * Public and unauthenticated on purpose (listed in `proxy.ts`): it answers one
 * opaque id and nothing else. Never cached anywhere, because a cached answer is
 * the stale copy this exists to replace.
 *
 * 9 November 2026: this file was written on 6 November but the repository's
 * blanket `build/` ignore rule kept it out of every commit, so the live site
 * answered 404 and no phone ever reloaded. `.gitignore` now lets it through.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json(
    { id: process.env.VERCEL_DEPLOYMENT_ID ?? "" },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
