import { UiIcon } from "@/design-system/icons/UiIcon";
import { PARTNER_MARK_TEXT, partnerMarkReady } from "@/lib/money/protected-wording";
import "./pp-screens.css";

/**
 * THE PARTNER MARK (Option 2, BUILD section 3 point 2): one small, quiet line
 * beside the pay button, and nowhere else. It is drawn only when BOTH hold:
 * the provider has supplied its wording and asset (`partnerMarkReady` in
 * protected-wording.ts, false today), and the founder's presentation flag
 * `protected_partner_mark_on` is on (read on the server and passed in as
 * `on`). Moving to full white label is that flag going off: one switch, no
 * sweep. Server-safe.
 */
export function PartnerMark({ on }: { on: boolean }) {
  if (!partnerMarkReady || !on) return null;
  return (
    <p className="nf-pp-partner" data-testid="pp-partner-mark">
      <UiIcon name="shield-check" size={14} weight="lean" />
      <span>{PARTNER_MARK_TEXT}</span>
    </p>
  );
}
