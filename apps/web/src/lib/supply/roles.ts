import { VERIFICATION_ORDER, type RungDefinition } from "@/lib/trust/verification";
import { getDictionary } from "@vallo/i18n";

/**
 * THE SUPPLY SIDE, AS DATA. ONE VOCABULARY, READ BY EVERY SURFACE.
 *
 * Built the way `lib/trust/verification.ts` is built, for the reason that file
 * gives at its head: a ladder whose public description and internal checklist
 * are written separately ends up promising a reader something the reviewer
 * never looked at. The same is true of a role. Before this module there were
 * THREE role vocabularies in the tree and they disagreed with each other:
 *
 *   `components/roles/roles.ts`   renter | owner | professional, mapped onto
 *                                 `agents.type`, so a landlord and a one
 *                                 person letting agency were the same database
 *                                 row and were told on screen they were
 *                                 different things.
 *   `public.signup_role`          five values that the migration itself says
 *                                 "confer nothing".
 *   `verification_is_required`    gates verification on that self declared
 *                                 enum.
 *
 * And the AI assistant's system prompt described a verification ladder with a
 * phone rung, which has never existed, and omitted the payout rung, which is
 * the only automated one we have. One hardcoded paragraph, already wrong,
 * already shipped. That is what a second copy of this vocabulary costs.
 *
 * Client safe: it imports one other data module and nothing else, so the same
 * values reach the server, the browser, the assistant's prompt and the specs.
 *
 * ---------------------------------------------------------------------------
 * TWO PERSON ROLES AND THREE LISTING VALUES, AND THAT IS NOT AN INCONSISTENCY
 *
 * A firm's proof set is a SUPERSET of an individual agent's: identity and
 * mandate, plus incorporation and proof of association. A superset is a BRANCH
 * IN A FORM, not a role, and this codebase already implements exactly that
 * branch twice (`components/verification/kyc.ts` `stepsFor`, and
 * `lib/agent/application.ts`). Owner and agent are kinds of PERSON; a firm is
 * an ORGANISATION, already modelled as a `businesses` row with `kind` of
 * `agency` and a registration ladder of its own.
 *
 * But three values belong at the LISTING level, because "listed by the owner",
 * "listed by Chidi Okeke, agent" and "listed by Acme Properties Ltd" are three
 * different offers, and telling them apart is the whole point of the exercise
 * for the person searching.
 *
 * NO FOURTH ROLE, now or later. A developer's relation to what it sells is
 * OWNER plus an off plan disclosure, and `build_condition = 'off_plan'`
 * already exists. A property manager's relation is AGENT with a management
 * mandate. Both are a mandate kind and a flag.
 *
 * ---------------------------------------------------------------------------
 * OWNERSHIP IS A PROPERTY OF A PAIR, NEVER OF A PERSON
 *
 * `agents.user_id` is `not null unique`, so a role column on a person alone
 * makes a man who owns one flat and agents another unrepresentable. The person
 * axis answers "what kind of supply account is this"; the pair axis, a person
 * and a property, answers "what is this person to THIS property". This module
 * names both and conflates neither.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS NOT HERE, AND IT IS DELIBERATE
 *
 * No statutory figure, no penalty, no percentage and no regulator's fee
 * schedule. `docs/research/ROLE_ARCHITECTURE_RESEARCH.md` reaches every
 * Nigerian legal claim through a search index rather than a primary source and
 * its honesty log says so, and the LASRERA and tenancy numbers wait on a
 * lawyer's confirmation. So LASRERA is named here as a
 * field a person may fill in and as a thing a reader may filter on, and the
 * copy never states what the law requires or what it costs to ignore. The
 * ledger's "needs the founder" section carries the rest.
 */

/* -------------------------------------------------------------- the person */

/**
 * What kind of supply account a person runs on the property side.
 *
 * Two values, not three, and the reasoning is at the head of this file.
 */
export const SUPPLY_ROLES = ["owner", "agent"] as const;

export type SupplyRole = (typeof SUPPLY_ROLES)[number];

export function isSupplyRole(value: string | null | undefined): value is SupplyRole {
  return value === "owner" || value === "agent";
}

/* ------------------------------------------------------------- the listing */

/**
 * What the lister is to THIS property, which is what a searcher filters on.
 *
 * Three values here and two on the person, deliberately.
 */
export const LISTING_ROLES = ["owner", "agent", "firm"] as const;

export type ListingRole = (typeof LISTING_ROLES)[number];

export function isListingRole(value: string | null | undefined): value is ListingRole {
  return value === "owner" || value === "agent" || value === "firm";
}

/**
 * THE PERSON ROLE AN APPROVED APPLICATION BECOMES, AND IT IS THE FUNCTION THAT
 * WAS MISSING AT THE DOOR.
 *
 * `agent_applications.supply_role` carries what a person said they were on one
 * of the three forms: `owner`, `agent` or `firm`. `agents.role` carries two
 * values, because a firm is an ORGANISATION and the person running it is an
 * agent with a firm behind them. Something has to narrow three onto two, and
 * until today nothing did: the approval path in `lib/admin/actions.ts` upserted
 * an `agents` row with `type` and `status`, granted `user_roles.role = 'agent'`
 * and DISCARDED THE ROLE AT THE DOOR. Three forms filed three different
 * applications and the database could not tell them apart afterwards. An
 * approved owner became an "agent" row.
 *
 * The narrowing is written here, once, rather than at the call site, so that
 * the second caller cannot do it differently from the first. That is the same
 * reason `workspaceKindFor` in `registration.ts` exists.
 *
 * WHY NULL BECOMES `agent` AND NOT `owner`. A null `supply_role` is an
 * application filed before `20260922170000` added the column, and every one of
 * those came through the six step agent application. Answering `agent` says
 * what actually happened. Answering `owner`, or refusing to answer, would
 * invent a fact about a person, which rule 15 forbids and which the backfill in
 * migration 1 of this set refused for the same reason.
 */
export function personRoleFrom(applied: string | null | undefined): SupplyRole {
  return applied === "owner" ? "owner" : "agent";
}

/**
 * The firm an approved application asks to be attached to, if it asks at all.
 *
 * Only the firm door does. Stated as its own function so a caller reading
 * `personRoleFrom` does not have to remember that `firm` collapsed into
 * `agent` and that something else has to carry the organisation.
 */
export function appliedAsFirm(applied: string | null | undefined): boolean {
  return applied === "firm";
}

/* ------------------------------------------------------------ the workspace */

/**
 * The kinds of workspace one account can hold, across both sides.
 *
 * A WORKSPACE is not a role. It is a place a person works from, and the role
 * is what it resolves into when they stand in it. `owner`, `agent` and `firm`
 * are the property side's three doors; `host` is the stays side, unchanged;
 * `console` is staff.
 *
 * `personal` is not in this list on purpose. Personal is the absence of a
 * workspace, the state every account is in, and giving it a kind alongside the
 * others would invite somebody to write a form for it.
 */
export const WORKSPACE_KINDS = ["owner", "agent", "firm", "host", "console"] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export function isWorkspaceKind(value: string | null | undefined): value is WorkspaceKind {
  return (WORKSPACE_KINDS as readonly string[]).includes(value ?? "");
}

/**
 * Which side of the product a workspace belongs to.
 *
 * The console spans both and is filed under property because that is where its
 * shell lives today. It is stated rather than inferred so the switch sheet's
 * grouping cannot drift from the coin.
 */
export const WORKSPACE_SIDE: Record<WorkspaceKind, "property" | "stays"> = {
  owner: "property",
  agent: "property",
  firm: "property",
  host: "stays",
  console: "property",
};

/* ------------------------------------------------------------- the standing */

/**
 * What the platform has decided about a workspace, as the switch sheet says
 * it.
 *
 * EVERY ONE OF THESE IS SELECTABLE AND NONE OF THEM IS HIDDEN. A person whose
 * application was refused must be able to see that it was refused, and a
 * person who has been suspended and cannot find out why is the exact failure
 * the suspension design exists to prevent.
 *
 * `active` carries no label at all. A workspace in good standing says nothing
 * about its standing, because a badge on the normal state teaches nobody
 * anything and makes the abnormal states harder to see.
 */
export const WORKSPACE_STANDINGS = [
  "active",
  "pending",
  "refused",
  "suspended",
  "draft",
] as const;

export type WorkspaceStanding = (typeof WORKSPACE_STANDINGS)[number];

export type StandingCopy = {
  /**
   * The words on the row, or null for the normal state.
   *
   * TEXT, never colour alone. Three of these five states are bad news and a
   * reader who cannot see colour must get the same news.
   */
  label: string | null;
  /** One line under the label saying what it means for them right now. */
  meaning: string | null;
  /**
   * Whether the row can be selected. True for all five, always, and typed as a
   * field rather than left implicit so that a later change has to argue with
   * this comment first.
   */
  selectable: true;
};

/** SW11: source of truth is now `packages/i18n/src/locales/workspace.en.ts`. */
const _ws = getDictionary("en").workspaceStanding;
export const WORKSPACE_STANDING_COPY: Record<WorkspaceStanding, StandingCopy> = {
  active: { ..._ws.active, selectable: true },
  draft: { ..._ws.draft, selectable: true },
  pending: { ..._ws.pending, selectable: true },
  refused: { ..._ws.refused, selectable: true },
  suspended: { ..._ws.suspended, selectable: true },
};

/* ------------------------------------------------------------------- copy */

export type SupplyDoor = {
  /** The switch sheet's row title, and the chooser's card title. */
  title: string;
  /** ONE line. It sits under the title on a 390px phone and may not wrap to three. */
  blurb: string;
  /** How the person would say it about themselves, in the first person. */
  whoItIsFor: string;
  /** What this role could get wrong, which is why its proof is what it is. */
  whatCanGoWrong: string;
  /** What we therefore ask it to prove. */
  thereforeProve: string;
  /**
   * What the form will ask for, itemised.
   *
   * A paragraph is read once and forgotten; the same facts as a checklist can
   * be CHECKED, which is what somebody deciding whether to start actually
   * wants to do.
   */
  needs: readonly string[];
  /** Roughly how long, honestly, for the chooser's overview panel. */
  howLong: string;
};

/**
 * The three property side doors, in the order the chooser lists them.
 *
 * Owner first, and that ordering is the whole brief: most of the supply this
 * platform now wants is landlords who are not agents and never will be, and
 * until today the only door into the supply side was marked "become an agent".
 */
/*
 * THE FIRM DOOR IS NOT OFFERED, AND ITS COPY BELOW IS KEPT FOR THE DAY IT IS.
 * Approving a firm application makes one agent: nothing creates the agency
 * business, a `firm_members` row or `agents.firm_id`, and no listing can say
 * "listed by <firm>". A door promising that is a door with nothing behind it,
 * so the chooser lists the two that are real and `/profile/setup/firm` sends
 * a firm's principal to the agent form, which is what approval gave them.
 */
export const SUPPLY_DOOR_ORDER: readonly WorkspaceKind[] = ["owner", "agent"] as const;

export const SUPPLY_DOORS: Record<"owner" | "agent" | "firm", SupplyDoor> = {
  owner: {
    title: "I own the property",
    blurb: "List it yourself. No agency fee.",
    whoItIsFor:
      "The property is mine. I want to let it or sell it myself, with the enquiries coming to me.",
    whatCanGoWrong:
      "Somebody lets or sells a property that is not theirs, takes a year of rent, and disappears. The property is real; the person has no right to it.",
    thereforeProve: "That this person has a documented interest in this property.",
    needs: [
      "Your name, phone number and where you live",
      "A government issued ID, or your NIN",
      "Whatever you hold on the property, and there is an honest answer if you hold nothing",
      "A Nigerian bank account in your own name",
    ],
    howLong: "About five minutes.",
  },
  agent: {
    title: "I am an agent",
    blurb: "You act for owners and charge a fee.",
    whoItIsFor: "I list and let property for other people, and I charge a fee.",
    whatCanGoWrong:
      "Somebody with no instruction advertises a flat they have seen, collects inspection and agency fees from four people for it, and remits nothing. That is the runaround.",
    thereforeProve:
      "That this person is who they say, and that the owner instructed them about this property.",
    needs: [
      "Your name, phone number and where you live",
      "A government issued ID, or your NIN",
      "Proof of your address, dated within three months",
      "Your fees, in the open, where a tenant can read them",
      "A Nigerian bank account in your own name",
    ],
    howLong: "About ten minutes.",
  },
  firm: {
    title: "We are a registered firm",
    blurb: "An agency with staff and a CAC number.",
    whoItIsFor: "I work for, or I run, a registered real estate business.",
    whatCanGoWrong:
      "A letterhead. An unregistered outfit calling itself a limited company, whose staff each collect their own fee.",
    thereforeProve:
      "That the company exists and is in good standing, and that this person speaks for it.",
    needs: [
      "Everything an agent gives us, about you",
      "The registered name and RC number, as the CAC holds them",
      "The CAC certificate",
      "Something showing you work there, unless a colleague here admits you",
    ],
    howLong: "About fifteen minutes, and less if your firm is already on Vallo.",
  },
};

/**
 * The stays side's three doors.
 *
 * The same control, the same sheet, three different doors, which is the
 * founder's ruling. The host model itself is untouched: `lib/host/onboarding.ts`
 * already carries the three host types and their document specs, and this is
 * the chooser's copy for them and nothing more.
 */
export const STAYS_DOOR_ORDER = ["hotel", "shortlet", "restaurant"] as const;

export type StaysDoorId = (typeof STAYS_DOOR_ORDER)[number];

export const STAYS_DOORS: Record<StaysDoorId, { title: string; blurb: string }> = {
  hotel: { title: "We are a hotel", blurb: "Rooms, rates and a front desk." },
  shortlet: { title: "I run a shortlet", blurb: "One place or a few, let by the night." },
  restaurant: { title: "We are a restaurant", blurb: "Tables, hours and a menu." },
};

/* ------------------------------------------------- what a reader is told */

/**
 * The sentence a listing shows a reader, per listing role.
 *
 * `{name}` is the lister or the firm. The listing card, the listing page, the
 * map pin and the filter drawer all read these, and none of them holds its own
 * copy.
 */
export const LISTING_ROLE_SENTENCE: Record<ListingRole, string> = {
  owner: "Listed by the owner",
  agent: "Listed by {name}, agent",
  firm: "Listed by {name}",
};

/** The filter drawer's own label for each value, shorter than the sentence. */
export const LISTING_ROLE_FILTER_LABEL: Record<ListingRole, string> = {
  owner: "Owner direct",
  agent: "Agent",
  firm: "Registered firm",
};

/**
 * What the drawer calls the question these three answer.
 *
 * Here rather than in `packages/i18n` for the same reason the labels above are
 * here: the three values, the sentence, the short label and the heading are
 * one vocabulary, and this module exists because there were three of them in
 * the tree disagreeing with each other. A heading kept somewhere else is the
 * fourth.
 */
export const LISTING_ROLE_FILTER_HEADING = "Who is offering it";

/**
 * The three dated facts, on three different subjects.
 *
 * NONE OF THEM IS A RUNG. `private.agent_tier` counts over a fixed four
 * element array and five surfaces read the tier, so inserting a rung would
 * renumber everybody silently and change what "Fully verified" means for
 * people who earned it under the old numbering. These attach beside the
 * ladder, not inside it.
 *
 * Every one is DATED, for the reason the listing migration already gives about
 * the two timestamps it created: an inspection from two years ago is not the
 * same statement as one from last week. `{date}` is filled by the caller.
 */
export type DatedFact = {
  /** Whose fact it is. Three subjects, never conflated. */
  subject: "person" | "business" | "property";
  label: string;
  /** What the reader is told, in full, with the disclaimer where one is owed. */
  meaning: string;
};

export const DATED_FACTS = {
  registration: {
    subject: "business",
    label: "Registration checked",
    meaning: "{name} is registered with the CAC. We checked the record on {date}.",
  },
  ownership: {
    subject: "property",
    label: "Ownership document seen",
    meaning:
      "The lister showed us a document in their name for this address on {date}. We are not a land registry and this is not advice on the title.",
  },
  mandate: {
    subject: "property",
    label: "Mandate checked",
    meaning: "We saw a written instruction from the owner and spoke to them on {date}.",
  },
} as const satisfies Record<string, DatedFact>;

/**
 * What a listing says while a proof is in but unchecked.
 *
 * Publishing is allowed in both of these states. The listing says exactly
 * where it stands and the mark stays dark, which is worth more than a badge
 * that lies.
 */
/** SW11: source of truth is now `packages/i18n/src/locales/supply-roles.en.ts`. */
const _sr = getDictionary("en").supplyRoles;
export const PROOF_PENDING_COPY = _sr.proofPending;

/**
 * THE ANSWER THAT KEEPS NINE OWNERS IN TEN IN THE PRODUCT.
 *
 * Over ninety seven per cent of Nigerian land sits outside the formal
 * register, and the national survey found 71.4 per cent of sampled landlords
 * hold no title document at all. A form that requires a Certificate of
 * Occupancy excludes roughly nine owners in ten, which would destroy the
 * supply side this whole direction exists to build.
 *
 * So "I have none of these" is a FIRST CLASS ANSWER. It reaches a published
 * listing. It simply never earns the words "ownership verified", and the
 * listing says which rung it is on rather than hiding that there is a ladder.
 *
 * Neither figure appears in this string, because both rest on a search summary
 * rather than a primary source and a lawyer confirms them before any number
 * becomes copy. What ships is the behaviour, which needs no citation.
 */
export const NO_DOCUMENT_ANSWER = {
  label: _sr.noDocumentLabel,
  reassurance:
    "That is a normal answer in Nigeria and it does not stop you listing. Your listing goes live the same way; it just will not carry the ownership mark until you can show us something.",
} as const;

/* -------------------------------------------------- the ladder, once only */

/**
 * The verification ladder as one sentence, built from the ladder itself.
 *
 * THIS EXISTS SO THE ASSISTANT CANNOT DRIFT AGAIN. The system prompt at
 * `app/api/assistant/route.ts` told every user the ladder was "phone, then
 * identity document, then address, then a physical inspection". There is no
 * phone rung and there never was, and the payout rung, the strongest automated
 * check the platform has, was missing from what it said. A system prompt is a
 * hardcoded string by nature, so the fix is a mechanism rather than a habit:
 * the paragraph is BUILT from `VERIFICATION_ORDER` at module load, and the
 * moment a rung changes the sentence changes with it.
 */
export function ladderSentence(): string {
  const rungs = VERIFICATION_ORDER.map((rung: RungDefinition) => rung.label.toLowerCase());
  const last = rungs[rungs.length - 1];
  return `${rungs.slice(0, -1).join(", ")} and then ${last}`;
}

/**
 * The roles and the ladder as one paragraph, for any surface that needs prose:
 * the assistant, the help centre, the in product docs.
 */
/**
 * THE THREE DOORS AS ONE SENTENCE, FOR A SURFACE THAT CAN ONLY HOLD PROSE.
 *
 * The help centre, the careers cross link, the contact page and the in product
 * docs all used to send a landlord to a page marked "Become an agent" and then
 * describe the six step agent application as the only route in. A landlord with
 * one flat in Bwari is not becoming an agent and never will be, and being shown
 * that door is why the supply side of this platform has exactly one `agents`
 * row in it.
 *
 * They are all plain strings rather than components, so they cannot render the
 * chooser's cards. This builds the same three titles into a sentence FROM
 * `SUPPLY_DOORS`, so those four surfaces read the one vocabulary instead of
 * each keeping a paraphrase of it. Rename a door and all four change.
 */
export function doorsSentence(): string {
  const titles = SUPPLY_DOOR_ORDER.map(
    (id) => SUPPLY_DOORS[id as "owner" | "agent" | "firm"].title.toLowerCase(),
  );
  return `${titles.slice(0, -1).join(", ")} or ${titles[titles.length - 1]}`;
}

/** Where the three doors are, named once so four surfaces cannot disagree. */
export const SUPPLY_DOOR_HREF = "/profile/setup";

export function supplyPrimer(): string {
  return [
    "Vallo does not remove the agent, it removes the runaround.",
    "On the property side a supplier is either an owner listing their own place or an agent acting for owners, and an agent may have a registered firm behind them.",
    /*
     * THIS SENTENCE WAS FALSE, TWO AI SYSTEM PROMPTS WERE SAYING IT, AND IT IS
     * TRUE AGAIN AS OF TODAY.
     *
     * It read, and reads again: "A listing says which of the three it came
     * from, so a person searching can tell them apart." When it was written
     * `listings.listing_role` did not exist, so no listing said anything of the
     * kind, and this primer is spliced into the system prompt of both
     * `api/assistant/route.ts` and `api/support/route.ts`. Every user who asked
     * either of them how Vallo works was told a fact about the product that the
     * product did not have. It was then weakened to a claim about what the
     * database records, which was true and said nothing to a reader.
     *
     * WHAT CLOSED IT. Track G migration 3 added the column and every row
     * carries it. `ListerRoleLine` has rendered the three sentences on the
     * listing page's agent card since the same week. What was missing was the
     * middle: the listing READ never selected the column, so the value never
     * reached the prop. `lib/listings/supabase-repository.ts` now selects
     * `listing_role` in both reads and maps it through `isListingRole` onto
     * `Listing.listerRole`, and `app/(app)/listing/[id]/page.tsx` hands it to
     * the card. Rendered against a row, the page prints "Listed by the owner"
     * with `data-role="owner"` on it. That is the sentence on a screen, which
     * is what this claim is about and what no test of a constant could show.
     *
     * WHAT IS STILL SHORT, SAID HERE SO THE NEXT PERSON DOES NOT HAVE TO FIND
     * IT. The agent and firm sentences NAME the lister, and the public listing
     * read carries no name: `agents` is RLS-bound to the agent and to staff,
     * correctly, so a stranger has no path from `agent_id` to a display name.
     * `fillLister` refuses to print a template with its placeholder showing, so
     * those two draw no line until a name reaches the card. The owner sentence,
     * which needs no name and is the distinction this whole direction exists
     * for, is on the screen today. Carrying the lister's public name is the
     * next mile and it needs a migration, not a prop.
     */
    "A listing says which of the three it came from, so a person searching can tell them apart.",
    `Every supplier climbs the same four rung ladder: ${ladderSentence()}.`,
    "A rung not reached is drawn as not reached, with what it would take. Nothing is hidden and nothing is implied.",
  ].join(" ");
}
