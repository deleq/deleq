import Link from "next/link";
import { CaBox } from "@/components/site/CaCopy";
import { PageHead, StatusBadge } from "@/components/site/PageHead";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  path: "/token",
  title: `${BRAND.symbol} token`,
  description: `${BRAND.symbol} on ${BRAND.chainName}: contract address${TOKEN.isLive ? "" : " (published at launch)"}, the planned use, and what it is not. Mandates and checks never need it.`,
});

export default function TokenPage() {
  return (
    <>
      <PageHead eyebrow={BRAND.symbol} title={`${BRAND.symbol}. Not needed to set a limit.`}>
        <p>
          {BRAND.tokenName} ({BRAND.symbol}) is planned for {CHAIN.name}. Mandates, the guard, the checks and the dashboard all work without it. It is a memecoin with a planned
          use, not a share of anything and not a promise of value.
        </p>
      </PageHead>
      <div className="wrap grid grid-cols-1 gap-6 py-12 pb-24 lg:grid-cols-2">
        <section className="panel panel-b" data-testid="token-ca">
          <h2 className="display h-card flex items-center gap-3">
            <img src="/brand/mark-tile.webp" alt={`${BRAND.symbol} logo`} width={44} height={44} className="block shrink-0" data-testid="token-logo" />
            Contract address
          </h2>
          <p className="small mt-3">
            {TOKEN.isLive
              ? `The only ${BRAND.symbol} contract on ${CHAIN.name}. Copies with the same name can exist; check the address.`
              : `Not launched yet. The address is published here and on X ${BRAND.xHandle} at launch; any address shared before that is not ours.`}
          </p>
          <CaBox testid="ca-token" className="mt-6 w-full" />
          <p className="mt-4 text-[13px] text-[var(--muted)]">
            Network: {CHAIN.name} (chain {CHAIN.id}), gas paid in {CHAIN.nativeSymbol}. {TOKEN.isLive ? "" : "Launchpad: TBA. "}We never send direct messages first.
          </p>
        </section>
        <section className="panel panel-b" id="utility">
          <h2 className="display h-card flex flex-wrap items-center gap-3">
            Planned use <StatusBadge status="Concept" />
          </h2>
          <ul className="small mt-4 grid list-disc gap-2 pl-5">
            <li>Advanced risk checks before an agent trades a token (planned).</li>
            <li>Alerts when a mandate nears its cap, is paused, or a listed token changes its code (planned).</li>
          </ul>
          <p className="small mt-4">
            Neither exists yet, and launching the token does not create them. Mandates, the guard and the basic token check stay usable without {BRAND.symbol}. No yield, no revenue
            share, no price promise, not advice.
          </p>
          <Link href="/console" className="btn btn-blue mt-6">
            <span className="gl">Use the console without it</span>
          </Link>
        </section>
      </div>
    </>
  );
}
