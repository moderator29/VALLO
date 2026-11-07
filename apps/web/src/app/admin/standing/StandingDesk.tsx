"use client";

import { useActionState, type ReactNode } from "react";
import { useActionBanner } from "@/components/ui/use-action-banner";
import {
  grantStandingBadge,
  revokeStandingBadge,
  type GrantReceipt,
} from "@/lib/admin/standing-actions";
import type { ManualGrant } from "@/lib/admin/standing-queries";
import type { ActionResult } from "@/lib/actions/envelope";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextArea } from "@/components/ui/Field";

/**
 * The standing desk.
 *
 * One badge is granted rather than earned, and the whole design of this
 * surface is about never letting those two look alike. A grant needs a
 * handle, a badge and a reason, and the reason is required because it is the
 * record of the decision: "why does this person have this" must be answerable
 * a year later by somebody who was not in the room.
 *
 * Every row states plainly who granted it. Every row in this list is a manual
 * badge, so every one of them was granted by somebody: a row with no name
 * against it is one whose granter has since closed their account, not one that
 * was earned. Taking it back stays available either way, because a badge that
 * can only be revoked by the person who granted it becomes permanent the day
 * they leave.
 */
export function StandingDesk({
  grants,
  manualBadges,
  filters,
  empty,
}: {
  grants: ManualGrant[];
  manualBadges: { code: string; name: string }[];
  /** The record's search and badge chips, drawn with the record they narrow rather than above the form. */
  filters?: ReactNode;
  /** The page's own empty state for the record (never granted, or nothing matched the search). */
  empty?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionResult<GrantReceipt> | null, FormData>(
    grantStandingBadge,
    null,
  );
  const [revokeState, revokeAction] = useActionState<
    ActionResult<{ userId: string }> | null,
    FormData
  >(revokeStandingBadge, null);
  /* Each outcome is said by the one banner at the top of the screen (Grade 1);
     a field's own error stays under that field. */
  useActionBanner(state, { ok: state?.ok ? `Granted to @${state.data.handle}. Your name is on it.` : undefined });
  useActionBanner(revokeState, { ok: "Standing taken back. The record keeps who granted it and who took it back." });

  const fieldError = (key: string): string | undefined =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <div className="space-y-lg">
      {/* --------------------------------------------------------- grant */}
      <form action={formAction} noValidate className="nf-panel nf-panel--card nf-admin-card p-md sm:p-lg">
        <h2 className="text-[length:var(--nf-text-body-sm)] font-bold text-[var(--nf-content-primary)]">
          Grant standing
        </h2>
        <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          This is the only badge a person awards. Everything else on the platform is
          earned from real events, and granting one of those by hand would make every
          earned one worth less.
        </p>

        {/*
          Both of these set `aria-invalid` and painted nothing for it:
          `.nf-field` draws its border with a border-box gradient, so the error
          rule beside it colours a surface the gradient covers. A grant refused
          for a bad handle looked exactly like one nobody had submitted yet.
          The field primitives own the invalid state, the message and the
          label/error wiring together.
        */}
        <div className="mt-md grid gap-sm sm:grid-cols-2">
          <TextField
            type="text"
            name="handle"
            label="Member handle"
            autoComplete="off"
            placeholder="adaobi"
            error={fieldError("handle")}
          />

          <SelectField
            name="badgeCode"
            label="Badge"
            defaultValue={manualBadges[0]?.code ?? ""}
          >
            {manualBadges.map((badge) => (
              <option key={badge.code} value={badge.code}>
                {badge.name}
              </option>
            ))}
          </SelectField>
        </div>

        <TextArea
          name="reason"
          label="Why"
          rows={3}
          className="mt-sm"
          placeholder="Answered forty questions in Yaba this month, every one of them useful."
          error={fieldError("reason")}
        />


        <Button
          type="submit"
          variant="primary"
          className="mt-md"
          disabled={manualBadges.length === 0}
          loading={pending}
        >
          {pending ? "Granting..." : "Grant badge"}
        </Button>
      </form>

      {/* -------------------------------------------------------- record */}
      <section>
        <h2 className="nf-h3 mb-sm text-[length:var(--nf-text-body)]">Every grant, and who signed for it</h2>
        {filters}
        {grants.length === 0 && empty ? (
          empty
        ) : grants.length === 0 ? (
          <div className="nf-panel nf-panel--card nf-admin-card p-lg text-center">
            <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
              Nobody has been granted standing yet
            </p>
            <p className="mx-auto mt-2xs max-w-[46ch] text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
              When you grant one it appears here with your name and your reason against
              it, permanently.
            </p>
          </div>
        ) : (
          <ul className="nf-queue-list">
            {grants.map((grant) => (
              <li key={`${grant.userId}-${grant.badgeCode}`} className="nf-panel nf-panel--card nf-admin-card p-md">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="nf-badge nf-badge--brand">{grant.badgeName}</span>
                  {/* `.nf-badge` alone paints no fill and no colour, so this
                      read as invisible text exactly where a revocation had to be
                      seen. It is a status, so it is a status pill. */}
                  {grant.revoked && <StatusPill tone="danger">Revoked</StatusPill>}
                  <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    {new Date(grant.grantedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Africa/Lagos",
                    })}
                  </span>
                </div>
                <p className="mt-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
                  {grant.holder}
                </p>
                <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {grant.grantedByName
                    ? `Granted by ${grant.grantedByName}.`
                    : "Granted by an administrator whose account has since been closed."}
                  {grant.reason ? ` ${grant.reason}` : ""}
                </p>
                {!grant.revoked && (
                  <form action={revokeAction} className="mt-sm">
                    <input type="hidden" name="userId" value={grant.userId} />
                    <input type="hidden" name="badgeCode" value={grant.badgeCode} />
                    {/* Revoking somebody's standing is destructive, and it was
                        drawn as a ghost - the quietest control on the row. */}
                    <Button type="submit" variant="dangerQuiet" size="sm">
                      Take it back
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
