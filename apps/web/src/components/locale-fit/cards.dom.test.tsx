/**
 * Locale fit, the dock and the cards (north star checklist point 22): the
 * bottom dock (MobileTabBar with its Create switch, each tab active in turn so
 * the chosen tab's word shows beside its glyph) and its More tray (DockMore),
 * then ListingCard (one across, the wide shelf and the dense row) and StayCard,
 * each mounted in Chromium at 390px in English, Hausa, Igbo and Yorùbá, from the
 * real dictionaries and the repository's own structural fixtures
 * (`app/(dev)/preview/f3/fixtures`), on the product's real compiled cascade.
 * See `fit-cases.ts` for the three things held.
 */
import { afterAll, beforeAll, describe, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";
import { fitCases } from "./fit-cases";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = () => appCss();

/* The key is "<surface> <locale>"; the value is the report line. */
const KNOWN: Record<string, string> = {
};

const DOCK_IMPORTS = `
  import { MobileTabBar } from "@/components/app/MobileTabBar";
  import { CreateDock } from "@/components/app/CreateDock";
  import { shellDictionary } from "@/lib/i18n/shell-dictionary";`;

const dock = (active: string, side: "property" | "stays", signedIn: boolean) => `
  <MobileTabBar t={shellDictionary(t)} side="${side}" active="${active}" signedIn={${signedIn}}
    createSlot={<CreateDock t={shellDictionary(t)} listHref="/profile/setup" isHost={false} signedIn={${signedIn}} />} />`;

describe.skipIf(!hasBrowser && !process.env.CI)("locale fit: the dock and the cards at 390px", () => {
  for (const [active, side] of [
    ["/home", "property"],
    ["/search", "property"],
    ["/around", "property"],
    ["/profile", "property"],
    ["/stays", "stays"],
  ] as const) {
    fitCases(
      { name: `Dock with ${active} chosen (${side} side, signed in)`, imports: DOCK_IMPORTS, body: dock(active, side, true), css: CSS },
      KNOWN,
    );
  }

  fitCases(
    { name: "Dock signed out, Sign up tab chosen", imports: DOCK_IMPORTS, body: dock("/sign-up", "property", false), css: CSS },
    KNOWN,
  );

  /* The grid tray (DockMore) left the dock on 7 November 2026: the centre
     slot is Vallo Circle, a destination, so the dock with Circle chosen is
     the case that replaces the open tray. */
  fitCases(
    { name: "Dock with /circle chosen (property side, signed in)", imports: DOCK_IMPORTS, body: dock("/circle", "property", true), css: CSS },
    KNOWN,
  );

  fitCases(
    {
      name: "ListingCard, one across, every fixture row",
      imports: `import { ListingCard } from "@/components/app/ListingCard";\nimport { SHELF, EXAMPLE_LISTING } from "@/app/(dev)/preview/f3/fixtures";`,
      body: `
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          {[...SHELF, EXAMPLE_LISTING].map((listing, i) => <ListingCard key={listing.id} listing={listing} locale={locale} t={t} index={i} />)}
        </div>`,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "ListingCard, wide and dense",
      imports: `import { ListingCard } from "@/components/app/ListingCard";\nimport { SHELF } from "@/app/(dev)/preview/f3/fixtures";`,
      body: `
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          {SHELF.map((listing, i) => <ListingCard key={"w" + listing.id} listing={listing} locale={locale} t={t} index={i} wide />)}
          {SHELF.map((listing, i) => <ListingCard key={"d" + listing.id} listing={listing} locale={locale} t={t} index={i} dense messageAgent />)}
        </div>`,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "StayCard, stays and restaurants",
      imports: `import { StayCard } from "@/components/app/stays/StayCard";\nimport { STAYS, RESTAURANTS } from "@/app/(dev)/preview/f3/fixtures";`,
      body: `
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          {[...STAYS, ...RESTAURANTS].map((stay, i) => <StayCard key={stay.id} stay={stay} locale={locale} t={t} index={i} saved={i === 0} canSavePlaces />)}
        </div>`,
      css: CSS,
    },
    KNOWN,
  );
});
