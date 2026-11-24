import { ConsoleApp } from "@/components/console/ConsoleApp";
import { PageHead } from "@/components/site/PageHead";
import { BRAND, CHAIN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/console",
  title: "Console",
  description: `Set an agent mandate (tokens, per-transaction and daily caps, recipients, routers, expiry) and check a proposal against it and against the token's code on ${CHAIN.name}, before anything is signed. Practice mode needs no wallet.`,
});

export default function ConsolePage() {
  return (
    <>
      <PageHead eyebrow="Console" title="Set the limits. Check the proposal.">
        <p>
          Practice mode runs the guard&apos;s rules on sample data in your browser, with a live token check from {CHAIN.name}. On chain, the same proposal is asked of
          DeleqMandateGuard itself. {BRAND.name} never holds your tokens.
        </p>
      </PageHead>
      <div className="wrap py-12 pb-24">
        <ConsoleApp />
      </div>
    </>
  );
}
