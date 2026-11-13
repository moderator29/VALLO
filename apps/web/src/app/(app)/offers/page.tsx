import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageFrame } from "@/components/app/PageFrame";
import { Unreachable } from "@/components/app/Unreachable";
import { OffersWorkspace } from "@/components/app/offers/OffersWorkspace";
import { resolveSession } from "@/lib/actions/session";
import { requestNow } from "@/lib/format/when";
import { listMyOffers, listOffersReceived } from "@/lib/offers/queries";

export const metadata: Metadata = { title: "Offers", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * MY OFFERS. Two tabs, Made and Received, each with its true count. Every
 * count comes from the reads, never from the length of what is on screen.
 * Nothing here charges anything, and an agreed offer is terms agreed, not a sale.
 */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect("/sign-in?next=%2Foffers");
  const query = await searchParams;
  const initialTab = query.tab === "received" ? "received" : "made";
  let made;
  let received;
  try {
    [made, received] = await Promise.all([listMyOffers(), listOffersReceived()]);
  } catch {
    made = null;
    received = null;
  }
  return (
    <div className="nf-page grid grid-cols-1 gap-md">
      <PageFrame title="Offers" subtitle="Offers you made and offers you received" fallback="/home" width="wide">
        {made && received ? (
          <OffersWorkspace made={made} received={received} initialTab={initialTab} nowMs={requestNow()} />
        ) : (
          <Unreachable noun="offers" icon="contract-sign" />
        )}
      </PageFrame>
    </div>
  );
}
