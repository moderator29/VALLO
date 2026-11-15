/**
 * THE LINK FROM A DOUBTED IDENTITY CHECK TO TRUST AND SAFETY.
 *
 * The escalation form lives at `/admin/escalations/new` and reads three
 * query values (a fixed contract with that page):
 *   category   always `identity_fraud` from this desk
 *   record     the admin path of the record being escalated
 *   label      a few words naming it for the person who picks it up
 *
 * The record is the member's person file, which has its own door. NOTHING
 * ELSE GOES IN THE LINK: no ID number, no document id, no finding. A web
 * address is kept in browser history and server logs, so it carries only
 * what those may hold.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ESCALATION_CATEGORY = "identity_fraud";

/** The admin path of the record an identity check is about. */
export function identityRecordPath(userId: string | null | undefined): string {
  return userId && UUID.test(userId) ? `/admin/people/${userId}` : "/admin/kyc";
}

export function identityEscalationLabel(displayName: string | null | undefined): string {
  const name = (displayName ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return `Identity check for ${name === "" ? "a member" : name}`;
}

export function identityEscalationHref(userId: string | null | undefined, displayName: string | null | undefined): string {
  const record = encodeURIComponent(identityRecordPath(userId));
  const label = encodeURIComponent(identityEscalationLabel(displayName));
  return `/admin/escalations/new?category=${ESCALATION_CATEGORY}&record=${record}&label=${label}`;
}
