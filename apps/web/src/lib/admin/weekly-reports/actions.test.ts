import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type Script } from "@/lib/testing/fake-supabase";

/**
 * THE WEEKLY REPORT'S WRITES: the gate, ownership, the Saturday opening, the
 * late flag, what can be edited after submitting, proof rules, and who may
 * review or reopen. These check the SQL each action issues, never a database.
 */

const door = vi.hoisted(() => ({ requireDeskUser: vi.fn() }));
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => true) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/my-desk/access", () => ({
  requireDeskUser: door.requireDeskUser,
  doorWords: (state: string) => (state === "signed-out" ? "Sign in with your operations account to continue." : "My Desk is for Vallo staff."),
}));
vi.mock("@/lib/admin/audit", () => ({ writeAudit: audit.writeAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

const { saveWeeklyReportDraft, submitWeeklyReport, readMyWeeklyReport, addProofLink, uploadProofFile, removeProof, reviewReport, reopenReport } = await import("./actions");

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REPORT = "11111111-1111-4111-8111-111111111111";
const WEEK = "2026-11-09";
const TABLE = "staff_weekly_reports";
const MB = 1024 * 1024;

const SATURDAY = "2026-11-14T10:00:00Z";
const MONDAY_ON_TIME = "2026-11-16T10:59:00Z"; // 11:59 Lagos
const MONDAY_LATE = "2026-11-16T11:01:00Z"; // 12:01 Lagos
const FRIDAY_BEFORE = "2026-11-13T11:00:00Z";

type Who = { isAdmin?: boolean; isSuperAdmin?: boolean; position?: string | null };

function signIn(db: unknown, who: Who = {}) {
  door.requireDeskUser.mockResolvedValue({
    state: "ok",
    db,
    userClient: db,
    who: { userId: ME, isAdmin: who.isAdmin ?? false, isSuperAdmin: who.isSuperAdmin ?? false, position: who.position ?? "social_media_manager", scopes: ["social_media"] },
  });
}

function dbRow(over: Record<string, unknown> = {}) {
  return {
    id: REPORT, author_id: ME, position: "social_media_manager", week_start: WEEK, status: "draft", accomplishments: "", numbers: [], blockers: "", next_week: "",
    proofs: [], submitted_at: null, is_late: false, reviewed_by: null, reviewed_at: null, review_note: null, created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T10:00:00Z", ...over,
  };
}

function storage() {
  const upload = vi.fn(async (_path: string, ..._rest: unknown[]) => ({ error: null }));
  const remove = vi.fn(async (_paths: string[]) => ({ error: null }));
  return { upload, remove, api: { from: () => ({ upload, remove, createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed.example.com/x" } })) }) } };
}

function setup(script: Script, who?: Who) {
  const fake = fakeSupabase(script);
  const store = storage();
  const db = { ...fake.client, storage: store.api };
  signIn(db, who);
  return { fake, store };
}

const INPUT = { week: WEEK, accomplishments: "Posted twelve reels and two stories.", numbers: [], blockers: "", nextWeek: "More reels." };
const mine = (over: Record<string, unknown> = {}): Script => ({ [TABLE]: { select: { data: dbRow(over) }, update: { data: [{ id: REPORT }] }, insert: { data: { id: REPORT } } } });
const none: Script = { [TABLE]: { select: { data: null }, insert: { data: { id: REPORT } }, update: { data: [{ id: REPORT }] } } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(SATURDAY));
  door.requireDeskUser.mockReset();
  audit.writeAudit.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("the gate", () => {
  it("refuses a signed-out or non-staff caller on every action without writing", async () => {
    door.requireDeskUser.mockResolvedValue({ state: "signed-out" });
    expect((await saveWeeklyReportDraft(INPUT)).ok).toBe(false);
    expect((await submitWeeklyReport(INPUT)).ok).toBe(false);
    expect((await readMyWeeklyReport(WEEK)).ok).toBe(false);
    expect((await addProofLink(WEEK, { url: "https://a.example.com", caption: "" })).ok).toBe(false);
    expect((await uploadProofFile(new FormData())).ok).toBe(false);
    expect((await removeProof(WEEK, "abcd1234")).ok).toBe(false);
    expect((await reviewReport(REPORT, "")).ok).toBe(false);
    expect((await reopenReport(REPORT, "please fix")).ok).toBe(false);
    expect(audit.writeAudit).not.toHaveBeenCalled();
    door.requireDeskUser.mockResolvedValue({ state: "not-admin" });
    expect((await saveWeeklyReportDraft(INPUT)).ok).toBe(false);
  });
});

describe("saveWeeklyReportDraft", () => {
  it("refuses before Saturday 00:00 Lagos and writes nothing", async () => {
    vi.setSystemTime(new Date(FRIDAY_BEFORE));
    const { fake } = setup(none);
    const r = await saveWeeklyReportDraft(INPUT);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/opens Sat 14 Nov 2026/);
    expect(fake.wrote()).toBe(false);
  });

  it("opens exactly on Saturday midnight Lagos", async () => {
    vi.setSystemTime(new Date("2026-11-13T23:00:00Z"));
    const { fake } = setup(none);
    expect((await saveWeeklyReportDraft(INPUT)).ok).toBe(true);
    expect(fake.of(TABLE, "insert")).toHaveLength(1);
  });

  it("creates a draft owned by the caller, with their position, and audits it", async () => {
    const { fake } = setup(none);
    const r = await saveWeeklyReportDraft(INPUT);
    expect(r.ok).toBe(true);
    const insert = fake.of(TABLE, "insert")[0]!;
    expect(insert.values).toMatchObject({ author_id: ME, position: "social_media_manager", week_start: WEEK, status: "draft", accomplishments: INPUT.accomplishments });
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorId: ME, action: "weekly_report.create", entityType: "staff_weekly_report" }));
  });

  it("looks the report up by the caller's own id, never another person's", async () => {
    const { fake } = setup(mine());
    await saveWeeklyReportDraft(INPUT);
    expect(fake.of(TABLE, "select")[0]!.filters).toContainEqual(["eq", "author_id", ME]);
    expect(fake.of(TABLE, "update")[0]!.filters).toContainEqual(["eq", "author_id", ME]);
  });

  it("rejects bad input before any read or write", async () => {
    const { fake } = setup(none);
    for (const bad of [{ ...INPUT, week: "2026-11-10" }, { ...INPUT, accomplishments: "x".repeat(5001) }, { ...INPUT, numbers: [{ label: "", value: 1 }] }]) {
      expect((await saveWeeklyReportDraft(bad)).ok).toBe(false);
    }
    expect(fake.calls).toHaveLength(0);
  });

  it("saves a submitted report in place, keeps its status, never touches proofs, and refuses a reviewed one", async () => {
    const submitted = setup(mine({ status: "submitted", submitted_at: SATURDAY }));
    expect((await saveWeeklyReportDraft(INPUT)).ok).toBe(true);
    const update = submitted.fake.of(TABLE, "update")[0]!;
    expect(update.values).not.toHaveProperty("status");
    expect(update.values).not.toHaveProperty("proofs");
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "weekly_report.edit" }));

    const reviewed = setup(mine({ status: "reviewed", submitted_at: SATURDAY }));
    const r = await saveWeeklyReportDraft(INPUT);
    expect(r.ok).toBe(false);
    expect(reviewed.fake.wrote()).toBe(false);
  });

  it("says the tables are not set up rather than failing opaquely", async () => {
    setup({ [TABLE]: { select: { error: { code: "42P01", message: "relation does not exist" } } } });
    const r = await saveWeeklyReportDraft(INPUT);
    expect(!r.ok && r.error).toMatch(/not set up/);
  });
});

describe("submitWeeklyReport", () => {
  it("submits on time with is_late false", async () => {
    vi.setSystemTime(new Date(MONDAY_ON_TIME));
    const { fake } = setup(none);
    const r = await submitWeeklyReport(INPUT);
    expect(r.ok && r.data.late).toBe(false);
    expect(fake.of(TABLE, "insert")[0]!.values).toMatchObject({ status: "submitted", is_late: false, author_id: ME });
  });

  it("saves a report after Monday 12:00 Lagos and flags it late", async () => {
    vi.setSystemTime(new Date(MONDAY_LATE));
    const { fake } = setup(mine({ status: "draft" }));
    const r = await submitWeeklyReport(INPUT);
    expect(r.ok && r.data.late).toBe(true);
    expect(fake.of(TABLE, "update")[0]!.values).toMatchObject({ status: "submitted", is_late: true });
  });

  it("refuses before Saturday, with nothing to say, or when already submitted or reviewed", async () => {
    vi.setSystemTime(new Date(FRIDAY_BEFORE));
    const early = setup(none);
    expect((await submitWeeklyReport(INPUT)).ok).toBe(false);
    expect(early.fake.wrote()).toBe(false);

    vi.setSystemTime(new Date(SATURDAY));
    const empty = setup(none);
    const blank = await submitWeeklyReport({ ...INPUT, accomplishments: "  " });
    expect(blank.ok).toBe(false);
    expect(empty.fake.wrote()).toBe(false);

    for (const status of ["submitted", "reviewed"]) {
      const s = setup(mine({ status, submitted_at: SATURDAY }));
      expect((await submitWeeklyReport(INPUT)).ok).toBe(false);
      expect(s.fake.wrote()).toBe(false);
    }
  });

  it("keeps the original late flag when a reopened report is sent again", async () => {
    vi.setSystemTime(new Date("2026-11-16T09:00:00Z"));
    const { fake } = setup(mine({ status: "reopened", submitted_at: "2026-11-17T09:00:00Z", is_late: true }));
    await submitWeeklyReport(INPUT);
    expect(fake.of(TABLE, "update")[0]!.values).toMatchObject({ is_late: true });
  });
});

describe("readMyWeeklyReport", () => {
  it("returns the caller's report and whether its form has opened", async () => {
    setup(mine());
    const r = await readMyWeeklyReport(WEEK);
    expect(r.ok && r.data.open).toBe(true);
    expect(r.ok && r.data.report?.id).toBe(REPORT);
    vi.setSystemTime(new Date(FRIDAY_BEFORE));
    const early = await readMyWeeklyReport(WEEK);
    expect(early.ok && early.data.open).toBe(false);
    expect((await readMyWeeklyReport("2026-11-10")).ok).toBe(false);
  });
});

describe("proof", () => {
  it("keeps only https links and writes them to the caller's own report", async () => {
    const { fake } = setup(mine());
    for (const url of ["http://x.example.com", "javascript:alert(1)", "https://u:p@x.example.com", ""]) {
      expect((await addProofLink(WEEK, { url, caption: "" })).ok).toBe(false);
    }
    expect(fake.wrote()).toBe(false);
    const ok = await addProofLink(WEEK, { url: "https://www.instagram.com/p/abc", caption: "Reel" });
    expect(ok.ok).toBe(true);
    const update = fake.of(TABLE, "update")[0]!;
    expect((update.values as { proofs: { kind: string; url: string }[] }).proofs[0]).toMatchObject({ kind: "link", url: "https://www.instagram.com/p/abc", caption: "Reel" });
    expect(update.filters).toContainEqual(["eq", "author_id", ME]);
  });

  it("creates the draft when proof is the first thing added", async () => {
    let reads = 0;
    const { fake } = setup({
      [TABLE]: { select: () => ({ data: reads++ === 0 ? null : dbRow() }), insert: { data: { id: REPORT } }, update: { data: [{ id: REPORT }] } },
    });
    expect((await addProofLink(WEEK, { url: "https://a.example.com", caption: "" })).ok).toBe(true);
    expect(fake.of(TABLE, "insert")[0]!.values).toMatchObject({ author_id: ME, status: "draft", week_start: WEEK });
    expect(fake.of(TABLE, "update")).toHaveLength(1);
  });

  it("refuses proof before Saturday and on a reviewed report", async () => {
    vi.setSystemTime(new Date(FRIDAY_BEFORE));
    const early = setup(none);
    expect((await addProofLink(WEEK, { url: "https://a.example.com", caption: "" })).ok).toBe(false);
    expect(early.fake.wrote()).toBe(false);
    vi.setSystemTime(new Date(SATURDAY));
    const reviewed = setup(mine({ status: "reviewed", submitted_at: SATURDAY }));
    expect((await addProofLink(WEEK, { url: "https://a.example.com", caption: "" })).ok).toBe(false);
    expect(reviewed.fake.wrote()).toBe(false);
  });

  it("refuses a 21st proof", async () => {
    const proofs = Array.from({ length: 20 }, (_, i) => ({ id: `link-${i}`, kind: "link", url: `https://a.example.com/${i}`, caption: "" }));
    const { fake } = setup(mine({ proofs }));
    expect((await addProofLink(WEEK, { url: "https://b.example.com", caption: "" })).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
  });

  function form(file: File | null, caption = "") {
    const f = new FormData();
    f.set("week", WEEK);
    if (file) f.set("file", file);
    f.set("caption", caption);
    return f;
  }

  it("refuses a wrong type or an oversize file before uploading", async () => {
    const { fake, store } = setup(mine());
    expect((await uploadProofFile(form(null))).ok).toBe(false);
    expect((await uploadProofFile(form(new File(["x"], "a.zip", { type: "application/zip" })))).ok).toBe(false);
    const bigImage = new File(["x"], "a.png", { type: "image/png" });
    Object.defineProperty(bigImage, "size", { value: 10 * MB + 1 });
    expect((await uploadProofFile(form(bigImage))).ok).toBe(false);
    const bigPdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    Object.defineProperty(bigPdf, "size", { value: 10 * MB + 1 });
    expect((await uploadProofFile(form(bigPdf))).ok).toBe(false);
    const bigVideo = new File(["x"], "a.mp4", { type: "video/mp4" });
    Object.defineProperty(bigVideo, "size", { value: 100 * MB + 1 });
    expect((await uploadProofFile(form(bigVideo))).ok).toBe(false);
    expect(store.upload).not.toHaveBeenCalled();
    expect(fake.wrote()).toBe(false);
  });

  it("uploads into the caller's own folder and records the path on the report", async () => {
    const { fake, store } = setup(mine());
    const r = await uploadProofFile(form(new File(["png"], "Screenshot 1.png", { type: "image/png" }), "Insights"));
    expect(r.ok).toBe(true);
    const path = store.upload.mock.calls[0]![0] as string;
    expect(path.startsWith(`${ME}/${WEEK}/`)).toBe(true);
    const proofs = (fake.of(TABLE, "update")[0]!.values as { proofs: { kind: string; path: string; name: string }[] }).proofs;
    expect(proofs[0]).toMatchObject({ kind: "file", path, name: "Screenshot 1.png" });
  });

  it("removes the uploaded file again when the report will not take it", async () => {
    const { store } = setup({ [TABLE]: { select: { data: dbRow() }, update: { data: [] } } });
    const r = await uploadProofFile(form(new File(["png"], "a.png", { type: "image/png" })));
    expect(r.ok).toBe(false);
    expect(store.remove).toHaveBeenCalledTimes(1);
  });

  it("removes proof only while the report is a draft or reopened", async () => {
    const path = `${ME}/${WEEK}/abc-123.png`;
    const proofs = [{ id: "file-1", kind: "file", path, name: "a.png", contentType: "image/png", caption: "" }, { id: "link-1", kind: "link", url: "https://a.example.com", caption: "" }];
    for (const status of ["draft", "reopened"]) {
      const { fake, store } = setup(mine({ status, proofs, submitted_at: status === "reopened" ? SATURDAY : null }));
      expect((await removeProof(WEEK, "file-1")).ok).toBe(true);
      expect((fake.of(TABLE, "update")[0]!.values as { proofs: unknown[] }).proofs).toHaveLength(1);
      expect(store.remove).toHaveBeenCalledWith([path]);
    }
    for (const status of ["submitted", "reviewed"]) {
      const { fake, store } = setup(mine({ status, proofs, submitted_at: SATURDAY }));
      expect((await removeProof(WEEK, "file-1")).ok).toBe(false);
      expect(fake.wrote()).toBe(false);
      expect(store.remove).not.toHaveBeenCalled();
    }
  });

  it("ignores a stored file proof whose path is not in the caller's folder", async () => {
    const stray = [{ id: "file-9", kind: "file", path: `${OTHER}/${WEEK}/theirs.png`, caption: "" }];
    const { fake, store } = setup(mine({ proofs: stray }));
    expect((await removeProof(WEEK, "file-9")).ok).toBe(false);
    expect(fake.wrote()).toBe(false);
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe("review and reopen", () => {
  const submitted = (over: Record<string, unknown> = {}) => ({ [TABLE]: { select: { data: dbRow({ author_id: OTHER, status: "submitted", submitted_at: SATURDAY, ...over }) }, update: { data: [{ id: REPORT }] } } });

  it("is for reviewers only: a CFO, a plain staff member and an unnamed member are refused with no write", async () => {
    for (const who of [{ position: "cfo" }, { position: "social_media_manager" }, { position: null }]) {
      const { fake } = setup(submitted(), who);
      expect((await reviewReport(REPORT, "good")).ok).toBe(false);
      expect((await reopenReport(REPORT, "please change")).ok).toBe(false);
      expect(fake.wrote()).toBe(false);
    }
  });

  it("lets an admin, a super admin and the COO review a submitted report, recording who and when", async () => {
    for (const who of [{ isAdmin: true, position: null }, { isSuperAdmin: true, position: null }, { position: "coo" }]) {
      const { fake } = setup(submitted(), who);
      const r = await reviewReport(REPORT, "  Well done  ");
      expect(r.ok).toBe(true);
      const update = fake.of(TABLE, "update")[0]!;
      expect(update.values).toMatchObject({ status: "reviewed", reviewed_by: ME, review_note: "Well done" });
      expect(update.filters).toContainEqual(["eq", "status", "submitted"]);
    }
  });

  it("will not review a draft, a bad id, an over-long note or the reviewer's own report", async () => {
    const draft = setup(submitted({ status: "draft", submitted_at: null }), { isAdmin: true });
    expect((await reviewReport(REPORT, "")).ok).toBe(false);
    expect(draft.fake.wrote()).toBe(false);
    const bad = setup(submitted(), { isAdmin: true });
    expect((await reviewReport("not-a-uuid", "")).ok).toBe(false);
    expect((await reviewReport(REPORT, "x".repeat(2001))).ok).toBe(false);
    expect(bad.fake.wrote()).toBe(false);
    const own = setup(submitted({ author_id: ME }), { isAdmin: true });
    const r = await reviewReport(REPORT, "");
    expect(!r.ok && r.error).toMatch(/Another reviewer/);
    expect(own.fake.wrote()).toBe(false);
  });

  it("reopens a submitted or reviewed report with a reason, and only then", async () => {
    for (const status of ["submitted", "reviewed"]) {
      const { fake } = setup(submitted({ status }), { position: "coo" });
      expect((await reopenReport(REPORT, "no")).ok).toBe(false);
      expect((await reopenReport(REPORT, "Add the proof for the Lekki post")).ok).toBe(true);
      expect(fake.of(TABLE, "update")[0]!.values).toMatchObject({ status: "reopened", reviewed_by: null, reviewed_at: null, review_note: "Add the proof for the Lekki post" });
    }
    const draft = setup(submitted({ status: "draft", submitted_at: null }), { isAdmin: true });
    expect((await reopenReport(REPORT, "Add the proof please")).ok).toBe(false);
    expect(draft.fake.wrote()).toBe(false);
  });
});
