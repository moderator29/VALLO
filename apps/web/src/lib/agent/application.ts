"use server";

/**
 * Agent application submission.
 *
 * Validation is real and runs on the server. When Supabase is configured and the
 * applicant is signed in, the application is persisted to agent_applications
 * under Row Level Security as a SUBMITTED row, and the generated VL-AGT-#####
 * reference is returned. When Supabase is not configured, or the user is not
 * signed in, this returns a plain, honest message rather than a fake approval
 * (Master Rule 8). The client keeps the draft in local storage either way, so
 * nothing the applicant typed is lost (Master Rule 57, never lose a draft).
 *
 * DOCUMENTS. The wizard uploads each file straight from the browser into the
 * private agent-documents bucket under `<auth uid>/<batch>/...`, which storage
 * RLS restricts to that user's own folder, and then hands this action the paths.
 * Nothing here trusts those strings: every one must live under the caller's own
 * uid prefix or the whole submission is refused, so a crafted path cannot claim
 * somebody else's object. The rows are written through the applicant's own
 * client, under the same RLS that guards reading them.
 *
 * Documents are REQUIRED, and that is the point of the feature. An application
 * with no identity document cannot be verified by anybody, so accepting one
 * would mean filling the admin queue with items no reviewer can action. Before
 * this, the files never left the browser at all and every application arrived
 * showing zero documents.
 */

import { normalisePhone } from "../phone";
import { createClient } from "../supabase/server";
import { accountSetupOwed, SETUP_OWED_MESSAGE } from "../actions/session";
import { isSupabaseConfigured } from "../supabase/env";

export type ApplicationField =
  | "firstName"
  | "lastName"
  | "phone"
  | "idType"
  | "idNumber"
  | "businessName"
  | "rcNumber"
  | "state"
  | "city"
  | "address"
  | "bankName"
  | "accountNumber"
  | "accountName"
  | "agreeTerms"
  | "acceptTerms"
  | "acceptPayOnVallo"
  | "documents";

export type ApplicationResult = {
  ok: boolean;
  message?: string;
  reference?: string;
  fieldErrors?: Partial<Record<ApplicationField, string>>;
};

/*
 * The phone rule is shared now, and this file was the reason it had to be.
 *
 * It carried `/^(\+?234|0)\d{10}$/`, which accepts `01234567890`: eleven
 * digits beginning zero, no Nigerian network on earth, and the agent whose
 * verification documents were about to be reviewed passed with a number
 * nobody could ring. Meanwhile the guest booking form applied a stricter rule
 * from `lib/bookings/schema.ts`, so the platform held two different opinions
 * about the same number. `lib/phone.ts` is now the only one.
 */

import { DOCUMENT_KINDS, STORED_DOCUMENT_KIND, type DocumentKind } from "./application-document-kinds";
import { OPEN_STATUSES } from "./open-application";
import { otherSideMessage } from "./role-lock";
import { otherSideHeld } from "./role-lock-read";
import { ACCEPT_PAY_REQUIRED, ACCEPT_TERMS_REQUIRED, withWorkspaceAcceptance } from "../legal/workspace-acceptance";

type UploadedDocument = { kind: DocumentKind; path: string };

/**
 * Read the uploaded document manifest the wizard sends as one JSON field.
 *
 * Anything malformed is treated as "no documents" rather than throwing, because
 * a broken manifest must produce the same honest field error as an empty one,
 * never a crash on a form somebody spent ten minutes filling in.
 */
function readManifest(raw: string): UploadedDocument[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: UploadedDocument[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== "object") continue;
    const kind = (item as Record<string, unknown>)["kind"];
    const path = (item as Record<string, unknown>)["path"];
    if (typeof kind !== "string" || typeof path !== "string") continue;
    if (!DOCUMENT_KINDS.includes(kind as DocumentKind)) continue;
    if (path.length === 0 || path.length > 400) continue;
    out.push({ kind: kind as DocumentKind, path });
  }
  return out;
}

export async function submitAgentApplication(
  _prev: ApplicationResult,
  formData: FormData,
): Promise<ApplicationResult> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const fieldErrors: ApplicationResult["fieldErrors"] = {};

  const isBusiness = get("agentType") === "business";

  const required: ApplicationField[] = [
    "firstName",
    "lastName",
    "phone",
    "idType",
    "idNumber",
    "state",
    "city",
    "address",
    "bankName",
    "accountNumber",
    "accountName",
  ];
  for (const f of required) {
    if (!get(f)) fieldErrors[f] = "This field is required.";
  }

  // A business applicant is claiming a registered company, so the registration
  // details are not optional for them. They are not asked of an individual.
  if (isBusiness) {
    if (!get("businessName")) fieldErrors.businessName = "This field is required.";
    if (!get("rcNumber")) fieldErrors.rcNumber = "This field is required.";
  }

  const phone = get("phone");
  if (phone && normalisePhone(phone) === null) {
    fieldErrors.phone =
      "That does not look like a mobile number. Check the digits and the country beside them.";
  }

  const account = get("accountNumber");
  if (account && !/^\d{10}$/.test(account)) {
    fieldErrors.accountNumber = "A Nigerian account number is 10 digits.";
  }

  if (formData.get("agreeTerms") !== "on") {
    fieldErrors.agreeTerms = "You must accept the agent terms to continue.";
  }
  /* Ruling 6 (13 October 2026): the Terms of Service and the Privacy Policy,
     and that every payment for a deal happens inside Vallo, both ticked. */
  if (formData.get("acceptTerms") !== "on") fieldErrors.acceptTerms = ACCEPT_TERMS_REQUIRED;
  if (formData.get("acceptPayOnVallo") !== "on") fieldErrors.acceptPayOnVallo = ACCEPT_PAY_REQUIRED;

  const documents = readManifest(get("documents"));
  const has = (kind: DocumentKind) => documents.some((d) => d.kind === kind);
  if (!has("idFront") || !has("idBack")) {
    fieldErrors.documents =
      "Upload both sides of your ID. We cannot verify an agent without seeing it.";
  } else if (isBusiness && !has("registration")) {
    fieldErrors.documents =
      "Upload your CAC registration certificate so we can verify the business.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Validation passed. Persist if we can.
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message:
        "Your details are valid, but the platform is not connected yet. " +
        "Your progress is saved on this device and nothing was lost.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message:
        "Your details are valid. Please sign in to submit your application. " +
        "Your progress is saved on this device.",
    };
  }

  /* B-2: a Google or Apple account finishes setting up (terms + 18+) before
     it files anything. */
  if (await accountSetupOwed(supabase, user)) {
    return {
      ok: false,
      message: `${SETUP_OWED_MESSAGE} Your progress is saved on this device.`,
    };
  }

  // Every path must sit under this caller's own folder. Storage RLS enforces the
  // same rule on the upload itself, so a path that fails here was never written
  // by this user and has no business being recorded against their application.
  const prefix = `${user.id}/`;
  if (documents.some((d) => !d.path.startsWith(prefix) || d.path.includes(".."))) {
    return {
      ok: false,
      fieldErrors: {
        documents:
          "Those uploads did not come from your own account, so we did not file them. Please choose the files again.",
      },
    };
  }

  /* One open application per person (`open-application.ts`). The Submit
     button is disabled once this form has filed, but a second visit to the
     form filed a second row behind the first. A read that fails does not
     block a filing. */
  const { data: open } = await supabase
    .from("agent_applications")
    .select("reference")
    .eq("user_id", user.id)
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) {
    return {
      ok: false,
      message:
        `You already have an application waiting, filed as ${open.reference}. ` +
        "Follow that one from your profile; a second would only queue behind it.",
    };
  }

  /* The professional application makes an agent: an owner's account cannot
     file it (`role-lock.ts`). */
  const held = await otherSideHeld(supabase, user.id, "agent");
  if (held) return { ok: false, message: otherSideMessage(held) };

  // Resolve the state name from the form to its canonical code.
  const stateName = get("state");
  const { data: stateRow } = await supabase
    .from("states")
    .select("code")
    .eq("name", stateName)
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from("agent_applications")
    .insert({
      user_id: user.id,
      // The wizard has always asked individual or business and this action
      // always filed "individual" regardless, silently discarding the answer
      // along with both registration fields.
      type: isBusiness ? "business" : "individual",
      status: "SUBMITTED",
      full_name: `${get("firstName")} ${get("lastName")}`.trim(),
      phone,
      email: user.email ?? null,
      residential_address: get("address"),
      state_code: stateRow?.code ?? null,
      city: get("city"),
      id_type: get("idType"),
      id_number: get("idNumber"),
      business_name: isBusiness ? get("businessName") : null,
      business_rc: isBusiness ? get("rcNumber") : null,
      bank_name: get("bankName"),
      account_number: account,
      account_name: get("accountName"),
      agree_terms: true,
      submitted_at: new Date().toISOString(),
      /* Ruling 6: recorded with each version and the moment, as the host
         publish step records its agreement (pending migration pov07). */
      consents: withWorkspaceAcceptance(null, new Date().toISOString()),
    } as never)
    .select("id, reference")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      message:
        "We could not file your application just now. Your progress is saved on " +
        "this device, so you can try again shortly.",
    };
  }

  const documentWrite = await supabase.from("agent_documents").insert(
    /* `uploader_id` is what `agent_documents_insert_own` compares with
       auth.uid(); without it the insert is refused by RLS as well. */
    documents.map((d) => ({
      application_id: inserted.id,
      uploader_id: user.id,
      kind: STORED_DOCUMENT_KIND[d.kind],
      storage_path: d.path,
    })),
  );

  // The application is filed and that is real, so this is not reported as a
  // failure. But an application a reviewer cannot open the documents for is
  // stuck, so the applicant is told plainly rather than left to find out by
  // waiting. Support can attach them by hand from the reference.
  if (documentWrite.error) {
    return {
      ok: true,
      reference: inserted.reference,
      message:
        `Application ${inserted.reference} submitted, but your documents did not attach. ` +
        "Please contact support with that reference and we will add them for you.",
    };
  }

  return {
    ok: true,
    reference: inserted.reference,
    message: `Application ${inserted.reference} submitted. We review within 24 to 48 hours.`,
  };
}
