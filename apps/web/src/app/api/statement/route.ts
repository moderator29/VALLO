import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/actions/session";
import { parseHistoryRows, type HistoryEntry } from "@/lib/money/history-model";
import { statementCsv } from "@/lib/money/statement";
import { consume } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" } as const;
/** Twenty pages of fifty: a thousand movements, far beyond anybody's statement here. */
const PAGES = 20;
const PAGE = 50;

/**
 * GET /api/statement: the signed-in member's own payments as a CSV.
 *
 * Read with the member's OWN client only (`my_payments_history` reads
 * `auth.uid()` itself), never the service role, so it cannot hold anybody
 * else's row. Paced, never cached, served as an attachment.
 */
export async function GET(): Promise<NextResponse> {
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return NextResponse.json({ error: "Sign in to download your statement." }, { status: session.state === "unconfigured" ? 503 : 401, headers: NO_STORE });
  }
  const paced = await consume({ bucket: "statement_csv", subject: `user:${session.user.id}`, limit: 10, windowSeconds: 3_600 });
  if (!paced.allowed) {
    return NextResponse.json(
      { error: `You have downloaded your statement a few times just now. Try again ${paced.retryIn}.` },
      { status: 429, headers: { ...NO_STORE, "retry-after": String(paced.retryAfterSeconds) } },
    );
  }

  const rows: HistoryEntry[] = [];
  let before: string | null = null;
  for (let i = 0; i < PAGES; i += 1) {
    const { data, error } = await session.supabase.rpc("my_payments_history" as never, { p_limit: PAGE, p_before: before } as never);
    if (error) return NextResponse.json({ error: "Your statement could not be read just now. Try again in a moment." }, { status: 503, headers: NO_STORE });
    const page = parseHistoryRows(data);
    if (!page) return NextResponse.json({ error: "Your statement could not be read just now. Try again in a moment." }, { status: 503, headers: NO_STORE });
    rows.push(...page);
    if (page.length < PAGE) break;
    before = page[page.length - 1]?.occurredAt ?? null;
    if (!before) break;
  }

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(statementCsv(rows), {
    status: 200,
    headers: {
      ...NO_STORE,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vallo-statement-${day}.csv"`,
      "x-content-type-options": "nosniff",
    },
  });
}
