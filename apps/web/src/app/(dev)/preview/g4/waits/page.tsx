import LoadingRestaurants from "@/app/(app)/restaurants/loading";
import LoadingSaved from "@/app/(app)/saved/loading";
import LoadingStaysSearch from "@/app/(app)/stays/search/loading";

/**
 * THE SHELF WAITS, HELD STILL SO THEY CAN BE MEASURED AGAINST WHAT LANDS.
 *
 * A `loading.tsx` cannot be routed to, so an audit that wants to know whether
 * a skeleton is the shape of its screen has to catch it mid stream, which on
 * a fast server it never does. Three of them are mounted here instead, the
 * same way `/preview/g4/loading` mounts the root wait, so the reserved
 * geometry can be read off the page and compared with the landed shelf on
 * `/preview/f3/restaurants`, `/preview/f3/stays-search` and
 * `/preview/f3/saved`.
 *
 * `?of=restaurants` (the default), `?of=stays-search`, `?of=saved`.
 */
export const dynamic = "force-dynamic";

export default async function PreviewShelfWaits({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { of } = await searchParams;
  /* The real wait renders inside the `(app)` layout, which supplies the
     gutter. Without it the stand-in would measure wider than the shelf it is
     being compared with, and the comparison would be worthless, so the
     shell's own content wrapper is drawn here exactly as
     `/preview/g4/app-error` draws it. */
  return (
    <main id="main" className="min-h-dvh">
      <div className="nf-shell py-section-tight">
        {of === "saved" ? <LoadingSaved /> : of === "stays-search" ? <LoadingStaysSearch /> : <LoadingRestaurants />}
      </div>
    </main>
  );
}
