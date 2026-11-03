/**
 * registration: the zod schemas the SERVER validates with.
 *
 * Everything a client component may import (the constants, labels, limits,
 * copy and pure helpers) lives in `./registration-model` and is re-exported here, so a server
 * module still imports from this file as before. A client component imports
 * the model, never this file, because this file builds zod schemas at import
 * time and zod's classic API is 64 KB gzipped in every client chunk that
 * reaches it (W13, chunk 2008felnqkn1d).
 */

import { z } from "zod";
import { normalisePhone } from "@/lib/phone";
import { ACCEPT_PAY_REQUIRED, ACCEPT_TERMS_REQUIRED } from "@/lib/legal/workspace-acceptance";
import {
  ASSOCIATION_PROOFS,
  EXPERIENCE_BANDS,
  FEE_MAX_BPS,
  FEE_MIN_BPS,
  MAX_DECLARED_TEAM,
  OWNERSHIP_ANSWERS,
} from "./registration-model";
export * from "./registration-model";

const trimmed = z.string().trim();

const fullName = trimmed
  .min(2, "Tell us your name as it appears on your ID.")
  .max(120, "That is longer than a name we can file.");

const phone = trimmed
  .min(1, "We need a number that reaches you.")
  .refine((value) => normalisePhone(value) !== null, {
    message: "That does not look like a mobile number. Check the digits and the country beside them.",
  });

/**
 * The NIN, as eleven digits and nothing else.
 *
 * THE NUMBER ITSELF IS NEVER LOGGED, ANYWHERE. It travels from the field to
 * the row and stops. Nothing in this module, the action or the components
 * prints it, and the error messages describe the SHAPE rather than echoing the
 * value, which is the only way an error message can be safe with one of these.
 */
/* COMPULSORY for an owner and an agent (30 October 2026, the founder: "it is
   compulsory"). Said in words about the shape, never echoing the value. */
const nin = trimmed.regex(/^\d{11}$/, "Enter your 11-digit National Identity Number.");

/*
 * Ruling 6 (13 October 2026): every registration is sent with both ticks, the
 * Terms of Service and the Privacy Policy, and that every payment for a deal
 * happens inside Vallo. The action records them (`workspace-acceptance.ts`).
 */
const acceptance = {
  acceptTerms: z.literal(true, { message: ACCEPT_TERMS_REQUIRED }),
  acceptPayOnVallo: z.literal(true, { message: ACCEPT_PAY_REQUIRED }),
};

const feeBps = z
  .number()
  .int("A fee is a whole number of basis points.")
  .min(FEE_MIN_BPS, "A fee cannot be less than nothing.")
  .max(FEE_MAX_BPS, "A fee cannot be more than the whole rent. Check the figure.")
  .nullable();

export const ownerRegistrationSchema = z.object({
  role: z.literal("owner"),
  fullName,
  phone,
  nin,
  stateCode: trimmed.min(1, "Choose the state the property is in."),
  lgaCode: trimmed.min(1, "Choose the local government it sits in."),
  area: trimmed.max(120, "That is longer than a neighbourhood name.").optional().or(z.literal("")),
  /* Every answer is accepted, `none` exactly like the other five. */
  ownershipDocument: z.enum(OWNERSHIP_ANSWERS, {
    message: "Choose what you hold, or choose that you hold none of these.",
  }),
  /** The document itself, already uploaded into the private bucket. Optional:
      an owner may file the answer now and the paper later. */
  ownershipPath: trimmed.max(400).optional().or(z.literal("")),
  ...acceptance,
});

export const agentRegistrationSchema = z.object({
  role: z.literal("agent"),
  fullName,
  phone,
  nin,
  experience: z.enum(EXPERIENCE_BANDS, { message: "Choose how long you have been doing this." }),
  agencyFeeBps: feeBps,
  legalFeeBps: feeBps,
  /** Storage paths, already uploaded by the browser into the private bucket. */
  idPath: trimmed.max(400).optional().or(z.literal("")),
  selfiePath: trimmed.max(400).optional().or(z.literal("")),
  ...acceptance,
});

export const firmRegistrationSchema = z.object({
  role: z.literal("firm"),
  fullName,
  businessName: trimmed
    .min(2, "Give the registered name, as the CAC holds it.")
    .max(160, "That is longer than a registered name."),
  rcNumber: trimmed
    .min(2, "Give the RC or BN number on your certificate.")
    .max(40, "An RC number is shorter than that."),
  officeAddress: trimmed.min(4, "Where does the firm work from?").max(240),
  /*
   * A FIELD, AND ONLY A FIELD. Optional here, optional in the database, and
   * the copy states no requirement and no penalty, because what the law asks,
   * of whom, and what ignoring it costs are all unconfirmed from here.
   */
  lasreraNumber: trimmed.max(80).optional().or(z.literal("")),
  associationProof: z.enum(ASSOCIATION_PROOFS, {
    message: "Choose how you would like to show that you work here.",
  }),
  principalEmail: trimmed.max(160).optional().or(z.literal("")),
  letterPath: trimmed.max(400).optional().or(z.literal("")),
  team: z
    .array(
      z.object({
        name: trimmed.min(2, "Give the person's name.").max(120),
        email: trimmed.max(160).optional().or(z.literal("")),
      }),
    )
    .max(MAX_DECLARED_TEAM, "That is more colleagues than one application can carry.")
    .default([]),
  ...acceptance,
});

/**
 * The firm's two routes, each with the one thing it needs.
 *
 * Cross field rather than per field because neither answer is required on its
 * own: a letter makes the email pointless and a principal makes the upload
 * pointless, and marking both required would refuse every honest applicant.
 */
export const firmRegistrationRefined = firmRegistrationSchema.superRefine((value, ctx) => {
  if (value.associationProof === "principal") {
    const email = value.principalEmail ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({
        code: "custom",
        path: ["principalEmail"],
        message: "We need an address we can write to, so your principal can confirm you.",
      });
    }
  }
  if (value.associationProof === "letter" && !(value.letterPath ?? "")) {
    ctx.addIssue({
      code: "custom",
      path: ["letterPath"],
      message: "Upload the letter, or choose to have your principal confirm you instead.",
    });
  }
});

export type OwnerRegistration = z.infer<typeof ownerRegistrationSchema>;

export type AgentRegistration = z.infer<typeof agentRegistrationSchema>;

export type FirmRegistration = z.infer<typeof firmRegistrationSchema>;

export const registrationSchema = z.discriminatedUnion("role", [
  ownerRegistrationSchema,
  agentRegistrationSchema,
  firmRegistrationSchema,
]);

export type Registration = z.infer<typeof registrationSchema>;
