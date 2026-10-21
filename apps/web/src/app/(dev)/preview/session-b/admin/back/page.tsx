// Admin console harness, behind the preview gate. The real
// AdminFrame and the real BackButton, rendered as they render on /admin/money,
// so a browser can find the control and press it.
import { getDictionary } from "@vallo/i18n";
import { AdminFrame } from "@/app/admin/_components/AdminFrame";
import { PageHead } from "@/app/admin/_components/panels";
import { BackButton } from "@/components/site/BackButton";
import { COUNTS, IDENTITY } from "../fixtures";
import { AsDesk } from "./AsDesk";

export const dynamic = "force-dynamic";

export default function Page() {
  const t = getDictionary("en");
  return (
    <AsDesk path="/admin/money">
      <AdminFrame
        identity={IDENTITY}
        counts={COUNTS}
        unread={2}
        navLabel="Admin console"
        navLabels={t.admin.nav}
        searchLabel="Search"
        bellLabel="Notifications"
        back={<BackButton fallback="/admin" label={t.common.back} className="nf-admin-back" />}
      >
        <PageHead title="Money" lede="Rendered as /admin/money: the back arrow goes to this desk's declared parent." />
      </AdminFrame>
    </AsDesk>
  );
}
