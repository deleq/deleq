"use client";

import Link from "next/link";
import { BRAND, CHAIN } from "@/config/brand";
import { guardLive } from "@/config/contracts";
import { CaBox } from "@/components/site/CaCopy";
import { useChain } from "@/components/home/useChain";
import { ago } from "@/lib/format";

/** The reference's giant outlined watermark, drawn from Deleq's own D-bracket mark. */
export function Watermark({ className = "watermark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="0.35">
      <path d="M5 4h11.5a12 12 0 0 1 0 24H5z" />
      <path d="M10 9v14h6.5a7 7 0 0 0 0-14z" />
      <rect x="12.5" y="14.6" width="8.5" height="2.8" />
      <path d="M2 4h1M2 28h1M29.5 16h1" />
    </svg>
  );
}

const gwei = (wei: string | null) => (wei ? `${(Number(BigInt(wei)) / 1e9).toFixed(4)} GWEI` : "—");

/** Bottom strip of the hero: where the reference scrolls headlines, Deleq scrolls live chain facts and its own rules. */
function Ticker() {
  const { data } = useChain(20_000);
  const live = [
    `${CHAIN.name} block ${data?.block ? data.block.toLocaleString("en-US") : "—"}`,
    `Gas ${gwei(data?.gasPriceWei ?? null)}`,
    `ETH / USD ${data?.ethUsd ? `$${data.ethUsd.price.toLocaleString("en-US", { maximumFractionDigits: 2 })} (Chainlink, ${ago(data.ethUsd.updatedAt)})` : "—"}`,
    guardLive() ? "DeleqMandateGuard live" : "DeleqMandateGuard not deployed yet",
    "Per-tx cap · daily cap (UTC) · allowlists · pause · revoke",
    "Funds stay in the owner's wallet",
    "Native ETH not supported in v1: wrap to WETH",
  ];
  const strip = (
    <span>
      {live.map((t, i) => (
        <span key={i}>
          <b>{t}</b>
          <span aria-hidden="true">•</span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="ticker" data-testid="ticker">
      <div className="ticker-in">
        {strip}
        <span aria-hidden="true">{strip}</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero on-blue" data-testid="hero">
      <Watermark />
      <div className="wrap hero-in">
        <h1 className="display h-hero max-w-[1000px]">
          Delegate
          <br />
          with Limits.
        </h1>
        <p className="hero-sub mt-8">{BRAND.tagline} Give a trading agent a mandate instead of your keys, and every action is checked before it can move a token.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/console" className="btn btn-dark" data-testid="hero-console">
            <span className="gl">Open the console</span>
          </Link>
          <Link href="/method" className="btn btn-ghost">
            <span className="gl">Read the method</span>
          </Link>
        </div>
        <div className="mt-8 max-w-[520px]">
          <CaBox testid="hero-ca" />
        </div>
      </div>
      <Ticker />
    </section>
  );
}
