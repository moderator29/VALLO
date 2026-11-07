import { cookies } from "next/headers";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolvePasscodeGate } from "@/lib/passcode/state";
import { PASSCODE_OFFER_COOKIE, passcodeOfferShows } from "./passcode-offer";
import { PasscodeOfferCard } from "./PasscodeOfferCard";

/**
 * THE OFFER ON THE HOME SCREEN (P0.1, 6 November 2026). The founder: "the app
 * don't need by default to turn on passcode ... it should be like a small long
 * notification message in top dashboard like a alert and then can remove it
 * like the x". Draws nothing for a signed-out visitor, a member who already
 * has a passcode, or one who closed it in the last 60 days. Never blocks.
 */
export async function PasscodeOffer() {
  let gate = "open";
  try {
    gate = (await resolvePasscodeGate()).view.kind;
  } catch {
    return null;
  }
  const snoozed = (await cookies()).get(PASSCODE_OFFER_COOKIE)?.value === "1";
  if (!passcodeOfferShows({ gate, snoozed })) return null;
  const copy = getDictionary(await getLocale()).protect;
  return (
    <PasscodeOfferCard
      title={copy.offerTitle}
      body={copy.offerBody}
      action={copy.offerAction}
      dismiss={copy.offerDismiss}
    />
  );
}
