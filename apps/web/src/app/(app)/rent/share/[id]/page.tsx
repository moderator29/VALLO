import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { formatMoneyDate } from "@/lib/money/dates";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState, Section, TYPE } from "@/components/app/Screen";
import { DocFigure, DocHead, DocNote, DocRow, DocRows, DocumentSheet } from "@/components/app/money/DocumentSheet";
import { PayShare, SettleShareOnReturn, ShareAnswer } from "@/components/app/tenancy/FlatmateControls";

/** A private record. Never indexed. */
export const metadata: Metadata = { title: "Your share", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

/**
 * V-86. A flatmate's share of a move-in, and the one control that pays it:
 * a card checkout straight to the landlord or agent, split by Paystack.
 *
 * Read through `my_rent_share`, which answers only the flatmate the share
 * belongs to and names the area, never the address. A share that is not the
 * reader's answers exactly as one that does not exist.
 */
export default async function RentSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnedRef = query.paid === "1" && typeof query.reference === "string" ? query.reference : null;
  const locale = await getLocale();
  const copy = getDictionary(locale).afterTheGate.flatmates;
  const shell = (children: React.ReactNode) => (
    <PageFrame title={copy.shareTitle} fallback="/agreements" width="narrow">
      {children}
    </PageFrame>
  );
  const missing = shell(<EmptyState icon="calendar-home" title={copy.shareMissingTitle} body={copy.shareMissingBody} data-testid="share-missing" />);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return missing;

  const session = await resolveSession();
  if (session.state !== "signed-in") return missing;
  let row: Record<string, unknown> | null = null;
  let failed = false;
  try {
    const { data, error } = await (session.supabase as unknown as SupabaseClient).rpc("my_rent_share", { p_contributor: id });
    failed = Boolean(error);
    row = !error && typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    failed = true;
  }
  if (failed) {
    return shell(<EmptyState icon="calendar-home" title={copy.shareMissingTitle} body={copy.unavailable} data-testid="share-unavailable" />);
  }
  const share = Number(row?.share_minor);
  const total = Number(row?.total_minor);
  if (!row || !Number.isSafeInteger(share) || !Number.isSafeInteger(total)) return missing;

  const area = [row.area, row.city].filter((part): part is string => typeof part === "string" && part.length > 0).join(", ");
  const day = (value: unknown) => (typeof value === "string" ? (formatMoneyDate(value, locale) ?? value) : null);
  const moveIn = day(row.move_in);
  const paidAt = day(row.paid_at);
  const refund = typeof row.refund === "object" && row.refund !== null ? (row.refund as Record<string, unknown>) : null;
  const refundedAt = refund?.status === "processed" ? day(refund.processed_at) : null;
  const tenancyId = typeof row.rent_payment_id === "string" ? row.rent_payment_id : null;
  const paidMinor = Number(row.paid_minor);
  const paidAmount = Number.isSafeInteger(paidMinor) && paidMinor > 0 ? formatMoney(paidMinor, locale) : null;
  const lead = typeof row.lead === "string" ? row.lead : null;
  const answer = row.answer === "accepted" || row.answer === "declined" ? row.answer : null;

  let state: React.ReactNode;
  if (refundedAt && paidAmount && paidAt) {
    state = <p className={TYPE.body}>{copy.shareReturned.replace("{amount}", paidAmount).replace("{date}", paidAt).replace("{returned}", refundedAt)}</p>;
  } else if ((refund || row.void === true) && paidAmount && paidAt) {
    state = (
      <p className={TYPE.body} data-testid="share-paid-void">
        {(lead ? copy.sharePaidVoid.replaceAll("{name}", lead) : copy.sharePaidVoidUnknown)
          .replace("{amount}", paidAmount)
          .replace("{date}", paidAt)}
      </p>
    );
  } else if (paidAt) {
    state = (
      <p className="nf-body-sm text-[var(--nf-state-success)]">
        {(lead ? copy.sharePaid.replace("{name}", lead) : copy.sharePaidUnknown).replace("{date}", paidAt)}
      </p>
    );
  } else if (row.void === true) {
    state = <p className={TYPE.body}>{copy.shareVoid}</p>;
  } else if (answer === "declined") {
    state = <p className={TYPE.body}>{copy.shareDeclined}</p>;
  } else if (answer === null && row.complete !== true) {
    state = (
      <>
        <p className={TYPE.body}>{copy.shareInvited}</p>
        <ShareAnswer contributorId={id} copy={copy} />
      </>
    );
  } else if (row.payable === true && tenancyId) {
    state = <PayShare tenancyId={tenancyId} contributorId={id} label={copy.payMine} help={copy.sharePayHelp} />;
  } else {
    state = <p className={TYPE.body}>{copy.shareClosed}</p>;
  }

  /*
   * THE SHARE SPLIT AS NAMED ROWS (north star 10 D, reference 7073). The
   * share used to be one sentence carrying two figures and a place; on the
   * document sheet it is a figure and its rows, so the share leads, the
   * whole it is a part of sits beneath it, and who arranged it is a named
   * line of its own beside the rail it pays through. The state and the one control follow, in the
   * member's theme, because they are not the document.
   */
  const x = getDictionary(locale).experienceMoney.share;
  return shell(
    <div className="grid gap-md" data-testid="rent-share">
      <DocumentSheet kind="document" as="section" aria-labelledby="share-sheet-title" data-testid="share-sheet">
        {/* With no place on the row the title already is "Your share of a move-in", so the overline is not drawn above it a second time. */}
        <DocHead label={area ? copy.shareTitle : undefined} title={area || copy.shareTitle} id="share-sheet-title" />
        <div className="nf-doc__hero">
          <p className="nf-doc__label">{x.yours}</p>
          <DocFigure testId="share-figure">{formatMoney(share, locale)}</DocFigure>
        </div>
        <DocRows>
          {/* The share is the hero figure above, so it is not a row again. */}
          <DocRow label={x.total} numeric>
            {formatMoney(total, locale)}
          </DocRow>
        </DocRows>
        {/* When it is due keeps its old meaning ("before move-in"), in the
            existing sentence rather than a bare "Move-in" row. */}
        {moveIn ? <DocNote>{copy.shareDue.replace("{date}", moveIn)}</DocNote> : null}
      </DocumentSheet>
      <Section>
        <div className="grid gap-md">
          {/* Who arranged it and the rail, said plainly: the share goes
              straight to the landlord or agent, split by Paystack. */}
          <p className={TYPE.body}>{lead ? copy.shareLead.replace("{name}", lead) : copy.shareLeadUnknown}</p>
          {/* Not gated on `!paidAt`: settling refreshes this page with the
              share paid, and a gate on it unmounted the receipt it had just
              opened. A revisit answers `already` and shows nothing. */}
          {returnedRef && tenancyId && <SettleShareOnReturn tenancyId={tenancyId} reference={returnedRef} success={getDictionary(locale).success} />}
          {state}
        </div>
      </Section>
    </div>,
  );
}
