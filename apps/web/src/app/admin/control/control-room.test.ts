import { describe, expect, it } from "vitest";
import { renderClient } from "@/lib/testing/render-client";

/**
 * THE CONTROL ROOM, READ AS THE FOUNDER READS IT: what is waiting comes first
 * in plain words, a part whose SQL has not run names its file, the parts in
 * place are folded away, and nothing on the page is a secret.
 */
async function render(waiting: boolean): Promise<string> {
  const html = await renderClient(`
    import { renderToStaticMarkup } from "react-dom/server";
    import { ControlRoomView } from "@/app/admin/control/ControlRoomView";
    import { SETUP_ITEMS, orderSetup, readConnections, readReach, readSwitches } from "@/lib/admin/control/setup";
    const waiting = ${waiting};
    const room = {
      state: "ok",
      setup: orderSetup(SETUP_ITEMS.map((item) => ({ item, state: waiting && item.key === "staff_escalations" ? "waiting" : "ready" }))),
      switches: readSwitches([{ key: "phone_confirmation", enabled: true }, { key: "wallet", enabled: false }]),
      connections: readConnections({ codesNigeria: true, codesAbroad: false, paymentPartner: false, paymentPartnerWebhook: false, cardPayments: true, email: true, copilot: true, onCallPage: false }),
      waiting: waiting ? [{ key: "escalations", count: 2, words: "2 escalations are waiting on you.", href: "/admin/escalations" }] : [],
      reach: readReach(!waiting),
    };
    export const html = () => renderToStaticMarkup(<ControlRoomView room={room} />);
  `);
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}

describe("the control room page", () => {
  it("says what is waiting, names the file to run, and folds away what is in place", async () => {
    const text = await render(true);
    expect(text).toContain("2 escalations are waiting on you.");
    expect(text).toContain("1 part is waiting for its SQL to be run.");
    expect(text).toContain("Waiting to be run");
    expect(text).toContain("pending/staff_escalations_2026-11-15.sql");
    expect(text).toMatch(/\d+ parts are in place/);
    expect(text).toContain("members abroad are not asked for a phone");
    expect(text).toContain("This page only reads; nothing here changes anything.");
    expect(text).toContain("meets a sign-in page first");
    expect(text).toContain("VALLO_PUBLIC_CATALOGUE");
    expect(text).toContain("Nothing on Vallo is closed to a country.");
  }, 120_000);

  it("says so when nothing is waiting and everything is in place", async () => {
    const text = await render(false);
    expect(text).toContain("Nothing is waiting on you right now.");
    expect(text).toContain("Every part listed here is in place on the live database.");
    expect(text).not.toContain("The file to run");
    expect(text).toContain("Anybody, anywhere, can read the listings");
  }, 120_000);
});
