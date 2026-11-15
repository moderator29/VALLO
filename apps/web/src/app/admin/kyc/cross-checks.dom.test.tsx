/**
 * THE CROSS-CHECKS PANEL AND THE PASSPORT CHECKER, rendered for real: what a
 * reviewer reads, in what order, what is sent to the server and what never is.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { KycSubjectView } from "@/lib/admin/kyc-queries";
import type { CrossCheckReport } from "@/lib/identity/cross-check/actions";
import { CROSS_CHECK_SUMMARY, couldNotRun, finding, notAvailableYet } from "@/lib/identity/cross-check/signals";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { CrossChecks, type CrossChecksProps } from "./CrossChecks";
import { identityEscalationHref, identityEscalationLabel, identityRecordPath } from "./escalate-link";
import { CHECKLIST_CAVEAT, GENERAL_CHECKLIST, ID_CHECKLISTS, checklistFor } from "./id-checklists";
import { IdentityAtAGlance } from "./IdentityAtAGlance";
import { GUIDE_SECTIONS } from "./guide/guide-content";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DOCUMENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const NO_NAMES = { onId: null, account: null, application: null, bank: null, business: null };

const BASE: CrossChecksProps = {
  subjectId: SUBJECT,
  displayName: "Chidi Okeke",
  identityDocumentId: DOCUMENT,
  idSubtype: "nin_card",
  issuingCountry: "NG",
  names: { ...NO_NAMES, account: "Chidi Okeke" },
  decidable: true,
};

const STOP: CrossCheckReport = {
  state: "ok",
  findings: [
    finding("id_number.shared", "stop", "This ID number is on 1 other account", "One ID belongs to one person. Do not approve, do not tell the member, and escalate to Trust and Safety.", [
      { href: `/admin/people/${OTHER}`, label: "Open the other account" },
    ]),
    finding("file.front.editor", "look", "The front image was saved by an editing app (Photoshop)", "Zoom in on the name, the photo and the dates."),
    couldNotRun("account.phone", "whether their phone number is confirmed"),
    finding("account.age", "ok", "The account is 45 days old", "A new account is normal for a new lister."),
  ],
};

const html = (props: Partial<CrossChecksProps> = {}) => renderToStaticMarkup(<CrossChecks {...BASE} {...props} />);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ");

describe("the cross-checks panel", () => {
  it("opens with the sentence that nothing here is proof, and what to do with a doubt", () => {
    expect(text(html({ preloaded: STOP }))).toContain(CROSS_CHECK_SUMMARY);
  });

  it("lists the findings worst first: stop, look, what could not run, then what is fine", () => {
    const markup = html({ preloaded: STOP, names: { ...NO_NAMES, onId: "OKEKE CHIDI", account: "Chidi Okeke", bank: "OKEKE CHIDI E" } });
    const levels = [...markup.matchAll(/data-testid="cross-check-finding" data-key="([^"]+)" data-level="([^"]+)"/g)].map((m) => `${m[2]}:${m[1]}`);
    expect(levels).toEqual([
      "stop:id_number.shared",
      "look:file.front.editor",
      "not-run:account.phone",
      "ok:names.id_account",
      "ok:names.bank",
      "ok:account.age",
    ]);
    const words = text(markup);
    expect(words).toContain("This ID number is on 1 other account");
    expect(words).toContain("The front image was saved by an editing app (Photoshop)");
    expect(words).toContain("This check could not run: whether their phone number is confirmed");
    expect(words).toContain("The bank account name matches the ID");
    expect(words).toContain("1 to stop on");
    expect(words).toContain("1 to look at");
    expect(words).toContain("1 not run");
    expect(words).toContain("3 fine");
  });

  it("tucks what is fine away when something needs the reviewer, and opens it when it is all there is", () => {
    expect(html({ preloaded: STOP })).toMatch(/<details class="mt-xs" data-testid="cross-check-fine">/);
    expect(text(html({ preloaded: STOP }))).toContain("1 check found nothing wrong");
    const clean = html({ preloaded: { state: "ok", findings: [finding("account.age", "ok", "The account is 45 days old", "Fine."), finding("file.same", "ok", "None of their files is on another account", "Fine.")] } });
    expect(clean).toMatch(/<details class="mt-xs" open="" data-testid="cross-check-fine">/);
    expect(text(clean)).toContain("2 checks found nothing wrong");
  });

  it("links to the other account's admin record and never names it", () => {
    const markup = html({ preloaded: STOP });
    expect(markup).toContain(`href="/admin/people/${OTHER}"`);
    expect(text(markup)).toContain("Open the other account");
    expect(text(markup)).not.toContain(OTHER);
  });

  it("works out the names side by side on the page, with no server answer at all", () => {
    const words = text(html({ names: { ...NO_NAMES, onId: "ADAOBI NWOSU", account: "Chidi Okeke", bank: "BELLO TOLU" } }));
    expect(words).toContain("The name on the ID differs from the account name");
    expect(words).toContain("The bank account name differs from the ID");
  });

  it("says in one line when the server checks could not run at all, and keeps everything else", () => {
    const words = text(html({ preloaded: { state: "failed" }, names: { ...NO_NAMES, onId: "OKEKE CHIDI", account: "Chidi Okeke" } }));
    expect(words).toContain("This check could not run: the comparisons with other accounts and the file checks");
    expect(words).toContain("The name on the ID matches the account name");
    expect(words).toContain("Check a passport's bottom lines");
    expect(words).toContain("Escalate to Trust and Safety");
  });

  it("says each line that is not available yet in its own words", () => {
    const words = text(html({ preloaded: { state: "ok", findings: [notAvailableYet("file.same", "the same file on another account")] } }));
    expect(words).toContain("Not available yet: the same file on another account");
    expect(words).toContain("Not run");
  });

  it("shows a refusal as the server worded it", () => {
    expect(text(html({ preloaded: { state: "refused", message: "This is your own account, so somebody else has to review it." } }))).toContain(
      "This is your own account, so somebody else has to review it.",
    );
  });

  it("says documents with no owner cannot be compared, and still offers the checker and the escalation", () => {
    const markup = html({ subjectId: null, displayName: null });
    expect(text(markup)).toContain("These documents have no owner on record");
    expect(markup).toContain('href="/admin/escalations/new?category=identity_fraud&amp;record=%2Fadmin%2Fkyc&amp;label=Identity%20check%20for%20a%20member"');
  });

  it("states that no free lookup exists and that a number is never typed anywhere else", () => {
    const words = text(html());
    expect(words).toContain("There is no free place to look a NIN or a BVN up");
    expect(words).toContain("never typed into any other website, app or chat");
  });

  it("names asking for a selfie holding the ID as the next step, and never tipping off", () => {
    const words = text(html());
    expect(words).toContain("Ask for a selfie holding their ID");
    expect(words).toContain("do not tell the member what you suspect");
  });

  it("opens the passport checker for a passport and the number box for everything else", () => {
    const passport = html({ idSubtype: "passport" });
    expect(passport).toMatch(/<details class="mt-sm" open="" data-testid="cross-checks-mrz">/);
    expect(passport).toMatch(/<details class="mt-sm" data-testid="cross-checks-number">/);
    const slip = html({ idSubtype: "nin_card" });
    expect(slip).toMatch(/<details class="mt-sm" data-testid="cross-checks-mrz">/);
    expect(slip).toMatch(/<details class="mt-sm" open="" data-testid="cross-checks-number">/);
  });

  it("offers to compare a number only while a decision is still to be made on an ID", () => {
    expect(html()).toContain('data-testid="id-number-compare"');
    expect(html({ decidable: false })).not.toContain('data-testid="id-number-compare"');
    expect(html({ identityDocumentId: null })).not.toContain('data-testid="id-number-compare"');
  });

  it("gives every field its keyboard: nothing capitalised by guess, corrected or remembered", () => {
    const markup = html({ idSubtype: "passport" });
    const inputs = [...markup.matchAll(/<input[^>]*type="text"[^>]*>/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(3);
    for (const input of inputs) {
      expect(input).toContain('autoComplete="off"');
      expect(input).toContain('autoCorrect="off"');
      expect(input).toContain('spellCheck="false"');
      expect(input).toContain('autoCapitalize="characters"');
    }
  });
});

describe("the escalation link", () => {
  it("goes to the escalation form with the category, the record and a label, URL-encoded", () => {
    expect(identityEscalationHref(SUBJECT, "Chidi Okeke")).toBe(
      `/admin/escalations/new?category=identity_fraud&record=${encodeURIComponent(`/admin/people/${SUBJECT}`)}&label=${encodeURIComponent("Identity check for Chidi Okeke")}`,
    );
    const url = new URL(identityEscalationHref(SUBJECT, "Adé & Sons / Ltd?"), "https://vallo.test");
    expect(url.pathname).toBe("/admin/escalations/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({ category: "identity_fraud", record: `/admin/people/${SUBJECT}`, label: "Identity check for Adé & Sons / Ltd?" });
  });

  it("falls back to the desk and to plain words when the person or their name is not known", () => {
    expect(identityRecordPath(null)).toBe("/admin/kyc");
    expect(identityRecordPath("not-an-id/../../x")).toBe("/admin/kyc");
    expect(identityEscalationLabel(null)).toBe("Identity check for a member");
    expect(identityEscalationLabel("   ")).toBe("Identity check for a member");
    expect(identityEscalationLabel(`  Chidi \n Okeke  `)).toBe("Identity check for Chidi Okeke");
  });

  it("carries nothing but the record and the name: no number, no document id, no finding", () => {
    const markup = html({ preloaded: STOP });
    const href = /href="(\/admin\/escalations\/new[^"]*)"/.exec(markup)![1]!.replace(/&amp;/g, "&");
    expect(href).toBe(identityEscalationHref(SUBJECT, "Chidi Okeke"));
    expect(href).not.toContain(DOCUMENT);
    expect(href).not.toContain(OTHER);
    expect([...new URL(href, "https://vallo.test").searchParams.keys()]).toEqual(["category", "record", "label"]);
  });
});

describe("what a real one looks like", () => {
  it("has a list for each Nigerian document, four to six concrete lines each", () => {
    expect(ID_CHECKLISTS.map((list) => list.subtype)).toEqual(["nin_card", "passport", "drivers_licence", "voters_card"]);
    for (const list of [...ID_CHECKLISTS, GENERAL_CHECKLIST]) {
      expect(list.items.length, list.title).toBeGreaterThanOrEqual(4);
      expect(list.items.length, list.title).toBeLessThanOrEqual(6);
      expect(new Set(list.items).size).toBe(list.items.length);
      for (const item of list.items) expect(item).toMatch(/\.$/);
    }
  });

  it("says the well-known things, and that no list is proof", () => {
    const passport = checklistFor("passport", "NG").items.join(" ");
    expect(passport).toContain("two lines");
    expect(passport).toContain("printed into the page, not glued");
    const slip = checklistFor("nin_card", "NG").items.join(" ");
    expect(slip).toContain("11 digits");
    expect(slip).toContain("QR code");
    expect(CHECKLIST_CAVEAT).toContain("No list of features is proof");
    expect(text(html())).toContain(CHECKLIST_CAVEAT);
  });

  it("uses the general list for another country's ID or a kind it holds no list for", () => {
    expect(checklistFor("passport", "GH")).toBe(GENERAL_CHECKLIST);
    expect(checklistFor("national_id", "NG")).toBe(GENERAL_CHECKLIST);
    expect(checklistFor(null)).toBe(GENERAL_CHECKLIST);
    expect(text(html({ idSubtype: "voters_card" }))).toContain("What a real one looks like: Permanent voter's card");
  });
});

describe("on the desk", () => {
  const doc = (over: Partial<KycSubjectView["documents"][number]>): KycSubjectView["documents"][number] => ({
    id: DOCUMENT,
    kind: "identity",
    subtype: "passport",
    reviewStatus: "pending",
    rejectionReason: null,
    issuedOn: null,
    uploadedAt: "2026-11-14T10:00:00Z",
    reviewedAt: null,
    reviewedByName: null,
    media: "image",
    backMedia: null,
    issuingCountry: "NG",
    isResubmission: false,
    tooOld: false,
    nameOnDocument: null,
    answersRequest: false,
    ...over,
  });
  const subject: KycSubjectView = {
    userId: SUBJECT,
    displayName: "Chidi Okeke",
    applicationId: null,
    applicationReference: null,
    agentId: null,
    tier: 0,
    rungs: [],
    business: null,
    documents: [doc({}), doc({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "selfie", subtype: null })],
    payoutNameCheck: { match: true, reason: "same names", holder: "OKEKE CHIDI E", onRecord: "OKEKE CHIDI" },
    namesOnRecord: { account: "Chidi Okeke", application: null },
    identityName: "OKEKE CHIDI",
    request: null,
    consents: [],
    consentsRead: true,
  };

  it("sits in Identity at a glance with the ID and the selfie, fed the names the desk already holds", () => {
    const markup = renderToStaticMarkup(<IdentityAtAGlance subject={subject} decidable crossChecks={STOP} />);
    const glance = markup.indexOf('data-testid="identity-at-a-glance"');
    const photo = markup.indexOf(`src="/api/documents/${DOCUMENT}"`);
    const panel = markup.indexOf('data-testid="cross-checks"');
    const names = markup.indexOf("Name given at sign-up");
    expect(glance).toBeGreaterThan(-1);
    expect(photo).toBeGreaterThan(glance);
    expect(panel).toBeGreaterThan(photo);
    expect(names).toBeGreaterThan(panel);
    const words = text(markup);
    expect(words).toContain("The name on the ID matches the account name");
    expect(words).toContain("The bank account name matches the ID");
    expect(words).toContain("This ID number is on 1 other account");
    /* The existing control stays. */
    expect(words).toContain("Ask for a selfie holding their ID");
    expect(markup).toContain('data-testid="request-selfie-with-id"');
  });

  it("draws no panel for a person with no ID or selfie", () => {
    const markup = renderToStaticMarkup(<IdentityAtAGlance subject={{ ...subject, documents: [doc({ kind: "address", subtype: "utility_bill" })] }} decidable />);
    expect(markup).toBe("");
  });

  it("the passport checker makes no server call and stores nothing: its source has neither", () => {
    const source = readFileSync(join(process.cwd(), "src/app/admin/kyc/MrzChecker.tsx"), "utf8");
    expect(source).not.toMatch(/actions"|fetch\(|localStorage|sessionStorage|document\.cookie|navigator\.sendBeacon/);
    for (const file of ["mrz.ts", "consistency.ts", "formats.ts", "signals.ts"]) {
      const lib = readFileSync(join(process.cwd(), "src/lib/identity/cross-check", file), "utf8");
      expect(lib, file).not.toMatch(/fetch\(|server-only|node:|localStorage|console\./);
    }
  });
});

describe("the reviewer guide: how to tell a forged ID", () => {
  const section = GUIDE_SECTIONS.find((s) => s.id === "forged")!;
  const words = `${section?.lede ?? ""} ${section?.points.join(" ") ?? ""}`;

  it("is a section of the guide, before asking for a selfie holding the ID", () => {
    expect(section.title).toBe("How to tell a forged ID");
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(ids.indexOf("forged")).toBe(ids.indexOf("ask") - 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the panel and its levels, the checker, the by-eye list, the selfie, no outside lookup, and escalating without tipping off", () => {
    for (const part of [
      "Cross-checks lists what it found, worst first",
      "Stop means do not approve",
      "Fine means that one check found nothing wrong, not that the ID is real",
      "Not run means the check could not run",
      "This ID number is on another account",
      "The same file is on another account",
      "Saved by an editing app",
      "Check a passport's bottom lines",
      "All five check digits should pass",
      "sends nothing anywhere",
      "What a real one looks like",
      "No list is proof",
      "Ask for a selfie holding their ID",
      "There is no free public place to look up a NIN or a BVN",
      "Never type a member's ID number into any outside website, app or chat",
      "do not tell the member what you suspect",
      "Escalate to Trust and Safety",
      "Escalating a doubt is the right call, not a failure",
      "Nothing in it proves an ID is genuine",
    ]) {
      expect(words, part).toContain(part);
    }
  });

  it("uses the panel's own words for its findings, so the guide and the screen agree", () => {
    const panel = readFileSync(join(process.cwd(), "src/app/admin/kyc/CrossChecks.tsx"), "utf8");
    for (const label of ["Check a passport&apos;s bottom lines", "Check the number printed on the ID", "What a real one looks like", "Escalate to Trust and Safety", "Compare with other accounts"]) {
      expect(panel).toContain(label);
      expect(words).toContain(label.replace("&apos;", "'"));
    }
  });

  it("has no dash the founder ruled out, anywhere in the guide", () => {
    const all = GUIDE_SECTIONS.map((s) => `${s.title} ${s.lede ?? ""} ${s.points.join(" ")}`).join(" ");
    expect(all).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`));
  });
});

const ICAO = ["P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10"] as const;

function entry(props: Partial<CrossChecksProps>, wrap: "open" | "closed" | "none" = "none"): string {
  const panel = `<CrossChecks {...${JSON.stringify({ ...BASE, ...props })}} now={new Date("2026-11-15T12:00:00Z")} />`;
  const body = wrap === "none" ? panel : `<details data-testid="row" ${wrap === "open" ? "open" : ""}><summary data-testid="row-summary">A person</summary>${panel}</details>`;
  return `
    import { mount } from "@/lib/testing/browser-root";
    import { CrossChecks } from "@/app/admin/kyc/CrossChecks";
    mount(${body});
  `;
}

const calls = (page: { evaluate: <T>(fn: () => T) => Promise<T> }) => page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);

describe.skipIf(!hasBrowser && !process.env.CI)("the passport checker, in a browser", () => {
  it("answers at once for the ICAO specimen: all five digits pass, with the name and dates the zone carries", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport", names: { ...NO_NAMES, account: "Anna Eriksson" } }), actions: { runCrossChecks: `async () => ({ state: "ok", findings: [] })` } });
    try {
      await page.getByTestId("mrz-line-1").fill(ICAO[0]);
      expect(await page.getByTestId("mrz-count-1").innerText()).toBe("44 of 44");
      await page.getByTestId("mrz-line-2").fill(ICAO[1].slice(0, 20));
      expect(await page.getByTestId("mrz-incomplete").innerText()).toContain("the second has 20");
      expect(await page.getByTestId("mrz-verdict").count()).toBe(0);

      await page.getByTestId("mrz-line-2").fill(ICAO[1]);
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("All 5 check digits pass");
      expect(await page.locator('[data-testid^="mrz-digit-"][data-pass="yes"]').count()).toBe(5);
      const fields = await page.getByTestId("mrz-fields").innerText();
      for (const part of ["ERIKSSON", "ANNA MARIA", "L898902C3", "UTO", "12 August 1974", "Female", "15 April 2012"]) expect(fields).toContain(part);

      /* The same answer joins the panel's one list, with the name compared and the expired date flagged. */
      /* (Read as text content: what is fine sits in a closed group once something needs a look.) */
      const list = (await page.getByTestId("cross-checks").textContent()) ?? "";
      expect(list).toContain("Passport check digits: all 5 pass");
      expect(list).toContain("The name in the bottom lines matches the account name");
      expect(list).toContain("The ID expired on 15 April 2012");
      expect(list).toContain("The date of birth gives an age of 52");
    } finally {
      await close();
    }
  });

  it("names the digits that fail on a corrupted line, puts a Stop at the top, and clears it when the line is put right", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport" }), actions: { runCrossChecks: `async () => ({ state: "ok", findings: [] })` } });
    try {
      await page.getByTestId("mrz-line-1").fill(ICAO[0].toLowerCase());
      /* The birth year changed from 74 to 94, and nothing else. */
      await page.getByTestId("mrz-line-2").fill(ICAO[1].slice(0, 13) + "9" + ICAO[1].slice(14));
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("2 of 5 check digits fail");
      expect(await page.getByTestId("mrz-digit-date_of_birth").getAttribute("data-pass")).toBe("no");
      expect(await page.getByTestId("mrz-digit-composite").getAttribute("data-pass")).toBe("no");
      expect(await page.getByTestId("mrz-digit-document_number").getAttribute("data-pass")).toBe("yes");
      const first = page.getByTestId("cross-check-finding").first();
      expect(await first.getAttribute("data-level")).toBe("stop");
      expect(await first.innerText()).toContain("Passport check digits: 2 of 5 fail");

      await page.getByTestId("mrz-line-2").fill(ICAO[1].slice(0, 43) + "7");
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("1 of 5 check digits fails");
      expect(await page.getByTestId("mrz-digit-composite").innerText()).toContain("the zone says 7, the characters work out to 0");

      await page.getByTestId("mrz-line-2").fill(ICAO[1]);
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("All 5 check digits pass");
      expect(await page.locator('[data-testid="cross-check-finding"][data-level="stop"]').count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("says when two full lines are not a passport's, and sends nothing typed to the server", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport", subjectId: null }) });
    try {
      await page.getByTestId("mrz-line-1").fill("I" + ICAO[0].slice(1));
      await page.getByTestId("mrz-line-2").fill(ICAO[1]);
      expect(await page.getByTestId("mrz-invalid").innerText()).toContain("does not start with P");
      await page.getByTestId("mrz-line-1").fill(ICAO[0]);
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("All 5 check digits pass");
      /* Not one server action was called, with or without what was typed. */
      expect(await calls(page)).toEqual([]);
      expect(await page.evaluate(() => window.localStorage.length + window.sessionStorage.length)).toBe(0);
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the panel, in a browser", () => {
  const FOUND = `async () => ({ state: "ok", findings: [
    { key: "id_number.shared", level: "stop", title: "This ID number is on 1 other account", detail: "Escalate.", links: [{ href: "/admin/people/${OTHER}", label: "Open the other account" }] },
    { key: "account.age", level: "ok", title: "The account is 45 days old", detail: "Fine." },
  ] })`;

  it("asks the server once when it is on an open person, and shows what came back", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({}, "open"), actions: { runCrossChecks: FOUND } });
    try {
      await page.getByText("This ID number is on 1 other account").waitFor();
      expect(await calls(page)).toEqual([["runCrossChecks", SUBJECT]]);
      expect(await page.getByTestId("cross-checks-loading").count()).toBe(0);
      expect(await page.locator(`a[href="/admin/people/${OTHER}"]`).innerText()).toBe("Open the other account");
      expect(await page.getByTestId("cross-checks-counts").innerText()).toContain("1 to stop on");
    } finally {
      await close();
    }
  });

  it("does not read anybody's files while their row is closed, and reads them once when it is opened", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({}, "closed"), actions: { runCrossChecks: FOUND } });
    try {
      await page.waitForTimeout(300);
      expect(await calls(page)).toEqual([]);
      await page.getByTestId("row-summary").click();
      await page.getByText("This ID number is on 1 other account").waitFor();
      await page.getByTestId("row-summary").click();
      await page.getByTestId("row-summary").click();
      await page.waitForTimeout(200);
      expect(await calls(page)).toEqual([["runCrossChecks", SUBJECT]]);
    } finally {
      await close();
    }
  });

  it("says the checks are being read while the server has not answered", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({}), actions: { runCrossChecks: `() => new Promise(() => {})` } });
    try {
      expect(await page.getByTestId("cross-checks-loading").innerText()).toBe("Reading their files and comparing with other accounts");
    } finally {
      await close();
    }
  });

  it.each([
    ["answers that it failed", `async () => ({ state: "failed" })`],
    ["throws", `async () => { throw new Error("network") }`],
  ])("never blocks the reviewer when the server %s", async (_name, action) => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport" }), actions: { runCrossChecks: action } });
    try {
      await page.getByText("This check could not run: the comparisons with other accounts and the file checks").waitFor();
      expect(await page.getByTestId("cross-checks-loading").count()).toBe(0);
      /* The checks worked out on the page still work. */
      await page.getByTestId("mrz-line-1").fill(ICAO[0]);
      await page.getByTestId("mrz-line-2").fill(ICAO[1]);
      expect(await page.getByTestId("mrz-verdict").innerText()).toBe("All 5 check digits pass");
      expect(await page.getByTestId("cross-checks-escalate").getAttribute("href")).toBe(identityEscalationHref(SUBJECT, "Chidi Okeke"));
    } finally {
      await close();
    }
  });

  it("makes no server call for findings it was handed, or for documents with no owner", async () => {
    const handed = await mountInBrowser({ entry: entry({ preloaded: STOP }), actions: { runCrossChecks: FOUND } });
    try {
      await handed.page.getByText("The front image was saved by an editing app (Photoshop)").waitFor();
      expect(await calls(handed.page)).toEqual([]);
    } finally {
      await handed.close();
    }
    const orphan = await mountInBrowser({ entry: entry({ subjectId: null }), actions: { runCrossChecks: FOUND } });
    try {
      await orphan.page.getByTestId("cross-checks-no-owner").waitFor();
      expect(await calls(orphan.page)).toEqual([]);
    } finally {
      await orphan.close();
    }
  });

  it("judges the shape of a typed number as it is typed, without sending it anywhere", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ preloaded: { state: "ok", findings: [] } }) });
    try {
      const shape = page.getByTestId("id-number-shape");
      expect(await shape.innerText()).toBe("The genuine number is 11 digits, no letters.");
      expect(await page.getByTestId("id-number-compare").isDisabled()).toBe(true);
      await page.getByTestId("id-number-input").fill("1234 5678 90");
      expect(await shape.getAttribute("data-shape")).toBe("unusual");
      expect(await shape.innerText()).toContain("a NIN is 11 digits, and this has 10");
      expect(await page.getByTestId("cross-checks").innerText()).toContain("NIN: the shape is unusual");
      await page.getByTestId("id-number-input").fill("1234 5678 901");
      expect(await shape.getAttribute("data-shape")).toBe("right");
      expect(await shape.innerText()).toContain("That proves nothing by itself");
      /* Another kind of document has another shape. */
      await page.getByTestId("id-number-kind").selectOption("passport");
      expect(await shape.getAttribute("data-shape")).toBe("unusual");
      await page.getByTestId("id-number-input").fill("a12345678");
      expect(await shape.getAttribute("data-shape")).toBe("right");
      expect(await calls(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("compares a number on one press, shows the answer in the list, and clears the number from the box", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ preloaded: { state: "ok", findings: [{ key: "id_number.shared", level: "look", notRun: true, title: "The ID number has not been compared with other accounts yet", detail: "Type it below." }] } }),
      actions: {
        compareIdNumber: `async () => ({ ok: true, findings: [{ key: "id_number.shared", level: "stop", title: "This ID number is on 2 other accounts", detail: "Escalate.", links: [{ href: "/admin/people/${OTHER}", label: "Open other account 1" }] }] })`,
      },
    });
    try {
      expect(await page.getByTestId("cross-checks").innerText()).toContain("The ID number has not been compared with other accounts yet");
      await page.getByTestId("id-number-input").fill("1234 5678 901");
      await page.getByTestId("id-number-compare").click();
      await page.getByText("This ID number is on 2 other accounts").waitFor();
      expect(await calls(page)).toEqual([["compareIdNumber", { documentId: DOCUMENT, kind: "nin", number: "1234 5678 901" }]]);
      /* The server's answer replaces the line that asked for the number. */
      const list = await page.getByTestId("cross-checks").innerText();
      expect(list).not.toContain("has not been compared");
      expect(await page.getByTestId("cross-check-finding").first().getAttribute("data-level")).toBe("stop");
      expect(await page.getByTestId("id-number-input").inputValue()).toBe("");
      expect(await page.getByTestId("id-number-compared").innerText()).toContain("the number has been cleared from this box");
      expect(await page.content()).not.toContain("1234 5678 901");
    } finally {
      await close();
    }
  });

  it("says in plain words when a number could not be compared, and keeps it for another try", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ preloaded: { state: "ok", findings: [] } }),
      actions: { compareIdNumber: `async () => ({ ok: false, error: "Comparing ID numbers is not set up on this server yet. Nothing was saved. Carry on with the other checks." })` },
    });
    try {
      await page.getByTestId("id-number-input").fill("12345678901");
      await page.getByTestId("id-number-compare").click();
      expect(await page.getByTestId("id-number-problem").innerText()).toContain("not set up on this server yet");
      expect(await page.getByTestId("id-number-input").inputValue()).toBe("12345678901");
    } finally {
      await close();
    }
  });

  it("counts the ticks on the by-eye list as the reviewer's own working notes", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport", preloaded: { state: "ok", findings: [] } }) });
    try {
      await page.locator('[data-testid="cross-checks-checklist"] > summary').click();
      expect(await page.getByTestId("checklist-count").innerText()).toContain("0 of 6 ticked");
      await page.getByTestId("checklist-tick").nth(0).check();
      await page.getByTestId("checklist-tick").nth(3).check();
      expect(await page.getByTestId("checklist-count").innerText()).toContain("2 of 6 ticked");
      await page.getByTestId("checklist-tick").nth(0).uncheck();
      expect(await page.getByTestId("checklist-count").innerText()).toContain("1 of 6 ticked");
      expect(await page.getByTestId("checklist-caveat").innerText()).toContain("No list of features is proof");
      expect(await calls(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("shows each typed line whole below its box, in elevens, for a screen too narrow for 44 characters", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ idSubtype: "passport", preloaded: STOP }), viewport: { width: 390, height: 844 } });
    try {
      expect(await page.getByTestId("mrz-echo-1").count()).toBe(0);
      await page.getByTestId("mrz-line-1").fill(ICAO[0].toLowerCase());
      await page.getByTestId("mrz-line-2").fill(ICAO[1]);
      await page.getByTestId("mrz-verdict").waitFor();
      const groups = await page.locator('[data-testid="mrz-echo-1"] > span').allInnerTexts();
      expect(groups).toEqual([ICAO[0].slice(0, 11), ICAO[0].slice(11, 22), ICAO[0].slice(22, 33), ICAO[0].slice(33)]);
      expect((await page.getByTestId("mrz-echo-2").innerText()).replace(/\s+/g, "")).toBe(ICAO[1]);
    } finally {
      await close();
    }
  });
});
