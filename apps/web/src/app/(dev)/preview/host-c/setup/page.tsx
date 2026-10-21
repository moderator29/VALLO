import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { HostShell } from "@/components/host/HostShell";
import { HostWizard } from "@/components/host/HostWizard";
import { stepsFor, type HostDraft, type HostStepId } from "@/lib/host/onboarding";
import { PERSON } from "../../_fixtures/people";
import { hotelDraft, restaurantDraft, shortletDraft } from "../../imgc/fixtures";

/**
 * THE HOST SET-UP FLOW FOR EACH OF THE THREE, ON THE REAL WIZARD.
 *
 * `?type=hotel|shortlet|restaurant&step=<step id>` opens `HostWizard` on that
 * step over a fixture draft, through `initialStep`, the way the S9 harness
 * does for a hotel alone. `&sent=1` draws the application as a reviewer sent
 * it back, with their note. With no type or step it lists every step of all
 * three. Fixture-backed: the proof of the look and of what each step asks
 * for, never of the wiring. Nothing here writes until a control is pressed.
 */
export const dynamic = "force-dynamic";

const PHOTOS = [
  { id: "f1", url: "/brand/photos/bedroom-01.jpg" },
  { id: "f2", url: "/brand/photos/living-room-day.jpg" },
];

/* The four presets of `20261013062641_four_preset_cancellation_policies.sql`,
   with their tiers, as the wizard reads them once that has run. */
const POLICIES = [
  { id: "ef100000-0000-4000-8000-000000000001", name: "Flexible", preset: "flexible", isFreeUntilHours: 24,
    summary: "Full refund if you cancel at least 24 hours before check-in. No refund after that.",
    rules: [{ hours_before: 24, refund_bps: 10000 }, { hours_before: 0, refund_bps: 0 }] },
  { id: "ef100000-0000-4000-8000-000000000002", name: "Moderate", preset: "moderate", isFreeUntilHours: 120,
    summary: "Full refund if you cancel at least 5 days before check-in. Half back after that.",
    rules: [{ hours_before: 120, refund_bps: 10000 }, { hours_before: 0, refund_bps: 5000 }] },
  { id: "ef100000-0000-4000-8000-000000000003", name: "Firm", preset: "firm", isFreeUntilHours: 720,
    summary: "Full refund at least 30 days before check-in, half back at least 7 days before, no refund after that.",
    rules: [{ hours_before: 720, refund_bps: 10000 }, { hours_before: 168, refund_bps: 5000 }, { hours_before: 0, refund_bps: 0 }] },
  { id: "ef100000-0000-4000-8000-000000000004", name: "Strict", preset: "strict", isFreeUntilHours: null,
    summary: "Half back if you cancel at least 7 days before check-in. No refund after that.",
    rules: [{ hours_before: 168, refund_bps: 5000 }, { hours_before: 0, refund_bps: 0 }] },
];

type HostKind = "hotel" | "shortlet" | "restaurant";

const DRAFTS: Record<HostKind, () => HostDraft> = {
  hotel: () =>
    hotelDraft({
      documents: { identity: true, registration: true },
      accommodation: { ...hotelDraft().accommodation!, photos: PHOTOS, cancellationPolicyId: "ef100000-0000-4000-8000-000000000003" },
    }),
  shortlet: () =>
    shortletDraft({
      documents: { identity: true },
      accommodation: { ...shortletDraft().accommodation!, photos: PHOTOS, cancellationPolicyId: "ef100000-0000-4000-8000-000000000002" },
    }),
  restaurant: () =>
    restaurantDraft({
      documents: { identity: true },
      businessPhotos: [{ id: "v1", url: "/brand/photos/living-room-dusk.jpg" }],
      businessPhotoCount: 1,
    }),
};

const SENT_BACK_NOTE =
  "The ID you uploaded is cut off at the bottom. Please upload it again with all four corners showing.";

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | null {
  const one = Array.isArray(value) ? value[0] : value;
  return allowed.find((candidate) => candidate === one) ?? null;
}

export default async function PreviewHostSetup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const params = await searchParams;
  const type = pick(params.type, ["hotel", "shortlet", "restaurant"] as const);
  const base = type ? DRAFTS[type]() : null;
  const steps = base ? stepsFor(base.hostType, base.kind) : [];
  const step = pick(params.step, steps.map((s) => s.id) as HostStepId[]);

  if (!type || !base || !step) {
    return (
      <div className="mx-auto max-w-2xl p-gutter">
        <h1 className="nf-h2">Preview: host set-up</h1>
        {(Object.keys(DRAFTS) as HostKind[]).map((kind) => {
          const draft = DRAFTS[kind]();
          return (
            <section key={kind} className="mt-md">
              <h2 className="nf-h4">{kind}</h2>
              <ul className="mt-xs flex flex-col gap-2xs">
                {stepsFor(draft.hostType, draft.kind).map((s) => (
                  <li key={s.id}>
                    <Link className="nf-link" href={`/preview/host-c/setup?type=${kind}&step=${s.id}`}>
                      {s.id}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  const sentBack = params.sent === "1";
  const refused = params.refused === "1";
  const draft: HostDraft = sentBack
    ? { ...base, status: "MORE_INFO_REQUIRED", reviewNotes: SENT_BACK_NOTE }
    : refused
      ? { ...base, status: "REJECTED", reviewNotes: SENT_BACK_NOTE }
      : base;

  return (
    <HostShell logoLabel={t.a11y.logoHome}>
      <HostWizard
        key={`${type}-${step}-${sentBack ? "sent" : refused ? "refused" : "draft"}`}
        initial={draft}
        userId={PERSON.id}
        policies={POLICIES}
        locale={locale}
        initialStep={step}
        arrivalCopy={t.afterTheGate.arrival}
      />
    </HostShell>
  );
}
