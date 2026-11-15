import { getDictionary } from "@vallo/i18n";
import { ControlRoomView } from "@/app/admin/control/ControlRoomView";
import { getLocale } from "@/lib/locale";
import type { ControlRoom } from "@/lib/admin/control/read";
import { SETUP_ITEMS, orderSetup, readConnections, readSwitches } from "@/lib/admin/control/setup";
import { ConsoleFrame } from "../bd/ConsoleFrame";

/**
 * The control room on the console frame, from recorded answers: the page is
 * `ControlRoomView` itself, fed what `readControlRoom` would return.
 * `?state=quiet` draws it with nothing waiting and everything in place.
 */
export const dynamic = "force-dynamic";

export default async function PreviewControlRoom({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const quiet = (await searchParams).state === "quiet";
  const room: Extract<ControlRoom, { state: "ok" }> = {
    state: "ok",
    setup: orderSetup(
      SETUP_ITEMS.map((item, i) => ({
        item,
        state: quiet ? "ready" : item.key === "staff_escalations" ? "waiting" : i === 4 ? "unknown" : "ready",
      })),
    ),
    switches: readSwitches([
      { key: "payments_protected_pay_on", enabled: false },
      { key: "payments_escrowpay_on", enabled: false },
      { key: "phone_confirmation", enabled: true },
      { key: "wallet", enabled: false },
      { key: "crypto_payments", enabled: false },
      { key: "restaurant_bill_pay", enabled: false },
      { key: "restaurant_deposits", enabled: true },
      { key: "dojah_identity", enabled: false },
      { key: "video_calls", enabled: true },
      { key: "assistant", enabled: true },
    ]),
    connections: readConnections({
      codesNigeria: true,
      codesAbroad: quiet,
      paymentPartner: quiet,
      paymentPartnerWebhook: quiet,
      cardPayments: true,
      email: true,
      copilot: true,
      onCallPage: quiet,
    }),
    waiting: quiet
      ? []
      : [
          { key: "escalations", count: 2, words: "2 escalations are waiting on you.", href: "/admin/escalations" },
          { key: "critical_alerts", count: 1, words: "1 critical alert is open.", href: "/admin/alerts" },
          { key: "access", count: 1, words: "1 staff access recommendation is waiting for your decision.", href: "/admin/overview" },
        ],
  };
  const t = getDictionary(await getLocale());
  return (
    <ConsoleFrame t={t}>
      <ControlRoomView room={room} />
    </ConsoleFrame>
  );
}
