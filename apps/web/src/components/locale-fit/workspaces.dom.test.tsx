/**
 * Locale fit, the workspaces (north star checklist point 22): the host's home,
 * the host's requests to decide, the host calendar's selected-nights sheet, the
 * agent dashboard, the agent's listings workspace and Listing Health, each in
 * Chromium at 390px in English, Hausa, Igbo and Yorùbá from the real
 * dictionaries, on the product's real compiled cascade. See `fit-cases.ts` for
 * the three things held.
 *
 * Data is the repository's own fixtures: the host preview's (`host-c/fixtures`),
 * the agent previews' (`f5/ops-fixtures`, the dashboard page's own numbers by
 * rendering that page), and `health-model` as the Listing Health test builds it.
 *
 * What is NOT here, and why: the host home draws only its honest empty state (a
 * host with nothing yet), because no fixture of a populated `HostToday` exists
 * and its figures would have to be written for the test.
 */
import { afterAll, beforeAll, describe, vi } from "vitest";
import { prerender } from "react-dom/static";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { FIT_LOCALES, appCss } from "@/lib/testing/locale-fit";
import { fitCases } from "./fit-cases";

/* The agent dashboard is a development page (an async server component over fixture numbers), so it is
   rendered to markup here, one locale at a time, and that markup is what the browser is shown. */
const locale = vi.hoisted(() => ({ now: "en" as "en" | "ha" | "ig" | "yo" }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => locale.now }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, prefetch() {} }),
  usePathname: () => "/agent/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
import { getDictionary } from "@vallo/i18n";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";
import AgentDashboardPreview from "@/app/(dev)/preview/f5/agent-dashboard/page";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = () => appCss();

/* The key is "<surface> <locale>"; the value is the report line. */
const KNOWN: Record<string, string> = {};

describe.skipIf(!hasBrowser && !process.env.CI)("locale fit: host and agent workspaces at 390px", () => {
  fitCases(
    {
      name: "Host home, nothing yet",
      imports: `
        import { HostTodayView } from "@/app/host/HostTodayView";
        import { lagosDay } from "@/app/host/today";
        import { ButtonLink } from "@/components/ui/Button";`,
      body: `
        <div className="nf-shell">
          <HostTodayView
            today={{ day: lagosDay(new Date()), kpis: [], stages: [], attention: [], needsYou: 0 }}
            t={t} locale={locale} sub={t.hostWorkspace.nothingYet.home}
            action={<ButtonLink href="/profile/setup?side=stays" variant="primary">{t.hostWorkspace.doors.startApplication}</ButtonLink>} />
        </div>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Host requests to decide, rooms and a table",
      imports: `
        import { DecideView } from "@/components/host/DecideView";
        import { roomDeadline, sortByDeadline } from "@/lib/host/decide";
        import { requestNow } from "@/lib/format/when";
        import { roomRequest, tableRequest } from "@/app/(dev)/preview/host-c/fixtures";`,
      setup: `
        const now = requestNow();
        const rooms = [roomRequest("r1", 47.4), roomRequest("r2", 38), roomRequest("r3", 4)];
        const table = tableRequest("t1", 5);
        const rows = [
          ...rooms.map((b) => ({ kind: "room", id: b.id, openedAt: b.createdAt, deadline: roomDeadline(b.createdAt), booking: b })),
          { kind: "table", id: table.id, openedAt: new Date(now - 20 * 3600000).toISOString(), deadline: table.reservedFor, table },
        ];`,
      body: `<div className="nf-shell"><DecideView rows={sortByDeadline(rows, now)} now={now} locale={locale} unreadable={false} /></div>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Host requests to decide, caught up and unreadable",
      imports: `import { DecideView } from "@/components/host/DecideView";\nimport { requestNow } from "@/lib/format/when";`,
      body: `<div className="nf-shell"><DecideView rows={[]} now={requestNow()} locale={locale} unreadable={false} /><DecideView rows={[]} now={requestNow()} locale={locale} unreadable /></div>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Host calendar, a night selected and its change sheet open",
      imports: `
        import { RateCalendar } from "@/components/host/calendar/RateCalendar";
        import { addMonths, lagosToday } from "@/lib/host/rate-calendar";
        import { ROOMS, SYNC_READY, calendarRows } from "@/app/(dev)/preview/host-c/fixtures";`,
      setup: `const today = lagosToday(); const rows = calendarRows(today);`,
      body: `
        <div className="nf-shell">
          <RateCalendar accommodationName="Example: Marina Court Hotel" businessId="preview" rooms={ROOMS} rates={rows.rates}
            inventory={rows.inventory} imported={rows.imported} month={today.slice(0, 7)} today={today} initialRoomId={null}
            maxMonth={addMonths(today.slice(0, 7), 18)} sync={SYNC_READY} feedBase="https://vallospaces.com" locale={locale} />
        </div>`,
      bleed: true,
      scope: "body",
      before: async (page) => {
        await page.locator("button.nf-rcal__cell:not([aria-disabled])").first().click();
        await page.getByRole("button", { name: "Change", exact: true }).click();
        await page.getByRole("dialog").waitFor();
      },
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Host calendar month, before any night is chosen",
      imports: `
        import { RateCalendar } from "@/components/host/calendar/RateCalendar";
        import { addMonths, lagosToday } from "@/lib/host/rate-calendar";
        import { ROOMS, SYNC_READY, calendarRows } from "@/app/(dev)/preview/host-c/fixtures";`,
      setup: `const today = lagosToday(); const rows = calendarRows(today);`,
      body: `
        <div className="nf-shell">
          <RateCalendar accommodationName="Example: Marina Court Hotel" businessId="preview" rooms={ROOMS} rates={rows.rates}
            inventory={rows.inventory} imported={rows.imported} month={today.slice(0, 7)} today={today} initialRoomId={null}
            maxMonth={addMonths(today.slice(0, 7), 18)} sync={SYNC_READY} feedBase="https://vallospaces.com" locale={locale} />
        </div>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Agent listings workspace, fixture listings",
      imports: `
        import { ListingsWorkspace } from "@/app/agent/listings/ListingsWorkspace";
        import { AGENT_LISTINGS } from "@/app/(dev)/preview/f5/ops-fixtures";`,
      body: `
        <div className="nf-shell pt-md">
          <h1 className="nf-h1">{t.agentListings.workspace.title}</h1>
          <p className="mt-2xs">{t.agentListings.workspace.lede}</p>
          <ListingsWorkspace t={t.agentListings} reference={t.listingReference} listings={AGENT_LISTINGS} locale={locale} />
        </div>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  for (const kind of ["needs", "whole"] as const) {
    fitCases(
      {
        name: `Listing Health, a listing that ${kind === "needs" ? "needs things" : "is in place"}`,
        imports: `
          import { HealthReport } from "@/components/agent/intel/HealthReport";
          import { listingHealth } from "@/components/agent/intel/health-model";
          import { MIN_DESCRIPTION_WORDS, MIN_PHOTOS } from "@/lib/agent/listings-model";`,
        setup: `
          const NOW = Date.parse("2026-10-06T12:00:00Z");
          const DAY = 86400000;
          const words = (n) => Array.from({ length: n }, () => "room").join(" ");
          const needs = ${kind === "needs"};
          const health = listingHealth({
            gate: {
              title: "Fixture listing title", description: words(needs ? 12 : MIN_DESCRIPTION_WORDS),
              propertyType: "apartment", stateCode: "LA", city: "City", area: "Area", intent: "rent",
              rentMinor: 100000, rentPeriod: "year", rateMinor: 0, ratePeriod: null, salePriceMinor: null, tenure: null,
              bedrooms: 1, bathrooms: 1, amenityCount: needs ? 0 : 2, photoCount: needs ? 1 : MIN_PHOTOS + 1, hasCover: true,
            },
            status: "PUBLISHED", listingRole: "agent",
            inspectedAt: needs ? null : "2026-09-01T10:00:00Z",
            addressCheckedAt: needs ? null : "2026-08-20T10:00:00Z",
            ownershipVerifiedAt: null,
            mandateVerifiedAt: needs ? null : "2026-08-01T10:00:00Z",
            publishedAt: new Date(NOW - 40 * DAY).toISOString(),
            listerConfirmedAt: new Date(NOW - (needs ? 20 : 2) * DAY).toISOString(),
            fix: needs ? { key: "no-viewing", values: { enquired: 3 } } : null,
            now: NOW,
          });`,
        body: `<div className="nf-shell pt-md"><HealthReport health={health} listingId="00000000-0000-4000-8000-000000000001" t={t} locale={locale} /></div>`,
        bleed: true,
        css: CSS,
      },
      KNOWN,
    );
  }
});

/* The agent dashboard, from the preview page's own numbers, one locale at a time. */
describe.skipIf(!hasBrowser && !process.env.CI)("locale fit: agent dashboard at 390px", () => {
  for (const l of FIT_LOCALES) {
    fitCasesFromMarkup(l);
  }
});

function fitCasesFromMarkup(l: (typeof FIT_LOCALES)[number]) {
  /* One surface, one locale: the markup is produced for that locale only. */
  fitCasesForLocale(l);
}

import { appendFileSync } from "node:fs";
import { it, expect } from "vitest";
import { auditFit, fitMount } from "@/lib/testing/locale-fit";

function fitCasesForLocale(l: (typeof FIT_LOCALES)[number]) {
  const key = `Agent dashboard, fixture numbers ${l}`;
  const run = key in KNOWN ? it.fails : it;
  run(
    `Agent dashboard, fixture numbers fits at 390px in ${l}: no sideways overflow, no cut label, every target 44px`,
    async () => {
      locale.now = l;
      /* `prerender` waits for the page's async server components to settle. */
      const { prelude } = await prerender(
        <ClientCopyProvider copy={clientCopyOf(getDictionary(l))}>{await AgentDashboardPreview()}</ClientCopyProvider>,
      );
      const html = await new Response(prelude).text();
      const { page, close } = await fitMount({
        locale: l,
        imports: "",
        body: `<div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(html)} }} />`,
        css: await CSS(),
        bleed: true,
      });
      try {
        const found = await auditFit(page);
        if (process.env.FIT_DUMP) appendFileSync(process.env.FIT_DUMP, `${JSON.stringify({ key, ...found })}\n`);
        expect(found.overflow.join("\n"), "sideways overflow").toBe("");
        expect(found.clipped.join("\n"), "label cut off").toBe("");
        expect(found.targets.join("\n"), "tap target under 44px").toBe("");
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
}
