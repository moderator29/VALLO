import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { PageHead } from "../../_components/panels";
import { AdminDealView } from "../DealView";
import { readAdminDeal } from "../reads";

export const metadata: Metadata = { title: "Deal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * DEAL INSPECTION. Staff read the terms, every version, the activity and the
 * document states. They never see a buyer's identity data (only whether the
 * buyer is eligible) and never a document's contents or the private messages;
 * those are reached from the cases desk under the Trust and Safety rules, with
 * a written reason that is audited.
 */
export default async function AdminDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdmin("agreements");
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Deal" lede="Your account cannot open this desk." />
      </div>
    );
  }
  const deal = await readAdminDeal(access.supabase, id);
  if (!deal) notFound();
  return <AdminDealView deal={deal} />;
}
