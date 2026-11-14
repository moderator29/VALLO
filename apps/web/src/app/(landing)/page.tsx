import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isShellUserAgent, SHELL_START } from "@/lib/native/shell";
import { LandingPageBody } from "@/components/site/landing/LandingPage";

/**
 * `/`, THE FRONT DOOR, IN ITS ONE REMAINING CASE.
 *
 * Since 14 November 2026 this address is the signed-out discovery screen
 * (the founder: "make it our Home Screen of VALLO unsigned"), and the proxy
 * decides that before any page runs: signed in goes to `/home`, signed out
 * with the catalogue open is REWRITTEN to `/search` with the site footer
 * under it. The three ways are named in `lib/site/front-door.ts`.
 *
 * So this file is reached in exactly one case: a signed-out visitor while
 * `VALLO_PUBLIC_CATALOGUE` is off, when a stranger may not be shown the
 * catalogue at all and the front door has to be something else. That
 * something is the landing page, unchanged, drawn from the one
 * implementation it shares with `/tour`.
 *
 * Nothing of the landing page was deleted: its structured data now also sits
 * on the discovery screen when that screen serves `/`, so a search engine
 * reading the root still finds it either way.
 */
export default async function FrontDoorPage() {
  /* V-11. The store shell loads this origin's `/` and must never be shown
     the marketing page: it announces itself in its user agent and is sent to
     its own start, which answers home, welcome or sign in. A browser is
     untouched. See `lib/native/shell.ts`. */
  const head = await headers();
  if (isShellUserAgent(head.get("user-agent"))) redirect(SHELL_START);
  return <LandingPageBody />;
}
