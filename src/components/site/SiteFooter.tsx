import Link from "next/link";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { CONTRACTS, guardLive } from "@/config/contracts";
import { UNISWAP_V3 } from "@/config/dex";
import { Wordmark } from "@/components/site/Mark";
import { CaBox } from "@/components/site/CaCopy";

/* The reference's footer: near-black, wordmark + one line, mono column heads, quiet links, a status line with a blinking dot. */
export function SiteFooter() {
  return (
    <footer className="ft">
      <div className="wrap pb-10 pt-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <Wordmark size={28} />
            <p className="mt-4 max-w-[340px] text-[13.6px] leading-[1.6] text-[var(--faint)]">
              {BRAND.slogan} {BRAND.tagline}
            </p>
            <div className="mt-5 max-w-[460px]">
              <CaBox testid="footer-ca" />
            </div>
          </div>
          <div>
            <h3>Product</h3>
            <ul className="mt-4 grid gap-2">
              <li>
                <Link className="l" href="/console">
                  Console
                </Link>
              </li>
              <li>
                <Link className="l" href="/dashboard">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link className="l" href="/method">
                  Method &amp; limits
                </Link>
              </li>
              <li>
                <Link className="l" href="/token">
                  {BRAND.symbol}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Chain</h3>
            <ul className="mt-4 grid gap-2">
              <li>
                <a className="l" href={CHAIN.explorer} target="_blank" rel="noreferrer">
                  {CHAIN.name} explorer
                </a>
              </li>
              <li>
                <a className="l" href={`${CHAIN.explorer}/address/${UNISWAP_V3.swapRouter02}`} target="_blank" rel="noreferrer">
                  SwapRouter02
                </a>
              </li>
              <li>
                {guardLive() ? (
                  <a className="l" href={`${CHAIN.explorer}/address/${CONTRACTS.guard}`} target="_blank" rel="noreferrer">
                    DeleqMandateGuard
                  </a>
                ) : (
                  <Link className="l" href="/method#contract">
                    DeleqMandateGuard (not deployed yet)
                  </Link>
                )}
              </li>
            </ul>
          </div>
          <div>
            <h3>Connect</h3>
            <ul className="mt-4 grid gap-2">
              <li>
                <a className="l" href={BRAND.x} target="_blank" rel="noreferrer">
                  X {BRAND.xHandle}
                </a>
              </li>
              {hasGithub ? (
                <li>
                  <a className="l" href={BRAND.github} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </li>
              ) : null}
              <li>
                <a className="l" href="/llms.txt">
                  llms.txt
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-12 max-w-[900px] text-[12px] leading-[18px] text-[var(--faint)]">
          {BRAND.name} is an independent prototype on {CHAIN.name}, not affiliated with Robinhood or with any token, router or venue it reads. Limits reduce what an agent
          can do; they do not make its trades good ones. Nothing here is financial advice.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5 font-mono text-[11px] tracking-[0.12em] text-[var(--faint)] uppercase">
          <span>© 2026 {BRAND.name}</span>
          <span className="inline-flex items-center gap-2">
            <i className="status-dot" aria-hidden="true" /> Funds stay in your wallet
          </span>
        </div>
      </div>
    </footer>
  );
}
