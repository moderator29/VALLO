/** A calendar date in UTC, the same on the server and in the browser. */
export function AnnouncementDate({ iso }: { iso: string }) {
  return <>{iso.slice(0, 10)}</>;
}
