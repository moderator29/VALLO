import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/actions/session";
import { readAssistantState, readAuditRows, readLearnedPreferences } from "@/lib/assistant/access";
import { AssistantSettingsBody } from "./AssistantSettingsBody";
import "@/app/css/home.css";

export const metadata: Metadata = {
  title: "VALLO AI Assistant",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Settings, VALLO AI Assistant. Off for everybody until they turn it on
 * themselves through the agreement screen. Once on: what it may do (one switch
 * per permission, read and act kept apart), what it learned about you, and what
 * it did.
 */
export default async function AiAssistantSettingsPage() {
  const session = await resolveSession();
  if (session.state !== "signed-in") redirect("/sign-in?next=/settings/ai-assistant");

  const state = await readAssistantState(session.supabase);
  const [audit, learned] = state.enabled
    ? await Promise.all([readAuditRows(session.supabase, 30), readLearnedPreferences(session.supabase)])
    : [[], []];

  return <AssistantSettingsBody state={state} audit={audit} learned={learned} />;
}
