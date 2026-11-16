import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSessionClaims } from "@/lib/actions/session";
import { parseIntelUrl } from "@/lib/intelligence/client";
import { daypartFor, lagosHour } from "@/lib/app/home-queries";
import { getShellIdentity } from "@/lib/app/shell-queries";
import { IntelligenceScreen } from "@/components/app/intelligence/IntelligenceScreen";

const words = getDictionary("en").intelligence;

export const metadata: Metadata = {
  title: words.name,
  description: words.description,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * VALLO INTELLIGENCE (16 November 2026): one search across everything Vallo
 * holds, and the discovery page around it.
 *
 * A thin server shell. It reads who is asking (a signed-out visitor sees the
 * public kinds; a member also gets their own recent searches and results,
 * read by the engine through their own session) and the search in the
 * address, and hands both to the screen, which asks the engine's routes
 * (`/api/intelligence/*`) for everything else. The address IS the search
 * (`lib/intelligence/client.ts`), so a search is a link and a reload lands
 * on the same results.
 *
 * `focus=1` is set by the launchers (Home, Cmd/Ctrl+K): only then does the
 * caret go straight into the field.
 *
 * A member with a first name is greeted by it over the title, by the Lagos
 * daypart (the same cut as Home's greeting). The name is the shell's own
 * (`getShellIdentity`, one read per request, shared with the layout); a
 * member with no name on record, and a visitor, see the plain title.
 */
export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale, session] = await Promise.all([searchParams, getLocale(), resolveSessionClaims().catch(() => null)]);
  const copy = getDictionary(locale).intelligence;
  const focus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const signedIn = session?.state === "signed-in";
  const greeting = signedIn ? await greetingFor(copy) : null;
  return (
    <IntelligenceScreen
      copy={copy}
      locale={locale}
      signedIn={signedIn}
      greeting={greeting}
      initial={parseIntelUrl(params)}
      focusOnOpen={focus === "1"}
    />
  );
}

/** "Good morning, Ada." for a member with a first name on record; null otherwise. */
async function greetingFor(copy: ReturnType<typeof getDictionary>["intelligence"]): Promise<string | null> {
  const identity = await getShellIdentity().catch(() => null);
  /* The shell says "Guest" when it has no name worth greeting: no greeting then. */
  const name = identity?.signedIn && identity.userName && identity.userName !== "Guest" ? identity.userName : null;
  if (!name) return null;
  return copy.greeting[daypartFor(lagosHour())].replace("{name}", name);
}
