import { notFound } from "next/navigation";
import { DocPage } from "@/components/docs/DocPage";
import { ConsoleGuide, DashboardGuide, TokenCheckGuide } from "@/components/docs/content/Guides";
import { AgentRef, ApiRef, Changelog, ContractRef, FaqRef, SecurityRef } from "@/components/docs/content/Reference";
import { Concepts, Quickstart } from "@/components/docs/content/Start";
import { DOC_PAGES, docBySlug } from "@/lib/docs/nav";
import { pageMeta } from "@/lib/seo";

const CONTENT: Record<string, () => React.ReactNode> = {
  quickstart: Quickstart,
  concepts: Concepts,
  console: ConsoleGuide,
  dashboard: DashboardGuide,
  "token-check": TokenCheckGuide,
  contract: ContractRef,
  agent: AgentRef,
  api: ApiRef,
  security: SecurityRef,
  faq: FaqRef,
  changelog: Changelog,
};

export const dynamicParams = false;
export function generateStaticParams() {
  return DOC_PAGES.filter((p) => p.slug).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = docBySlug(slug);
  return p ? pageMeta({ path: `/docs/${slug}`, title: `${p.title} · Docs`, description: p.description }) : {};
}

export default async function DocSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const Body = CONTENT[slug];
  if (!Body || !docBySlug(slug)) notFound();
  return (
    <DocPage slug={slug}>
      <Body />
    </DocPage>
  );
}
