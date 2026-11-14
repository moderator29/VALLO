import { LogoMarkLive } from "@/design-system/brand/LogoMarkLive";
import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingShell } from "@/components/app/ScreenSkeleton";
import "@/app/css/system.css";

/**
 * The landing page's wait.
 *
 * `/` is the most expensive page on the platform to render and the one a
 * stranger sees first, so it has a loading state drawn in its own shape.
 *
 * IT LIVES IN THE `(landing)` GROUP, NOT AT THE ROOT (trace B-3, 29 September
 * 2026). At the root of `app/` it was the Suspense boundary around EVERY
 * segment's layout, and `loading.tsx` never wraps the layout of its own
 * segment: while `(app)/layout.tsx` read the session on a full reload into
 * `/home`, the fallback on screen was this one, the landing hero, before the
 * app shell and its own skeleton arrived. In a group of its own it wraps
 * `/` alone; `(app)`, `(auth)`, `(site)`, `agent`, `host` and `admin` wait
 * on their own boundaries.
 *
 * It draws the landing hero's shape in the register rather than a spinner:
 * the mark, three display lines, a lede, the search pill at its real height
 * inside a glass capsule, and the feature grid as four glass cards. The one
 * ambient is the living canvas the root layout already mounts; nothing here
 * paints a second one.
 */
export default function LoadingRoot() {
  return (
    <LoadingShell label="Loading Vallo" className="nf-shell nf-wait py-section">
      {/* The new mark as the loader (D81): the towers rise out of the ring,
          then a light runs round the ring, blue into orange, until the page
          arrives. Inline, so it needs no request of its own; it carries both
          palettes, so a light page waits on the day mark. At rest under
          reduced motion, data saving, Calm and Off. */}
      <LogoMarkLive size={56} motion="orbit" className="nf-wait__mark" />

      <div className="mt-xl max-w-2xl">
        {/* Three display lines, which is what the hero is. */}
        <Skeleton width="min(18rem, 80%)" height="3.25rem" radius="sm" />
        <Skeleton width="min(20rem, 88%)" height="3.25rem" radius="sm" className="mt-sm" />
        <Skeleton width="min(16rem, 72%)" height="3.25rem" radius="sm" className="mt-sm" />

        <Skeleton width="min(34rem, 100%)" height="1.25rem" radius="sm" className="mt-lg" />

        {/* The search bar: the field and its submit inside one glass panel.
            ROUNDED RECTANGLES, and the comment that stood here cited the
            section 8 amendment, which is WITHDRAWN (DESIGN_DIRECTION 1.4,
            ledger 13.4). Restating a withdrawn amendment is how it survives,
            so the citation goes with the shape.

            A skeleton is a SHAPE and section 1.4 exempts it, so rule 10 is
            right to stay silent. The law reaches these two through what they
            are a picture of: the landing's real search field and its real
            submit both measured 14px on the live page (ledger 13.3), so a
            capsule here is a picture of a control the product does not draw,
            and the page visibly reshapes the moment it loads, which is the one
            thing a skeleton exists to prevent. `md` is 14px, the control rung,
            on a 48px slab: ratio 0.29. Seven siblings were moved in 13.4;
            these two were missed. */}
        <div className="nf-panel nf-wait__pill">
          <Skeleton height="3rem" radius="md" />
          <Skeleton width="6.5rem" height="3rem" radius="md" className="shrink-0" />
        </div>
      </div>

      <div className="nf-wait__grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="nf-panel nf-panel--card block p-card">
            <Skeleton circle width="2.5rem" />
            <Skeleton width="60%" height="1rem" radius="sm" className="mt-md" />
            <Skeleton width="85%" height="0.75rem" radius="sm" className="mt-xs" />
          </div>
        ))}
      </div>
    </LoadingShell>
  );
}
