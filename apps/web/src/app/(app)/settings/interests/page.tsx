import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { forInterestChoices } from "@/lib/i18n/slice";
import { getLocale } from "@/lib/locale";
import { withNext } from "@/lib/auth/next-link";
import { PageFrame } from "@/components/app/PageFrame";
import { loadInterestsState } from "@/lib/interests/queries";
import { InterestChoices } from "@/components/app/welcome/InterestChoices";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";

export const metadata: Metadata = {
  title: "What you are here for",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Changing your mind about what you came here for.
 *
 * `/welcome` asks the question once at the door. This is the backstop, and it
 * is the same nine cards from the same component rather than a second copy:
 * the enum can grow, and a person who edits their answer later must be offered
 * every option somebody arriving today is offered.
 *
 * Signed out, this explains what the screen is for and offers the way in,
 * rather than showing cards that cannot be saved. Same shape as
 * `/settings/place`, because it is the same situation.
 */
export default async function InterestsSettingsPage() {
  const t = getDictionary(await getLocale());
  const state = await loadInterestsState();

  if (state.state !== "signed-in") {
    return (
      <PageFrame title={t.interests.screenTitle} fallback="/settings" width="narrow">
        <EmptyState
          icon="user-verified"
          title={t.interests.accountTitle}
          body={state.state === "unconfigured" ? t.interests.accountBodyUnconfigured : t.interests.accountBodySignedOut}
          {...(state.state === "signed-out"
            ? { action: <EmptyActions primary={{ label: t.common.signIn, href: withNext("/sign-in", "/settings/interests") }} /> }
            : {})}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      title={t.interests.screenTitle}
      subtitle={t.interests.screenSubtitle}
      fallback="/settings"
      width="narrow"
      testId="interests-settings"
    >
      <div className="nf-panel nf-panel--card block p-lg sm:p-lg">
        <InterestChoices initial={state.interests} mode="settings" t={forInterestChoices(t)} />
      </div>
    </PageFrame>
  );
}
