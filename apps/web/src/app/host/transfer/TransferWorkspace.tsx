"use client";

import { useHostCopy, useHostPageCopy } from "@/components/host/host-copy";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { EmptyState, Row, RowList, Section, Stack, TYPE } from "@/components/app/Screen";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  closeBusiness,
  offerBusinessTransfer,
  respondToBusinessTransfer,
} from "@/lib/business-transfer/actions";
import type {
  TransferOffer,
  TransferableBusiness,
} from "@/lib/business-transfer/queries";
import { countOf, formatDate, type Locale } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The route out of the business precondition, drawn as the two doors it is.
 *
 * NOTHING ON THIS SCREEN IS A DEAD END, and that is the whole reason it
 * exists. Every business shows what is actually in the way for it, and every
 * one of those things carries the control that clears it: hand it over, close
 * it, or settle the diary on the screen where the diary lives.
 *
 * AN OFFER IS NOT AN ACT. The form sends an offer with a fourteen day clock on
 * it and the copy says so twice, because a person clearing a deletion
 * precondition needs to know the business has NOT moved yet. It moves when the
 * other person accepts, and not before.
 *
 * THE RECEIVER IS TOLD WHAT THEY ARE TAKING ON. The incoming panel says the
 * verified badge starts again and the consents are theirs to make, because
 * accepting a business is accepting its obligations and a consent given in
 * ignorance is not consent.
 */

function when(iso: string, locale: Locale): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  return formatDate(new Date(parsed), locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TransferWorkspace({
  businesses,
  outgoing,
  incoming,
  partial,
}: {
  businesses: TransferableBusiness[];
  outgoing: TransferOffer[];
  incoming: TransferOffer[];
  partial: boolean;
}) {
  const hw = useHostCopy();
  const w = useHostPageCopy();
  const tw = w.transfer;
  const locale = useClientLocale();
  const trading = businesses.filter((business) => business.stillTrading).length;

  return (
    <>
      <div className="nf-agent-head">
        <div>
          <h1 className="nf-agent-head__title">{w.screens.transfer}</h1>
          <p className={`mt-row ${TYPE.bodyLg}`}>
            {businesses.length === 0
              ? tw.noBusiness
              : trading === 0
                ? tw.nothingTrading
                : /*
                     THE VERB AGREES WITH `trading`, NOT WITH `businesses.length`.
                     Two businesses with one of them trading once read "1 of
                     your businesses are still trading". The subject is the
                     number that is trading, so that count picks the form; a
                     single business on the account has its own sentence.
                  */
                  `${countOf(trading, businesses.length > 1 ? "businessesStillTrading" : "yourBusinessTrading", locale)} ${tw.whyItMatters}`}
          </p>
        </div>
      </div>

      <Stack>
        {incoming.length > 0 && (
          <Section
            title={hw.transfer.offeredTitle}
            description={tw.offeredDescription}
          >
            <RowList boxed>
              {incoming.map((offer) => (
                <IncomingRow key={offer.transferId} offer={offer} />
              ))}
            </RowList>
          </Section>
        )}

        {businesses.length > 0 && (
          <Section
            title={hw.transfer.businessesTitle}
            description={tw.businessesDescription}
          >
            <RowList boxed>
              {businesses.map((business) => (
                <BusinessRow
                  key={business.id}
                  business={business}
                  offer={outgoing.find(
                    (entry) => entry.businessId === business.id && entry.status === "PENDING",
                  )}
                />
              ))}
            </RowList>
          </Section>
        )}

        {businesses.length === 0 && (
          <EmptyState
            icon="hotel"
            title={hw.transfer.nothingTitle}
            body={hw.transfer.nothingBody}
            action={
              <ButtonLink href="/settings/account" variant="secondary" size="lg">
                {tw.backToAccount}
              </ButtonLink>
            }
          />
        )}

        {partial && (
          <p className={TYPE.rowMeta}>
            {tw.partial}
          </p>
        )}
      </Stack>
    </>
  );
}

/* ------------------------------------------------------------- one business */

function BusinessRow({
  business,
  offer,
}: {
  business: TransferableBusiness;
  offer: TransferOffer | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, start] = useSafeTransition();
  const w = useHostPageCopy();
  const tw = w.transfer;
  const locale = useClientLocale();

  const send = () => {
    setError(null);
    start(async () => {
      const result = await offerBusinessTransfer({
        businessId: business.id,
        email,
        note: note.length > 0 ? note : undefined,
      });
      if (!result.ok) {
        setError(result.fieldErrors?.email ?? result.error);
        return;
      }
      setSent(result.data.expiresAt);
      setOpen(false);
      router.refresh();
    });
  };

  const takeBack = () => {
    if (!offer) return;
    setError(null);
    start(async () => {
      const result = await respondToBusinessTransfer({
        transferId: offer.transferId,
        decision: "withdraw",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const close = () => {
    setError(null);
    start(async () => {
      const result = await closeBusiness({ businessId: business.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Row className="flex-col items-stretch gap-sm py-md">
      <div className="grid gap-2xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-sm">
        <span className="min-w-0">
          <span className={`block ${TYPE.rowTitle}`}>{business.name}</span>
          <span className={`block ${TYPE.rowMeta}`}>
            {tw.kind[business.kind as keyof typeof tw.kind] ?? business.kind}
            {business.verified ? tw.verifiedSuffix : ""}
          </span>
        </span>
        <StatusPill
          tone={business.stillTrading ? "info" : "neutral"}
          className="justify-self-start sm:justify-self-end"
        >
          {w.businessStatus[business.status as keyof typeof w.businessStatus] ?? business.status}
        </StatusPill>
      </div>

      {business.stillTrading && (
        <ul className={`space-y-2xs ${TYPE.rowMeta}`}>
          {business.status === "PUBLISHED" && <li>{tw.live}</li>}
          {business.publishedRooms > 0 && (
            <li>
              {countOf(business.publishedRooms, "propertiesLive", locale)}
            </li>
          )}
          {business.futureReservations > 0 && (
            <li>
              {countOf(business.futureReservations, "tablesBooked", locale)}{" "}
              <Link
                href="/agent/bookings"
                className="font-semibold text-[var(--nf-content-link)] hover:underline"
                data-testid={`transfer-diary-${business.id}`}
              >
                {tw.settleDiary}
              </Link>
            </li>
          )}
        </ul>
      )}

      {offer ? (
        <div className="nf-panel nf-panel--card block p-md">
          <p className={TYPE.rowTitle}>{tw.offerWaiting}</p>
          <p className={`mt-2xs ${TYPE.rowMeta}`}>
            {offer.counterpartyHandle ? tw.sentTo.replace("{handle}", offer.counterpartyHandle) : tw.sent}{" "}
            {tw.runsOutNothingMoved.replace("{date}", when(offer.expiresAt, locale))}
          </p>
          <div className="mt-sm">
            <Button variant="secondary" onClick={takeBack} loading={busy} data-testid="transfer-withdraw">
              {tw.takeOfferBack}
            </Button>
          </div>
        </div>
      ) : sent ? (
        <p
          className={`${TYPE.rowMeta} text-[var(--nf-state-success)]`}
          data-testid="transfer-sent"
        >
          {tw.offerSent.replace("{date}", when(sent, locale))}
        </p>
      ) : open ? (
        <div className="nf-panel nf-panel--card block p-md">
          <label className="nf-label mb-2xs block" htmlFor={`email-${business.id}`}>
            {tw.emailLabel}
          </label>
          <input
            id={`email-${business.id}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            className="nf-field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-testid={`transfer-email-${business.id}`}
          />
          <p className={`mt-2xs ${TYPE.caption} text-[var(--nf-content-muted)]`}>
            {tw.emailHint}
          </p>
          <label className="nf-label mb-2xs mt-sm block" htmlFor={`note-${business.id}`}>
            {tw.noteLabel}
          </label>
          <input
            id={`note-${business.id}`}
            type="text"
            className="nf-field"
            maxLength={400}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="mt-md grid gap-sm sm:grid-cols-2">
            <Button variant="secondary" full onClick={() => setOpen(false)}>
              {tw.cancel}
            </Button>
            <Button
              variant="primary"
              full
              onClick={send}
              loading={busy}
              disabled={email.trim().length === 0}
              data-testid={`transfer-send-${business.id}`}
            >
              {tw.sendOffer}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-sm sm:grid-cols-2">
          {/* Secondary: one row per business would otherwise be a column of
              primaries, and a hand-over is rare and deliberate (T-44). */}
          <Button
            variant="secondary"
            full
            onClick={() => setOpen(true)}
            data-testid={`transfer-open-${business.id}`}
          >
            <UiIcon name="arrow-right" size={20} />
            {tw.handOver}
          </Button>
          <Button
            variant="secondary"
            full
            onClick={close}
            loading={busy}
            data-testid={`transfer-close-${business.id}`}
          >
            {tw.closeIt}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className={`${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
    </Row>
  );
}

/* --------------------------------------------------------- one offer to you */

function IncomingRow({ offer }: { offer: TransferOffer }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useSafeTransition();
  const tw = useHostPageCopy().transfer;
  const locale = useClientLocale();

  const answer = (decision: "accept" | "decline") => {
    setError(null);
    start(async () => {
      const result = await respondToBusinessTransfer({
        transferId: offer.transferId,
        decision,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Row className="flex-col items-stretch gap-sm py-md">
      <span className="min-w-0">
        <span className={`block ${TYPE.rowTitle}`}>{offer.businessName}</span>
        <span className={`block ${TYPE.rowMeta}`}>
          {offer.counterpartyHandle ? `${tw.from.replace("{handle}", offer.counterpartyHandle)} ` : ""}
          {tw.runsOut.replace("{date}", when(offer.expiresAt, locale))}
        </span>
      </span>
      {offer.note && <p className={`${TYPE.rowMeta} whitespace-pre-wrap`}>{offer.note}</p>}
      <p className={TYPE.rowMeta}>
        {tw.takingOn}
      </p>
      <div className="grid gap-sm sm:grid-cols-2">
        <Button
          variant="secondary"
          full
          onClick={() => answer("decline")}
          loading={busy}
          data-testid="transfer-decline"
        >
          {tw.noThanks}
        </Button>
        <Button
          variant="primary"
          full
          onClick={() => answer("accept")}
          loading={busy}
          data-testid="transfer-accept"
        >
          {tw.acceptIt}
        </Button>
      </div>
      {error && (
        <p role="alert" className={`${TYPE.rowMeta} text-[var(--nf-state-error)]`}>
          {error}
        </p>
      )}
    </Row>
  );
}
