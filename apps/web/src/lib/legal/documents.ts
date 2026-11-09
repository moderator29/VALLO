import type { UiIconName } from "@/design-system/icons/UiIcon";
import { DISCLAIMER_UPDATED_ISO, PRIVACY_UPDATED_ISO, TERMS_UPDATED_ISO } from "./versions";

/**
 * EVERY LEGAL AND POLICY DOCUMENT, IN ONE LIST (DOCS_AND_PRESENCE_UPGRADE.md
 * 2.2 and 8): the /legal index draws it as cards, and anything else that
 * lists the documents reads it from here, so a document is never added in one
 * place and forgotten in another. `updated` is the document's own version date
 * where it has one.
 */
export type LegalDocumentEntry = {
  href: string;
  icon: UiIconName;
  title: string;
  /** One plain sentence: what a reader finds inside. */
  description: string;
  updated?: string;
};

export const LEGAL_DOCUMENTS: LegalDocumentEntry[] = [
  {
    href: "/terms",
    icon: "file-text",
    title: "Terms of service",
    description: "The agreement between you and Vallo, including what Vallo does and does not do.",
    updated: TERMS_UPDATED_ISO,
  },
  {
    href: "/privacy",
    icon: "shield-lock",
    title: "Privacy policy",
    description: "What we collect, why, who processes it, and how to download or delete it.",
    updated: PRIVACY_UPDATED_ISO,
  },
  {
    href: "/disclaimer",
    icon: "info",
    title: "Disclaimer",
    description: "What a marketplace can and cannot promise about the places and people on it.",
    updated: DISCLAIMER_UPDATED_ISO,
  },
  {
    href: "/cancellations",
    icon: "calendar-check",
    title: "Cancellations and refunds",
    description: "When a booking can be cancelled, what comes back, and how long a refund takes.",
  },
  {
    href: "/community",
    icon: "users",
    title: "Community promise",
    description: "How everyone on Vallo agrees to treat each other, without discrimination.",
  },
  {
    href: "/standards",
    icon: "certificate",
    title: "Listing standards",
    description: "What a listing must show and be before it goes live.",
  },
  {
    href: "/safety",
    icon: "shield-check",
    title: "Safety",
    description: "How to view, agree and pay with care, and what to do when something feels wrong.",
  },
  {
    href: "/host-agreement",
    icon: "concierge-bell",
    title: "Host agreement",
    description: "The terms a hotel, shortlet, guest house or restaurant agrees to when it hosts on Vallo.",
  },
  {
    href: "/ai/terms",
    icon: "bot",
    title: "Vallo Assistant terms",
    description: "How the assistant works, what it may do for you, and what it never does.",
  },
  {
    href: "/eula",
    icon: "document",
    title: "App licence",
    description: "The licence for the Vallo apps on iPhone and Android.",
  },
];
