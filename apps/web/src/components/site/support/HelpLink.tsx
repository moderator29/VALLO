import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * THE LINK AT THE MOMENT OF DOUBT (DOCS_AND_PRESENCE_UPGRADE.md 8: "a link
 * to the cancellation policy on the booking screen, the verification guide
 * inside the verification stepper, the payout explanation on the payout
 * screen"). One quiet line with a thin question glyph, to a stable public
 * address, so the question is answered where it forms and the member does
 * not have to go looking. One shape everywhere it appears.
 *
 * The addresses are the written surface's own stable ones; the screens that
 * carry this line name them through `HELP_LINKS`, so a moved document is
 * corrected here once.
 */
const HELP_LINKS = {
  cancellation: { href: "/cancellations", label: "How cancellation and refunds work" },
  verification: { href: "/docs/badges-and-verification", label: "How verification works" },
  payouts: { href: "/docs/paying-on-vallo#for-listers", label: "How payouts work" },
  help: { href: "/help", label: "Open the help centre" },
} as const;

export function HelpLink({ to, className = "" }: { to: keyof typeof HELP_LINKS; className?: string }) {
  const link = HELP_LINKS[to];
  return (
    <p className={`text-[length:var(--nf-text-body-sm)] ${className}`}>
      <Link
        href={link.href}
        className="nf-tap inline-flex min-h-11 items-center gap-inline font-semibold text-[var(--nf-content-link)] hover:underline"
      >
        <UiIcon name="info" size={16} />
        {link.label}
        <UiIcon name="chevron-right" size={16} />
      </Link>
    </p>
  );
}
