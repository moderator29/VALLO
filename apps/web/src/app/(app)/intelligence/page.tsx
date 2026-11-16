import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSessionClaims } from "@/lib/actions/session";
import { parseIntelUrl } from "@/lib/intelligence/client";
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
 */
export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, locale, session] = await Promise.all([searchParams, getLocale(), resolveSessionClaims().catch(() => null)]);
  const copy = getDictionary(locale).intelligence;
  const focus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  return (
    <IntelligenceScreen
      copy={copy}
      locale={locale}
      signedIn={session?.state === "signed-in"}
      initial={parseIntelUrl(params)}
      focusOnOpen={focus === "1"}
    />
  );
}
