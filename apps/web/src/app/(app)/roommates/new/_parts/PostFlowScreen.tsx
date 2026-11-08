import { PageFrame } from "@/components/app/PageFrame";
import { RoommatesEmpty, type RoommatesCopy } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { ROOMMATES_ROUTES, type InstitutionRef, type ListingDraft, type ListingStatus } from "@/lib/features/roommates/model";

import { PostFlow } from "./PostFlow";

export type PostFlowState =
  | { state: "not-open" }
  | { state: "signed-out"; next: string }
  | { state: "ok"; initial: ListingDraft; status: ListingStatus | null; me: { userId: string; name: string; avatarUrl: string | null } };

/** THE POST FLOW'S DOOR (server safe): not open, signed out, or the flow (new or editing). */
export function PostFlowScreen({ read, schools, copy }: { read: PostFlowState; schools: InstitutionRef[]; t: RoommatesCopy }) {
  if (read.state !== "ok") {
    return (
      <PageFrame title={copy.create.title} fallback={ROOMMATES_ROUTES.home} width="narrow">
        {read.state === "not-open" ? (
          <RoommatesEmpty icon="info">{copy.notOpen}</RoommatesEmpty>
        ) : (
          <RoommatesEmpty icon="lock" action={<ButtonLink href={`/sign-in?next=${encodeURIComponent(read.next)}`} variant="primary" size="md">{copy.ui.signInCta}</ButtonLink>}>
            {copy.ui.create.signedOut}
          </RoommatesEmpty>
        )}
      </PageFrame>
    );
  }
  return <PostFlow initial={read.initial} status={read.status} schools={schools} me={read.me} />;
}
