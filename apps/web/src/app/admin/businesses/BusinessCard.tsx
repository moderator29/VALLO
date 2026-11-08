import { RemoteImage } from "@/components/ui/RemoteImage";
import { countOf } from "@vallo/i18n";
import { BUSINESS_RUNGS, type BusinessQueueRow } from "@/lib/admin/business-queries";
import { BUSINESS_LADDER, BUSINESS_TIER_NAME, asBusinessTier } from "@/lib/admin/business-ladder";
import { decisionsOffered, isOwnBusiness } from "@/lib/admin/business-decision";
import type { AdminUi } from "../_components/ui";
import { BusinessReviewDecision, PublishControl, RungDecision } from "./BusinessDecisions";
import { ReviewCallAction } from "@/components/calls/admin/ReviewCallAction";
import { DocumentViewer } from "../_components/DocumentViewer";

/** The four rungs in ladder order, with the ladder's own words. */
const RUNGS = BUSINESS_RUNGS.map((rung) => ({
  rung,
  label: BUSINESS_LADDER[rung].label,
  /** What the reviewer actually does to settle this rung. The ladder's words. */
  meaning: BUSINESS_LADDER[rung].reviewerDoes,
}));

type Check = { label: string; pass: boolean; detail: string };

/**
 * What this venue has, split into what stops it going live and what does not.
 *
 * The blocking half is `publishRestaurant`'s gate, restated in the reviewer's
 * words so the screen and the server cannot quietly disagree about what is
 * required. The second half is everything the page reads to be a real place
 * rather than a directory entry: none of it blocks, all of it is worth a
 * telephone call.
 */
function restaurantChecks(row: BusinessQueueRow): { blocking: Check[]; thin: Check[] } {
  const windows = row.restaurant?.windowCount ?? 0;
  const cuisines = row.restaurant?.cuisineCount ?? 0;
  return {
    blocking: [
      {
        label: "A service with hours and a guest number",
        pass: windows > 0,
        detail:
          windows > 0
            ? `${countOf(windows, "serviceWindows")} on record, and every one of them seats at least one guest.`
            : "None. Every request for a table would be refused with 'that restaurant does not seat guests at that time', and the owner would watch a page that looks fine take no bookings.",
      },
      {
        label: "A city and a state",
        pass: Boolean(row.city && row.stateCode),
        detail:
          row.city && row.stateCode
            ? [row.area, row.city, row.stateCode].filter(Boolean).join(", ")
            : "Missing. Every shelf in the product finds a venue by its city and state, so this one would be live and unreachable.",
      },
      {
        label: "A phone number somebody answers",
        pass: Boolean(row.phone),
        detail: row.phone
          ? row.phone
          : "Missing. When the app is not enough, a late guest or a grown party has no way to reach the venue.",
      },
      {
        label: "First party, and not an example",
        pass: row.kind === "restaurant",
        detail:
          row.kind === "restaurant"
            ? "A restaurant on the first-party queue, so a table request can reach it."
            : "This row is not a restaurant, so it goes live from its property rather than from here.",
      },
    ],
    thin: [
      {
        label: "A price band",
        pass: (row.restaurant?.priceBand ?? 0) > 0,
        detail:
          (row.restaurant?.priceBand ?? 0) > 0
            ? `Band ${row.restaurant?.priceBand} of 4. A band, never an amount per head the venue would have to honour.`
            : "Not set. The application asks for it, so a venue without one was created by hand.",
      },
      {
        label: "What they serve",
        pass: cuisines > 0,
        detail:
          cuisines > 0
            ? `${countOf(cuisines, "cuisines")}. The first shows on the fact strip, the rest become tags.`
            : "None. The fact strip on the venue's page stays empty, which reads as a record nobody finished.",
      },
      {
        label: "Photographs of the venue",
        pass: row.photoCount > 0,
        detail:
          row.photoCount > 0
            ? `${row.photoCount} on record, cover first.`
            : "None. The page draws a Vallo category plate under a 'No photographs yet' chip, so nobody is misled, and the owner's own pictures are worth chasing in the first week.",
      },
    ],
  };
}

/** One application, in full. Exported so the preview harness can draw it. */
export function BusinessCard({
  row,
  ui,
  viewerId = null,
}: {
  row: BusinessQueueRow;
  ui: AdminUi;
  /**
   * The reviewer looking at the card. On their own business every control is
   * withheld and the card says why: the actions refuse it too, and a button
   * that can only be refused is not a control.
   */
  viewerId?: string | null;
}) {
  const isRestaurant = row.kind === "restaurant";
  const checks = restaurantChecks(row);
  const blocked = checks.blocking.filter((check) => !check.pass).length;
  const own = viewerId !== null && isOwnBusiness(row.ownerId, viewerId);
  /* The hands the server would accept for this state, so a suspended or a
     draft business is not offered a decision, and an approved one is not
     offered Approve a second time. */
  const offered = own ? [] : decisionsOffered(row.status);
  const decidable = offered.length > 0;
  const publishable = !own && isRestaurant && row.status === "APPROVED";
  /* A property goes live only under an approved business, and the action
     says so; the control used to be drawn on every draft property, under a
     business nobody had read, to be refused when pressed. */
  const propertiesPublishable = !own && (row.status === "APPROVED" || row.status === "PUBLISHED");
  const hasIdentityDocument = row.documents.some((doc) => doc.kind === "identity");
  const tier = asBusinessTier(row.verificationTier);
  const decided = new Map(row.rungs.map((rung) => [rung.rung, rung]));

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-card sm:p-card-lg">
      <div className="flex flex-wrap items-center gap-inline">
        <ui.StatusChip status={row.status} />
        <ui.StatusChip label={ui.columnLabel("businessKind", row.kind)} tone="neutral" />
        {/* Edited and sent again after a refusal or a change request. The
            decision it answers is under "Decisions so far". */}
        {row.resubmission && <ui.StatusChip label="Resubmission" tone="warning" />}
        {blocked > 0 && isRestaurant && (
          <ui.StatusChip
            label={countOf(blocked, "thingsStopLive")}
            tone="warning"
          />
        )}
        <span className="nf-overline ml-auto">
          {row.submittedAt ? `Sent ${ui.when(row.submittedAt)}` : `Started ${ui.when(row.createdAt)}`}
        </span>
      </div>

      <h3 className="nf-h4 mt-row">{row.name}</h3>
      <p className="nf-caption mt-inline-tight">
        {[row.area, row.city, row.stateCode].filter(Boolean).join(", ") || "No place on record"}
        {" · "}
        {/* THE LADDER'S OWN WORD FOR TIER 0 IS "Approved", which is right on a
            host's status page and reads as a contradiction here, beside a chip
            that says SUBMITTED. A venue with no rung recorded is told so
            plainly instead. */}
        {tier === 0
          ? "No rung recorded yet"
          : `Level ${tier} of 4, ${BUSINESS_TIER_NAME[tier].toLowerCase()}`}
      </p>

      {isRestaurant && (
        <>
          <ui.DetailSection title="Before it can go live">
            <ul className="mt-inline">
              {checks.blocking.map((check) => (
                <ui.CheckRow
                  key={check.label}
                  label={check.label}
                  pass={check.pass}
                  detail={check.detail}
                />
              ))}
            </ul>
          </ui.DetailSection>

          <ui.DetailSection title="Worth chasing, but nothing waits on it">
            <ul className="mt-inline">
              {checks.thin.map((check) => (
                <ui.CheckRow
                  key={check.label}
                  label={check.label}
                  pass={check.pass}
                  detail={check.detail}
                />
              ))}
            </ul>
          </ui.DetailSection>
        </>
      )}

      {row.properties.length > 0 && (
        <ui.DetailSection title="Properties">
          {row.properties.map((property) => (
            <div key={property.id} className="border-t border-[var(--nf-brand-edge-soft)] py-row">
              <div className="flex flex-wrap items-center gap-inline">
                <span className="nf-body font-semibold text-content">{property.name}</span>
                <ui.StatusChip status={property.status} />
              </div>
              <p className="nf-caption mt-inline-tight">
                {property.hasPin ? "Pin set" : "No pin"} · {countOf(property.photoCount, "photos")} ·{" "}
                {countOf(property.roomTypeCount, "roomTypes")} · {countOf(property.ratePlanCount, "ratePlans")}
              </p>
              {/*
                THE PICTURES, NOT A COUNT OF THEM. The property desk has shown
                a reviewer every photograph on a listing since it was built and
                this desk showed a number, which is backwards: a stay is sold
                almost entirely on its pictures, and the reviewer is the last
                person who can see that the room photographed is not the room
                described. A count was all that could honestly be drawn while
                nothing in the product could upload one, and that is no longer
                true.

                Public bucket URLs, as on the property desk, so `next/image`
                can size them: a reviewer opening a hotel should not be pulling
                ten full size uploads down a strip of 128px thumbnails.
              */}
              {property.photos.length > 0 && (
                <ul className="mt-inline flex gap-inline overflow-x-auto pb-2xs">
                  {property.photos.map((photo, index) => (
                    <li key={photo} className="shrink-0">
                      <RemoteImage
                        src={photo}
                        alt={
                          index === 0
                            ? `${property.name}, the photograph guests see first`
                            : `${property.name}, photograph ${index + 1}`
                        }
                        loading="lazy"
                        width={128}
                        height={96}
                        sizes="128px"
                        className="h-24 w-32 rounded-md border border-[var(--nf-border-subtle)] object-cover"
                      />
                    </li>
                  ))}
                </ul>
              )}
              {propertiesPublishable && (property.status === "APPROVED" || property.status === "DRAFT") ? (
                <PublishControl
                  target={{ kind: "property", accommodationId: property.id }}
                  label={property.name}
                />
              ) : null}
            </div>
          ))}
        </ui.DetailSection>
      )}

      <ui.DetailSection title="The application">
        <ui.DetailRow label="Representative" value={row.representativeName} />
        <ui.DetailRow label="Their phone" value={row.representativePhone} />
        <ui.DetailRow label="Account" value={row.ownerName} />
        <ui.DetailRow label="Business phone" value={row.phone} />
        <ui.DetailRow label="Business email" value={row.email} />
        <ui.DetailRow label="Address" value={row.address} />
        <ui.DetailRow label="Registered name" value={row.registeredName} />
        <ui.DetailRow label="CAC number" value={row.cacNumber} />
        <ui.DetailRow label="Tax id" value={row.tin} />
        <ui.DetailRow
          label="Bank name returned"
          value={
            row.payoutName ? (
              <>
                {row.payoutName}
                {row.payoutBank ? `, ${row.payoutBank}` : ""}
                {row.payoutNameMismatch && (
                  <span className="mt-inline-tight block text-[var(--nf-state-warning)]">
                    Shares no word with the representative or the registered name. A prompt to
                    look, never a refusal: people bank under names that do not match their
                    paperwork for honest reasons.
                  </span>
                )}
              </>
            ) : null
          }
        />
        <ui.DetailRow
          label="Hygiene attestation"
          value={
            row.hygieneAttestedAt
              ? `Stated ${ui.when(row.hygieneAttestedAt)} by ${row.representativeName ?? "the representative"}`
              : null
          }
        />
        <ui.DetailRow
          label="Licence attestation"
          value={row.licenceAttestedAt ? `Stated ${ui.when(row.licenceAttestedAt)}` : null}
        />
        <ui.DetailRow
          label="Permissions"
          value={
            Object.keys(row.consents).length === 0 ? null : (
              <ul>
                {Object.entries(row.consents).map(([id, at]) => (
                  <li key={id} className="nf-caption">
                    {CONSENT_WORDS[id] ?? id}: {ui.when(at)}
                  </li>
                ))}
              </ul>
            )
          }
        />
        {row.consentWithdrawals.length > 0 && (
          <ui.DetailRow
            label="Withdrawn"
            value={
              <ul>
                {row.consentWithdrawals.map((entry) => (
                  <li key={`${entry.id}-${entry.at}`} className="nf-caption">
                    {CONSENT_WORDS[entry.id] ?? entry.id}: withdrawn {ui.when(entry.at)}
                  </li>
                ))}
              </ul>
            }
          />
        )}
        {row.reviewNotes && <ui.DetailRow label="Last note sent" value={row.reviewNotes} />}
        {row.reviewedAt && <ui.DetailRow label="Last decided" value={ui.when(row.reviewedAt)} />}
      </ui.DetailSection>

      {row.history.length > 0 && (
        <ui.DetailSection title="Decisions so far">
          <ul className="mt-inline grid gap-inline">
            {row.history.map((entry) => (
              <li key={`${entry.at}-${entry.decision}`} className="nf-caption">
                <span className="font-semibold">
                  {entry.decision === "approve"
                    ? "Approved"
                    : entry.decision === "reject"
                      ? "Refused"
                      : entry.decision === "more_info"
                        ? "Sent back for a change"
                        : entry.decision}
                </span>{" "}
                {ui.when(entry.at)}
                {entry.reviewerName ? ` by ${entry.reviewerName}` : ""}
                {entry.note ? ` · ${entry.note}` : ""}
              </li>
            ))}
          </ul>
        </ui.DetailSection>
      )}

      <ui.DetailSection title="Papers">
        {row.documents.length === 0 ? (
          <p className="nf-caption">Nothing uploaded.</p>
        ) : (
          row.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center gap-inline border-t border-[var(--nf-brand-edge-soft)] py-row"
            >
              <span className="nf-body-sm font-semibold text-content">
                {DOCUMENT_WORDS[doc.kind] ?? doc.kind}
              </span>
              <span className="nf-overline">{ui.when(doc.uploadedAt)}</span>
              {/* Opened in place: this was a signed Supabase URL in a
                  `target="_blank"` anchor, which read a driving licence on
                  somebody else's origin. */}
              <DocumentViewer
                documentId={doc.id}
                media={doc.media}
                label="Open the file"
                title={DOCUMENT_WORDS[doc.kind] ?? doc.kind}
                className="nf-tap nf-caption ml-auto font-semibold underline"
              />
            </div>
          ))
        )}
      </ui.DetailSection>

      {/* Every row on this queue is first party: `getBusinessQueue` filters on
          it, and a partner venue carries no ladder because the ladder is a
          record about a human being that Vallo checked. */}
      {(
        <ui.DetailSection title="The verification ladder">
          <p className="nf-caption">
            One rung, one decision, one row. The level is the rungs passed with no gap below them
            and is computed by the database, never typed. The identity rung is the only thing in
            the product that means a human was checked, and a restaurant still shows no mark of any
            kind on its own page, so nothing here should be described to a host as
            a badge.
          </p>
          {RUNGS.map(({ rung, label, meaning }) => {
            const already = decided.get(rung);
            return (
              <div key={rung} className="border-t border-[var(--nf-brand-edge-soft)] py-row">
                <div className="flex flex-wrap items-center gap-inline">
                  <span className="nf-body font-semibold text-content">{label}</span>
                  {already && (
                    <ui.StatusChip
                      label={already.status === "passed" ? "Passed" : "Did not pass"}
                      tone={already.status === "passed" ? "success" : "danger"}
                    />
                  )}
                </div>
                <p className="nf-caption mt-inline-tight">{meaning}</p>
                {already && (
                  <p className="nf-caption mt-inline-tight">
                    {ui.when(already.decidedAt)}
                    {already.reviewerName ? ` by ${already.reviewerName}` : ""}
                    {already.note ? ` · ${already.note}` : ""}
                  </p>
                )}
                {own ? null : (
                  <RungDecision
                    businessId={row.id}
                    rung={rung}
                    label={label}
                    evidenced={rung !== "identity" || hasIdentityDocument}
                    missingEvidence={
                      rung === "identity"
                        ? "No identity document is on file, so there is nothing to check a person against. This rung is what the verified mark is derived from, and it cannot be recorded on nothing."
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </ui.DetailSection>
      )}

      {publishable && (
        <PublishControl target={{ kind: "restaurant", businessId: row.id }} label={row.name} />
      )}

      {own ? (
        <p className="nf-caption mt-group" role="note" data-testid="business-own">
          This business is yours, so another reviewer decides it, records its checks and puts it on
          the shelf. Every decision is in the audit log.
        </p>
      ) : decidable ? (
        <>
          <BusinessReviewDecision businessId={row.id} name={row.name} offered={offered} />
          {/* VC1: a review call with the owner (KYC scope, both switches on). */}
          <ReviewCallAction caseKind="business_verification" caseId={row.id} />
        </>
      ) : (
        <p className="nf-overline mt-group">
          {row.status === "PUBLISHED"
            ? isRestaurant
              ? "Live, and taking tables."
              : "Live, and open to guests."
            : row.status === "SUSPENDED"
              ? "Suspended. A review decision does not lift a suspension."
              : row.status === "DRAFT"
                ? "Still a draft. Nothing has been sent to review."
                : "Closed."}{" "}
          Every decision is in the audit log.
        </p>
      )}
    </li>
  );
}

/** The three consents, named for a reader. Keys are `businesses.consents`. */
const CONSENT_WORDS: Record<string, string> = {
  accuracy: "The documents are genuine and the details accurate",
  terms: "Host terms and the privacy policy",
  processing: "Identity and fraud checks",
};

/** `business_documents.kind`, named for a reader rather than printed raw. */
const DOCUMENT_WORDS: Record<string, string> = {
  identity: "Government issued ID",
  registration: "CAC certificate",
  association: "Authority to act for the business",
  licence: "State hospitality licence",
  hygiene: "Health permit",
};
