import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { profileSetupOwed } from "@/lib/first-run/profile-setup";
import { termsUpdateOwed } from "@/lib/legal/terms-update";
import { ProfileSetupSheets } from "./ProfileSetupSheets";

/**
 * The photo sheet, for a member with no profile photo who is not
 * inside the quiet window. Its own server component, so the reads run beside
 * the page and never hold the shell. The new-terms sheet goes first: both are
 * never stacked, and this one waits for a later visit.
 */
export async function ProfileSetupMount() {
  const owed = await profileSetupOwed();
  if (!owed) return null;
  if (await termsUpdateOwed()) return null;
  const t = getDictionary(await getLocale());
  return <ProfileSetupSheets copy={t.profileSetup} userId={owed.userId} />;
}
