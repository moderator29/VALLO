import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";

import { resolveSessionClaims } from "@/lib/actions/session";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { listInstitutions, readMyListingDraft, readMyRoommateProfile, readRoomListing } from "@/lib/features/roommates/queries";

import { PostFlowScreen } from "../../../new/_parts/PostFlowScreen";

const copy = getDictionary("en").roommates;

export const metadata: Metadata = { title: `${copy.ui.create.editEyebrow}, ${copy.title}` };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Edit a post: the same flow, prefilled, opening on the review. Not mine or not there: not found. */
export default async function EditRoommatePostPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSessionClaims();
  const schoolsRead = listInstitutions({ limit: 1500 });
  if (session.state !== "signed-in") {
    return <PostFlowScreen read={{ state: "signed-out", next: ROOMMATES_ROUTES.editListing(id) }} schools={(await schoolsRead).items} t={copy} />;
  }
  const [draft, view, mine, schools] = await Promise.all([readMyListingDraft(id), readRoomListing(id), readMyRoommateProfile(), schoolsRead]);
  if (!draft) notFound();
  const status = view.state === "ok" ? view.listing.status : "draft";
  const name = mine.state === "ok" && mine.name ? mine.name : copy.title;
  return <PostFlowScreen read={{ state: "ok", initial: draft, status, me: { userId: session.userId, name, avatarUrl: view.state === "ok" ? view.listing.owner.avatarUrl : null } }} schools={schools.items} t={copy} />;
}
