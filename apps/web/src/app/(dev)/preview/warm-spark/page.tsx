import { HeroBand } from "@/components/ui/HeroBand";
import { KpiTile } from "@/components/ui/KpiTile";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * The warm spark's placements that sit behind a role (docs/design/
 * CLEAN_UNIFIED_DIRECTION.md section 18), on one page for the screenshot
 * harness: the desk band with its blue-to-orange lap and the unread figure,
 * the register flow's current bar, the listing wizard's current segment,
 * stars, the "New" tag and the dock's unread badge. Every figure is an
 * example.
 */
export default function WarmSparkPreview() {
  return (
    <main className="nf-shell flex flex-col gap-lg py-lg">
      <div className="nf-desk-home">
        <HeroBand lap label="Example" title="Today" sub="An example desk band.">
          <div className="nf-desk-kpis">
            <KpiTile label="Live listings" icon="house" value={7} href="#" />
            <KpiTile label="Inspections" icon="calendar-clock" value={2} href="#" />
            <KpiTile label="In review" icon="file-search" value={1} href="#" />
            <KpiTile label="Unread" icon="chat-bubble" value={4} href="#" className="nf-kpi--spark" />
          </div>
        </HeroBand>
      </div>

      <section className="flex flex-col gap-sm" data-testid="flows">
        <p className="nf-section-label">Register flow, step 2 of 4</p>
        <div className="nf-steprow" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="nf-steprow__bar" data-on={i <= 1 || undefined} />
          ))}
        </div>
        <p className="nf-section-label">List a property, step 3 of 6</p>
        <div className="nf-lw-rail__track" style={{ display: "flex", gap: "0.375rem" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="nf-lw-rail__seg" data-done={i <= 2 ? "" : undefined} data-at={i === 2 ? "" : undefined} />
          ))}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-md" data-testid="marks">
        <span className="nf-numeric flex items-center gap-xs">
          {[0, 1, 2, 3, 4].map((i) => (
            <UiIcon key={i} name="star" size={16} filled className="text-[var(--nf-rating)]" />
          ))}
          <span className="font-semibold">4.8</span>
        </span>
        <span className="nf-badge nf-badge--spark">New</span>
        <span className="relative inline-grid h-12 w-12 place-items-center rounded-full bg-[var(--nf-surface-raised)]">
          <UiIcon name="bell" size={20} />
          <span className="nf-dockmore__unread nf-numeric">3</span>
        </span>
        <span className="nf-badge nf-badge--info">Info stays blue</span>
      </section>
    </main>
  );
}
