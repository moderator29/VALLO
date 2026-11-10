import {
  CONDITION_CHOICES,
  FURNISHING_CHOICES,
  MAX_TITLE_LENGTH,
  MIN_TITLE_LENGTH,
  POWER_BACKUP_CHOICES,
  POWER_GRID_CHOICES,
  WATER_SUPPLY_CHOICES,
  asksFact,
  type PropertyType,
} from "@/lib/agent/listings-model";
import { kindOf, type Values } from "./model";

/**
 * "REWRITE FROM MY ANSWERS" (R18.11, pattern 15): a plain first version of the
 * title and the description, built from what the lister already told us. It
 * is deterministic and runs on the phone, so nothing leaves Vallo and nothing
 * is invented: every clause is one of the lister's own answers, and an answer
 * not given is a clause not written.
 *
 * NEVER THE STREET ADDRESS, THE LANDMARK OR THE GATE. The title is public
 * (STORE-16 warns when one carries a street), and the description is too, so
 * both name the area and the city and nothing nearer than that.
 *
 * English only for now, like the rest of the new words (`copy.ts`).
 */

/** The noun a title uses for a type: "flat" reads as a sentence where "Rental" does not. */
const NOUN: Record<PropertyType, string> = {
  apartment: "apartment",
  shortlet: "shortlet apartment",
  home: "house",
  villa: "villa",
  hotel: "hotel",
  rental: "flat",
  shop: "shop",
  office: "office space",
  land: "plot of land",
  restaurant: "restaurant",
};

type Answers = Pick<
  Values,
  | "intent"
  | "propertyType"
  | "area"
  | "city"
  | "bedrooms"
  | "bathrooms"
  | "toilets"
  | "parkingSpaces"
  | "sizeSqm"
  | "furnished"
  | "condition"
  | "powerGrid"
  | "powerBackup"
  | "powerBackupHours"
  | "waterSupply"
  | "prepaidMeter"
  | "minimumTenancyMonths"
>;

function where(answers: Answers): string {
  const area = answers.area.trim();
  const city = answers.city.trim();
  if (area && city && area.toLowerCase() !== city.toLowerCase()) return `${area}, ${city}`;
  return area || city;
}

function bedroomsWord(answers: Answers): string {
  if (!asksFact(answers.propertyType, "bedrooms")) return "";
  if (answers.bedrooms === 0) return "studio ";
  return `${answers.bedrooms} bedroom `;
}

function marketWord(answers: Answers): string {
  const kind = kindOf(answers);
  return kind === "sale" ? " for sale" : kind === "rent" ? " to let" : "";
}

/**
 * A working title: "3 bedroom flat to let in Lekki Phase 1, Lagos". Empty
 * until the place is known, because a title without a place is not one a
 * searcher can use. Clamped to the gate's bounds.
 */
export function titleFromAnswers(answers: Answers): string {
  const place = where(answers);
  if (!place) return "";
  const noun = NOUN[answers.propertyType] ?? "property";
  let title = `${bedroomsWord(answers)}${noun}${marketWord(answers)} in ${place}`;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > MAX_TITLE_LENGTH) title = title.slice(0, MAX_TITLE_LENGTH).trimEnd();
  return title.length >= MIN_TITLE_LENGTH ? title : "";
}

function lower(label: string | undefined): string {
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : "";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A first description, one plain sentence per answer group. `amenityLabels`
 * are the chosen amenities' names as the reader sees them.
 */
export function descriptionFromAnswers(answers: Answers, amenityLabels: readonly string[]): string {
  const kind = kindOf(answers);
  const place = where(answers);
  const noun = NOUN[answers.propertyType] ?? "property";
  const sentences: string[] = [];

  const opening = `${bedroomsWord(answers)}${noun}${marketWord(answers)}${kind === "stay" ? " for short stays" : ""}${place ? ` in ${place}` : ""}`;
  sentences.push(`A ${opening.trim()}.`.replace(/^A ([aeiou])/i, "An $1"));

  const rooms: string[] = [];
  if (asksFact(answers.propertyType, "bathrooms") && answers.bathrooms > 0) rooms.push(plural(answers.bathrooms, "bathroom", "bathrooms"));
  const toilets = Number(answers.toilets) || 0;
  if (asksFact(answers.propertyType, "toilets") && toilets > 0) rooms.push(plural(toilets, "toilet", "toilets"));
  const parking = Number(answers.parkingSpaces) || 0;
  if (asksFact(answers.propertyType, "parking") && parking > 0) rooms.push(`parking for ${plural(parking, "car", "cars")}`);
  if (rooms.length > 0) {
    const last = rooms.pop();
    sentences.push(`It has ${rooms.length > 0 ? `${rooms.join(", ")} and ${last}` : last}.`);
  }
  if (answers.sizeSqm.trim()) sentences.push(`The ${answers.propertyType === "land" ? "plot" : "floor area"} is about ${answers.sizeSqm.trim()} square metres.`);

  const furnished = FURNISHING_CHOICES.find((c) => c.value === answers.furnished)?.label;
  const condition = CONDITION_CHOICES.find((c) => c.value === answers.condition)?.label;
  if (furnished && condition) sentences.push(`It is ${lower(furnished)} and ${lower(condition)}.`);
  else if (furnished) sentences.push(`It is ${lower(furnished)}.`);
  else if (condition) sentences.push(`It is ${lower(condition)}.`);

  const grid = POWER_GRID_CHOICES.find((c) => c.value === answers.powerGrid);
  const backup = POWER_BACKUP_CHOICES.find((c) => c.value === answers.powerBackup);
  const hours = Number(answers.powerBackupHours) || 0;
  if (grid) {
    const backupClause =
      backup && answers.powerBackup !== "NONE"
        ? `, backed by ${lower(backup.label)}${hours > 0 ? ` for about ${plural(hours, "hour", "hours")} a day` : ""}`
        : "";
    sentences.push(`Power from the grid: ${lower(grid.blurb)}${backupClause}.`);
  } else if (backup && answers.powerBackup !== "NONE") {
    sentences.push(`Backup power from ${lower(backup.label)}${hours > 0 ? ` for about ${plural(hours, "hour", "hours")} a day` : ""}.`);
  }
  if (answers.prepaidMeter) sentences.push("There is a prepaid meter.");
  const water = WATER_SUPPLY_CHOICES.find((c) => c.value === answers.waterSupply);
  if (water) sentences.push(`Water: ${lower(water.blurb)}.`);

  if (amenityLabels.length > 0) {
    const list = [...amenityLabels];
    const last = list.pop();
    sentences.push(`You will find ${list.length > 0 ? `${list.join(", ")} and ${last}` : last} on the property.`);
  }

  const months = Number(answers.minimumTenancyMonths) || 0;
  if (kind === "rent" && months > 0) sentences.push(`The shortest tenancy is ${plural(months, "month", "months")}.`);

  sentences.push(
    kind === "stay"
      ? "Book on Vallo and the check-in details arrive once your booking is confirmed."
      : "Message me on Vallo to arrange a viewing.",
  );
  return sentences.join(" ");
}
