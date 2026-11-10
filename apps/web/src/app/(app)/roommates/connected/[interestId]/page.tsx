import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { PageFrame } from "@/components/app/PageFrame";
import { ConnectedScreen } from "@/components/roommates/ConnectedScreen";
import { RoommatesEmpty } from "@/components/roommates";
import { ButtonLink } from "@/components/ui/Button";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { readMyConnections } from "@/lib/features/roommates/queries";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.connectedScreen.title} ${copy.title}`, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The "You're connected" screen for one accepted connection of the signed-in member. Anything else: a plain not-found with the way on. */
export default async function ConnectedPage({ params }: { params: Promise<{ interestId: string }> }) {
  const { interestId } = await params;
  const mine = await readMyConnections();
  const c = mine.find((p) => p.interestId === interestId);
  if (!c) {
    return (
      <PageFrame title={copy.title} fallback={ROOMMATES_ROUTES.hub} width="narrow">
        <RoommatesEmpty icon="info" action={<ButtonLink href={ROOMMATES_ROUTES.hub} variant="primary" size="md">{copy.connectedScreen.hub}</ButtonLink>}>
          {copy.connectedScreen.notFound}
        </RoommatesEmpty>
      </PageFrame>
    );
  }
  return <ConnectedScreen interestId={interestId} userId={c.userId} name={c.name} />;
}
