import { DocPage } from "@/components/docs/DocPage";
import { Introduction } from "@/components/docs/content/Start";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/docs",
  title: "Docs",
  description: `${BRAND.name} documentation: what it is, quickstart, concepts, console and dashboard guides, token check, smart contract reference, agent integration, HTTP API and security model.`,
});

export default function DocsHome() {
  return (
    <DocPage slug="">
      <Introduction />
    </DocPage>
  );
}
