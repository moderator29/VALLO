import "server-only";

import { guideSource, screenSource } from "./help";
import { propertySource } from "./listings";
import { personalSource } from "./personal";
import { placeSource } from "./places";
import { roommateSource } from "./roommates";
import { communitySource, personSource, postSource } from "./social";
import { restaurantSource, staySource } from "./stays";
import type { Source } from "./types";

/** Every retriever, in the contract's kind order. */
export const SOURCES: readonly Source[] = [
  placeSource,
  propertySource,
  staySource,
  restaurantSource,
  roommateSource,
  personSource,
  communitySource,
  postSource,
  screenSource,
  guideSource,
  personalSource,
];
