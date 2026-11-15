import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { DeskLinks } from "../_components/panels";
import { DemandBoard } from "@/components/agent/DemandBoard";
import { readDemandBoard } from "@/lib/demand/queries";
import { getLocale } from "@/lib/locale";
import { flatParams } from "../money/_desk/Desk";
import { readPage } from "@/lib/admin/reads/money-derive";
import type { SupplyRoleKey } from "@/lib/admin/reads/money-types";
import { getFirmRosters, getSupplyDesk } from "@/lib/admin/reads/supply";
import { getBadgeTiers } from "@/lib/admin/reads/badges";
import { SUPPLY_ROLE_KEYS } from "@/lib/admin/reads/money-types";
import { SupplyDesk, type SupplyFilter } from "./SupplyDesk";
import "../money/_desk/desk.css";

export const metadata: Metadata = {
  title: "Supply",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Rows per page on the supply table. The render draws six. */
const SUPPLY_PAGE_SIZE = 8;

/**
 * The supply desk, as panel 3 of 8E9602E2 draws it.
 *
 * Every figure is `getSupplyDesk` (`lib/admin/reads/supply.ts`): owners,
 * agents, firms and hosts from `agents`, `agent_applications` and
 * `businesses`, their live listings from `listings` and `accommodations`, and
 * what has been paid to them from `escrows` and `bookings`. Examples
 * (`is_demo`) are left out unless the operator asks, and the page says how
 * many were left out.
 *
 * The layout's `requireAdmin()` refuses a non-admin before this runs, and
 * every `lib/admin` read repeats that check at its own door, so the read that
 * replaces the placeholder below brings its own guard with it.
 */
export default async function AdminSupplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const flat = flatParams(params);
  const role = SUPPLY_ROLE_KEYS.find((r) => r === flat.role) as SupplyRoleKey | undefined;
  const filter: SupplyFilter = {
    ...(role ? { role } : {}),
    examples: flat.examples === "1",
    page: readPage(params.page),
  };

  const [read, roster, demand] = await Promise.all([
    getSupplyDesk({ ...filter, pageSize: SUPPLY_PAGE_SIZE }),
    getFirmRosters(filter.examples),
    readDemandBoard(4),
  ]);
  const supply = read.state === "ok" ? read.data : null;
  const tiers = await getBadgeTiers([
    ...(supply?.rows ?? []).map((r) => r.userId),
    ...(roster.state === "ok" ? roster.data.firms.flatMap((f) => f.members.map((m) => m.userId)) : []),
  ]);

  return (
    <>
      {/* The desks the menu files under this one, as buttons: this desk drew
          none of them, so reaching Businesses or Stops meant going back to the menu. */}
      <div className="nf-console">
        <DeskLinks deskKey="supply" label="The other supply desks" caption="More in this desk" />
      </div>
      <SupplyDesk supply={supply} filter={filter} params={flat} locale={locale} pageSize={SUPPLY_PAGE_SIZE} rosters={roster.state === "ok" ? roster.data : null} tiers={tiers} now={new Date().getTime()} />
      {/* V-10: the recruiting map. Where demand sits that supply does not. */}
      <DemandBoard rows={demand} copy={getDictionary(locale).frontDoor.demand} locale={locale} />
    </>
  );
}
