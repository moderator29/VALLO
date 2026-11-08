import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { G2_OBJECTS } from "./objects";

/**
 * G2's screenshot harness: every glass object cropped from the reference
 * renders, on the four real grounds, at the three sizes the product uses.
 *
 * The first block is the proof that fits one 390 by 844 viewport: all objects
 * at 32 on canvas, card, elevated and the glass card, side by side, so one
 * dark shot and one light shot show the cutout on every ground at once. The
 * header is one short line and the caption sits under the grid for exactly
 * that reason: 21 rows of 32 have to clear the fold. The
 * sections below repeat each ground at 32, 48 and 96 with the object's name,
 * its source render and its size at source, for scrolling and for anchored
 * shots (`#canvas`, `#card`, `#elevated`, `#glass`).
 *
 * Theme follows the document, as everywhere: the light shot is the light
 * theme, where an untwinned object sits on the navy chip `--nf-icon-ground`
 * paints behind it. Never the proof of the ONE LAW, only the proof of the look.
 */

const GROUNDS = [
  { id: "canvas", label: "Canvas", className: "bg-[var(--nf-surface-canvas)]" },
  { id: "card", label: "Card", className: "bg-[var(--nf-surface-primary)]" },
  { id: "elevated", label: "Elevated", className: "bg-[var(--nf-surface-elevated)]" },
  { id: "glass", label: "Glass card", className: "nf-card" },
] as const;

const SIZES = [32, 48, 96] as const;

export default function G2Preview() {
  return (
    <main className="min-h-dvh bg-[var(--nf-surface-canvas)] px-gutter py-md">
      <h1 className="nf-h3">G2: render glass objects</h1>

      <section aria-label="Every object at 32 on four grounds" className="mt-xs grid grid-cols-4 gap-xs">
        {GROUNDS.map((ground) => (
          <div key={ground.id} className={`${ground.className} rounded-md p-2xs`}>
            <p className="nf-caption truncate text-center">{ground.label}</p>
            <div className="mt-2xs grid grid-cols-2 justify-items-center gap-x-2xs gap-y-3xs">
              {G2_OBJECTS.map((object) => (
                <BrandIcon key={object.name} name={object.name} size={32} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="nf-caption mt-xs">
        {G2_OBJECTS.length} objects on four grounds at 32 above, and at 32, 48 and 96 below. Theme
        follows the document.
      </p>

      {GROUNDS.map((ground) => (
        <section key={ground.id} id={ground.id} className="mt-section">
          <h2 className="nf-h3">{ground.label}</h2>
          <ul className={`${ground.className} mt-xs flex flex-col gap-xs rounded-lg p-xs`}>
            {G2_OBJECTS.map((object) => (
              <li key={object.name} className="flex items-center gap-xs">
                <div className="flex shrink-0 items-end gap-xs">
                  {SIZES.map((size) => (
                    <BrandIcon key={size} name={object.name} size={size} />
                  ))}
                </div>
                <div className="min-w-0">
                  <code className="nf-caption block truncate">{object.name}</code>
                  <p className="nf-caption truncate">
                    {object.render}, {object.native}px at source
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
