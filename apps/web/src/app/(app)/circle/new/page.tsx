import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { resolveSessionClaims } from "@/lib/actions/session";
import { CIRCLE_COPY } from "@/lib/features/circle/copy";

import { CreateCommunityFlow } from "../_parts/CreateCommunityFlow";

export const metadata: Metadata = { title: CIRCLE_COPY.start };
export const dynamic = "force-dynamic";

export default async function NewCommunityPage() {
  const session = await resolveSessionClaims();
  if (session.state !== "signed-in") redirect("/sign-in?next=/circle/new");
  return <CreateCommunityFlow />;
}
