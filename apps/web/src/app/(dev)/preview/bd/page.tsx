import Link from "next/link";

const PAGES = [
  ["reservations", "Reservation oversight on the console frame"],
  ["alerts", "Alerts with inventory drift on the console frame"],
  ["refunds", "The refund console on the console frame"],
  ["payments", "The payment-method lookup panel on the console frame"],
  ["pipeline", "The Business development pipeline table on the console frame"],
];

export default function PreviewBD() {
  return (
    <main className="nf-shell py-section">
      <h1 className="nf-h2">BD surfaces</h1>
      <ul className="mt-md flex flex-col gap-xs">
        {PAGES.map(([slug, label]) => (
          <li key={slug}>
            <Link className="nf-link-quiet text-[var(--nf-content-link)]" href={`/preview/bd/${slug}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
