import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "@/lib/copy/source-scan";
import { isBare, rawFields } from "./field-keyboard-walk";

/**
 * THE KEYBOARD PASS, HELD (founder, 14 November 2026: "keyboard high clean
 * for our platform").
 *
 * Walks the source for every `<input>` and `<textarea>` written directly in
 * JSX and fails on one that names none of `type`, `inputMode`,
 * `enterKeyHint`, `autoComplete`, `autoCapitalize`, `autoCorrect` and
 * `spellCheck`. Such a field gets whatever keyboard the phone guesses: capitals
 * in a code, autocorrect in a street name, a bare "return" where Next belongs.
 * It is the same kind of gate as `hand-rolled-sheets.test.ts`.
 *
 * A field that spreads its props (`{...rest}`) is a primitive whose caller
 * decides, so it is not counted here; the shared fields apply the table in
 * `field-keyboard.ts` and are tested there.
 *
 * THE CONSOLE'S DEBT. `app/admin` was outside this pass (another agent owned
 * it on the day). Its bare fields are counted per file below and that count
 * may only go down: fixing one means lowering its number, and a new bare
 * field anywhere, the console included, fails.
 */
const SRC = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") && !name.includes(".test.")) out.push(path);
  }
  return out;
}

function bareByFile(): Map<string, number[]> {
  const found = new Map<string, number[]>();
  for (const path of walk(SRC)) {
    const lines = rawFields(withoutComments(readFileSync(path, "utf8")))
      .filter(isBare)
      .map((field) => field.line);
    if (lines.length > 0) found.set(relative(SRC, path).split("\\").join("/"), lines);
  }
  return found;
}

/** 127 bare fields in 58 console files on 14 November 2026. */
const CONSOLE_DEBT: Record<string, number> = {
  "app/admin/_components/AdminActions.tsx": 4,
  "app/admin/_components/EntryTool.tsx": 4,
  "app/admin/_components/MoneyDecisions.tsx": 2,
  "app/admin/_components/NoteForm.tsx": 1,
  "app/admin/_lanes/ContestDecision.tsx": 1,
  "app/admin/_lanes/HoldDecision.tsx": 1,
  "app/admin/account-recovery/RecoveryDesk.tsx": 3,
  "app/admin/agreements/AgreementQueue.tsx": 1,
  "app/admin/agreements/WatchList.tsx": 2,
  "app/admin/appeals/AppealDecision.tsx": 1,
  "app/admin/blocked-terms/TermForms.tsx": 4,
  "app/admin/bookings/reservations/ReservationDecisions.tsx": 1,
  "app/admin/business-development/AddProspectForm.tsx": 4,
  "app/admin/business-development/ProspectBoard.tsx": 6,
  "app/admin/businesses/BusinessDecisions.tsx": 2,
  "app/admin/cases/[id]/CaseActions.tsx": 1,
  "app/admin/chargebacks/ChargebackActions.tsx": 2,
  "app/admin/circle/CommunityActions.tsx": 1,
  "app/admin/compliance/_lanes/SanctionsControls.tsx": 2,
  "app/admin/compliance/_lanes/StrControls.tsx": 8,
  "app/admin/content/ContentControls.tsx": 4,
  "app/admin/kyc/CredentialForm.tsx": 2,
  "app/admin/kyc/IdentityCheckDecision.tsx": 1,
  "app/admin/kyc/RequestSelfieWithId.tsx": 1,
  "app/admin/listings/MandateConsent.tsx": 1,
  "app/admin/listings/MandateDecision.tsx": 1,
  "app/admin/listings/[id]/PropertyMatchButtons.tsx": 1,
  "app/admin/listings/[id]/ReviewActionBar.tsx": 1,
  "app/admin/marketing/MarketingControls.tsx": 11,
  "app/admin/marketing/ReportBuilder.tsx": 1,
  "app/admin/money/CautionDesk.tsx": 2,
  "app/admin/money/DeclineRefundRequest.tsx": 1,
  "app/admin/money/GuaranteeDesk.tsx": 2,
  "app/admin/my-desk/AnnouncementControls.tsx": 2,
  "app/admin/my-desk/TaskControls.tsx": 1,
  "app/admin/my-desk/weekly/WeeklyReportForm.tsx": 2,
  "app/admin/overview/EscalationBoard.tsx": 3,
  "app/admin/overview/StaffAccessRecommendations.tsx": 3,
  "app/admin/payments/MethodLookup.tsx": 1,
  "app/admin/people/[id]/MemberStandingControls.tsx": 1,
  "app/admin/people/[id]/NoteForm.tsx": 1,
  "app/admin/people/[id]/UpholdControl.tsx": 1,
  "app/admin/queue/page.tsx": 1,
  "app/admin/referrals/ReferralControls.tsx": 2,
  "app/admin/reports/weekly/ReviewControls.tsx": 1,
  "app/admin/roommates/ReviewControls.tsx": 1,
  "app/admin/roommates/RoommateControls.tsx": 5,
  "app/admin/social-media/SocialMediaControls.tsx": 2,
  "app/admin/social/SocialDecisions.tsx": 1,
  "app/admin/staff/KeyRosterForms.tsx": 1,
  "app/admin/staff/StaffForms.tsx": 2,
  "app/admin/staff/SupportTeam.tsx": 1,
  "app/admin/stops/StopsDesk.tsx": 2,
  "app/admin/support-lead/SupportLeadControls.tsx": 5,
  "app/admin/support/SupportComposer.tsx": 1,
  "app/admin/support/SupportEscalate.tsx": 2,
  "app/admin/technical/TechnicalControls.tsx": 4,
  "app/admin/weight-withheld/ClearStamp.tsx": 1,
};

describe("reading a file for its raw fields", () => {
  it("names the keyboard attributes a field carries", () => {
    const [field] = rawFields(`<input id="a" type="text" inputMode="numeric" autoComplete="one-time-code" />`);
    expect(field).toMatchObject({ tag: "input", names: ["type", "inputMode", "autoComplete"], spreads: false });
  });

  it("is not fooled by a brace, a string or an arrow inside an attribute", () => {
    const code = `<textarea\n  value={draft}\n  onChange={(e) => { if (e.target.value.length > 3) set(e.target.value); }}\n  placeholder="a > b"\n/>`;
    const [field] = rawFields(code);
    expect(field).toMatchObject({ tag: "textarea", names: [], spreads: false });
    expect(isBare(field!)).toBe(true);
    /* The word inside a handler or a string is not the attribute. */
    expect(rawFields(`<input onChange={() => log("spellCheck")} placeholder="type here" />`)[0]!.names).toEqual([]);
  });

  it("skips an input nobody types into, and a primitive that spreads its props", () => {
    expect(rawFields(`<input type="hidden" name="a" /><input type="checkbox" /><input type="file" />`)).toEqual([]);
    const [spread] = rawFields(`<input {...rest} {...control} ref={ref} />`);
    expect(spread!.spreads).toBe(true);
    expect(isBare(spread!)).toBe(false);
  });

  it("gives the line the field starts on", () => {
    expect(rawFields(`\n\n<div>\n  <input enterKeyHint="next" />\n</div>`)[0]!.line).toBe(4);
  });
});

describe("every field says which keyboard it wants", () => {
  const bare = bareByFile();

  it("no input or textarea outside the console names none of the seven attributes", () => {
    const outside = [...bare.entries()]
      .filter(([file]) => !file.startsWith("app/admin/"))
      .map(([file, lines]) => `${file}:${lines.join(",")}`);
    expect(outside).toEqual([]);
  });

  it("the console's bare fields only ever get fewer", () => {
    const grown = [...bare.entries()]
      .filter(([file]) => file.startsWith("app/admin/"))
      .filter(([file, lines]) => lines.length > (CONSOLE_DEBT[file] ?? 0))
      .map(([file, lines]) => `${file}: ${lines.length} bare, ${CONSOLE_DEBT[file] ?? 0} allowed (lines ${lines.join(",")})`);
    expect(grown).toEqual([]);
  });

  it("a console file that has been fixed comes off the list", () => {
    const stale = Object.entries(CONSOLE_DEBT)
      .filter(([file, allowed]) => (bare.get(file)?.length ?? 0) < allowed)
      .map(([file, allowed]) => `${file}: ${bare.get(file)?.length ?? 0} bare now, lower its ${allowed}`);
    expect(stale).toEqual([]);
  });
});
