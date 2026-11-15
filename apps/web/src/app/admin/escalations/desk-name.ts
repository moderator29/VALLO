import { deskRoot } from "@/lib/admin/escalations/types";
import { ADMIN_NAV } from "../_components/nav";

/**
 * The desk an escalation was raised from, in the words the rail uses for it:
 * "/admin/kyc" is "the Verification desk". The exact page first, then the
 * desk it sits under. A path the rail does not know is "the console", never
 * a raw address.
 */
export function deskName(sourceDesk: string): string {
  if (sourceDesk === "/admin") return "the console overview";
  const root = deskRoot(sourceDesk);
  const found = ADMIN_NAV.find((item) => item.href === sourceDesk) ?? ADMIN_NAV.find((item) => item.href === root);
  return found ? `the ${found.label} desk` : "the console";
}

/** Where the "from which desk" link goes: the desk's own front page. */
export function deskHref(sourceDesk: string): string {
  return deskRoot(sourceDesk);
}
