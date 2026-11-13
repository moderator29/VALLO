import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * EVERY WIRED MOMENT, BY FILE (docs/SUCCESS_MOMENTS.md).
 *
 * The flows with a staged action are driven for real in
 * `success-wiring.dom.test.tsx`. The multi-step wizards (listing, agent,
 * host, registration, KYC), the support chat and the review forms are too
 * large to stage one screen of, so this holds each of them to the same rule
 * at the source: the sheet is imported, and the only thing that opens it is
 * the action's own ok. Each pattern names the line that gates it; a refactor
 * that moves the gate has to move the pattern too, which is the point.
 */
const SRC = join(__dirname, "..", "..");

const WIRED: [file: string, gate: RegExp][] = [
  /* Round 5: no sheet. The last step becomes the sent chain under the card,
     in place, and only from the action's ok (ListingWizard.publish.dom.test). */
  ["app/agent/list/ListingWizard.tsx", /if \(!result\.ok\) \{[\s\S]{0,800}\}\s*setNotice\(null\);\s*setFieldErrors\(\{\}\);\s*setSent\(\{ status: result\.data\.status/],
  ["components/agent/ApplyWizard.tsx", /open=\{state\.ok && !successClosed\}/],
  ["components/host/HostWizard.tsx", /if \(submitted\) setCelebrate\(true\)/],
  ["components/supply/OwnerRegisterForm.tsx", /if \(step === 3 && filed\)[\s\S]{0,200}RegistrationFiledSheet/],
  ["components/supply/AgentRegisterForm.tsx", /if \(step === 3 && filed\)[\s\S]{0,200}RegistrationFiledSheet/],
  ["components/supply/FirmRegisterForm.tsx", /if \(step === 3 && filed\)[\s\S]{0,200}RegistrationFiledSheet/],
  ["components/verification/KycFlow.tsx", /if \(sent\)[\s\S]{0,160}<KycSentSheet copy=\{success\} \/>/],
  ["app/(app)/support/new/NewQueryForm.tsx", /if \(filed\)[\s\S]{0,160}<TicketFiledSheet/],
  ["components/app/account/SupportChat.tsx", /markFiled[\s\S]{0,200}setJustFiled\(reference\)/],
  ["app/(app)/bookings/[bookingId]/review/ReviewForm.tsx", /if \(state\?\.ok\) \{[\s\S]{0,400}<SuccessSheet/],
  ["app/(app)/rent/review/[paymentId]/TenancyReviewForm.tsx", /if \(done\) \{[\s\S]{0,600}<SuccessSheet/],
  ["app/(app)/listing/[id]/ReservePanel.tsx", /if \(state\?\.ok\) \{[\s\S]{0,900}<SuccessSheet/],
  ["components/app/inspections/InspectionSheet.tsx", /if \(body\.submit === true\) setDone\("inspectionReportSubmitted"\)/],
  ["components/app/agreements/AgreementControls.tsx", /"claim-filed"/],
  ["app/agent/listings/ListingsWorkspace.tsx", /withDone\("\/agent\/listings", "listing-submitted"/],
  ["components/app/payments/PaymentMethodsPanel.tsx", /onSaved=\{\(\) => \{[\s\S]{0,80}setAccountAdded\(true\)/],
  ["components/agent/PayoutAccounts.tsx", /open=\{addState\?\.ok === true && acknowledged !== addState\}/],
  ["app/(app)/checkout/[bookingId]/PayPanel.tsx", /result\.data\.settled\s*\?\s*\{ kind: "paid"/],
  ["app/(app)/rent/pay/[inspectionId]/PayPanel.tsx", /result\.data\.settled\s*\?\s*\{ kind: "paid"/],
  ["lib/auth/actions.ts", /rememberSuccess\("password-changed"\);\s*redirect\("\/home"\)/],
  /* Since 13 November 2026 a new account passes the profile photo step on its
     way to where it was going (lib/auth/photo-step.ts). */
  ["lib/auth/actions.ts", /rememberSuccess\("account-created"\);\s*redirect\(photoStepHref\(landingAfterAuth\(formData\)\)\)/],
];

describe("the success sheet is wired, and gated on ok, in every flow the DOM suite does not drive", () => {
  it.each(WIRED)("%s", (file, gate) => {
    const code = withoutComments(readFileSync(join(SRC, file), "utf8"));
    expect(code).toMatch(/SuccessSheet|PaymentStage|RegistrationFiledSheet|KycSentSheet|TicketFiledSheet|withDone|rememberSuccess|ListingSentForReview/);
    expect(code).toMatch(gate);
  });

  it("no success sheet is opened from a pending or failed phase in the pay panels", () => {
    for (const file of ["app/(app)/checkout/[bookingId]/PayPanel.tsx", "app/(app)/rent/pay/[inspectionId]/PayPanel.tsx"]) {
      const code = withoutComments(readFileSync(join(SRC, file), "utf8"));
      if (code.includes("<PaymentStage")) {
        /* The pay stage (round 5): one card whose face turns to "paid" in
           exactly one place, and only from the paid phase. */
        expect(code.match(/at: "paid"/g), file).toHaveLength(1);
        expect(code, file).toMatch(/phase\.kind === "paid"\s*\?\s*\{\s*at: "paid",\s*settled: true/);
        continue;
      }
      const opens = [...code.matchAll(/<SuccessSheet\s+open=\{([^}]+)\}/g)].map((m) => m[1]);
      expect(opens, file).toEqual(['phase.kind === "paid"']);
    }
  });
});

/*
 * THE WORDS COME FROM THE PAGE. Most moments' copy is not carried on every
 * screen (lib/i18n/client-copy-of.ts), so a wired component draws its sheet
 * only when its server parent hands it `t.success`. Each production caller
 * below must, or the moment silently stops appearing.
 */
const CALLERS: [file: string, element: string][] = [
  ["app/(app)/listing/[id]/page.tsx", "ReservePanel"],
  ["app/(app)/listing/[id]/page.tsx", "ReserveTable"],
  ["app/(app)/listing/[id]/page.tsx", "ViewingSlots"],
  ["app/(app)/restaurant/[id]/RestaurantFace.tsx", "ReserveTable"],
  ["components/app/plans/InspectionsBoard.tsx", "InspectionSheet"],
  ["app/agent/inspections/page.tsx", "InspectionSheet"],
  ["app/agent/list/page.tsx", "ListingWizard"],
  ["components/app/after-gate/BookingMoneyRecord.tsx", "RefundRequestForm"],
  ["app/(app)/rent/share/[id]/page.tsx", "SettleShareOnReturn"],
  ["app/(app)/tenancy/[id]/page.tsx", "SettleShareOnReturn"],
  ["app/(app)/verification/page.tsx", "VninPanel"],
  ["app/(app)/verification/page.tsx", "KycFlow"],
  ["app/agent/earnings/page.tsx", "PayoutAccounts"],
  ["app/(app)/bookings/[bookingId]/review/page.tsx", "ReviewForm"],
  ["app/(app)/rent/review/[paymentId]/page.tsx", "TenancyReviewForm"],
];

describe("every production caller hands its component the success words", () => {
  it.each(CALLERS)("%s passes success to <%s>", (file, element) => {
    const code = withoutComments(readFileSync(join(SRC, file), "utf8"));
    const uses = [...code.matchAll(new RegExp(`<${element}\\b[^>]*?(?:/>|>)`, "gs"))].map((m) => m[0]);
    expect(uses.length, `${element} in ${file}`).toBeGreaterThan(0);
    for (const use of uses) expect(use, use).toMatch(/\bsuccess=\{/);
  });
});
