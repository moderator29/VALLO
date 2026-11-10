/**
 * The review desks' proof harness (rule R-G): the real desk components
 * on fixture props, behind the preview gate, so anyone can re-run the proof
 * shots and the shape sweep. `/preview/session-b/admin-review/<desk>` with
 * desk one of listings, review, moderation, kyc; `?empty=1` draws the empty
 * state, which is the state the live database is in. EVERY FIGURE HERE IS A
 * FIXTURE and none of it reaches a database or can take a decision that lands.
 */
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import type { ListingReviewView } from "@/lib/admin/queries";
import { adminUi } from "@/app/admin/_components/ui";
import { AdminFrame } from "@/app/admin/_components/AdminFrame";
import { ListingsQueue } from "@/app/admin/listings/ListingsQueue";
import { MandatesPanel } from "@/app/admin/listings/MandatesPanel";
import { ListingReview } from "@/app/admin/listings/[id]/ListingReview";
import { ReviewActionBar } from "@/app/admin/listings/[id]/ReviewActionBar";
import { ModerationDesk } from "@/app/admin/_lanes/ModerationDesk";
import { VerificationDesk } from "@/app/admin/kyc/VerificationDesk";
import { Pager } from "@/app/admin/_review/parts";
import type { QueueRow } from "@/app/admin/listings/rows";
import { listingStatusWord } from "@/app/admin/listings/tabs";
import "@/app/admin/_review/review.css";

export const dynamic = "force-dynamic";

const P = "/brand/photos/";
const PHOTOS = [
  "villa-pool-skyline-01.jpg",
  "villa-pool-terrace.webp",
  "living-room-dusk.webp",
  "bedroom-01.webp",
  "bathroom-01.webp",
  "living-room-dusk.webp",
  "bedroom-02.webp",
  "villa-pool-portrait.webp",
  "resort-pool-deck.webp",
].map((f) => P + f);

const LISTING: ListingReviewView = {
  id: "00000000-0000-4000-8000-0000000000aa",
  reference: null,
  title: "Three Bedroom Flat in Lekki Phase One",
  status: "SUBMITTED",
  propertyType: "apartment",
  intent: "rent",
  pricePeriod: "year",
  priceMinor: 250_000_000,
  moveIn: {
    parts: [
      { key: "rent", label: "Rent (yearly)", minor: 250_000_000 },
      { key: "agency", label: "Agency fee", minor: 25_000_000 },
      { key: "legal", label: "Legal fee", minor: 5_000_000 },
      { key: "caution", label: "Caution deposit", minor: 20_000_000 },
      { key: "service", label: "Service charge (yearly)", minor: 10_000_000 },
    ],
    totalMinor: 310_000_000,
    totalStated: false,
  },
  purchase: null,
  tenure: null,
  saleStatus: null,
  city: "Lagos",
  area: "Lekki",
  stateCode: "LA",
  address: "Admiralty Way, Lekki Phase One",
  description:
    "A three bedroom flat on the second floor of a new block, with a fitted kitchen and a balcony. The estate has a gate, a security desk and a borehole.",
  bedrooms: 3,
  bathrooms: 3,
  agentName: "Tunde Adeyemi",
  photos: PHOTOS,
  videos: [{ url: null, posterUrl: P + "living-room-dusk.webp", durationSeconds: 60 }],
  utilities: {
    powerGrid: "BAND_A",
    powerBackup: "GENERATOR",
    powerBackupHours: 6,
    waterSupply: "BOREHOLE",
    prepaidMeter: true,
  },
  facts: {
    sizeSqm: 180,
    toilets: 4,
    parkingSpaces: 2,
    floor: 2,
    totalFloors: 4,
    condition: "newly_built",
    yearBuilt: 2025,
    furnished: "fully_furnished",
  },
  access: { estateName: "Admiralty Court", answered: 3 },
  amenityCount: 6,
  submittedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  reviewedAt: null,
  reviewNotes: null,
  createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  checks: [
    { label: "Three photos or videos", pass: true, detail: "9 photos and 1 video" },
    { label: "Cover photo set", pass: true, detail: "First photo is the cover" },
    { label: "Title of 8 to 80 characters", pass: true, detail: "Three Bedroom Flat in Lekki Phase One" },
    { label: "Area and city recorded", pass: true, detail: "Lekki, Lagos" },
    { label: "Price recorded in naira", pass: true, detail: "per year" },
    { label: "Bedrooms and bathrooms recorded", pass: true, detail: "3 bedrooms, 3 bathrooms" },
    { label: "Amenities chosen", pass: true, detail: "6 selected" },
    { label: "Description of 40 words or more", pass: false, detail: "27 words" },
    { label: "No contact or payment details in the text", pass: true, detail: "Clean" },
  ],
};


function rows(): QueueRow[] {
  const base: [string, string, string, string, string | null, string, number, string, boolean][] = [
    ["LST-7K4M92", "Apartment", "Lekki, Lagos", "Tunde A.", "Owner", "₦2,500,000 per year", 2, "SUBMITTED", false],
    ["LST-3RP911", "Home", "Ikoyi, Lagos", "Amaka J.", "Agent", "₦4,200,000 per year", 4, "APPROVED", false],
    ["LST-9D2K77", "Land", "Bwari, Abuja", "Chinedu R.", "Owner", "₦1,800,000", 5, "SUBMITTED", false],
    ["LST-5M7Q33", "Shortlet", "Wuse, Abuja", "Fatima B.", "Agent", "₦120,000 per night", 6, "MORE_INFO_REQUIRED", false],
    ["LST-2N6H88", "Apartment", "Surulere, Lagos", "Bola T.", "Owner", "₦1,700,000 per year", 8, "REJECTED", false],
    ["LST-8L3L45", "Restaurant", "Yaba, Lagos", "Daniel K.", "Firm", "₦350,000 per month", 9, "APPROVED", false],
    ["LST-4P2T19", "Hotel", "Maitama, Abuja", "Grace E.", "Agent", "₦8,500,000 per year", 10, "SUBMITTED", true],
    ["LST-6R9D62", "Land", "Gwarinpa, Abuja", "Ifeanyi C.", "Owner", "₦2,200,000", 12, "APPROVED", false],
  ];
  return base.map(([reference, typeLabel, address, lister, listerRole, price, age, status, isExample], i) => ({
    id: `row-${i}`,
    href: "#",
    reference,
    typeLabel,
    thumb: PHOTOS[i % PHOTOS.length] ?? null,
    address,
    lister,
    listerRole,
    isExample,
    badge: null,
    price,
    submittedAge: `${age}h ago`,
    status,
  }));
}

export default async function Harness({
  params,
  searchParams,
}: {
  params: Promise<{ desk: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { desk } = await params;
  const sp = await searchParams;
  const empty = sp.empty === "1";
  /* `?fail=1` draws the review page's two failure states: a walkthrough that
     could not be signed and a listing with no pin. */
  const fail = sp.fail === "1";
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const identity = { name: "Admin", role: "Platform Operator", initial: "A", avatarUrl: null };

  let body: React.ReactNode = null;
  if (desk === "listings") {
    body = (
      <ListingsQueue
        title="Listings"
        sub="Review and manage all submitted listings."
        tabs={[
          { key: "all", label: "All", href: "#", on: true, count: empty ? 0 : 73 },
          { key: "SUBMITTED", label: "Waiting", href: "#", on: false, count: empty ? 0 : 28 },
          { key: "UNDER_REVIEW", label: "Under review", href: "#", on: false, count: 0 },
          { key: "MORE_INFO_REQUIRED", label: "More info needed", href: "#", on: false, count: empty ? 0 : 17 },
          { key: "APPROVED", label: "Approved", href: "#", on: false, count: empty ? 0 : 21 },
          { key: "PUBLISHED", label: "Live", href: "#", on: false, count: empty ? 64 : 0 },
          { key: "REJECTED", label: "Rejected", href: "#", on: false, count: empty ? 0 : 7 },
          { key: "SUSPENDED", label: "Suspended", href: "#", on: false, count: 0 },
        ]}
        rows={empty ? [] : rows()}
        statusLabel={(s: string) => listingStatusWord(s, ui.statusLabel)}
        counts={
          empty
            ? { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, MORE_INFO_REQUIRED: 0, APPROVED: 0, PUBLISHED: 0, REJECTED: 0, SUSPENDED: 0 }
            : { DRAFT: 0, SUBMITTED: 28, UNDER_REVIEW: 0, MORE_INFO_REQUIRED: 17, APPROVED: 21, PUBLISHED: 0, REJECTED: 7, SUSPENDED: 0 }
        }
        examples={empty ? 64 : 0}
        reviewTimes={
          empty
            ? { thisWeek: { decisions: 0, medianMinutes: null, meanMinutes: null }, lastWeek: { decisions: 0, medianMinutes: null, meanMinutes: null }, lastDecisionAt: null }
            : { thisWeek: { decisions: 41, medianMinutes: 504, meanMinutes: 520 }, lastWeek: { decisions: 30, medianMinutes: 870, meanMinutes: 900 }, lastDecisionAt: null }
        }
        page={1}
        hasNext={!empty}
        hrefForPage={() => "#"}
        mandates={
          <MandatesPanel
            day={ui.day}
            today="2026-09-23"
            queue={
              empty
                ? { counts: { pending: 0, approved: 0, rejected: 0 }, pending: [], decided: [] }
                : {
                    counts: { pending: 2, approved: 5, rejected: 1 },
                    pending: [
                      { id: "m1", listingId: "l1", listingTitle: "Three Bedroom Flat in Lekki Phase One", listingReference: null, kind: "letting", principalName: "Mrs Folake Adeyemi", principalPhone: "+2348012345678", exclusive: true, signedOn: "2026-09-01", expiresOn: "2027-09-01", hasDocument: true, status: "pending", rejectionReason: null, reviewedAt: null, createdAt: "2026-09-20T10:00:00Z" },
                      { id: "m2", listingId: "l2", listingTitle: "Plot in Bwari", listingReference: null, kind: "sale", principalName: "Mr Chinedu Okafor", principalPhone: null, exclusive: null, signedOn: null, expiresOn: null, hasDocument: false, status: "pending", rejectionReason: null, reviewedAt: null, createdAt: "2026-09-21T10:00:00Z" },
                    ],
                    decided: [
                      { id: "m3", listingId: "l3", listingTitle: "Duplex in Ikoyi", listingReference: "VL-3RP911", kind: "management", principalName: "Ikoyi Holdings Ltd", principalPhone: "+2348098765432", exclusive: false, signedOn: "2026-08-10", expiresOn: "2026-09-10", hasDocument: true, status: "rejected", rejectionReason: "The letter names a different address from the listing.", reviewedAt: "2026-09-18T10:00:00Z", createdAt: "2026-09-15T10:00:00Z" },
                    ],
                  }
            }
          />
        }
        empty={{
          title: "Nothing is waiting for review",
          body: "No listing has been decided here yet. A new submission appears here the moment a lister sends one.",
          cause: "Submissions come from the listing wizard, when an owner, an agent or a firm sends a property for review. The live listings today are examples, which are not reviewed here.",
          link: { href: "/admin/examples", label: "See the example listings" },
        }}
      />
    );
  } else if (desk === "review") {
      const listing = fail
      ? LISTING
      : {
          ...LISTING,
          /* A player with its poster and controls. The file is not a real
             walkthrough; with preload none nothing is fetched until play. */
          videos: [{ url: "/preview/session-b/admin-review/walkthrough.mp4", posterUrl: P + "living-room-dusk.webp", durationSeconds: 60 }],
        };
    body = (
      <ListingReview
        listing={listing}
        extras={{
          title: LISTING.title,
          status: "SUBMITTED",
          isDemo: false,
          amenities: ["Air conditioning", "Balcony", "Fitted kitchen", "Parking", "Security", "WiFi"],
          latitude: fail ? null : 6.4474,
          longitude: fail ? null : 3.47,
          availableFrom: "Immediately",
          lister: {
            userId: "00000000-0000-4000-8000-000000000001",
            name: "Tunde A.",
            role: "owner",
            avatarUrl: null,
            verified: true,
            badge: null,
            tier: 2,
            rungs: [
              { kind: "identity", status: "passed" },
              { kind: "payout", status: "passed" },
            ],
          },
          nextId: null,
        }}
        reference="LST-7K4M92"
        copy={t.admin.listings}
        locale={locale}
        sqm={t.catalogue.card.sqm}
        statusLabel={(s: string) => listingStatusWord(s, ui.statusLabel)}
        backHref="#"
        keepers={{ moveIn: t.moveIn, purchase: t.purchase }}
        actions={<ReviewActionBar listingId={LISTING.id} status="SUBMITTED" nextHref={null} queueHref="#" />}
      />
    );
  } else if (desk === "moderation") {
    const cat = (k: string) => (k === "uncategorised" ? "No reason chosen" : ui.columnLabel("reportCategory", k));
    const cats = ["off_platform_payment", "scam", "unsafe", "not_as_described", "unavailable", "offensive", "duplicate", "other"];
    const modRows = [
      ["house", "Listing", "RPT-7K4M92", "Tunde A.", "Member", "Scam", 2, "open", "Open"],
      ["feed", "Post", "@aisha", "Safety scan", "Automatic", "Held by the scan", 5, "HELD", "Held"],
      ["house", "Listing", "RPT-4Q8N56", "Emeka O.", "Member", "Offensive", 7, "reviewing", "In review"],
      ["user", "Bio", "@bolas", "Safety scan", "Automatic", "Held by the scan", 12, "HELD", "Held"],
      ["house", "Listing", "RPT-6T9K33", "Chioma K.", "Member", "Unsafe", 19, "open", "Open"],
      ["house", "Listing", "RPT-2P5M78", "David T.", "Member", "Scam", 24, "resolved", "Resolved"],
      ["feed", "Post", "RPT-8N4Q17", "Grace E.", "Member", "Not as described", 26, "resolved", "Resolved"],
      ["house", "Listing", "RPT-5K8P90", "Ifeanyi D.", "Member", "Duplicate", 48, "dismissed", "Dismissed"],
    ] as const;
    body = (
      <ModerationDesk
        tabs={[
          { key: "all", label: "All", href: "#", on: true },
          ...cats.map((c, i) => ({ key: c, label: ["Payment outside", "Scam", "Unsafe", "Not as described", "Unavailable", "Offensive", "Duplicate", "Other"][i] ?? c, href: "#", on: false })),
          { key: "held", label: "Held by the scan", href: "#", on: false },
        ]}
        categoryLabel={cat}
        summary={
          empty
            ? {
                openReports: 0, reviewingReports: 0, held: { posts: 0, stories: 0, comments: 0, bios: 0, events: 0 },
                olderThan24h: { reports: 0, held: 0 },
                byCategory: Object.fromEntries([...cats, "uncategorised"].map((c) => [c, 0])) as never,
                medianResponseMinutes: { thisWeek: null, lastWeek: null }, closedThisWeek: 0,
                newThisWeek: 0, newLastWeek: 0, newPerDay: new Array(14).fill(0),
              }
            : {
                openReports: 112, reviewingReports: 25, held: { posts: 3, stories: 1, comments: 2, bios: 1, events: 1 },
                olderThan24h: { reports: 3, held: 0 },
                byCategory: { off_platform_payment: 12, scam: 40, unsafe: 18, not_as_described: 29, unavailable: 8, offensive: 16, duplicate: 9, other: 5, uncategorised: 0 },
                medianResponseMinutes: { thisWeek: 156, lastWeek: 200 }, closedThisWeek: 58,
                newThisWeek: 96, newLastWeek: 117, newPerDay: [6, 8, 7, 9, 5, 8, 7, 10, 9, 12, 11, 14, 17, 20],
              }
        }
        rows={
          empty
            ? []
            : modRows.map(([icon, item, sub, reporter, rsub, reason, age, status, label], i) => ({
                id: `m-${i}`,
                icon,
                item,
                itemSub: sub,
                reporter,
                reporterSub: rsub,
                reason,
                age: `${age}h`,
                status,
                statusLabel: label,
                ...(status === "HELD" ? { tone: "warning" as const } : {}),
                body: <p className="nf-rv-msg">Fixture row.</p>,
              }))
        }
        empty={{
          title: "Nothing to moderate",
          body: "No report is open and the safety scan is holding nothing. When either changes it lands here, oldest first.",
          cause: "Members report from any listing, post or profile; the safety scan holds words as they are posted, and the author is told they are being checked.",
          link: { href: "/admin/queue?tab=reports", label: "See every report, including closed ones" },
        }}
        pager={empty ? null : <Pager page={1} hasNext hrefFor={() => "#"} />}
      />
    );
  } else if (desk === "kyc") {
    const names = ["Tunde A.", "Aisha B.", "Chinedu K.", "Grace M.", "Emeka J.", "Ngozi D."];
    const roles = ["Owner", "Agent", "Owner", "Agent", "Firm", "Agent"];
    body = (
      <VerificationDesk
        rows={
          empty
            ? []
            : names.map((name, i) => ({
                id: `k-${i}`,
                name,
                role: roles[i] ?? "Agent",
                tier: i % 3,
                rungsPassed: (i * 2) % 5,
                submitted: `24 Sept 2026, 0${9 - i}:12`,
                pending: i % 4 === 3 ? 0 : 1 + (i % 2),
                body: <p className="nf-rv-msg">Fixture row.</p>,
              }))
        }
        empty={{
          title: "No one has asked to be verified yet",
          body: "Sellers, landlords and agents verify here; renters and buyers are never asked. The first identity, address or business document uploaded appears in this queue immediately.",
          cause: "Documents arrive when an owner, an agent or a firm registers and proves who they are.",
          link: { href: "/admin/agents", label: "Open the applications desk" },
        }}
        summary={
          empty
            ? {
                awaiting: 0, awaitingLastWeek: 0, passedToday: 0, failedToday: 0, passedYesterday: 0, failedYesterday: 0,
                medianDecisionMinutes: { thisWeek: null, lastWeek: null }, decisionsThisWeek: 0,
                documents: { pending: 0, approved: 0, rejected: 0 },
                rungs: { identity: { passed: 0, failed: 0, pending: 0 }, address: { passed: 0, failed: 0, pending: 0 }, payout: { passed: 0, failed: 0, pending: 0 }, in_person: { passed: 0, failed: 0, pending: 0 } },
                recent: [],
              }
            : {
                awaiting: 42, awaitingLastWeek: 51, passedToday: 86, failedToday: 7, passedYesterday: 70, failedYesterday: 11,
                medianDecisionMinutes: { thisWeek: 134, lastWeek: 258 }, decisionsThisWeek: 212,
                documents: { pending: 42, approved: 86, rejected: 7 },
                rungs: { identity: { passed: 96, failed: 4, pending: 3 }, address: { passed: 70, failed: 8, pending: 6 }, payout: { passed: 88, failed: 12, pending: 2 }, in_person: { passed: 20, failed: 1, pending: 0 } },
                recent: [],
              }
        }
        recent={
          empty
            ? []
            : [
                { id: "r1", name: "Olamide S.", what: "Identity, NIN slip", approved: true, age: "2h ago" },
                { id: "r2", name: "Ibrahim M.", what: "Address, utility bill", approved: true, age: "3h ago" },
                { id: "r3", name: "Folashade T.", what: "Business, CAC certificate", approved: false, age: "4h ago" },
                { id: "r4", name: "Bello A.", what: "Identity, passport", approved: true, age: "5h ago" },
              ]
        }
      />
    );
  }

  return (
    <AdminFrame
      identity={identity}
      counts={{}}
      unread={0}
      navLabel="Console"
      navLabels={t.admin.nav}
      searchLabel="Search"
      bellLabel="Notifications"
    >
      {body}
    </AdminFrame>
  );
}
