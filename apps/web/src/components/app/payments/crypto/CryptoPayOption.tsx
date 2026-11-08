"use client";

import { banner } from "@/lib/ui/toast";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { getCryptoQuote, startCryptoPayment } from "@/lib/crypto/actions";
import { refundAddressLooksValid } from "@/lib/crypto/assets";
import type { CryptoPaymentView } from "@/lib/crypto/view";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Amount } from "@/components/ui/Amount";
import { TextField } from "@/components/ui/Field";
import { IconPlate } from "@/components/ui/IconPlate";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CryptoPaymentStatus, clock, useCountdown } from "./CryptoPaymentStatus";
import type { CryptoOffer } from "./offer";

/**
 * "Pay with crypto": one more row among the ways to pay an existing charge.
 *
 * Rendered only when the server says the gate is open (flag, provider,
 * direct settlement, assets, payer KYC). When only the payer's KYC is
 * missing, the row says so honestly and links to verification; when the
 * platform is closed, `offer` is null and nothing renders at all.
 *
 * The flow, all in one bottom sheet (reference 01: quiet rows, one ticked):
 *   pick   a dark hero with the naira charge, asset and network as rows that
 *          open their own sheets, then "Get a quote";
 *   quote  the crypto amount large, the rate, the provider's fee, a
 *          countdown, and the refund address;
 *   pay    the provider's address as text and QR, copy buttons, the live
 *          steps; then the outcome, with a way back from every dead end.
 */

const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

type Step =
  | { kind: "pick" }
  | { kind: "quoting" }
  | { kind: "quote"; view: CryptoPaymentView }
  | { kind: "starting"; view: CryptoPaymentView }
  | { kind: "pay"; view: CryptoPaymentView };

export function CryptoPayOption({
  offer,
  bookingId,
  totalMinor,
  locale,
}: {
  offer: CryptoOffer;
  bookingId: string;
  totalMinor: number;
  locale: Locale;
}) {
  const t = useScopedCopy("cryptoPay");
  const [open, setOpen] = useState(false);

  if (offer.kind === "kyc") {
    return (
      <Panel as="li" variant="card" className="isolate flex-row items-start gap-group">
        <IconPlate size="lg">
          <span className="block h-8 w-8">
            <BrandIcon name="id-card-check" fill tile={false} />
          </span>
        </IconPlate>
        <div className="min-w-0 flex-1">
          <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{t.kycTitle}</p>
          <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">{t.kycBody}</p>
          <Link href="/verification"className="nf-body-sm mt-row inline-block font-semibold text-[var(--nf-brand-primary)] underline">
            {t.kycAction}
          </Link>
        </div>
      </Panel>
    );
  }

  const assets = [...new Set(offer.pairs.map((pair) => pair.asset))].join(", ");
  return (
    <>
      <Panel as="li" variant="card" className="isolate flex-row items-start gap-group" data-testid="pay-with-crypto">
        <IconPlate size="lg">
          <span className="block h-8 w-8">
            <BrandIcon name="flip-coin" fill tile={false} />
          </span>
        </IconPlate>
        <div className="min-w-0 flex-1">
          <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{t.optionTitle}</p>
          <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">
            {fill(t.optionBodyAssets, { assets, provider: offer.providerName })}
          </p>
          <div className="mt-row">
            <Button variant="secondary" full onClick={() => setOpen(true)}>
              {t.optionAction}
            </Button>
          </div>
        </div>
      </Panel>
      {open && (
        <CryptoSheet
          offer={offer}
          bookingId={bookingId}
          totalMinor={totalMinor}
          locale={locale}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CryptoSheet({
  offer,
  bookingId,
  totalMinor,
  locale,
  onClose,
}: {
  offer: Extract<CryptoOffer, { kind: "open" }>;
  bookingId: string;
  totalMinor: number;
  locale: Locale;
  onClose: () => void;
}) {
  const t = useScopedCopy("cryptoPay");
  const assets = useMemo(() => [...new Set(offer.pairs.map((pair) => pair.asset))], [offer.pairs]);
  const [asset, setAsset] = useState(assets[0] ?? "");
  const networks = offer.pairs.filter((pair) => pair.asset === asset);
  const [network, setNetwork] = useState(networks[0]?.network ?? "");
  const pair = offer.pairs.find((p) => p.asset === asset && p.network === network) ?? networks[0] ?? null;
  const [picker, setPicker] = useState<null | "asset" | "network">(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [refund, setRefund] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  const quote = async () => {
    if (!pair) return;
    setStep({ kind: "quoting" });
    const result = await getCryptoQuote({ bookingId, asset: pair.asset, network: pair.network });
    if (!result.ok) {
      banner.error(result.error);
      setStep({ kind: "pick" });
      return;
    }
    setStep({ kind: "quote", view: result.data });
  };

  const start = async (view: CryptoPaymentView) => {
    if (!refundAddressLooksValid(view.network, refund)) {
      setRefundError(fill(t.refundInvalid, { network: view.networkName }));
      return;
    }
    setRefundError(null);
    setStep({ kind: "starting", view });
    const result = await startCryptoPayment({ paymentId: view.id, refundAddress: refund.trim() });
    if (!result.ok) {
      banner.error(result.error);
      setStep({ kind: "quote", view });
      return;
    }
    setStep({ kind: "pay", view: result.data });
  };

  return (
    <>
      <Sheet open onOpenChange={(next) => (next ? undefined : onClose())} title={t.sheetTitle} closeLabel={t.done} detents={[0.92]}>
        <div className="grid gap-block pb-lg">
          {/* The dark hero over light content (reference 05): the one figure that matters. */}
          <div className="rounded-[var(--nf-radius-xl)] bg-[var(--nf-surface-inverse)] px-lg py-lg text-[var(--nf-content-on-inverse)]">
            <p className="nf-caption opacity-80">{step.kind === "pick" || step.kind === "quoting" ? t.chargeLabel : t.sendExactly}</p>
            {step.kind === "pick" || step.kind === "quoting" ? (
              <Amount
                minorUnits={totalMinor}
                locale={locale}
                showFraction
                className="nf-display mt-inline block font-bold leading-none"
                secondaryClassName="text-[length:max(0.55em,0.75rem)] font-semibold opacity-70"
              />
            ) : (
              <>
                <p className="nf-display mt-inline break-all font-bold leading-none">
                  {step.view.cryptoAmount} <span className="text-[length:max(0.55em,0.75rem)] font-semibold opacity-80">{step.view.asset}</span>
                </p>
                <p className="nf-body-sm mt-inline opacity-80">
                  {fill(t.worth, { amount: "" })}
                  <Amount minorUnits={step.view.amountMinor} locale={locale} showFraction />
                  {" · "}
                  {step.view.networkName}
                </p>
              </>
            )}
          </div>


          {(step.kind === "pick" || step.kind === "quoting") && (
            <>
              <Panel variant="card" className="grid gap-0 p-0">
                <PickerRow label={t.asset} value={offer.pairs.find((p) => p.asset === asset)?.assetName ?? asset} onClick={() => setPicker("asset")} />
                <div className="h-px bg-[var(--nf-border-subtle)]" />
                <PickerRow label={t.network} value={pair?.networkName ?? network} onClick={() => setPicker("network")} disabled={networks.length < 2} />
              </Panel>
              <Button variant="primary" size="lg" full onClick={quote} loading={step.kind === "quoting"} disabled={!pair || step.kind === "quoting"}>
                {step.kind === "quoting" ? t.gettingQuote : t.getQuote}
              </Button>
              <Button variant="secondary" full onClick={onClose}>
                {t.payAnotherWay}
              </Button>
            </>
          )}

          {(step.kind === "quote" || step.kind === "starting") && (
            <QuoteCard
              view={step.view}
              locale={locale}
              providerName={offer.providerName}
              refund={refund}
              refundError={refundError}
              onRefund={setRefund}
              busy={step.kind === "starting"}
              onConfirm={() => start(step.view)}
              onRequote={quote}
            />
          )}

          {step.kind === "pay" && (
            <CryptoPaymentStatus
              key={step.view.reference}
              initial={step.view}
              locale={locale}
              providerName={offer.providerName}
              onNewQuote={() => {
                setRefund("");
                setStep({ kind: "pick" });
              }}
              onPayAnotherWay={onClose}
            />
          )}
        </div>
      </Sheet>

      {/* The asset and network pickers as their own sheets: quiet rows, one ticked. */}
      <Sheet open={picker === "asset"} onOpenChange={(next) => (next ? undefined : setPicker(null))} title={t.pickAsset} closeLabel={t.done} detents={[0.5]}>
        <ChoiceList
          items={assets.map((a) => ({ id: a, label: offer.pairs.find((p) => p.asset === a)?.assetName ?? a }))}
          value={asset}
          onChoose={(id) => {
            setAsset(id);
            setNetwork(offer.pairs.find((p) => p.asset === id)?.network ?? "");
            setPicker(null);
          }}
        />
      </Sheet>
      <Sheet open={picker === "network"} onOpenChange={(next) => (next ? undefined : setPicker(null))} title={t.pickNetwork} closeLabel={t.done} detents={[0.5]}>
        <ChoiceList
          items={networks.map((n) => ({ id: n.network, label: n.networkName }))}
          value={network}
          onChoose={(id) => {
            setNetwork(id);
            setPicker(null);
          }}
        />
      </Sheet>
    </>
  );
}

function PickerRow({ label, value, onClick, disabled = false }: { label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[3.5rem] w-full items-center justify-between gap-sm px-md py-sm text-left disabled:cursor-default"
    >
      <span className="nf-body-sm text-[var(--nf-content-muted)]">{label}</span>
      <span className="flex items-center gap-inline">
        <span className="nf-body font-semibold text-[var(--nf-content-primary)]">{value}</span>
        {!disabled && <UiIcon name="chevron-down" size="xs" className="text-[var(--nf-content-muted)]" />}
      </span>
    </button>
  );
}

function ChoiceList({ items, value, onChoose }: { items: { id: string; label: string }[]; value: string; onChoose: (id: string) => void }) {
  return (
    <ul className="grid gap-3xs" role="listbox">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <li key={item.id} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onChoose(item.id)}
              className={`flex min-h-[3.25rem] w-full items-center justify-between rounded-[var(--nf-radius-md)] px-md text-left ${
                selected ? "bg-[var(--nf-surface-inset)]" : ""
              }`}
            >
              <span className="nf-body text-[var(--nf-content-primary)]">{item.label}</span>
              {selected && <UiIcon name="verified-badge" size="xs" className="text-[var(--nf-brand-primary)]" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function QuoteCard({
  view,
  locale,
  providerName,
  refund,
  refundError,
  onRefund,
  busy,
  onConfirm,
  onRequote,
}: {
  view: CryptoPaymentView;
  locale: Locale;
  providerName: string;
  refund: string;
  refundError: string | null;
  onRefund: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onRequote: () => void;
}) {
  const t = useScopedCopy("cryptoPay");
  const left = useCountdown(view.expiresAt);
  const expired = left <= 0;
  return (
    <div className="grid gap-block">
      <Panel variant="card">
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{t.quoteTitle}</p>
        <dl className="mt-row grid gap-sm">
          <div className="flex justify-between gap-sm">
            <dt className="nf-caption text-[var(--nf-content-muted)]">{t.rate}</dt>
            <dd className="nf-body-sm text-[var(--nf-content-primary)]">{fill(t.rateValue, { rate: view.rate, asset: view.asset })}</dd>
          </div>
          <div className="flex justify-between gap-sm">
            <dt className="nf-caption text-[var(--nf-content-muted)]">{fill(t.fee, { provider: providerName })}</dt>
            <dd className="nf-body-sm text-[var(--nf-content-primary)]">
              {view.feeMinor > 0 ? <Amount minorUnits={view.feeMinor} locale={locale} showFraction /> : t.feeNone}
            </dd>
          </div>
        </dl>
        <p
          className={`nf-caption mt-row ${expired ? "text-[var(--nf-state-warning)]" : "text-[var(--nf-content-muted)]"}`}
          aria-live={expired ? "polite" : "off"}
        >
          {expired ? t.expired : fill(t.expiresIn, { time: clock(left) })}
        </p>
      </Panel>

      {expired ? (
        <Button variant="primary" size="lg" full onClick={onRequote}>
          {t.newQuote}
        </Button>
      ) : (
        <>
          <TextField
            label={t.refundLabel}
            hint={fill(t.refundHelp, { network: view.networkName, provider: providerName })}
            value={refund}
            onChange={(event) => onRefund(event.target.value)}
            error={refundError ?? undefined}
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={false}
            inputMode="text"
          />
          <Button variant="primary" size="lg" full onClick={onConfirm} loading={busy} disabled={busy || refund.trim().length < 10}>
            {busy ? t.confirming : t.confirm}
          </Button>
        </>
      )}
    </div>
  );
}
