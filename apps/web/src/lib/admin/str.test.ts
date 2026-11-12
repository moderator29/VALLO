import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDictionary } from "@vallo/i18n";
import { describe, expect, it } from "vitest";
import { holdFromRows } from "../security/account-hold";
import { holdReasonOf, notMeConsequence } from "../security/not-me-copy";
import {
  considerStrHref,
  lagosLocalToIso,
  lagosTime,
  strCaseFrom,
  strCasesFrom,
  strNextStep,
  strPrefill,
  strRegisterFrom,
  strReleasesFrom,
  strResultText,
} from "./str";

const copy = getDictionary("en").complianceStr;
const ID = "11111111-1111-4111-8111-111111111111";

const row = {
  id: ID,
  source_kind: "transaction",
  source_id: "22222222-2222-4222-8222-222222222222",
  subject_id: null,
  grounds: "Three payments in a week from different cards.",
  opened_by: "a",
  opened_at: "2026-09-24T10:00:00Z",
  due_at: "2026-09-25T10:00:00Z",
  state: "awaiting_approval",
  overdue: false,
  decision_id: "d",
  decision: "file",
  reasons: "Structuring below the threshold.",
  decided_by: "a",
  decided_at: "2026-09-24T11:00:00Z",
  approved: null,
  approver_id: null,
  links: [{ kind: "transaction", ref: "x" }, { junk: true }],
};

describe("SCUML item 6: reading the STR desk", () => {
  it("reads a case, its decision and its links", () => {
    const c = strCaseFrom(row);
    expect(c?.sourceKind).toBe("transaction");
    expect(c?.decision).toEqual({
      id: "d",
      decision: "file",
      reasons: "Structuring below the threshold.",
      decidedBy: "a",
      decidedAt: "2026-09-24T11:00:00Z",
      approved: null,
      approverId: null,
    });
    expect(c?.links).toEqual([{ kind: "transaction", ref: "x" }]);
    expect(c && strNextStep(c)).toBe("approve");
  });

  it("drops a row it cannot read, and a failed read is null, never an empty desk", () => {
    expect(strCaseFrom({ ...row, source_kind: "gossip" })).toBeNull();
    expect(strCaseFrom({ ...row, state: "done" })).toBeNull();
    expect(strCasesFrom(null)).toBeNull();
    expect(strCasesFrom([row])).toHaveLength(1);
    /* A row that could not be read makes the whole read a failure. */
    expect(strCasesFrom([row, 7])).toBeNull();
    expect(strRegisterFrom("nope")).toBeNull();
    expect(strRegisterFrom([{ case_id: ID }])).toBeNull();
    expect(strReleasesFrom([{ release_id: "r", case_id: ID, note: "Cleared.", requested_by: "a", requested_at: "2026-09-24T12:00:00Z" }])).toHaveLength(1);
    expect(strReleasesFrom([{ release_id: "r" }])).toBeNull();
    expect(
      strRegisterFrom([{ case_id: ID, goaml_reference: "G-1", filed_at: "2026-09-24T12:00:00Z", recorded_by: "b", decided_by: "a", approver_id: "b" }]),
    ).toEqual([{ caseId: ID, goamlReference: "G-1", filedAt: "2026-09-24T12:00:00Z", recordedBy: "b", decidedBy: "a", approverId: "b" }]);
  });

  it("offers one next step per state", () => {
    expect(strNextStep({ state: "open" })).toBe("decide");
    expect(strNextStep({ state: "to_file" })).toBe("record");
    expect(strNextStep({ state: "filed" })).toBe("none");
    expect(strNextStep({ state: "not_filed" })).toBe("none");
  });

  it("says every database answer in the desk's words", () => {
    expect(strResultText("same_person", copy)).toEqual({ ok: false, text: copy.results.same_person });
    expect(strResultText({ status: "decided" }, copy)).toEqual({ ok: true, text: copy.results.decided });
    expect(strResultText({ status: "held", until: "2026-09-26T10:00:00Z" }, copy).text).toMatch(/Sat,? 26 Sep/);
    expect(strResultText("something new", copy)).toEqual({ ok: false, text: copy.results.failed });
    expect(lagosTime("not a date")).toBe("");
    expect(strResultText("conflicted", copy)).toEqual({ ok: false, text: copy.results.conflicted });
    expect(strResultText("released", copy)).toEqual({ ok: true, text: copy.results.released });
    /* "Filed at" is Lagos time whatever the browser's zone. */
    expect(lagosLocalToIso("2026-09-24T09:30")).toBe("2026-09-24T08:30:00.000Z");
    expect(lagosLocalToIso("yesterday")).toBeNull();
  });

  it("links in from the console, and a prefill takes nothing that is not an id", () => {
    expect(considerStrHref("risk_alert", ID)).toBe(`/admin/compliance?tab=str&from=risk_alert&id=${ID}`);
    expect(strPrefill({ from: "report", id: ID })).toEqual({ from: "report", id: ID, subject: "" });
    expect(strPrefill({ from: "nonsense", id: "<script>" })).toEqual({ from: "person", id: "", subject: "" });
    /* The sanctions lane's hand-off (SCUML item 8). */
    expect(strPrefill({ tab: "str", person: ID, from: "sanctions:hit-42" })).toEqual({
      from: "sanctions_hit",
      id: "hit-42",
      subject: ID,
    });
    expect(strPrefill({ person: ID })).toEqual({ from: "person", id: ID, subject: "" });
  });
});

/*
 * The LIVE migration for SCUML item 6 (20260924173000 to 173200 were never
 * applied; see docs/db/SUPERSEDED_MIGRATIONS.md). readFileSync throws
 * when it is missing, so a renamed or moved file fails the suite.
 */
const LIVE_6 = join(__dirname, "../../../../../supabase/migrations/20260929002643_scuml_6_str_desk_and_hold_claims_on_live_tables.sql");

describe("SCUML item 6: what the database holds to", () => {
  const sql = readFileSync(
    LIVE_6,
    "utf8",
  );

  it("names its checklist items", () => {
    expect(sql).toContain("SCUML item 6");
    expect(sql).toContain("SCUML item 19");
  });

  it("needs a second person to approve, in the function and by trigger", () => {
    expect(sql).toContain("if d.decided_by = actor then return 'same_person'; end if;");
    expect(sql).toContain("create trigger str_approvals_second_person");
  });

  it("is append-only, and outlives an account's deletion", () => {
    expect(sql).toContain("before update or delete on private.%I");
    expect(sql).not.toMatch(/references auth\.users/);
  });

  it("tells staff, never the subject, and stops money only by a staff-placed hold", () => {
    expect(sql).toContain("where ur.role in ('admin'::public.app_role, 'super_admin'::public.app_role)");
    expect(sql).not.toMatch(/private\.notify\(\s*v_subject/);
    expect(sql.match(/insert into public\.account_money_holds/g)?.length).toBe(1);
    expect(sql).toContain("create or replace function public.str_place_hold");
  });

  it("writes the one neutral reason, which reads as a hold with no cause anywhere a member looks", () => {
    const fixes = readFileSync(
      LIVE_6,
      "utf8",
    );
    /* Live: the row is written from the desks' claims, always as 'plain'. */
    expect(fixes).toContain("values (p_user, v_latest, 'plain', now());");
    expect(fixes).toContain("set hold_until = v_latest, reason = 'plain' where user_id = p_user;");
    expect(fixes).not.toContain("'staff_review'");
    /* Behaviour: the row the desk writes, read the way the wallet and the
       not-me panel read it. */
    const hold = holdFromRows([{ hold_until: "2099-01-01T00:00:00Z", reason: "plain" }], Date.parse("2026-09-24T10:00:00Z"));
    expect(hold).toEqual({ state: "held", until: "2099-01-01T00:00:00Z", reason: "plain" });
    const notMe = getDictionary("en").platform.notMe;
    const said = notMeConsequence(
      { holdUntil: "2099-01-01T00:00:00Z", holdPlaced: false, holdExtended: false, holdReason: holdReasonOf("plain"), rateLimited: false },
      notMe,
    );
    expect(said).not.toMatch(/review|staff|compliance|report|suspic|checked|investigat/i);
  });

  it("keeps a conflicted staff member out, dates no filing before its approval, and caps the hold (173100)", () => {
    const fixes = readFileSync(
      LIVE_6,
      "utf8",
    );
    expect(fixes.match(/if private\.str_is_party\([^)]*actor\) then return/g)?.length).toBeGreaterThanOrEqual(6);
    expect(fixes).toContain("and not private.str_is_party(p_case, ur.user_id)");
    expect(fixes.match(/where not private\.str_is_party\(/g)?.length).toBe(2);
    expect(fixes).toContain("if p_filed_at < v_approved_at then return 'before_approval'; end if;");
    expect(fixes).toContain("before truncate on private.%I for each statement");
    expect(fixes).toContain("v_until timestamptz := now() + private.str_hold_length();");
    /* Live: a release that finds another hold still in force is answered other_hold. */
    expect(fixes).toContain("v_outcome := 'other_hold';");
    expect(fixes).toContain("private.str_overdue(c.id)");
    expect(fixes).toContain("where private.str_overdue(x.id)");
  });

  it("holds through one shared claims model, and a release clears only this desk's claim (173200)", () => {
    const own = readFileSync(
      LIVE_6,
      "utf8",
    );
    expect(own).toContain("create table if not exists private.hold_claims");
    expect(own).toContain("owner    text not null check (owner in ('str', 'sanctions'))");
    expect(own).toContain("v_until := private.hold_claim_set(c.subject_id, 'str', v_until, actor);");
    expect(own).toContain("elsif v_row.hold_until > now() and v_row.reason <> 'plain' then");
    expect(own).toContain("if r.requested_by = actor then return 'same_person'; end if;");
    /* A live non-plain hold is not touched; the claims wait, and the job takes over. */
    expect(own).not.toMatch(/reason <> 'plain' then\s+if v_latest/);
    expect(own).toContain("create or replace function private.hold_claims_sweep()");
    expect(own).toContain("grant execute on function public.hold_claims_sweep() to service_role;");
    expect(own).toContain("select cron.schedule('vallo_hold_claims_sweep', '* * * * *', 'select private.hold_claims_sweep();');");
    /* A plain freeze this model did not write, later than every claim, is left alone. */
    expect(own).toContain("raise warning 'hold_claims_sweep: % could not be recomputed: %', u, sqlerrm;");
    /* Clear, then look, in two statements (one snapshot would see the old row). */
    expect(own).toContain("perform private.hold_claim_clear(r.user_id, 'str');");
    expect(own).toContain("where h.user_id = r.user_id and h.owner = 'str' and h.until > now());");
    expect(own).toContain("v_absorbed := v_row.hold_until;");
  });
});
