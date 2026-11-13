import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { photoStepHref, photoStepOnward } from "@/lib/auth/photo-step";
import { SignUpPhotoStep } from "@/components/app/first-run/SignUpPhotoStep";

export const metadata: Metadata = {
  title: "Add a profile photo",
  robots: { index: false, follow: false },
};

/* Read fresh: whether this account already has a photo is the member's own. */
export const dynamic = "force-dynamic";

/**
 * THE LAST STEP OF SIGN-UP: THE PROFILE PHOTO (13 November 2026; the rule is in
 * `lib/auth/photo-step.ts`). Every path that makes an account sends it here,
 * carrying `next`. Never a loop and never a wall: signed out goes to sign in
 * with this step as `next`; an account that already has a photo (a provider
 * gave one) goes straight on; anything this page cannot read goes straight on.
 */
export default async function SignUpPhotoPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = photoStepOnward((await searchParams).next);
  const session = await resolveSession();
  if (session.state === "unconfigured") redirect(next);
  if (session.state !== "signed-in") redirect(withNext("/sign-in", photoStepHref(next)));

  let hasPhoto = false;
  try {
    const { data } = await session.supabase.from("profiles").select("avatar_url").eq("id", session.user.id).maybeSingle();
    hasPhoto = Boolean((data as { avatar_url?: string | null } | null)?.avatar_url);
  } catch {
    redirect(next);
  }
  if (hasPhoto) redirect(next);

  const copy = getDictionary(await getLocale()).profileSetup.step;
  return <SignUpPhotoStep copy={copy} userId={session.user.id} next={next} />;
}
