import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/PageHeader";
import { resolveSession } from "@/lib/actions/session";
import { readAssistantState } from "@/lib/assistant/access";
import { ConsentForm } from "./ConsentForm";
import "@/app/css/home.css";

export const metadata: Metadata = {
  title: "Turn on VALLO AI Assistant",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The agreement screen: a page of its own, never a sheet, so it is read before it is ticked. */
export default async function AiAssistantConsentPage() {
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect("/sign-in?next=/settings/ai-assistant/consent");
  const state = await readAssistantState(session.supabase);
  if (state.enabled) redirect("/settings/ai-assistant");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Turn on VALLO AI Assistant" subtitle="Read, then decide" fallback="/settings/ai-assistant" />
      <ConsentForm />
    </div>
  );
}
