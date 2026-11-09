import { termsUpdateOwed } from "@/lib/legal/terms-update";
import { TermsUpdateNotice } from "./TermsUpdateNotice";

/**
 * Renders the one-time new-terms sheet only for a member who still owes it.
 * Its own server component, so the read runs beside the page and a slow
 * answer never holds the shell.
 */
export async function TermsUpdateMount() {
  return (await termsUpdateOwed()) ? <TermsUpdateNotice /> : null;
}
