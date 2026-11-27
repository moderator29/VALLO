import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";

import { previewHarnessIsOpen } from "@/lib/preview-harness";
import { IntelligenceScreen } from "@/components/app/intelligence/IntelligenceScreen";
import { EMPTY_STATE } from "@/lib/intelligence/client";

/**
 * /preview/features/intelligence: VALLO Intelligence's REAL screen, signed in
 * or out, with no session and no database.
 *
 * WHY IT EXISTS. `/intelligence` sends a signed-out visitor to the sign-in
 * door, so the only way to look at the screen was to hold an account on the
 * live project. That made every judgement about it, light mode especially,
 * a matter of description rather than of looking, which is how "too much ink
 * in light mode" went unnoticed until the founder saw it on his own phone.
 * Roommates has had this harness for a while; this is the same thing for the
 * other half of the pair.
 *
 * Dev only: `previewHarnessIsOpen` refuses on Vercel and in production.
 *
 *   ?signedIn=0   the visitor's screen, which is what a stranger meets
 *   ?q=<text>     opens with a query already in the field
 */
export const dynamic = "force-dynamic";

export default async function PreviewIntelligence({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!previewHarnessIsOpen(process.env)) notFound();
  const params = await searchParams;
  const dict = getDictionary("en");

  return (
    /* No CopyScope: the screen takes its copy as a prop, and "intelligence"
       is not one of the scoped keys. */
    <div data-testid="preview-intelligence">
        <IntelligenceScreen
          copy={dict.intelligence}
          locale="en"
          signedIn={params.signedIn !== "0"}
          greeting={params.signedIn === "0" ? null : "Good morning, Kemi."}
          initial={{ ...EMPTY_STATE, q: params.q ?? "" }}
      />
    </div>
  );
}
