import type { Metadata } from "next";
import { AiLegalPage } from "@/components/site/AiLegalPage";
import { AI_TERMS as doc } from "@/lib/legal/ai-assistant";

export const metadata: Metadata = {
  title: doc.title,
  description: doc.lede,
};

export default function AiDocPage() {
  return <AiLegalPage doc={doc} />;
}
