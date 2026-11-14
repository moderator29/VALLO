import "@/app/css/admin.css";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { ConsoleStepUp } from "@/app/admin/_components/ConsoleStepUp";
import { DesktopNote } from "@/app/admin/_components/DesktopNote";
import { StaffFrame, StaffHome } from "@/app/admin/_components/StaffFrame";
import type { StaffAccess } from "@/lib/admin/guard";
import { PageHead, Panel } from "@/app/admin/_components/panels";
import { YourDesks } from "@/app/admin/_components/YourDesks";
import { ProspectBoard } from "@/app/admin/business-development/ProspectBoard";
import type { BdActivity, BdProspect } from "@/lib/admin/business-development/types";
import { ConsoleFrame } from "../ConsoleFrame";

/**
 * The Business development pipeline table on the console frame, from fixture
 * rows: overdue, due today, due this week, undated, onboarded and rejected
 * prospects, with a history under some of them. The table is the desk's own
 * component, so what is screenshotted is what the desk draws. No write goes
 * anywhere: the real desk gates every action on `requireAdmin`.
 *
 *   /preview/bd/pipeline            the table with rows
 *   /preview/bd/pipeline?empty=1    the empty pipeline
 *   /preview/bd/pipeline?view=door  the console's password door
 *   /preview/bd/pipeline?view=staff the short console a staff member sees
 */
export const dynamic = "force-dynamic";

const TODAY = "2026-11-14";

function prospect(id: string, over: Partial<BdProspect>): BdProspect {
  return {
    id,
    contactName: "Ada Obi",
    businessName: "Ada Lets",
    category: "landlord",
    email: null,
    phone: null,
    location: null,
    stage: "new",
    notes: null,
    assignedTo: null,
    createdBy: null,
    listingId: null,
    onboardedAt: null,
    nextFollowUpAt: null,
    createdAt: "2026-11-01T09:00:00Z",
    updatedAt: "2026-11-01T09:00:00Z",
    ...over,
  };
}

const PROSPECTS: BdProspect[] = [
  prospect("p1", { businessName: "Harbour Point Residences", contactName: "Tunde Bakare", category: "landlord", phone: "0803 123 4567", email: "tunde@harbourpoint.example", location: "Victoria Island, Lagos", stage: "negotiation", nextFollowUpAt: "2026-11-11", notes: "Owns two blocks. Wants to start with the three-bedroom units." }),
  prospect("p2", { businessName: "Ikoyi Crest Hotel and Suites", contactName: "Ngozi Eze", category: "hotel", email: "reservations@ikoyicrest.example", location: "Ikoyi, Lagos", stage: "meeting_scheduled", nextFollowUpAt: "2026-11-14" }),
  prospect("p3", { businessName: "Bukka Republic", contactName: "Femi Ade", category: "restaurant", phone: "0812 555 0199", location: "Yaba, Lagos", stage: "interested", nextFollowUpAt: "2026-11-18" }),
  prospect("p4", { businessName: "Prime Keys Realty Limited", contactName: "Chiamaka Okonkwo-Adeyemi", category: "agent", phone: "0701 000 2233", email: "chiamaka.okonkwo-adeyemi@primekeysrealty.example", location: "Lekki Phase 1, Lagos", stage: "contacted" }),
  prospect("p5", { businessName: "Sunrise Shortlets", contactName: "Bola Musa", category: "shortlet_host", phone: "0905 444 1212", location: "Wuse 2, Abuja", stage: "new", createdAt: "2026-11-13T12:00:00Z" }),
  prospect("p6", { businessName: "Palm Court Apartments", contactName: "Kemi Lawal", category: "landlord", email: "kemi@palmcourt.example", location: "Ikeja GRA, Lagos", stage: "onboarded", onboardedAt: "2026-11-09T10:00:00Z" }),
  prospect("p7", { businessName: "Garden City Lodge", contactName: "Ibrahim Sule", category: "hotel", phone: "0809 777 3434", location: "Port Harcourt", stage: "rejected" }),
];

const ACTIVITY: BdActivity[] = [
  { id: "a1", prospectId: "p1", kind: "contact", body: "Called Tunde about the fee and the review steps.", outcome: "Wants the terms in writing before Friday", actorId: null, createdAt: "2026-11-08T10:30:00Z" },
  { id: "a2", prospectId: "p1", kind: "stage_change", body: "Moved to negotiation.", outcome: null, actorId: null, createdAt: "2026-11-08T10:35:00Z" },
  { id: "a3", prospectId: "p1", kind: "note", body: "Met at the property. Photographs are ready.", outcome: null, actorId: null, createdAt: "2026-11-05T15:00:00Z" },
  { id: "a4", prospectId: "p2", kind: "contact", body: "Emailed the reservations desk.", outcome: "Meeting set for Saturday", actorId: null, createdAt: "2026-11-12T09:00:00Z" },
  { id: "a5", prospectId: "p3", kind: "follow_up", body: "Sent the restaurant guide.", outcome: null, actorId: null, createdAt: "2026-11-10T14:00:00Z" },
];

const STAFF: StaffAccess = {
  isAdmin: false,
  isSuperAdmin: false,
  scopes: ["business_development", "listing_approval", "kyc_review"],
  position: "business_development_executive",
  handbookVersion: "preview",
  handbookAcknowledged: true,
  consoleVerified: true,
};

export default async function PreviewPipeline({ searchParams }: { searchParams: Promise<{ empty?: string; view?: string }> }) {
  const { empty, view } = await searchParams;
  if (view === "door") return <ConsoleStepUp name="Sophia" door="password" />;
  if (view === "staff") {
    return (
      <StaffFrame staff={STAFF} name="Sophia Duru">
        <DesktopNote />
        <StaffHome staff={STAFF} />
      </StaffFrame>
    );
  }
  const t = getDictionary(await getLocale());
  return (
    <ConsoleFrame t={t}>
      <DesktopNote />
      <div className="nf-console nf-admin-stack">
        <YourDesks staff={{ position: "business_development_executive", scopes: ["business_development", "listing_approval"] }} />
        <PageHead
          title="Business development"
          lede="Your pipeline of landlords, agents, hotels, shortlet hosts and restaurants, and the listings waiting for your review."
        />
        <Panel title="Pipeline">
          <ProspectBoard prospects={empty === "1" ? [] : PROSPECTS} activity={empty === "1" ? [] : ACTIVITY} today={TODAY} />
        </Panel>
      </div>
    </ConsoleFrame>
  );
}
