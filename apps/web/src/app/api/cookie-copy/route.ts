import { NextResponse } from "next/server";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";

/**
 * The cookie sheet's words in the reader's language, fetched when the sheet is
 * opened from the footer or Settings (`CookieSettingsButton`), so those two
 * entry points ship no copy on every page. Public, no personal data, varies
 * with the language cookie.
 */
export async function GET() {
  const t = getDictionary(await getLocale());
  return NextResponse.json(t.cookies, { headers: { "cache-control": "private, max-age=3600", vary: "cookie" } });
}
