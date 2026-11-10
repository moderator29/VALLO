import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { withNext } from "@/lib/auth/next-link";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";
import { listInstitutions, readMyRoommateProfile } from "@/lib/features/roommates/queries";

import { NewGroupFlow } from "../_parts/NewGroupFlow";
import "../_parts/fe-b.css";

export const metadata: Metadata = { title: "Start a group" };
export const dynamic = "force-dynamic";

/**
 * START A GROUP (FE-B) on StepFrame. The flow starts from what the member's
 * roommate profile already says (state, city, areas, school, budget, move-in),
 * so nothing is typed twice, and every field can be changed.
 */
export default async function NewRoommateGroupPage() {
  const [mine, schools] = await Promise.all([readMyRoommateProfile(), listInstitutions({ limit: 1500 })]);
  if (mine.state === "signed-out") redirect(withNext("/sign-in", ROOMMATES_ROUTES.newGroup));
  const p = mine.state === "ok" ? mine.profile : null;
  return (
    <NewGroupFlow
      live={mine.state === "ok"}
      schools={schools.items.map((s) => ({ id: s.id, name: s.shortName ? `${s.name} (${s.shortName})` : s.name }))}
      prefill={
        p
          ? {
              stateCode: p.stateCode,
              city: p.city,
              areas: p.areas,
              institutionId: p.institutionId,
              budgetMinMinor: p.budgetMinMinor,
              budgetMaxMinor: p.budgetMaxMinor,
              budgetPeriod: p.budgetPeriod,
              moveInOn: p.moveInOn,
              sizeTarget: p.householdSize,
            }
          : null
      }
    />
  );
}
