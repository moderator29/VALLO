import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * EACH STAFF SCOPE REACHES THE WHOLE OF ITS DESK.
 *
 * A scoped staff member passes `requireAdmin(scope)` and is handed the
 * SERVICE client, which has no auth.uid(). So two things must hold for every
 * door a scoped desk uses: the door names the desk's scope (a bare
 * `requireAdmin()` refuses every staff member), and any database function
 * that decides on auth.uid() is called with `access.userClient`, never
 * `access.supabase`. The database side (each function gating on
 * `private.staff_can(<caller>, '<scope>')`) is migration
 * 20260929010611_scoped_staff_reach_the_listing_and_kyc_desk_functions.
 */

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const DOORS: { file: string; scope: string; calls: number; userClientRpc: boolean }[] = [
  { file: "../photo-hash/matches-read.ts", scope: "listing_approval", calls: 1, userClientRpc: true },
  { file: "../photo-hash/backfill-action.ts", scope: "listing_approval", calls: 1, userClientRpc: false },
  { file: "../landlord/admin-actions.ts", scope: "listing_approval", calls: 4, userClientRpc: true },
  { file: "../compliance/beneficial-ownership-actions.ts", scope: "listing_approval", calls: 1, userClientRpc: true },
  { file: "../trust/credentials-actions.ts", scope: "kyc_review", calls: 1, userClientRpc: true },
  { file: "./kyc-actions.ts", scope: "kyc_review", calls: 1, userClientRpc: true },
  { file: "./identity-check-actions.ts", scope: "kyc_review", calls: 1, userClientRpc: true },
  { file: "./support-desk-actions.ts", scope: "support", calls: 2, userClientRpc: true },
  { file: "./moderation-actions.ts", scope: "moderation", calls: 1, userClientRpc: true },
  { file: "./agreements-actions.ts", scope: "agreements", calls: 1, userClientRpc: true },
];

describe("every scoped door names its desk's scope", () => {
  for (const door of DOORS) {
    it(`${door.file} opens on ${door.scope}`, () => {
      const text = src(door.file);
      const scoped = text.match(new RegExp(`await requireAdmin\\("${door.scope}"\\)`, "g")) ?? [];
      expect(scoped.length).toBeGreaterThanOrEqual(door.calls);
      expect(text).not.toMatch(/await requireAdmin\(\)/);
      if (door.userClientRpc) {
        /* The rpc goes through the caller's own client. */
        expect(text).toMatch(/access\.userClient/);
        expect(text).not.toMatch(/callLandlordRpc\(access\.supabase/);
        expect(text).not.toMatch(/rpc\("(decide_listing_mandate|record_credential|listing_photo_matches)"[^)]*access\.supabase/);
      }
    });
  }

  it("the document viewer opens for kyc_review, and for listing_approval only on a listing's documents", () => {
    const route = src("../../app/api/documents/[id]/route.ts");
    expect(route).toMatch(/requireAdmin\("kyc_review"\)/);
    expect(route).toMatch(/requireAdmin\("listing_approval"\)/);
    expect(route).not.toMatch(/await requireAdmin\(\)/);
    expect(route).toMatch(/if \(listingOnly\)/);
    expect(route).toMatch(/listing_id/);
    /* Listing staff open ownership and mandate proofs only. */
    expect(route).toMatch(/kind !== "ownership" && kind !== "mandate"/);
  });

  it("the migration moves each function's gate to its scope and is on disk", () => {
    const sql = src("../../../../../supabase/migrations/20260929010611_scoped_staff_reach_the_listing_and_kyc_desk_functions.sql");
    for (const [fn, scope] of [
      ["listing_photo_matches", "listing_approval"],
      ["listing_photo_hash_coverage", "listing_approval"],
      ["record_principal_consent", "listing_approval"],
      ["property_join", "listing_approval"],
      ["property_keep_apart", "listing_approval"],
      ["property_split", "listing_approval"],
      ["reopen_listing", "listing_approval"],
      ["decide_listing_mandate", "listing_approval"],
      ["record_credential", "kyc_review"],
    ]) {
      expect(sql).toMatch(new RegExp(`'public\\.${fn}\\([^']*\\)', '${scope}'`));
    }
  });
});
