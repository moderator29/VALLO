/* Video Two, "The Vallo vision": TWO CUTS. `main` is the phone film; `desk` is the desktop film, shot on the site in a browser. */
export const SCENES = new URLSearchParams(location.search).get("film") === "desktop" ? ["desk"] : ["main"];
