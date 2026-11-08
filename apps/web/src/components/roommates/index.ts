/**
 * VALLO ROOMMATES, THE VISUAL KIT (FE-A). Server safe pieces; each takes the
 * `roommates` dictionary slice as `t` (a server page:
 * `getDictionary("en").roommates`; a client island:
 * `useScopedCopy("roommates")`).
 */
export { RoommateCardView, RoomCardView, RoommateCardSkeleton, RoomCardSkeleton } from "./Cards";
export { PersonFace, FaceStack, MatchRing, MatchBadge, MatchReasons, BadgesRow, LifestyleChips, KindTag, VerifiedChip, type FaceSize } from "./Marks";
export { RoommatesHero, JourneyTiles, JOURNEY_HREF, StatTiles, TrustTiles, HowItWorks, SectionHead, RoommatesEmpty, CardGrid, CardRail } from "./Home";
export { MatchPanel, CostBreakdown } from "./Panels";
export {
  type RoommatesCopy,
  fill,
  counted,
  naira,
  nairaPer,
  budgetText,
  monthlyHint,
  dayText,
  moveInText,
  placeText,
  availableText,
  lifestyleFacts,
  institutionKind,
  lagosDay,
  LIFESTYLE_ICON,
  BADGE_ICON,
  AMENITY_ICON,
} from "./format";
export { STATE_OPTIONS, stateName } from "./states";
