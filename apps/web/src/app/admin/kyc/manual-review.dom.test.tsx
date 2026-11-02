/**
 * THE MANUAL REVIEW DESK: the ID beside the selfie with the names and the
 * bank account check, the checklist, and an ID approved only with the name
 * printed on it. Rendered for real.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { KycSubjectView } from "@/lib/admin/kyc-queries";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { IdentityAtAGlance, REVIEW_CHECKLIST } from "./IdentityAtAGlance";
import { GUIDE_SECTIONS } from "./guide/guide-content";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

function doc(over: Partial<KycSubjectView["documents"][number]>): KycSubjectView["documents"][number] {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "identity",
    subtype: "passport",
    reviewStatus: "pending",
    rejectionReason: null,
    issuedOn: null,
    uploadedAt: "2026-11-02T10:00:00Z",
    reviewedAt: null,
    reviewedByName: null,
    media: "image",
    isResubmission: false,
    tooOld: false,
    nameOnDocument: null,
    ...over,
  };
}

function subject(over: Partial<KycSubjectView> = {}): KycSubjectView {
  return {
    userId: "user-1",
    displayName: "Chidi",
    applicationId: null,
    applicationReference: null,
    agentId: null,
    tier: 0,
    rungs: [],
    business: null,
    documents: [
      doc({}),
      doc({ id: "00000000-0000-4000-8000-000000000002", kind: "selfie", subtype: null }),
      doc({ id: "00000000-0000-4000-8000-000000000003", kind: "address", subtype: "utility_bill" }),
    ],
    payoutNameCheck: null,
    namesOnRecord: { account: "Chidi Okeke", application: null },
    identityName: null,
    consents: [],
    consentsRead: true,
    ...over,
  };
}

describe("identity at a glance", () => {
  it("puts the ID beside the selfie, streamed from our own origin, with the names to compare", () => {
    const html = renderToStaticMarkup(<IdentityAtAGlance subject={subject()} decidable />);
    expect(html).toContain('src="/api/documents/00000000-0000-4000-8000-000000000001"');
    expect(html).toContain('src="/api/documents/00000000-0000-4000-8000-000000000002"');
    expect(html).toContain("Chidi Okeke");
    expect(html).toContain("No bank account added yet");
    expect(html).not.toContain("supabase.co");
    for (const item of REVIEW_CHECKLIST) expect(html).toContain(item.replace(/'/g, "&#x27;"));
    expect(html).toContain('href="/admin/kyc/guide"');
  });

  it("says whether the bank account name matches the name on the ID", () => {
    const matched = renderToStaticMarkup(
      <IdentityAtAGlance
        subject={subject({ identityName: "OKEKE CHIDI", payoutNameCheck: { match: true, reason: "same names", holder: "OKEKE CHIDI E", onRecord: "OKEKE CHIDI" } })}
        decidable
      />,
    );
    expect(matched).toContain("Bank name matches");
    const differs = renderToStaticMarkup(
      <IdentityAtAGlance
        subject={subject({ payoutNameCheck: { match: false, reason: "different surname", holder: "ADA OBI", onRecord: "Chidi Okeke" } })}
        decidable
      />,
    );
    expect(differs).toContain("Bank name differs");
  });

  it("names an older sign-up with no selfie, and draws nothing for a person with no ID or selfie", () => {
    const older = renderToStaticMarkup(<IdentityAtAGlance subject={subject({ documents: [doc({})] })} decidable />);
    expect(older).toContain("No selfie.");
    const none = renderToStaticMarkup(
      <IdentityAtAGlance subject={subject({ documents: [doc({ kind: "address", subtype: "utility_bill" })] })} decidable />,
    );
    expect(none).toBe("");
  });
});

describe("the reviewer guide", () => {
  it("covers the flow, each document, names, sending back, reporting and privacy", () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    for (const id of ["flow", "id", "selfie", "names", "address", "business", "bank", "reasons", "video", "report", "privacy"]) {
      expect(ids).toContain(id);
    }
    const report = GUIDE_SECTIONS.find((s) => s.id === "report")!.points.join(" ");
    expect(report).toContain("tipping off");
  });

  it("opens only for the verification team", () => {
    const page = readFileSync(join(process.cwd(), "src/app/admin/kyc/guide/page.tsx"), "utf8");
    expect(page).toMatch(/await requireAdmin\("kyc_review"\)/);
    expect(page).not.toMatch(/await requireAdmin\(\)/);
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("approving an ID", () => {
  const ENTRY = (kind: string) => `
    import { mount } from "@/lib/testing/browser-root";
    import { DocumentDecision } from "@/app/admin/_components/MoneyDecisions";
    mount(<DocumentDecision documentId="00000000-0000-4000-8000-000000000001" kind="${kind}" />);
  `;

  it("needs the name printed on it, and sends that name with the approval", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY("identity"),
      actions: { reviewKycDocument: `async () => ({ ok: true, data: null })`, setFeeRate: `async () => ({ ok: true, data: null })` },
    });
    try {
      expect(await page.getByTestId("document-approve").isDisabled()).toBe(true);
      await page.getByTestId("name-on-id").fill("OKEKE CHIDI EMMANUEL");
      await page.getByTestId("document-approve").click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[] }).__calls ?? []).length > 0);
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls[0]).toEqual([
        "reviewKycDocument",
        { documentId: "00000000-0000-4000-8000-000000000001", approve: true, nameOnId: "OKEKE CHIDI EMMANUEL" },
      ]);
    } finally {
      await close();
    }
  });

  it("approves a selfie as the same person, with no name to type", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY("selfie"),
      actions: { reviewKycDocument: `async () => ({ ok: true, data: null })` },
    });
    try {
      expect(await page.getByTestId("name-on-id").count()).toBe(0);
      expect(await page.getByTestId("document-approve").innerText()).toBe("Same person, approve");
      expect(await page.getByTestId("document-approve").isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });

  it("sends a refusal with the reviewer's own words", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY("identity"),
      actions: { reviewKycDocument: `async () => ({ ok: true, data: null })` },
    });
    try {
      await page.getByTestId("document-reject").click();
      await page.locator("textarea").fill("The photo is blurry. Take it again in good light.");
      await page.getByRole("button", { name: "Send it back" }).click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[] }).__calls ?? []).length > 0);
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls[0]).toEqual([
        "reviewKycDocument",
        { documentId: "00000000-0000-4000-8000-000000000001", approve: false, reason: "The photo is blurry. Take it again in good light." },
      ]);
    } finally {
      await close();
    }
  });
});
