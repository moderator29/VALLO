import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";

import { resolveSessionClaims } from "@/lib/actions/session";
import { EMPTY_LISTING, LISTING_KINDS, ROOMMATES_ROUTES, type ListingKind } from "@/lib/features/roommates/model";
import { listInstitutions, readMyIdentityState, readMyRoommateProfile } from "@/lib/features/roommates/queries";

import { PostFlowScreen, type PostFlowState } from "./_parts/PostFlowScreen";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.create.title}, ${copy.title}` };
export const dynamic = "force-dynamic";

/** Post on Roommates: `?kind=` chooses the first answer (room_offer, roommate_wanted, together). */
export default async function NewRoommatePostPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const kind = (LISTING_KINDS as readonly string[]).includes(String(q.kind)) ? (q.kind as ListingKind) : EMPTY_LISTING.kind;
  const next = `${ROOMMATES_ROUTES.create}${q.kind ? `?kind=${kind}` : ""}`;
  const [session, mine, schools, identity] = await Promise.all([resolveSessionClaims(), readMyRoommateProfile(), listInstitutions({ limit: 1500 }), readMyIdentityState()]);
  let read: PostFlowState;
  if (mine.state === "not-open") read = { state: "not-open" };
  else if (session.state !== "signed-in" || mine.state !== "ok") read = { state: "signed-out", next };
  else read = { state: "ok", initial: { ...EMPTY_LISTING, kind }, status: null, me: { userId: session.userId, name: mine.name ?? copy.title, avatarUrl: null }, identity };
  return <PostFlowScreen read={read} schools={schools.items} t={copy} />;
}
