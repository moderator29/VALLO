"use server";

import { resolveSession } from "@/lib/actions/session";
import { identityOnFile, type IdentityOnFile } from "@/lib/identity/listing-verification-rule";

/**
 * WHAT A DOCUMENT BUTTON NEEDS TO KNOW ABOUT THE READER, and nothing more.
 *
 * The documentation pages are static, so the reader's state cannot be read
 * while they render. A button asks once, in the browser, and gets back two
 * facts: whether there is a session, and whether an identity document is on
 * file. It never returns an id, a name, a document status or anything a page
 * could print. "On file" is what the verification rule itself means by it
 * (`identityOnFile`); it is not a claim that the person has been verified by
 * a provider, and no button says so.
 */
export type DocViewer = { signedIn: boolean; identity: IdentityOnFile };

const SIGNED_OUT: DocViewer = { signedIn: false, identity: "none" };

export async function readDocViewer(): Promise<DocViewer> {
  try {
    const session = await resolveSession();
    if (session.state !== "signed-in") return SIGNED_OUT;
    const { data, error } = await session.supabase
      .from("agent_documents")
      .select("review_status")
      .eq("uploader_id", session.user.id)
      .eq("kind", "identity");
    if (error) return { signedIn: true, identity: "none" };
    const statuses = (data ?? []).map((row) => {
      const status = (row as { review_status?: unknown }).review_status;
      return typeof status === "string" ? status : null;
    });
    return { signedIn: true, identity: identityOnFile(statuses) };
  } catch {
    return SIGNED_OUT;
  }
}
