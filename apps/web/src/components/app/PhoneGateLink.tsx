"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { withNext } from "@/lib/auth/next-link";
import { useClientCopyOptional } from "@/lib/i18n/client-copy";

/**
 * THE BUTTON BESIDE THE PHONE GATE'S REFUSAL (founder's FULL GATE ruling,
 * 13 October 2026).
 *
 * Every gated action (a first payment or listing since 15 November 2026; before that also a first message, visit or booking,
 * and the first review and report) answers a member with no confirmed phone
 * with the `required` sentence and `gate: "phone"` (`lib/phone-otp/gate.ts`).
 * The screen keeps drawing the sentence where it always drew its error, and
 * puts this beside it: one button to Settings, Phone, carrying where the
 * member is now as `next`, so the confirm form sends them straight back
 * (`/settings/phone`, `PhoneConfirmForm`). `withNext` drops a `next` that is
 * not a same-site path, so this can never become an open redirect.
 *
 * Renders nothing unless `show`: pass `isPhoneGate(result)`.
 */
/**
 * The same door as an action, for a screen that draws its refusal in a
 * sheet with its own action row (the pay panels' result sheet). Null while
 * there are no words for it.
 */
export function usePhoneGateAction(): { label: string; href: string } | null {
  const pathname = usePathname();
  const label = useClientCopyOptional()?.trustVisible.phone.requiredAction;
  if (!label) return null;
  const here =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : (pathname ?? "/");
  return { label, href: withNext("/settings/phone", here) };
}

export function PhoneGateLink({
  show,
  full = false,
  className,
}: {
  show: boolean;
  full?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const copy = useClientCopyOptional();
  const label = copy?.trustVisible.phone.requiredAction;
  /* The root layout's provider is around every page; with no words there is
     no honest label, so nothing is drawn (the sentence still says the way). */
  if (!show || !label) return null;
  const here =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : (pathname ?? "/");
  return (
    <ButtonLink
      href={withNext("/settings/phone", here)}
      variant="primary"
      size="md"
      full={full}
      leadingIcon="phone"
      className={className}
      data-testid="phone-gate-link"
    >
      {label}
    </ButtonLink>
  );
}
