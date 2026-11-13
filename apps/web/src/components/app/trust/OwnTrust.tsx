import type { Dictionary, Locale } from "@vallo/i18n/core";
import { personChecks } from "@/lib/trust/checks";
import { ownershipSeenFor } from "@/lib/trust/ownership-seen";
import { readPersonChecksResult, readPersonRegisters } from "@/lib/trust/person-checks-read";
import { readMyPromise } from "@/lib/trust/promise-actions";
import { OwnChecks, type OwnCheckRow } from "./OwnChecks";
import { PersonReasons } from "./PersonReasons";

/**
 * A MEMBER'S OWN TRUST CHECKS: what others see, and what can still be added.
 *
 * The first half is exactly what a visitor's page draws (`PersonReasons`,
 * the same rows and the same sheets), so a member sees their profile's trust
 * section as it is, not a kinder version of it. The second half is theirs
 * alone: the checks not yet on record, each with the real place it is done.
 *
 * "YOU CAN STILL ADD THIS" IS SAID ONLY ON EVIDENCE. A row is offered when
 * the read of the member's checks succeeded AND that date is absent. A read
 * that failed (the function is a pending migration) offers nothing, so a
 * member who confirmed their number is never told to confirm it. The promise
 * row follows its own read the same way.
 */
export async function OwnTrust({
  userId,
  isLister,
  locale,
  t,
}: {
  userId: string;
  /** An approved lister, who may also carry "ownership seen". */
  isLister: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const copy = t.trustReasons;
  const [result, promise, ownershipSeen, registers] = await Promise.all([
    readPersonChecksResult(userId),
    readMyPromise(),
    isLister ? ownershipSeenFor(userId) : Promise.resolve(null),
    isLister ? readPersonRegisters(userId) : Promise.resolve([]),
  ]);
  const facts = {
    ...result.facts,
    registers,
    ownershipSeenAt: ownershipSeen,
    /* The member's own acceptance is read from their own row as well, so it
       shows even before the public function is asked. */
    ...(promise.state === "accepted" ? { promiseAcceptedAt: promise.at } : {}),
  };
  const checks = personChecks(facts, copy, locale);

  const rows: OwnCheckRow[] = [];
  if (result.read && !facts.identitySeenAt) {
    rows.push({ key: "identity", title: copy.own.identity.title, how: copy.own.identity.how, href: "/verification" });
  }
  if (result.read && !facts.phoneConfirmedAt) {
    rows.push({ key: "phone", title: copy.own.phone.title, how: copy.own.phone.how, href: "/settings/phone" });
  }
  if (promise.state === "open") {
    rows.push({ key: "promise", title: copy.own.promise.title, how: copy.own.promise.how });
  }
  if (checks.length === 0 && rows.length === 0) return null;

  return (
    <section className="nf-reasons nf-reasons-slot" data-testid="own-trust">
      <PersonReasons title={copy.own.title} lede={copy.own.lede} stats={[]} checks={checks} labels={copy.sheet} testId="own-reasons" />
      <OwnChecks rows={rows} words={{ ...copy.own, close: copy.sheet.close }} />
    </section>
  );
}
