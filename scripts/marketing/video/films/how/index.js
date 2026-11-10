/*
 * Video One, "How Vallo works".
 *
 * TWO CUTS, NOT ONE REFLOWED. `main` is the phone film. `desk` is the
 * desktop film, and it is a different film: it shows the product on a
 * desktop, in a browser, with desktop pages and a cursor. The founder's
 * ruling, 14 October: "the desktop screenshots for the videos should be
 * desktop, not mobile in desktop shape".
 */
const film = new URLSearchParams(location.search).get("film") === "desktop" ? "desktop" : "mobile";
export const SCENES = film === "desktop" ? ["desk"] : ["main"];
