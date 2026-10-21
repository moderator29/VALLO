import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { getLocale } from "@/lib/locale";
import { withNext } from "@/lib/auth/next-link";
import "@/app/css/home.css";

/**
 * The location row under the greeting (UIUX item 15): a QUIET row, no box,
 * with the pin, the place ("Lekki, Lagos") and the chevron that changes it.
 *
 * The city is read from the caller's own profile: their local government where
 * they have set one, otherwise their state. The chevron opens the screen that
 * changes it, so the label is never a dead label. When nobody has told us
 * where they are, the line says so plainly and the chip becomes the invitation
 * to answer, rather than the product guessing Lagos at somebody in Kano.
 */
/* A server component that reads its own words, so its four callers (home,
   stays and two harnesses) pass nothing new (Round 3 sweep, C3). */
export async function CityRow({
  label,
  context,
  isOwn,
  signedIn,
}: {
  label: string;
  context: string;
  isOwn: boolean;
  signedIn: boolean;
}) {
  const words = getDictionary(await getLocale()).experienceDiscover.home;
  const changeHref = signedIn ? "/settings/place" : withNext("/sign-in", "/settings/place");
  const shown = label || words.chooseCity;
  const visible = isOwn && context ? `${shown}, ${context}` : shown;

  /* The name carries the words the eye reads (WCAG 2.5.3, label in name):
     your own city is named with its context, as drawn; with no city of your
     own the drawn invitation is already the whole name, so no label covers
     it. */
  return (
    <Link
      href={changeHref}
      aria-label={isOwn ? words.yourCityAria.replace("{city}", visible) : undefined}
      className="nf-home__loc nf-home__loc--quiet nf-tap mt-inline"
    >
      <UiIcon name="location" size={20} className="nf-home__loc-pin" />
      <span className="nf-home__loc-name">
        {visible}
        {!isOwn && (
          <span className="nf-home__loc-sub">{words.setYours}</span>
        )}
      </span>
      <UiIcon name="chevron-down" size={20} className="nf-home__loc-chev" />
    </Link>
  );
}
