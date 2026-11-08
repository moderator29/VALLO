import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";

import { requireConsole } from "@/lib/admin/guard";
import { RESTRICTION_LABEL, type RestrictionKind } from "@/lib/admin/cases/model";
import { isNotLive } from "@/lib/features/degrade";
import { reportReadFault } from "@/lib/observability/read-error";

import { MemberStandingControls } from "./MemberStandingControls";

type Row = { id: string; kind: RestrictionKind; reason: string; starts_at: string; ends_at: string | null; lifted_at: string | null; case_id: string | null };

/**
 * Trust and Safety on the member's file: their restrictions (live and past)
 * and their open cases, with Restrict and Lift. The read and every write run
 * on the staff member's own session, so the database decides (RLS on
 * `member_restrictions`, `admin_restrict_member`'s scope check).
 */
export async function MemberStanding({ userId, when }: { userId: string; when: (iso: string | null) => string }) {
  const access = await requireConsole();
  if (access.state !== "console") return null;
  const db = access.supabase as unknown as SupabaseClient;
  const [rows, cases] = await Promise.all([
    db.from("member_restrictions").select("id, kind, reason, starts_at, ends_at, lifted_at, case_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    db.from("moderation_cases").select("id, number, status").eq("subject_user_id", userId).not("status", "in", "(resolved,closed)").limit(10),
  ]);
  if (rows.error && isNotLive(rows.error)) return null;
  if (rows.error) await reportReadFault("read.admin.member-standing", rows.error);
  if (cases.error && !isNotLive(cases.error)) await reportReadFault("read.admin.member-standing", cases.error);
  const list = (rows.data ?? []) as Row[];
  const open = (cases.data ?? []) as { id: string; number: number; status: string }[];
  const now = Date.now();
  return (
    <section className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card" aria-label="Standing" data-testid="person-standing">
      <div className="flex items-center justify-between gap-sm">
        <h2 className="nf-h4">Standing</h2>
        <MemberStandingControls userId={userId} />
      </div>
      {open.length ? (
        <p className="mt-row nf-body-sm">
          Open cases:{" "}
          {open.map((c, i) => (
            <span key={c.id}>
              {i ? ", " : ""}
              <Link className="underline underline-offset-2" href={`/admin/cases/${c.id}`}>
                VC-{String(c.number).padStart(6, "0")}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {list.length === 0 ? (
        <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">No restrictions on record.</p>
      ) : (
        <ul className="mt-row space-y-inline">
          {list.map((r) => {
            const active = !r.lifted_at && r.kind !== "warning" && (!r.ends_at || Date.parse(r.ends_at) > now);
            return (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-sm nf-body-sm">
                <span>
                  <span className="font-semibold">{RESTRICTION_LABEL[r.kind]}</span> · {r.reason}
                  <span className="block nf-caption text-[var(--nf-content-muted)]">
                    {when(r.starts_at)} {r.lifted_at ? `· lifted ${when(r.lifted_at)}` : r.ends_at ? `· until ${when(r.ends_at)}` : r.kind === "warning" ? "" : "· until lifted"}
                  </span>
                </span>
                {active ? <MemberStandingControls userId={userId} liftId={r.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
