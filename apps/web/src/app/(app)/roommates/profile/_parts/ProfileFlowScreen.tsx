import { PageFrame } from "@/components/app/PageFrame";
import { RoommatesEmpty, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { ROOMMATES_ROUTES, type InstitutionRef } from "@/lib/features/roommates/model";
import type { MyProfileRead } from "@/lib/features/roommates/queries";

import { ProfileFlow } from "./ProfileFlow";

/**
 * THE PROFILE FLOW'S DOOR (server safe): not open, signed out, or the flow
 * itself, which opens on the first question for a new profile and on the
 * review for one that exists.
 */
export function ProfileFlowScreen({ read, schools, t: copy }: { read: MyProfileRead; schools: InstitutionRef[]; t: RoommatesCopy }) {
  if (read.state !== "ok") {
    return (
      <PageFrame title={copy.profile.create} fallback={ROOMMATES_ROUTES.home} width="narrow">
        {read.state === "not-open" ? (
          <RoommatesEmpty icon="info">{copy.notOpen}</RoommatesEmpty>
        ) : (
          <RoommatesEmpty icon="lock" action={<ButtonLink href={`/sign-in?next=${encodeURIComponent(ROOMMATES_ROUTES.profile)}`} variant="primary" size="md">{copy.ui.signInCta}</ButtonLink>}>
            {copy.ui.onboarding.signedOut}
          </RoommatesEmpty>
        )}
      </PageFrame>
    );
  }
  const { status, ...initial } = read.profile;
  return <ProfileFlow initial={initial} status={status} exists={read.exists} hasPhoto={read.hasPhoto} schools={schools} />;
}
