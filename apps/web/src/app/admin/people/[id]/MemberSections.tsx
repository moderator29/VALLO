import Link from "next/link";
import type { ReactNode } from "react";
import { countOf, formatMoney, type Locale } from "@vallo/i18n";
import type { MemberExtras } from "@/lib/admin/member-queries";
import { STAFF_SCOPE_LABEL, type StaffScope } from "@/lib/admin/guard";
import { consentReceipt, KYC_STATE_WORD, kycState, tallyBy } from "@/lib/admin/member-file-rules";
import { KYC_DOCUMENT_KIND_WORDS, KYC_DOCUMENT_SUBTYPE_WORDS } from "@/components/app/untranslated";
import { supportTopicLabel } from "@/lib/trust/support-topics";
import type { AdminUi } from "../../_components/ui";
import { NoteForm } from "./NoteForm";

/**
 * The member file's sections beyond what `admin_person_file` returns: account
 * and staff access, verification with the consent receipt, what they list,
 * what they have agreed and booked, what they asked support, what was
 * reported about them, the devices they sign in from, and the team's notes.
 *
 * Every section links to the desk that decides it; this page decides nothing
 * except a note. A section whose read failed says so rather than "none".
 */

const LINK = "inline-flex min-h-11 items-center underline underline-offset-2";

/* The database's own reason for a refused number (`phone.number_refused`),
   in staff words. The member only ever saw "We could not use this number". */
const PHONE_REFUSAL_WORDS: Record<string, string> = {
  taken: "the number is already confirmed on another account (see the shared-phone match above)",
  taken_on_confirm: "the number was confirmed on another account while the code was out",
  invalid: "the number is not one Vallo can send a code to",
};

function Section({ title, id, failed, children }: { title: string; id: string; failed: boolean; children: ReactNode }) {
  return (
    <section
      className="mt-section-tight nf-panel nf-panel--card nf-admin-card p-card"
      aria-labelledby={`member-${id}-title`}
      data-testid={`member-${id}`}
    >
      <h2 className="nf-h4" id={`member-${id}-title`}>
        {title}
      </h2>
      {failed ? (
        <p className="mt-row nf-body-sm text-[var(--nf-status-rejected)]">This could not be read just now. Reload to try again.</p>
      ) : (
        children
      )}
    </section>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">{children}</p>;
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="mt-row space-y-inline">{children}</ul>;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-xs gap-y-3xs border-t border-[var(--nf-divider)] pt-inline nf-body-sm break-words">
      {children}
    </li>
  );
}

function Tally({ rows, ui, column }: { rows: { key: string; count: number }[]; ui: AdminUi; column?: string }) {
  if (rows.length === 0) return null;
  return (
    <p className="mt-inline nf-caption text-[var(--nf-content-secondary)]">
      {rows.map((r) => `${r.count} ${column ? ui.columnLabel(column, r.key) : ui.statusLabel(r.key)}`).join(" · ")}
    </p>
  );
}

export function MemberSections({
  userId,
  extras,
  ui,
  locale,
}: {
  userId: string;
  extras: MemberExtras;
  ui: AdminUi;
  locale: Locale;
}) {
  const f = new Set(extras.failed);
  const receipt = consentReceipt(extras.consents);
  const kyc = kycState(extras.documents);

  return (
    <>
      <Section title="Account" id="account" failed={f.has("profile") && f.has("staff")}>
        <dl className="mt-row grid gap-xs text-[length:var(--nf-text-body-sm)] sm:grid-cols-2">
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Signed up as</dt>
            <dd>{extras.profile?.signupRole ? ui.columnLabel("signupRole", extras.profile.signupRole) : "Not recorded"}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Terms accepted</dt>
            <dd>
              {extras.profile?.termsAcceptedAt
                ? `${ui.when(extras.profile.termsAcceptedAt)}${extras.profile.termsVersion ? ` · version ${extras.profile.termsVersion}` : ""}`
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Phone on file</dt>
            <dd>{extras.profile ? (extras.profile.phoneOnFile ? "Yes (not shown here)" : "No") : "Not recorded"}</dd>
          </div>
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Phone confirmation</dt>
            <dd data-testid="person-phone">
              {!extras.phone
                ? "Could not be read"
                : extras.phone.qa
                  ? "Test account: never asked for a phone"
                  : extras.phone.confirmedAt
                    ? `Confirmed ${ui.when(extras.phone.confirmedAt)}`
                    : "Not confirmed"}
            </dd>
          </div>
          {extras.phone?.lastRefusal && (
            <div>
              <dt className="nf-caption text-[var(--nf-content-muted)]">Last number refused</dt>
              <dd data-testid="person-phone-refused">
                {`${ui.when(extras.phone.lastRefusal.at)}: ${PHONE_REFUSAL_WORDS[extras.phone.lastRefusal.reason] ?? extras.phone.lastRefusal.reason}. The member was told only that the number could not be used.`}
              </dd>
            </div>
          )}
          <div>
            <dt className="nf-caption text-[var(--nf-content-muted)]">Staff access</dt>
            <dd>
              {f.has("staff")
                ? "Could not be read"
                : !extras.staffVisible
                  ? "Shown to super admins only"
                  : !extras.staff
                  ? "None"
                  : extras.staff.revokedAt
                    ? `Ended ${ui.when(extras.staff.revokedAt)}${extras.staff.revokeReason ? `: ${extras.staff.revokeReason}` : ""}`
                    : extras.staff.scopes.map((s) => STAFF_SCOPE_LABEL[s as StaffScope] ?? s).join(", ")}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Verification" id="verification" failed={f.has("documents")}>
        <p className="mt-row nf-body-sm">
          <span className="font-semibold">{KYC_STATE_WORD[kyc]}</span>
          {extras.documents.length > 0 && (
            <>
              {" · "}
              <Link href="/admin/kyc" className={LINK}>
                Open the verification desk
              </Link>
            </>
          )}
        </p>
        {extras.documents.length > 0 && (
          <Rows>
            {extras.documents.map((d) => (
              <Row key={d.id}>
                <span className="font-semibold">{KYC_DOCUMENT_KIND_WORDS[d.kind] ?? d.kind}</span>
                {d.subtype && (
                  <span className="text-[var(--nf-content-secondary)]">{KYC_DOCUMENT_SUBTYPE_WORDS[d.subtype] ?? d.subtype}</span>
                )}
                <ui.StatusChip label={ui.columnLabel("kycReview", d.reviewStatus)} tone={d.reviewStatus === "approved" ? "success" : d.reviewStatus === "rejected" ? "danger" : "warning"} />
                <span className="nf-caption text-[var(--nf-content-muted)]">
                  uploaded {ui.when(d.uploadedAt)}
                  {d.issuedOn ? ` · issued ${ui.day(d.issuedOn)}` : ""}
                  {d.viaApplication ? " · with an application" : " · from Get verified"}
                </span>
                {d.rejectionReason && (
                  <span className="basis-full nf-caption text-[var(--nf-content-secondary)]">Sent back: {d.rejectionReason}</span>
                )}
              </Row>
            ))}
          </Rows>
        )}
        <h3 className="mt-row nf-caption font-semibold text-[var(--nf-content-primary)]">Consent receipt</h3>
        {f.has("consents") ? (
          <p className="mt-inline nf-body-sm text-[var(--nf-status-rejected)]">The consent receipt could not be read just now.</p>
        ) : receipt.given.length === 0 ? (
          <Quiet>No verification consent recorded. They are recorded when somebody sends documents from Get verified.</Quiet>
        ) : (
          <ul className="mt-inline space-y-3xs nf-caption text-[var(--nf-content-secondary)]" data-testid="member-consents">
            {receipt.given.map((c) => (
              <li key={c.consent}>
                {c.words} · {ui.when(c.at)}
              </li>
            ))}
            {receipt.missing.length > 0 && (
              <li className="text-[var(--nf-status-rejected)]">Not given: {receipt.missing.join(", ")}</li>
            )}
          </ul>
        )}
      </Section>

      <Section title="Listings" id="listings" failed={f.has("listings")}>
        {extras.listingsTotal === 0 ? (
          <Quiet>They list nothing.</Quiet>
        ) : (
          <>
            <p className="mt-row nf-body-sm">
              {extras.listingsTotal} in all{extras.listingsTotal > extras.listings.length ? `, newest ${extras.listings.length} shown` : ""}
            </p>
            <Tally rows={tallyBy(extras.listings, (l) => l.status)} ui={ui} />
            <Rows>
              {extras.listings.map((l) => (
                <Row key={l.id}>
                  <Link href={`/admin/listings/${l.id}`} className={LINK}>
                    {l.title ?? "Untitled listing"}
                  </Link>
                  <ui.StatusChip status={l.status} />
                  <span className="nf-caption text-[var(--nf-content-muted)]">
                    {l.reference ?? ""} {ui.day(l.createdAt)}
                  </span>
                </Row>
              ))}
            </Rows>
          </>
        )}
      </Section>

      <Section title="Agreements and stays" id="deals" failed={f.has("agreements") && f.has("bookings")}>
        {f.has("agreements") ? (
          <p className="mt-row nf-body-sm text-[var(--nf-status-rejected)]">Agreements could not be read just now.</p>
        ) : extras.agreements.length === 0 ? (
          <Quiet>No agreement, as a renter or as the owner&apos;s side.</Quiet>
        ) : (
          <Rows>
            {extras.agreements.map((a) => (
              <Row key={a.id}>
                <Link href="/admin/agreements" className={LINK}>
                  {a.listingTitle ?? "A listing"}
                </Link>
                <ui.StatusChip label={ui.columnLabel("agreementStatus", a.status)} tone={a.status === "approved" || a.status === "paid" ? "success" : a.status === "rejected" ? "danger" : "warning"} />
                <span className="nf-caption text-[var(--nf-content-muted)]">
                  {a.kind === "stay" ? "Stay" : "Rent"} · as {a.side === "renter" ? "renter or guest" : "owner or agent"} ·{" "}
                  {formatMoney(a.amountMinor, locale)} · {ui.day(a.createdAt)}
                </span>
              </Row>
            ))}
          </Rows>
        )}
        {f.has("bookings") ? (
          <p className="mt-row nf-body-sm text-[var(--nf-status-rejected)]">Stays could not be read just now.</p>
        ) : extras.bookings.length === 0 ? (
          <Quiet>No stay booked as a guest.</Quiet>
        ) : (
          <Rows>
            {extras.bookings.map((b) => (
              <Row key={b.id}>
                <Link href={`/admin/bookings/${b.id}`} className={LINK}>
                  {b.listingTitle ?? "A stay"}
                </Link>
                <ui.StatusChip status={b.status} />
                <span className="nf-caption text-[var(--nf-content-muted)]">
                  {ui.day(b.checkIn)} to {ui.day(b.checkOut)} · {formatMoney(b.totalMinor, locale)}
                </span>
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      <Section title="Support" id="support" failed={f.has("tickets")}>
        {extras.tickets.length === 0 ? (
          <Quiet>No ticket filed while signed in.</Quiet>
        ) : (
          <Rows>
            {extras.tickets.map((t) => (
              <Row key={t.id}>
                <Link href={`/admin/support?ticket=${t.id}`} className={LINK}>
                  {t.reference}
                </Link>
                <ui.StatusChip status={t.status} />
                <span className="text-[var(--nf-content-secondary)]">{supportTopicLabel(t.topic) ?? "A general question"}</span>
                <span className="nf-caption text-[var(--nf-content-muted)]">{ui.when(t.createdAt)}</span>
              </Row>
            ))}
          </Rows>
        )}
      </Section>

      <Section title="Reports" id="reports" failed={f.has("reports")}>
        <p className="mt-row nf-body-sm">
          They filed {countOf(extras.reportsFiled, "reports", locale)}.{" "}{extras.reportsAgainst.length === 0 ? "None about them or their lister account." : `${extras.reportsAgainst.length} about them or their lister account${extras.reportsAgainst.length >= 20 ? " (newest 20)" : ""}:`}
        </p>
        {extras.reportsAgainst.length > 0 && (
          <Rows>
            {extras.reportsAgainst.map((r) => (
              <Row key={r.id}>
                <Link href={`/admin/queue?tab=reports${r.category ? `&reason=${encodeURIComponent(r.category)}` : ""}`} className={LINK}>
                  {r.category ? ui.columnLabel("reportCategory", r.category) : "Report"}
                </Link>
                <ui.StatusChip status={r.status} />
                <span className="nf-caption text-[var(--nf-content-muted)]">{ui.when(r.createdAt)}</span>
              </Row>
            ))}
          </Rows>
        )}
        <p className="mt-inline nf-caption text-[var(--nf-content-muted)]">Reports about one of their listings are on the timeline below.</p>
      </Section>

      <Section title="Devices" id="devices" failed={f.has("devices")}>
        {extras.devices.length === 0 ? (
          <Quiet>No device recorded. A device is recorded at sign-in.</Quiet>
        ) : (
          <Rows>
            {extras.devices.map((d, i) => (
              <Row key={i}>
                <span className="font-semibold">{d.words ?? "A device"}</span>
                <span className="nf-caption text-[var(--nf-content-muted)]">
                  first seen {ui.when(d.firstSeenAt)} · last seen {ui.when(d.lastSeenAt)}
                </span>
              </Row>
            ))}
          </Rows>
        )}
        <p className="mt-inline nf-caption text-[var(--nf-content-muted)]">
          The device fingerprint is compared inside the database for Linked accounts and never shown.
        </p>
      </Section>

      <Section title="Team notes" id="notes" failed={f.has("notes")}>
        {extras.notes.length === 0 ? (
          <Quiet>No note yet.</Quiet>
        ) : (
          <Rows>
            {extras.notes.map((n) => (
              <Row key={n.id}>
                <span className="basis-full whitespace-pre-wrap text-[var(--nf-content-primary)]">{n.body}</span>
                <span className="nf-caption text-[var(--nf-content-muted)]">
                  {n.authorName ?? "A former staff member"} · {ui.when(n.createdAt)}
                </span>
              </Row>
            ))}
          </Rows>
        )}
        <NoteForm userId={userId} />
      </Section>
    </>
  );
}
