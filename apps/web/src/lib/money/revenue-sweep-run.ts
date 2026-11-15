import "server-only";

import { normalisePayoutWord } from "../payments/providers/escrowpay/normaliser";
import { readAvailableMinor, readPayout, readWallets } from "../payments/providers/escrowpay/read";
import { walletBalancesCall, walletPayoutCall, walletsCall } from "../payments/providers/escrowpay/requests";
import { failureCode } from "../payments/providers/escrowpay/errors";
import { provablyNothing, providerReachable, type ProtectedRailDeps } from "./protected-provider";
import { decideSweep, holdNeedsAPerson, sweepReason, type SweepHold } from "./revenue-sweep";

/**
 * MOVING VALLO'S OWN EARNINGS TO THE BANK: the part that talks to the payment
 * partner and to the database. The rules live in `revenue-sweep.ts`, which is
 * pure; this file carries them out.
 *
 * THE ORDER MATTERS, and it is: finish any sweep already open, and only then
 * consider a new one. A sweep is opened in Vallo's database BEFORE the
 * request goes to the partner, so a run that dies mid-flight leaves a record
 * of what was asked for. The database allows exactly one unfinished sweep at
 * a time (a partial unique index), so the same balance can never go twice.
 *
 * AN OPEN SWEEP IS RETRIED WITH THE SAME IDEMPOTENCY KEY. That is the whole
 * point of the key: if the earlier request reached the partner, the partner
 * answers with the one payout it already made rather than making a second; if
 * it never arrived, the payout is made now. Either way one payout exists.
 *
 * Nothing here can touch a member's money: a wallet payout names Vallo's own
 * payout account, which is owned by the business and set in the deployment's
 * own settings, never computed, never read from a member's record.
 */

export const SWEEP_PROVIDER = "escrowpay";
export const SWEEP_CURRENCY = "NGN";

/** The switch, and the deployment setting that names where the money goes. */
export const SWEEP_FLAG = "payments_escrowpay_sweep_on";
export const SWEEP_DESTINATION_VAR = "ESCROWPAY_SWEEP_PAYOUT_ACCOUNT_ID";

export type SweepOutcome =
  | { kind: "held"; hold: SweepHold }
  | { kind: "not_set_up" }
  | { kind: "no_partner_key" }
  | { kind: "sent"; amountMinor: number; payoutId: string | null }
  | { kind: "still_sending"; amountMinor: number }
  | { kind: "failed"; amountMinor: number; why: string }
  | { kind: "unknown"; amountMinor: number; why: string };

export type SweepDeps = ProtectedRailDeps & {
  /** Vallo's own payout account at the partner, from the deployment settings. */
  destination: string | null;
  /** The founder's switch for the sweep alone. */
  sweepOn: () => Promise<boolean>;
};

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string | null; message?: string | null } | null }> };

const obj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const whole = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) ? n : null;
};

/** A function the sweep SQL has not created yet. Expected, not a failure. */
function notDeployed(error: { code?: string | null; message?: string | null } | null): boolean {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  return code === "42883" || code === "PGRST202" || message.includes("could not find the function") || message.includes("does not exist");
}

type OpenSweep = { id: string; amountMinor: number; walletId: string | null };

export type SweepState = { unsettled: boolean; open: OpenSweep | null };

async function readState(deps: SweepDeps, environment: string): Promise<SweepState | null> {
  const { data, error } = await (deps.db as unknown as Rpc).rpc("revenue_sweep_state", { p_provider: SWEEP_PROVIDER, p_environment: environment });
  if (error) {
    if (notDeployed(error)) return null;
    throw new Error(`revenue_sweep_state: ${error.message ?? error.code ?? "rpc error"}`);
  }
  const answer = obj(data);
  if (!answer) return null;
  const open = obj(answer.open);
  const id = open && typeof open.id === "string" ? open.id : null;
  const amountMinor = open ? whole(open.amount_minor) : null;
  return {
    unsettled: answer.unsettled === true,
    open: id && amountMinor !== null ? { id, amountMinor, walletId: typeof open?.wallet_id === "string" ? open.wallet_id : null } : null,
  };
}

async function settle(deps: SweepDeps, id: string, status: "sent" | "failed" | "unknown", payoutId: string | null, failure: string | null): Promise<void> {
  const { error } = await (deps.db as unknown as Rpc).rpc("revenue_sweep_settle", {
    p_id: id,
    p_status: status,
    p_provider_payout_id: payoutId,
    p_failure: failure,
  });
  if (error) throw new Error(`revenue_sweep_settle: ${error.message ?? error.code ?? "rpc error"}`);
}

/**
 * Send one payout for an open sweep and record whatever came back. The same
 * call for a first attempt and for a retry, because the idempotency key makes
 * them the same request to the partner.
 */
async function sendAndSettle(deps: SweepDeps, sweep: OpenSweep, walletId: string, destination: string): Promise<SweepOutcome> {
  const answer = await deps.send(
    deps.config,
    walletPayoutCall({ walletId, payoutAccountId: destination, amountMinor: sweep.amountMinor, sweepId: sweep.id, reason: sweepReason() }),
  );

  if (!answer.ok) {
    /* The partner refused and made nothing: the sweep failed and the balance
       is still there to try again next run. */
    if (provablyNothing(answer)) {
      const why = failureCode(answer) ?? answer.kind;
      await settle(deps, sweep.id, "failed", null, `The partner refused the payout: ${why}.`);
      return { kind: "failed", amountMinor: sweep.amountMinor, why };
    }
    /* A timeout or an unreadable answer. The money may or may not have moved,
       so the sweep stays open and the next run asks again with the same key. */
    await settle(deps, sweep.id, "unknown", null, `No readable answer from the partner: ${answer.kind}.`);
    await deps.alert("revenue_sweep.unknown", { sweep_id: sweep.id, amount_minor: sweep.amountMinor, why: answer.kind });
    return { kind: "unknown", amountMinor: sweep.amountMinor, why: answer.kind };
  }

  const payout = readPayout(answer.value);
  const state = normalisePayoutWord(payout?.status);
  if (state === "paid") {
    await settle(deps, sweep.id, "sent", payout?.id ?? null, null);
    return { kind: "sent", amountMinor: sweep.amountMinor, payoutId: payout?.id ?? null };
  }
  if (state === "failed" || state === "reversed") {
    await settle(deps, sweep.id, "failed", payout?.id ?? null, `The partner's payout came back ${state}.`);
    return { kind: "failed", amountMinor: sweep.amountMinor, why: state };
  }
  /* Accepted and on its way, or a word nobody has read before. Either way it
     stays open and the next run reads it back with the same key. */
  await settle(deps, sweep.id, "unknown", payout?.id ?? null, state === null ? "The partner's payout status could not be read." : null);
  return { kind: "still_sending", amountMinor: sweep.amountMinor };
}

/** The wallet Vallo's own earnings sit in, or null when it cannot be found. */
async function findWallet(deps: SweepDeps): Promise<string | null> {
  const answer = await deps.send(deps.config, walletsCall(SWEEP_CURRENCY));
  if (!answer.ok) return null;
  const wallets = readWallets(answer.value).filter((w) => w.currency === null || w.currency === SWEEP_CURRENCY);
  /* Exactly one, or none. Two wallets in one currency is a shape nobody has
     read yet, and picking one of them would be a guess about money. */
  return wallets.length === 1 ? wallets[0]!.id : null;
}

export async function runRevenueSweep(deps: SweepDeps): Promise<SweepOutcome> {
  if (!providerReachable(deps)) return { kind: "no_partner_key" };
  const environment = deps.config?.environment ?? null;
  if (!environment) return { kind: "no_partner_key" };

  const state = await readState(deps, environment);
  if (state === null) return { kind: "not_set_up" };

  const destination = deps.destination?.trim() ? deps.destination.trim() : null;

  /* An open sweep is finished first, whatever the switch says now: money that
     may already have left has to be accounted for either way. */
  if (state.open) {
    if (!destination) {
      await deps.alert("revenue_sweep.no_destination_with_open_sweep", { sweep_id: state.open.id });
      return { kind: "held", hold: "no_destination" };
    }
    const walletId = state.open.walletId ?? (await findWallet(deps));
    if (!walletId) return { kind: "held", hold: "balance_unreadable" };
    return sendAndSettle(deps, state.open, walletId, destination);
  }

  const switchedOn = await deps.sweepOn();
  /* Reading the balance costs a request, so the cheap refusals come first. */
  const early = decideSweep({ availableMinor: 0, unsettled: false, destinationSet: destination !== null, switchedOn });
  if (!early.move && (early.hold === "switched_off" || early.hold === "no_destination")) return { kind: "held", hold: early.hold };

  const walletId = await findWallet(deps);
  if (!walletId) {
    await deps.alert("revenue_sweep.wallet_unreadable", { environment });
    return { kind: "held", hold: "balance_unreadable" };
  }

  const balances = await deps.send(deps.config, walletBalancesCall(walletId));
  const availableMinor = balances.ok ? readAvailableMinor(balances.value, SWEEP_CURRENCY) : null;
  const decision = decideSweep({ availableMinor, unsettled: false, destinationSet: true, switchedOn });
  if (!decision.move) {
    if (holdNeedsAPerson(decision.hold)) {
      await deps.alert(`revenue_sweep.${decision.hold}`, { environment, wallet_id: walletId, available_minor: availableMinor });
    }
    return { kind: "held", hold: decision.hold };
  }

  const { data, error } = await (deps.db as unknown as Rpc).rpc("revenue_sweep_open", {
    p_provider: SWEEP_PROVIDER,
    p_environment: environment,
    p_currency: SWEEP_CURRENCY,
    p_amount_minor: decision.amountMinor,
    p_wallet_id: walletId,
  });
  if (error) throw new Error(`revenue_sweep_open: ${error.message ?? error.code ?? "rpc error"}`);
  const opened = obj(data);
  /* Another run got there first. Nothing was sent and nothing is owed. */
  if (opened?.status === "already_open") return { kind: "held", hold: "waiting_on_earlier_sweep" };
  const id = opened && typeof opened.id === "string" ? opened.id : null;
  if (opened?.status !== "ok" || !id) throw new Error(`revenue_sweep_open: answered ${String(opened?.status ?? "nothing")}`);

  return sendAndSettle(deps, { id, amountMinor: decision.amountMinor, walletId }, walletId, destination!);
}
