import { Dashboard } from "@/components/console/Dashboard";
import { PageHead } from "@/components/site/PageHead";
import { CHAIN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/dashboard",
  title: "Dashboard",
  description: `Mandates, executed agent actions with transaction links, rejected proposals with their reasons, and pause / revoke controls for DeleqMandateGuard on ${CHAIN.name}.`,
});

export default function DashboardPage() {
  return (
    <>
      <PageHead eyebrow="Dashboard" title="What the agent did, and what it was refused.">
        <p>Executed actions are rebuilt from the guard&apos;s events on {CHAIN.name}. Rejections never reach the chain, so they are kept from the pre-check. Pause or revoke from here.</p>
      </PageHead>
      <div className="wrap py-12 pb-24">
        <Dashboard />
      </div>
    </>
  );
}
