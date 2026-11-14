/**
 * The words a refused caller reads on a staff desk's page. The same four
 * sentences the console's guard gives (`lib/admin/guard.ts`), kept here as
 * plain strings so a server component can print them without importing the
 * server-only guard.
 */
export type DeskRefusalState = "unconfigured" | "signed-out" | "not-admin" | "step-up";

export function deskRefusal(state: DeskRefusalState): string {
  switch (state) {
    case "unconfigured":
      return "We cannot reach the console right now. This is on our side, not yours. Nothing has been lost. Try again in a few minutes.";
    case "signed-out":
      return "Sign in with your operations account to continue.";
    case "step-up":
      return "Confirm it is you to open the console. Nothing was changed.";
    default:
      return "This area is for the Vallo operations team. Your account does not carry that role.";
  }
}
