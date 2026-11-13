import { showsGuide, type DisplayMoney } from "@/lib/currency/display";

/**
 * THE RATE SOURCE'S CREDIT, WHERE ITS TERMS REQUIRE IT.
 *
 * ExchangeRate-API's open access terms require the link "Rates By Exchange
 * Rate API" to https://www.exchangerate-api.com on every page that uses its
 * rates, and allow it to be discreet. So: once per page that shows a guide
 * figure, small and muted, and only when the rate in use came from that
 * source (the CC0 fallback asks for none). With naira chosen, or no fresh
 * rate, there is nothing to credit and nothing is drawn.
 *
 * Server-safe: no state, no effects. The anchor is a fixed, known host; in
 * the app shells `lib/native/external-links.ts` opens it in the in-app tab.
 */
export const ATTRIBUTION_URL = "https://www.exchangerate-api.com";

export function RatesAttribution({
  display,
  label,
  className,
}: {
  display: DisplayMoney | null | undefined;
  /** `experienceSettings.preferences.attribution`, worded as the terms ask. */
  label: string;
  className?: string;
}) {
  if (!display || !showsGuide(display) || display.rate?.source !== "exchangerate-api") return null;
  return (
    <a
      href={ATTRIBUTION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={["nf-caption text-[var(--nf-content-muted)] underline", className ?? ""].filter(Boolean).join(" ")}
      data-testid="rates-attribution"
    >
      {label}
    </a>
  );
}
