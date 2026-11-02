import { DOJAH_IDENTITY_ORIGIN } from "./config";

/**
 * THE HOSTED EASYONBOARD LINK (widget-sdks/web-javascript, "Resources").
 *
 * Vallo opens the flow as an iframe on identity.dojah.io rather than loading
 * widget.js: the site's script policy is nonce + strict-dynamic, and a
 * third-party script that injects its own frames is exactly what it is built
 * to refuse. The frame needs only `frame-src` and a camera delegation.
 *
 * `metadata[vallo_ref]` is the check row's id: opaque, never a NIN, BVN or
 * phone (the docs' own warning), and it comes back in the webhook's metadata,
 * which is how the result finds its row. Names are prefilled only when Vallo
 * really holds them; an empty parameter would prefill a blank.
 */
export function dojahHostedUrl(input: {
  widgetId: string;
  checkId: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const url = new URL(DOJAH_IDENTITY_ORIGIN + "/");
  url.searchParams.set("widget_id", input.widgetId);
  url.searchParams.set("metadata[vallo_ref]", input.checkId);
  const first = input.firstName?.trim();
  const last = input.lastName?.trim();
  if (first) url.searchParams.set("user_data[first_name]", first);
  if (last) url.searchParams.set("user_data[last_name]", last);
  return url.toString();
}
