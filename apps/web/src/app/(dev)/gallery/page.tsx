import Link from "next/link";
import { notFound } from "next/navigation";

import { previewHarnessIsOpen } from "@/lib/preview-harness";
import { GalleryBoard } from "./GalleryBoard";

/**
 * THE COMPONENT GALLERY, AND WHY IT EXISTS.
 *
 * A third of this product by surface area has never been seen rendered by
 * anybody working on it. The wallet drawer, `Sheet`, the queue empty states,
 * the stalled-money notice: all of them sit behind a session, and there is no
 * seeded environment to get a session from. So the work landed on compiler
 * proofs and careful reading, and every report for a week has carried a NOT
 * VERIFIED section saying the same thing.
 *
 * Most of those components do not actually need a session. They need PROPS.
 * `Sheet` is the most-used overlay in the product and it takes `open`, a title
 * and children; the fact that its real callers are all behind auth is a fact
 * about its callers. So this route mounts them with fixtures, and the things
 * that have never been looked at become things anybody can open in a browser.
 *
 * WHAT IT IS NOT. It is not a test and it does not assert anything. It is a
 * place to LOOK, which is the one thing this project has had no way to do. The
 * automated checks stay where they are.
 *
 * DEVELOPMENT ONLY, ENFORCED HERE RATHER THAN BY A ROUTE RULE. `notFound()`
 * means this cannot be reached on a deployed site even if something upstream
 * forgets to exclude it, and it is a 404 rather than a redirect because a
 * redirect tells a stranger the route exists.
 *
 * THE GATE IS `previewHarnessIsOpen` NOW, NOT A BARE `NODE_ENV` CHECK, and the
 * reason is written out in `app/(dev)/preview/layout.tsx`: every proof on this
 * build is retaken on a server that actually hydrates, `next dev` does not
 * hydrate reliably on this box, and `next start` IS production. A bare
 * `NODE_ENV` check therefore 404s the board on the only server a proof counts
 * from, which is exactly the wall the screenshot sweeps hit on `/preview` before
 * that layout was changed. This route was the last one still holding the old
 * shape, found by walking it: a browser walk could not reach the board to
 * prove its back control drew.
 *
 * It is not a loosening. `previewHarnessIsOpen` needs an explicit
 * `VALLO_PREVIEW_HARNESS=1` and refuses outright on Vercel whatever that
 * variable says, so a deployed vallospaces.com cannot serve this board even by
 * mistake - which is more than the old check promised, since the old one would
 * have opened on any non-production build anywhere.
 */
export default function GalleryPage() {
  if (!previewHarnessIsOpen(process.env)) notFound();
  return (
    <>
      {/* The other boards of this harness. Same gate as this page (each page
          checks `previewHarnessIsOpen` itself), and none is product, so they
          are NON_NAVIGABLE in `lib/nav/route-parents.ts`: this is the only way
          in short of typing the address. */}
      <nav aria-label="Other boards" className="nf-shell flex flex-wrap gap-sm pt-md">
        <Link href="/gallery/ported" className="nf-link-btn">
          Ported components
        </Link>
        <Link href="/gallery/features" className="nf-link-btn">
          Features
        </Link>
      </nav>
      <GalleryBoard />
    </>
  );
}
