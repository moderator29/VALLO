import { Suspense, type ComponentType, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { AppShell } from "@/components/app/AppShell";
import SettingsLayout from "@/app/(app)/settings/layout";
import { ApplyWizard } from "@/components/agent/ApplyWizard";
import { AssistantSettingsBody } from "@/app/(app)/settings/ai-assistant/page";
import { forApply } from "@/components/agent/agent-copy";
import { ROLE_COPY } from "@/components/roles/roles";
import "@/app/css/home.css";

/**
 * `/preview/pages-frame?p=<route>`: Agent PAGES' round 3 proof deck. The REAL
 * page module for a route (its own reads, its own states) inside the real app
 * shell, so the one page frame (`PageFrame`) can be seen on every ordinary
 * page from a production server. This box has no session, so a page that
 * reads the member draws its signed-out or not-found state: that is the state
 * under proof here, the frame and its body, never the wiring. Behind the
 * preview gate in `../layout.tsx`. A page that redirects when signed out is
 * not listed.
 */

type Page = ComponentType<{
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;
type Entry = { load: () => Promise<{ default: unknown }>; params?: Record<string, string> };

const ID = "00000000-0000-0000-0000-000000000001";

const PAGES: Record<string, Entry> = {
  "/settings": { load: () => import("@/app/(app)/settings/page") },
  "/settings/accessibility": { load: () => import("@/app/(app)/settings/accessibility/page") },
  "/settings/account": { load: () => import("@/app/(app)/settings/account/page") },
  "/settings/appearance": { load: () => import("@/app/(app)/settings/appearance/page") },
  "/settings/devices": { load: () => import("@/app/(app)/settings/devices/page") },
  "/settings/devices/alert": { load: () => import("@/app/(app)/settings/devices/alert/page") },
  "/settings/help": { load: () => import("@/app/(app)/settings/help/page") },
  "/settings/interests": { load: () => import("@/app/(app)/settings/interests/page") },
  "/settings/invite": { load: () => import("@/app/(app)/settings/invite/page") },
  "/settings/invite/how-it-works": { load: () => import("@/app/(app)/settings/invite/how-it-works/page") },
  "/settings/notifications": { load: () => import("@/app/(app)/settings/notifications/page") },
  "/settings/passcode": { load: () => import("@/app/(app)/settings/passcode/page") },
  "/settings/passport": { load: () => import("@/app/(app)/settings/passport/page") },
  "/settings/payments": { load: () => import("@/app/(app)/settings/payments/page") },
  "/settings/phone": { load: () => import("@/app/(app)/settings/phone/page") },
  "/settings/place": { load: () => import("@/app/(app)/settings/place/page") },
  "/settings/privacy": { load: () => import("@/app/(app)/settings/privacy/page") },
  "/settings/privacy/ai": { load: () => import("@/app/(app)/settings/privacy/ai/page") },
  "/settings/privacy/blocked": { load: () => import("@/app/(app)/settings/privacy/blocked/page") },
  "/settings/privacy/data": { load: () => import("@/app/(app)/settings/privacy/data/page") },
  "/settings/privacy/money-lock": { load: () => import("@/app/(app)/settings/privacy/money-lock/page") },
  "/settings/region": { load: () => import("@/app/(app)/settings/region/page") },
  "/payments": { load: () => import("@/app/(app)/payments/page") },
  "/payouts": { load: () => import("@/app/(app)/payouts/page") },
  "/receipts": { load: () => import("@/app/(app)/receipts/page") },
  "/refunds": { load: () => import("@/app/(app)/refunds/page") },
  "/pay/crypto/[reference]": { load: () => import("@/app/(app)/pay/crypto/[reference]/page"), params: { reference: "VAL-SAMPLE" } },
  "/pay/deposit/[reservationId]": { load: () => import("@/app/(app)/pay/deposit/[reservationId]/page"), params: { reservationId: ID } },
  "/rent/pay/[inspectionId]": { load: () => import("@/app/(app)/rent/pay/[inspectionId]/page"), params: { inspectionId: ID } },
  "/rent/review/[paymentId]": { load: () => import("@/app/(app)/rent/review/[paymentId]/page"), params: { paymentId: ID } },
  "/rent/share/[id]": { load: () => import("@/app/(app)/rent/share/[id]/page"), params: { id: ID } },
  "/tenancy/[id]": { load: () => import("@/app/(app)/tenancy/[id]/page"), params: { id: ID } },
  "/tenancy/[id]/complaint": { load: () => import("@/app/(app)/tenancy/[id]/complaint/page"), params: { id: ID } },
  "/agreements": { load: () => import("@/app/(app)/agreements/page") },
  "/agreements/[id]": { load: () => import("@/app/(app)/agreements/[id]/page"), params: { id: ID } },
  "/bookings": { load: () => import("@/app/(app)/bookings/page") },
  "/bookings/[bookingId]": { load: () => import("@/app/(app)/bookings/[bookingId]/page"), params: { bookingId: ID } },
  "/bookings/[bookingId]/review": { load: () => import("@/app/(app)/bookings/[bookingId]/review/page"), params: { bookingId: ID } },
  "/inspections/gate/[id]": { load: () => import("@/app/(app)/inspections/gate/[id]/page"), params: { id: ID } },
  "/record/[code]": { load: () => import("@/app/(app)/record/[code]/page"), params: { code: "VAL-SAMPLE" } },
  "/passport/[who]": { load: () => import("@/app/(app)/passport/[who]/page"), params: { who: "sample" } },
  "/profile/application": { load: () => import("@/app/(app)/profile/application/page") },
  "/rewards": { load: () => import("@/app/(app)/rewards/page") },
  "/rewards/history": { load: () => import("@/app/(app)/rewards/history/page") },
  "/rewards/referrals": { load: () => import("@/app/(app)/rewards/referrals/page") },
  "/rewards/withdraw": { load: () => import("@/app/(app)/rewards/withdraw/page") },
  "/compare": { load: () => import("@/app/(app)/compare/page") },
  "/price": { load: () => import("@/app/(app)/price/page") },
  "/price/area/[id]": { load: () => import("@/app/(app)/price/area/[id]/page"), params: { id: ID } },
  "/support/new": { load: () => import("@/app/(app)/support/new/page") },
  "/legal/terms": { load: () => import("@/app/(app)/legal/terms/page") },
  "/legal/privacy": { load: () => import("@/app/(app)/legal/privacy/page") },
  "/legal/disclaimer": { load: () => import("@/app/(app)/legal/disclaimer/page") },
  "/wallet": { load: () => import("@/app/(app)/wallet/page") },
  "/support": { load: () => import("@/app/(app)/support/page") },
  "/leaderboard": { load: () => import("@/app/(app)/leaderboard/page") },
  "/directory": { load: () => import("@/app/(app)/directory/page") },
  "/profile/setup": { load: () => import("@/app/(app)/profile/setup/page") },
  "/profile/setup/owner": { load: () => import("@/app/(app)/profile/setup/owner/page") },
  "/profile/setup/agent": { load: () => import("@/app/(app)/profile/setup/agent/page") },
  "/profile/setup/[role]": { load: () => import("@/app/(app)/profile/setup/[role]/page"), params: { role: "professional" } },
  "/wallet/send": { load: () => import("@/app/(app)/wallet/send/page") },
  "/wallet/add": { load: () => import("@/app/(app)/wallet/add/page") },
  "/wallet/withdraw": { load: () => import("@/app/(app)/wallet/withdraw/page") },
  "/checkout/[bookingId]": { load: () => import("@/app/(app)/checkout/[bookingId]/page"), params: { bookingId: ID } },
  "/checkout": { load: () => import("@/app/(app)/checkout/page") },
  "/settings/ai-assistant": { load: () => import("@/app/(app)/settings/ai-assistant/page") },
  "/settings/ai-assistant/consent": { load: () => import("@/app/(app)/settings/ai-assistant/consent/page") },
  "/agreements/[id]/fund": { load: () => import("@/app/(app)/agreements/[id]/fund/page"), params: { id: ID } },
};

/* `&loading=1`: the route's own `loading.tsx` instead (SW12), so the wait can
   be seen in its shape beside the page it stands in for. */
const LOADING: Record<string, () => Promise<{ default: unknown }>> = {
  "/settings/ai-assistant": () => import("@/app/(app)/settings/ai-assistant/loading"),
  "/settings/ai-assistant/consent": () => import("@/app/(app)/settings/ai-assistant/consent/loading"),
  "/pay/deposit/[reservationId]": () => import("@/app/(app)/pay/deposit/[reservationId]/loading"),
  "/agreements/[id]/fund": () => import("@/app/(app)/agreements/[id]/fund/loading"),
  "/inspections/gate/[id]": () => import("@/app/(app)/inspections/gate/[id]/loading"),
  "/rewards": () => import("@/app/(app)/rewards/loading"),
  "/rewards/history": () => import("@/app/(app)/rewards/history/loading"),
  "/rewards/withdraw": () => import("@/app/(app)/rewards/withdraw/loading"),
  "/compare": () => import("@/app/(app)/compare/loading"),
  "/price": () => import("@/app/(app)/price/loading"),
  "/price/area/[id]": () => import("@/app/(app)/price/area/[id]/loading"),
  "/checkout": () => import("@/app/(app)/checkout/loading"),
  "/checkout/[bookingId]": () => import("@/app/(app)/checkout/[bookingId]/loading"),
  "/support/new": () => import("@/app/(app)/support/new/loading"),
  "/profile/setup": () => import("@/app/(app)/profile/setup/loading"),
  "/profile/setup/[role]": () => import("@/app/(app)/profile/setup/[role]/loading"),
  "/wallet/send": () => import("@/app/(app)/wallet/send/loading"),
  "/settings": () => import("@/app/(app)/settings/loading"),
  "/settings/notifications": () => import("@/app/(app)/settings/notifications/loading"),
  "/payments": () => import("@/app/(app)/payments/loading"),
  "/legal/terms": () => import("@/app/(app)/legal/terms/loading"),
};

export default async function PagesFramePreview({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; loading?: string }>;
}) {
  const { p = "/settings", loading } = await searchParams;
  /* The professional application with no session: the wizard itself, on its
     real copy, since the route asks for a sign-in first. */
  /* The assistant switched on, with sample rows (no real person's data). */
  if (p === "ai-assistant-on") {
    const now = "2026-11-06T10:30:00Z";
    return (
      <Suspense>
        <AppShell t={getDictionary("en")} userName="Seyi Omojuni" userHandle="seyifunmi" signedIn unreadNotifications={2} preview={{ route: "/settings/ai-assistant" }}>
          <SettingsLayout>
            <AssistantSettingsBody
              state={{ enabled: true, permissions: ["discovery", "saved_prefs", "bookings_viewings"], epoch: 1, signedIn: true, acceptedAt: now, termsVersion: "2026-11-01", privacyVersion: "2026-11-01", needsReaccept: false }}
              audit={[
                { id: 1, at: now, event: "tool_call", permission: "bookings_viewings", tool: "list_bookings", outcome: "ok" },
                { id: 2, at: "2026-11-05T18:02:00Z", event: "permission_granted", permission: "discovery", tool: null, outcome: "ok" },
              ]}
              learned={[
                { key: "area:lekki", value: true, source: "search", weight: 0.8, updated_at: now },
                { key: "bedrooms:2", value: 2, source: "search", weight: 0.6, updated_at: now },
              ]}
            />
          </SettingsLayout>
        </AppShell>
      </Suspense>
    );
  }
  if (p === "apply-wizard") {
    const t = getDictionary("en");
    return <ApplyWizard t={forApply(t)} role="professional" intro={ROLE_COPY.professional.setup.involves} closeHref="/profile/setup" />;
  }
  const entry = PAGES[p];
  const wait = loading === "1" ? LOADING[p] : undefined;
  if (!entry || (loading === "1" && !wait)) notFound();
  const Real = (await (wait ?? entry.load)()).default as Page;
  const route = p.replace(/\[[^\]]+\]/g, (m) => entry.params?.[m.slice(1, -1)] ?? "x");
  let body: ReactNode = <Real params={Promise.resolve(entry.params ?? {})} searchParams={Promise.resolve({})} />;
  if (p.startsWith("/settings")) body = <SettingsLayout>{body}</SettingsLayout>;
  return (
    <Suspense>
      <AppShell
        t={getDictionary("en")}
        userName="Seyi Omojuni"
        userHandle="seyifunmi"
        signedIn
        unreadNotifications={2}
        preview={{ route }}
      >
        {body}
      </AppShell>
    </Suspense>
  );
}
