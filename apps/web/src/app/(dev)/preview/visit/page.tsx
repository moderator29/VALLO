import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getShellIdentity } from "@/lib/app/shell-queries";
import { getSide } from "@/lib/side";
import { resolveWorkspaces } from "@/lib/supply/workspaces-queries";
import { AppShell } from "@/components/app/AppShell";
import { VisitHeader } from "@/components/app/inspections/visit/VisitHeader";
import { VisitPropertyCard, type VisitProperty } from "@/components/app/inspections/visit/VisitPropertyCard";
import { VisitListerCard } from "@/components/app/inspections/visit/VisitListerCard";
import { VisitPlanner } from "@/components/app/inspections/visit/VisitPlanner";
import { VisitStatus } from "@/components/app/inspections/visit/VisitStatus";
import { roleWordsOf } from "@/components/app/inspections/visit/property";
import { addDays, lagosDayOf, lagosInstant, visitModeOf, type OpenSlot, type VisitLister, type VisitRow } from "@/lib/inspections/visit";
import type { InspectionState } from "@/lib/inspections/types";
import "@/app/css/visit.css";
import { requestNow } from "@/lib/format/when";

export const dynamic = "force-dynamic";

/**
 * THE PROOF HARNESS FOR SCHEDULE A VISIT, inside the real app shell, with
 * fixture props (no session, no database). Screenshots of it are in
 * docs/screens/visit-flow/. Every name and figure here is a fixture.
 *
 *   ?step=1              the planner: &slots=open|none|failed, &video=0
 *   ?step=2&state=...    the status screen for any inspection state,
 *                        &mode=video, &now=join (inside the call window)
 */
const PROPERTY: VisitProperty = {
  title: "Three-bedroom terrace with a garden",
  area: "Yaba",
  city: "Lagos",
  photo: "/brand/photos/villa-exterior-gate.jpg",
  priceMinor: 450_000_000,
  currency: "NGN",
  period: "/year",
  spokenPeriod: "year",
  bedrooms: 3,
  bathrooms: 3,
  sizeSqm: 140,
};

const LISTER: VisitLister = {
  name: "Kemi Adebayo",
  photoUrl: null,
  role: "landlord",
  tier: "gold",
  handle: "kemi.adebayo",
  phone: null,
};

function openSlots(now: number): OpenSlot[] {
  const today = lagosDayOf(now);
  const out: OpenSlot[] = [];
  for (let i = 1; i < 14; i++) {
    if (i % 3 === 0) continue;
    const day = addDays(today, i);
    for (const [h, m] of [
      [9, 0],
      [10, 0],
      [11, 30],
      [13, 0],
      [15, 30],
      [17, 0],
    ] as const) {
      if ((i + h) % 4 === 0) continue;
      out.push({ slotAt: lagosInstant(day, h, m), minutes: 30, windowId: "w-fixture" });
    }
  }
  return out;
}

export default async function VisitPreview({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; state?: string; mode?: string; slots?: string; video?: string; now?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.visit;
  const [side, identity, { workspaces, current }] = await Promise.all([getSide(), getShellIdentity(), resolveWorkspaces()]);
  const now = requestNow();
  const roles = roleWordsOf(LISTER.role, t.socialProfile.roleLine, copy.roleNoun);
  const step = params.step === "2" ? 2 : 1;

  const card = (
    <aside className="nf-visit__aside">
      <VisitPropertyCard property={PROPERTY} locale={locale} label={copy.property.label} sizeWord={copy.property.size} />
    </aside>
  );

  let body: React.ReactNode;
  if (step === 1) {
    const slots = params.slots === "none" ? [] : params.slots === "failed" ? null : openSlots(now);
    body = (
      <VisitPlanner
        listingId="00000000-0000-4000-8000-000000000001"
        locale={locale}
        now={now}
        copy={copy}
        slots={slots}
        videoOn={params.video !== "0"}
        initialSlot={null}
        roleNoun={roles.noun}
        lister={
          <VisitListerCard
            lister={LISTER}
            roleLabel={roles.label}
            messageHref="/messages"
            call={{ kind: "app", conversationId: "00000000-0000-4000-8000-000000000002" }}
            copy={copy.lister}
          />
        }
      />
    );
  } else {
    const state = (params.state ?? "REQUESTED").toUpperCase() as InspectionState;
    const slot = lagosInstant(addDays(lagosDayOf(now), 2), 10);
    const joinSlot = new Date(now + 5 * 60_000).toISOString();
    const confirmedLike = state === "CONFIRMED" || state === "COMPLETED" || state === "NO_SHOW" || state === "WITHDRAWN";
    const row: VisitRow = {
      id: "00000000-0000-4000-8000-0000000000aa",
      listingId: "00000000-0000-4000-8000-000000000001",
      state,
      requestedAt: slot,
      slotAt:
        params.now === "join"
          ? joinSlot
          : state === "PROPOSED"
            ? lagosInstant(addDays(lagosDayOf(now), 3), 15, 30)
            : state === "COMPLETED" || state === "NO_SHOW"
              ? new Date(now - 2 * 86_400_000).toISOString()
              : confirmedLike
                ? slot
                : null,
      note: "Hello, I would like to see the property and ask about the water supply. Thank you.",
      listerNote: state === "DECLINED" ? "I am travelling that week. Please ask for the week after." : null,
      createdAt: new Date(now - 3 * 3_600_000).toISOString(),
      respondedAt: state === "REQUESTED" ? null : new Date(now - 2 * 3_600_000).toISOString(),
      confirmedAt: confirmedLike ? new Date(now - 2 * 3_600_000).toISOString() : null,
      completedAt: state === "COMPLETED" ? new Date(now - 86_400_000).toISOString() : null,
      outcome: state === "COMPLETED" ? "no_deal" : null,
      visitMode: visitModeOf(params.mode),
      conversationId: "00000000-0000-4000-8000-000000000002",
      slotMinutes: 30,
    };
    body = (
      <VisitStatus
        row={row}
        listingId={row.listingId}
        locale={locale}
        now={now}
        copy={copy}
        reminders={{ eve: null, day: null }}
        roleNoun={roles.noun}
        area={PROPERTY.area}
        place="Yaba, Lagos"
        calendarWords={t.memberKit.dayKit}
        lister={
          <VisitListerCard
            lister={{ ...LISTER, phone: "+2348030000000" }}
            roleLabel={roles.label}
            messageHref="/messages"
            call={{ kind: "tel", number: "+2348030000000" }}
            copy={copy.lister}
          />
        }
      />
    );
  }

  return (
    <AppShell
      t={t}
      side={side}
      userName={identity.userName}
      userHandle={identity.userHandle}
      unreadNotifications={identity.unreadNotifications}
      avatarUrl={identity.avatarUrl}
      signedIn={identity.signedIn}
      isAgent={identity.isAgent}
      isAdmin={identity.isAdmin}
      workspaces={workspaces}
      currentProfile={current}
    >
      <div className="nf-visit">
        <VisitHeader
          title={step === 1 ? copy.title : copy.statusTitle}
          step={step}
          progressLabel={copy.progress.replace("{step}", String(step)).replace("{total}", "2")}
          fallback="/search"
        />
        {card}
        {body}
      </div>
    </AppShell>
  );
}
