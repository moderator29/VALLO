import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forFinishSetupForm } from "@/lib/i18n/slice";
import { finishSocialSetup } from "@/lib/auth/actions";
import { finishSetupView } from "@/lib/auth/finish-setup-server";
import { FINISH_SETUP_PATH, finishSetupHref } from "@/lib/auth/finish-setup";
import { safeReturnPath } from "@/lib/security/return-path";
import { withNext } from "@/lib/auth/next-link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { FinishSetupForm } from "@/components/auth/FinishSetupForm";

export const metadata: Metadata = {
  title: "Finish setting up",
  robots: { index: false, follow: false },
};

/**
 * B-2: "Finish setting up", the terms and 18+ step for a new Google or Apple
 * account (`lib/auth/finish-setup.ts` has the whole rule).
 *
 * Reached from the auth callback, and from `proxy.ts`, which sends every app
 * route here until the step is done. Never loops: signed out goes to sign in
 * with this screen as `next`; already done goes straight on to `next`.
 */
export const dynamic = "force-dynamic";

export default async function FinishSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: raw } = await searchParams;
  /* A query parameter is an input: only a same-site path, and never this
     screen itself, may be where the step goes afterwards. */
  const candidate = typeof raw === "string" ? safeReturnPath(raw, "") : null;
  const next =
    candidate && candidate !== FINISH_SETUP_PATH && !candidate.startsWith(`${FINISH_SETUP_PATH}?`)
      ? candidate
      : undefined;

  if (!isSupabaseConfigured()) redirect("/sign-in?notice=unconfigured");
  const view = await finishSetupView(await createClient());
  if (view.state === "signed-out") redirect(withNext("/sign-in", finishSetupHref(next)));
  if (view.state === "done") redirect(next ?? "/home");

  const t = getDictionary(await getLocale());
  return (
    <FinishSetupForm
      t={forFinishSetupForm(t)}
      action={finishSocialSetup}
      next={next}
      initialFirstName={view.firstName}
      initialSurname={view.surname}
    />
  );
}
