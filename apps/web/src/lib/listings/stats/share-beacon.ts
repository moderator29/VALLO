/**
 * LISTING SHARES: THE CLIENT SIGNAL (founder, 14 November 2026).
 *
 * Called when a share has actually gone out, never when the sheet merely
 * opened. `sendBeacon` hands the request to the browser and returns at once;
 * `fetch` with keepalive is the fallback. A browser driven by automation does
 * not send. Nothing is stored on the device, and a count is never worth an
 * error for the person sharing.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function noteListingShared(listingId: string, endpoint = "/api/listing-share"): void {
  if (typeof navigator === "undefined" || !UUID.test(listingId)) return;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
  const body = JSON.stringify({ id: listingId });
  try {
    if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) {
      void fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      }).catch(() => undefined);
    }
  } catch {
    /* Quiet by design. */
  }
}
