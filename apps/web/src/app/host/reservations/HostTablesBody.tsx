import { countOf, getDictionary, type Dictionary, type Locale } from "@vallo/i18n";
import { EmptyState } from "@/components/app/Screen";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { HostReservationsBoard } from "./ReservationsBoard";
import { longDayLabel } from "./desk";
import type { HostTableBoard } from "./board";
import { DepositSettingsCard } from "./DepositSettingsCard";
import type { DeskDeposits } from "@/lib/reservations/deposit-settings";

/**
 * The desk, apart from its reads, so the whole screen can be drawn from
 * fixtures in the preview harness (`/preview/restaurant-desk`) and read at 390
 * and 1280, light and dark. The route passes exactly what it read; nothing
 * here fetches anything.
 */
export function HostTablesBody({
  board,
  unavailable = false,
  copy = getDictionary("en").hostWorkspace,
  words = getDictionary("en").experienceHost,
  desk = getDictionary("en").tableDesk,
  locale = "en",
  now = new Date(),
  billsOn = false,
  deposits = null,
  depositWords = getDictionary("en").tableDeposits.desk,
}: {
  /**
   * D75: the restaurant's deposit settings, read on the server only while
   * `restaurant_deposits` is on (`readDeskDeposits`); null draws no card and
   * no deposit line, which is the desk exactly as it was.
   */
  deposits?: DeskDeposits | null;
  /** `tableDeposits.desk` in the reader's language; English in the previews. */
  depositWords?: Dictionary["tableDeposits"]["desk"];
  board: HostTableBoard | null;
  /** True when the read itself failed. A dropped read is not an empty venue. */
  unavailable?: boolean;
  /** The host workspace words in the reader's language; English in the previews. */
  copy?: Dictionary["hostWorkspace"];
  /** The page's own words in the reader's language; English in the previews. */
  words?: Dictionary["experienceHost"];
  /** The desk's words (`tableDesk`) in the reader's language; English in the previews. */
  desk?: Dictionary["tableDesk"];
  /** The reader's language, for the counts; English in the previews. */
  locale?: Locale;
  /** The instant the desk is cut at (Lagos today). The route's render time; fixed in the previews. */
  now?: Date;
  /** Whether a bill can be taken through Vallo yet. Off until Paystack is configured. */
  billsOn?: boolean;
}) {
  /* Every state sits under the Grade 1 page frame: the large title with
     Back, so the desk always has its heading and its one way back. */
  if (unavailable || board === null) {
    return (
      <PageFrame title={words.screens.tables} fallback="/host" width="wide">
        <EmptyState
          icon="concierge-bell"
          title={copy.reservations.failedTitle}
          body={copy.reservations.failedBody}
          action={
            <ButtonLink href="/host/reservations" variant="primary" size="lg">
              {words.tryAgain}
            </ButtonLink>
          }
        />
      </PageFrame>
    );
  }

  if (board.total === 0) {
    /*
      NOTHING HAS EVER ARRIVED HERE, which is not the same as a cleared queue
      and must not be dressed as one. It says what will appear and what puts
      it here, and it states the two facts a venue most needs to be sure of: a
      table costs nobody anything, and nothing is held for a guest until the
      venue itself says yes.
    */
    return (
      <PageFrame title={words.screens.tables} fallback="/host" width="wide">
      <div>
        <EmptyState
          icon="concierge-bell"
          title={copy.reservations.emptyTitle}
          body={copy.reservations.emptyBody}
          action={
            <ButtonLink href="/host" variant="secondary" size="lg">
              {words.tablesYourVenue}
            </ButtonLink>
          }
        />
        {deposits ? (
          <div className="mt-block">
            <DepositSettingsCard deposits={deposits} words={depositWords} locale={locale} />
          </div>
        ) : null}
      </div>
      </PageFrame>
    );
  }

  const waiting =
    board.requests.length === 0 ? words.tablesNothingWaiting : countOf(board.requests.length, "requestsWaiting", locale);

  return (
    <PageFrame title={words.screens.tables} subtitle={waiting} fallback="/host" width="wide">
      <div>
      <HostReservationsBoard
        framed
        board={board}
        words={desk}
        locale={locale}
        now={now.toISOString()}
        billsOn={billsOn}
        title={{ heading: words.screens.tables, line: waiting, date: longDayLabel(now) }}
        depositLines={deposits ? depositWords.line : null}
      />
      {deposits ? (
        <div className="mt-block">
          <DepositSettingsCard deposits={deposits} words={depositWords} locale={locale} />
        </div>
      ) : null}
      </div>
    </PageFrame>
  );
}
