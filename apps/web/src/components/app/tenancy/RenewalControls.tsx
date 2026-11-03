"use client";

import { NairaField } from "@/components/ui/NairaField";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { answerExitAccount, answerRenewal, offerRenewal, relistFromTenancy } from "@/lib/tenancy/actions";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["tenancy"];

/**
 * The renewal clock's controls. V-93 and V-38.
 *
 * The lister confirms a renewal figure (fees start at nothing) and, from 90
 * days out, starts a relisting draft; the tenant says whether they are
 * renewing and, once the caution is settled, gives their account of the flat.
 * Every rule is the database door's; these forms collect and report.
 */
function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(work: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, after?: (data: unknown) => void) {
    setError(null);
    start(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? null);
          return;
        }
        if (after) after(result.data);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }
  return { pending, error, run };
}

export function RenewalOfferForm({
  tenancyId,
  rentNaira,
  serviceNaira,
  copy,
}: {
  tenancyId: string;
  rentNaira: string;
  serviceNaira: string;
  copy: Copy;
}) {
  const { pending, error, run } = useRun();
  const [rent, setRent] = useState(rentNaira);
  const [service, setService] = useState(serviceNaira);
  const [fees, setFees] = useState("");
  return (
    <form
      className="grid gap-md"
      data-testid="renewal-offer"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => offerRenewal({ tenancyId, rentNaira: rent, serviceNaira: service, feesNaira: fees }));
      }}
    >
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.renewalOfferHelp}</p>
      {/* Details pass: naira grouped as it is typed ("1,500,000"). */}
      <NairaField label={copy.renewalRent} value={rent} onValueChange={setRent} allowKobo />
      <NairaField label={copy.renewalServiceField} value={service} onValueChange={setService} allowKobo />
      <NairaField label={copy.renewalFeesField} value={fees} onValueChange={setFees} allowKobo error={error ?? undefined} />
      <Button type="submit" variant="primary" full loading={pending} disabled={pending || rent.trim() === ""}>
        {copy.renewalOfferSubmit}
      </Button>
    </form>
  );
}

export function RenewalAnswer({ tenancyId, copy }: { tenancyId: string; copy: Copy }) {
  const { pending, error, run } = useRun();
  return (
    <div data-testid="renewal-answer">
      <p className="nf-body-sm font-semibold">{copy.renewalAsk}</p>
      <div className="mt-xs flex flex-wrap gap-sm">
        <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => answerRenewal({ tenancyId, answer: "renewing" }))}>
          {copy.renewing}
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => answerRenewal({ tenancyId, answer: "leaving" }))}>
          {copy.leaving}
        </Button>
      </div>
      {error && (
        <p className="nf-caption mt-xs text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function RelistButton({ tenancyId, successorId, copy }: { tenancyId: string; successorId: string | null; copy: Copy }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  if (successorId) {
    return (
      <ButtonLink href={`/agent/list?id=${successorId}`} variant="secondary" full trailingIcon="arrow-right">
        {copy.relistOpen}
      </ButtonLink>
    );
  }
  return (
    <div className="grid gap-sm" data-testid="relist">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.relistHelp}</p>
      <Button
        variant="secondary"
        full
        loading={pending}
        disabled={pending}
        onClick={() =>
          run(
            () => relistFromTenancy({ tenancyId }),
            (data) => {
              const id = data && typeof data === "object" ? (data as Record<string, unknown>).listing_id : null;
              if (typeof id === "string") router.push(`/agent/list?id=${id}`);
            },
          )
        }
      >
        {copy.relistSubmit}
      </Button>
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ExitAccountForm({ tenancyId, copy }: { tenancyId: string; copy: Copy }) {
  const { pending, error, run } = useRun();
  const [light, setLight] = useState("");
  const [water, setWater] = useState("");
  const [flooding, setFlooding] = useState("");
  const pick = (label: string, value: string, set: (v: string) => void, options: Record<string, string>) => (
    <Field label={label}>
      {(control) => (
        <select {...control} className="nf-field" value={value} onChange={(e) => set(e.target.value)}>
          <option value="" disabled>
            {/* A word, not a dash: em dashes are out of the product's copy. */}
            {"Choose one"}
          </option>
          {Object.entries(options).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
  return (
    <form
      className="grid gap-md"
      data-testid="exit-account"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => answerExitAccount({ tenancyId, light, water, flooding }));
      }}
    >
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.exitHelp}</p>
      {pick(copy.exitLight, light, setLight, copy.exitLightOptions)}
      {pick(copy.exitWater, water, setWater, copy.exitWaterOptions)}
      {pick(copy.exitFlooding, flooding, setFlooding, copy.exitFloodingOptions)}
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" full loading={pending} disabled={pending || !light || !water || !flooding}>
        {copy.exitSubmit}
      </Button>
    </form>
  );
}
