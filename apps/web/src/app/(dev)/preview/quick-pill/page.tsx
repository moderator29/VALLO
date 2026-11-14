import { QuickPillDeck } from "./QuickPillDeck";

/**
 * THE QUICK PILL (founder, 14 November 2026, handoff 6.1): the store's
 * lighter voice, `banner.quick`. Fire each moment and watch the pill rise
 * above the bottom, hold about 1.4 seconds and leave by itself. Fire the
 * same words twice quickly: the clock restarts with no second entrance.
 * Fire an error after a pill: the top banner takes over at once.
 */
export default function PreviewQuickPill() {
  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">The quick pill</h1>
      <QuickPillDeck />
    </main>
  );
}
