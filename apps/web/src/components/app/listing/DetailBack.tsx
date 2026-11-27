import { BackControl } from "@/components/ui/BackControl";

/**
 * THE WAY BACK ON A PHOTO-FIRST DETAIL PAGE.
 *
 * `/listing/<id>`, `/stay/<id>` and `/restaurant/<id>` are the three routes
 * `AppShell` deliberately draws with NO top bar (`edgeToEdge`), so that the
 * photograph can reach the top edge. On 13 November the listing's back control
 * was moved off the photograph and into that bar's lead slot, which on these
 * three routes does not exist: `BarBack` finds no slot, renders nothing, and
 * the page was left with no way back at all until the sticky section tabs
 * scrolled into view. The founder, 27 November: "there is no go back button in
 * the listing page ... it's until I scroll down that I can see it".
 *
 * So the control comes back as its own row, ABOVE the card and outside it.
 * That is the other half of the 16 November ruling, which was not "put it in
 * the bar" but "don't make the go back button be inside the image container
 * ... it should be outside the container but beside, not sit on top". A row
 * over the card is outside the container; the bar was simply a bar that is not
 * on these pages.
 *
 * IT HIDES ITSELF WHERE A BAR DOES CARRY ONE. `BarBack` sets `data-page-back`
 * on the document only when it actually found a lead slot to portal into, so
 * the rule in `space-card.css` keyed on that attribute means these two can
 * never both be on screen, and never both be missing.
 */
export function DetailBack({ fallback }: { fallback: string }) {
  return (
    <div className="nf-detail-back">
      <BackControl fallback={fallback} surface="bare" data-testid="detail-back" />
    </div>
  );
}
